const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

jest.setTimeout(30000);

describe('Site Readiness Checklist API & Execution Unlocking', () => {
  let accessToken;
  let tenantId;
  let projectId;
  let phaseId;

  beforeAll(async () => {
    // 1. Login to get access token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    accessToken = loginRes.body.data.accessToken;

    // Fetch tenant ID for DB setup
    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // 2. Create a test project directly
    const projRes = await pool.query(
      `INSERT INTO projects (tenant_id, name, client_name, client_phone, client_email, status, contract_value, is_scope_locked)
       VALUES ($1, 'Test Readiness Project', 'Test Client', '9999999999', 'test@client.com', 'active', 500000, true)
       RETURNING id`,
      [tenantId]
    );
    projectId = projRes.rows[0].id;

    // Create a dummy approved contract document so checkScopeLock document validation passes
    await pool.query(
      `INSERT INTO documents (tenant_id, project_id, name, doc_type, status, version, storage_key)
       VALUES ($1, $2, 'contract.pdf', 'contract', 'approved', 1, 'mock-contract-key')`,
      [tenantId, projectId]
    );

    // 3. Create a test execution phase directly
    const phaseRes = await pool.query(
      `INSERT INTO project_phases (tenant_id, project_id, name, status, sort_order, is_execution)
       VALUES ($1, $2, 'Execution Phase', 'pending', 1, true)
       RETURNING id`,
      [tenantId, projectId]
    );
    phaseId = phaseRes.rows[0].id;
  });

  afterAll(async () => {
    // Clean up test data
    if (projectId) {
      await pool.query('DELETE FROM project_site_readiness WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM documents WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM project_phases WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
  });

  describe('Site Readiness Workflow', () => {
    it('automatically seeds the default 4 checklist items on first retrieval', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/site-readiness`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(4);

      // Verify the keys
      const keys = res.body.data.map(i => i.item_key);
      expect(keys).toContain('civil_handover');
      expect(keys).toContain('electrical_rough_in');
      expect(keys).toContain('waterproofing');
      expect(keys).toContain('debris_cleared');

      // Verify they are initially incomplete
      res.body.data.forEach(item => {
        expect(item.is_completed).toBe(false);
      });
    });

    it('blocks transitioning the execution phase to in_progress if any checklist item is incomplete', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/phases/${phaseId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'in_progress' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SITE_READINESS_REQUIRED');
      expect(res.body.error.message).toContain('Site readiness checklist is incomplete');
    });

    it('successfully unlocks and allows phase transition after all checklist items are completed', async () => {
      // 1. Get the items to obtain their IDs
      const getRes = await request(app)
        .get(`/api/projects/${projectId}/site-readiness`)
        .set('Authorization', `Bearer ${accessToken}`);
      
      const items = getRes.body.data;

      // 2. Mark all items as completed
      for (const item of items) {
        const updateRes = await request(app)
          .patch(`/api/projects/${projectId}/site-readiness/${item.id}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ is_completed: true, notes: 'Completed in test run.' });

        expect(updateRes.status).toBe(200);
        expect(updateRes.body.success).toBe(true);
        expect(updateRes.body.data.is_completed).toBe(true);
      }

      // 3. Try phase transition again - should succeed now!
      const transitionRes = await request(app)
        .put(`/api/projects/${projectId}/phases/${phaseId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'in_progress' });

      expect(transitionRes.status).toBe(200);
      expect(transitionRes.body.success).toBe(true);
      expect(transitionRes.body.data.status).toBe('in_progress');
    });
  });
});
