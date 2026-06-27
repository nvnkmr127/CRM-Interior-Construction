process.env.STORAGE_PROVIDER = 'local';
const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Audit Trail API', () => {
  jest.setTimeout(30000);
  let adminToken;
  let unauthorizedToken;
  let tenantId;
  let testUserId;
  let testRoleId;
  let testProjectId;
  let auditLogId;

  beforeAll(async () => {
    // 1. Login superadmin
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    adminToken = loginRes.body.data.accessToken;

    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // Clean up any stale records from previous failed runs
    await pool.query("DELETE FROM users WHERE email = 'unauth@demo.com'");
    await pool.query("DELETE FROM roles WHERE tenant_id = $1 AND name = 'test_unauthorized'", [tenantId]);
    await pool.query("DELETE FROM projects WHERE tenant_id = $1 AND name = 'Audit Test Project'", [tenantId]);

    // 2. Create unauthorized user role & user
    const roleRes = await pool.query(
      `INSERT INTO roles (tenant_id, name, permissions) VALUES ($1, 'test_unauthorized', '["projects:read"]') RETURNING id`,
      [tenantId]
    );
    testRoleId = roleRes.rows[0].id;

    const userRes = await pool.query(
      `INSERT INTO users (tenant_id, role_id, name, email, password_hash) 
       VALUES ($1, $2, 'Unauthorized User', 'unauth@demo.com', '$2b$12$Tn2032FMfBMmDXri2QeWbe76h2i/.JjClq0DEe74IkyFBDSkT6Mqm') RETURNING id`,
      [tenantId, testRoleId]
    );
    testUserId = userRes.rows[0].id;

    const authRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'unauth@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    unauthorizedToken = authRes.body.data.accessToken;

    // 3. Create test project
    const projRes = await pool.query(
      `INSERT INTO projects (tenant_id, name, client_name, status)
       VALUES ($1, 'Audit Test Project', 'Client Test', 'active')
       RETURNING id`,
      [tenantId]
    );
    testProjectId = projRes.rows[0].id;

    // 4. Insert custom audit log
    const auditRes = await pool.query(
      `INSERT INTO audit_logs (tenant_id, user_id, action, entity, entity_id, old_value, new_value, ip_address, created_at)
       VALUES ($1, $2, 'project.updated', 'project', $3, '{"status": "active"}', '{"status": "completed"}', '192.168.1.1', NOW() - INTERVAL '1 hour')
       RETURNING id`,
      [tenantId, testUserId, testProjectId]
    );
    auditLogId = auditRes.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup (Note: audit_logs is immutable, so we do not delete from it)
    if (testProjectId) {
      await pool.query('DELETE FROM projects WHERE id = $1', [testProjectId]);
    }
    if (testUserId) {
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
    if (testRoleId) {
      await pool.query('DELETE FROM roles WHERE id = $1', [testRoleId]);
    }
    await pool.end();
  });

  it('should block non-admin users without events:read permission', async () => {
    const res = await request(app)
      .get('/api/events')
      .set('Authorization', `Bearer ${unauthorizedToken}`);
    expect(res.status).toBe(403);
  });

  it('should allow admin users to browse audit logs', async () => {
    const res = await request(app)
      .get('/api/events')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should support filtering by projectId', async () => {
    const res = await request(app)
      .get('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ projectId: testProjectId });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].entity_id).toBe(testProjectId);
  });

  it('should support filtering by userId', async () => {
    const res = await request(app)
      .get('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ userId: testUserId });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].user_id).toBe(testUserId);
  });

  it('should support date range filtering', async () => {
    const startDate = new Date(Date.now() - 2 * 3600000).toISOString();
    const endDate = new Date(Date.now() + 3600000).toISOString();

    const res = await request(app)
      .get('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ startDate, endDate });
    
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('should export audit logs as CSV formatted stream', async () => {
    const res = await request(app)
      .get('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ export: 'csv', projectId: testProjectId });
    
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.text).toContain('Timestamp,User Name,User Email,Action,Entity,Entity ID');
    expect(res.text).toContain('project.updated');
    expect(res.text).toContain('192.168.1.1');
  });
});
