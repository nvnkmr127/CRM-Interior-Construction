const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Auth API', () => {
  jest.setTimeout(30000);
  let accessToken;
  let testTenantId;
  let testUserToken;
  let testRefreshToken;

  const cleanupTestTenant = async () => {
    try {
      const existing = await pool.query("SELECT id FROM tenants WHERE slug = 'test-deact-ws'");
      if (existing.rows.length > 0) {
        const id = existing.rows[0].id;
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query("SET LOCAL app.allow_audit_log_deletion = 'on'");
          await client.query('DELETE FROM sessions WHERE tenant_id = $1', [id]);
          await client.query('DELETE FROM audit_logs WHERE tenant_id = $1', [id]);
          await client.query('DELETE FROM users WHERE tenant_id = $1', [id]);
          await client.query('DELETE FROM roles WHERE tenant_id = $1', [id]);
          await client.query('DELETE FROM tenant_security_settings WHERE tenant_id = $1', [id]);
          await client.query('DELETE FROM tenants WHERE id = $1', [id]);
          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK').catch(() => {});
        } finally {
          client.release();
        }
        const { clearCache } = require('../../utils/cache');
        await clearCache(`tenant_active:${id}`).catch(() => {});
      }
    } catch (e) {}
  };

  beforeAll(async () => {
    // Ensure clean state before running tests
    await cleanupTestTenant();

    const tRes = await pool.query(
      `INSERT INTO tenants (name, slug, is_active) VALUES ('Test Deactivate WS', 'test-deact-ws', true) RETURNING id`
    );
    testTenantId = tRes.rows[0].id;

    const rRes = await pool.query(
      `INSERT INTO roles (tenant_id, name, permissions) VALUES ($1, 'superadmin', '["*"]') RETURNING id`,
      [testTenantId]
    );
    const testRoleId = rRes.rows[0].id;

    // bcrypt hash for 'Admin@123'
    const pwHash = '$2b$12$Tn2032FMfBMmDXri2QeWbe76h2i/.JjClq0DEe74IkyFBDSkT6Mqm';
    await pool.query(
      `INSERT INTO users (tenant_id, role_id, name, email, password_hash, status) 
       VALUES ($1, $2, 'Test Admin', 'testadmin@testdeact.com', $3, 'active')`,
      [testTenantId, testRoleId, pwHash]
    );
  });

  afterAll(async () => {
    await cleanupTestTenant();
  });

  describe('POST /api/auth/login', () => {
    it('returns 200 and tokens for valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email:'admin@demo.com', password:'Admin@123', tenantSlug:'demo' });
      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeTruthy();
      expect(res.body.data.refreshToken).toBeTruthy();
      expect(res.body.data.user.email).toBe('admin@demo.com');
      accessToken = res.body.data.accessToken;
    });

    it('returns 401 for wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email:'admin@demo.com', password:'wrong', tenantSlug:'demo' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for missing email', async () => {
      const res = await request(app).post('/api/auth/login').send({ password:'x', tenantSlug:'demo' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns user when authenticated', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe('admin@demo.com');
    });

    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });

  describe('Workspace Deactivation & Reactivation Enforcement', () => {
    it('allows login when workspace is active', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'testadmin@testdeact.com', password: 'Admin@123', tenantSlug: 'test-deact-ws' });
      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeTruthy();
      testUserToken = res.body.data.accessToken;
      testRefreshToken = res.body.data.refreshToken;
    });

    it('blocks login with 403 TENANT_DEACTIVATED when workspace is deactivated', async () => {
      // Deactivate tenant
      await pool.query('UPDATE tenants SET is_active = false WHERE id = $1', [testTenantId]);
      const { clearCache, setCache } = require('../../utils/cache');
      await setCache(`tenant_active:${testTenantId}`, 'false', 300);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'testadmin@testdeact.com', password: 'Admin@123', tenantSlug: 'test-deact-ws' });
      expect(res.status).toBe(403);
      const code = res.body.error?.code || res.body.error;
      expect(code).toBe('TENANT_DEACTIVATED');
    });

    it('blocks authenticated requests with 403 TENANT_DEACTIVATED when workspace is deactivated', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${testUserToken}`);
      expect(res.status).toBe(403);
      const code = res.body.error?.code || res.body.error;
      expect(code).toBe('TENANT_DEACTIVATED');
    });

    it('blocks token refresh with 403 TENANT_DEACTIVATED when workspace is deactivated', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: testRefreshToken });
      expect(res.status).toBe(403);
      const code = res.body.error?.code || res.body.error;
      expect(code).toBe('TENANT_DEACTIVATED');
    });

    it('allows login again once workspace is reactivated', async () => {
      // Reactivate tenant
      await pool.query('UPDATE tenants SET is_active = true WHERE id = $1', [testTenantId]);
      const { setCache } = require('../../utils/cache');
      await setCache(`tenant_active:${testTenantId}`, 'true', 300);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'testadmin@testdeact.com', password: 'Admin@123', tenantSlug: 'test-deact-ws' });
      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeTruthy();
    });
  });
});
