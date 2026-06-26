const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Project Work Activities API & Progress Rollup', () => {
  let accessToken;
  let tenantId;
  let projectId;
  let phaseId;
  let activityId;

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
      `INSERT INTO projects (tenant_id, name, client_name, client_phone, client_email, status, contract_value)
       VALUES ($1, 'Test Activities Project', 'Test Client', '9999999999', 'test@client.com', 'active', 500000)
       RETURNING id`,
      [tenantId]
    );
    projectId = projRes.rows[0].id;

    // 3. Create a test phase directly
    const phaseRes = await pool.query(
      `INSERT INTO project_phases (tenant_id, project_id, name, status, sort_order, is_execution)
       VALUES ($1, $2, 'Execution Phase', 'in_progress', 1, true)
       RETURNING id`,
      [tenantId, projectId]
    );
    phaseId = phaseRes.rows[0].id;
  });

  afterAll(async () => {
    // Clean up test data
    if (projectId) {
      await pool.query('DELETE FROM project_work_activities WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM project_phases WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
  });

  describe('Work Activities CRUD', () => {
    it('creates a custom work activity', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/work-activities`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          phase_id: phaseId,
          room_name: 'Living Room',
          trade: 'civil',
          activity_name: 'Test Demolition & Sanding',
          description: 'Custom activity description',
          status: 'todo'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.activity_name).toBe('Test Demolition & Sanding');
      expect(res.body.data.room_name).toBe('Living Room');
      expect(res.body.data.trade).toBe('civil');

      activityId = res.body.data.id;
    });

    it('lists work activities of a project', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/work-activities`)
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ trade: 'civil' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('generates work activities from templates for a room and trade', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/work-activities/generate`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          phaseId: phaseId,
          roomName: 'Kitchen',
          trade: 'plumbing'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      
      // Plumbing for kitchen template should generate sink inlet/outlet pipings
      const createdNames = res.body.data.map(a => a.activity_name);
      expect(createdNames).toContain('Sink inlet & outlet pipe connection');
    });

    it('updates work activity details and status', async () => {
      const res = await request(app)
        .patch(`/api/projects/${projectId}/work-activities/${activityId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: 'completed',
          notes: 'Completed successfully.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('completed');
      expect(res.body.data.notes).toBe('Completed successfully.');
      expect(res.body.data.completed_at).toBeDefined();
    });

    it('calculates the dynamic phase completion percentage rollup correctly', async () => {
      // We have:
      // - 1 completed activity (Test Demolition & Sanding, in Living Room)
      // - 1 generated activity (Sink inlet & outlet pipe connection, in Kitchen, status 'todo')
      // Total activities for phaseId = 2 (1 completed, 1 pending)
      // Completion percentage should be 50.00%
      const res = await request(app)
        .get(`/api/projects/${projectId}/phases`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      
      const targetPhase = res.body.data.find(p => p.id === phaseId);
      expect(targetPhase).toBeDefined();
      expect(Number(targetPhase.progress_percentage)).toBe(50.00);
    });

    it('deletes a work activity', async () => {
      const res = await request(app)
        .delete(`/api/projects/${projectId}/work-activities/${activityId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify progress rollup changes back to 0.00% or 0% because only 1 todo activity remains
      const phaseRes = await request(app)
        .get(`/api/projects/${projectId}/phases`)
        .set('Authorization', `Bearer ${accessToken}`);
      
      const targetPhase = phaseRes.body.data.find(p => p.id === phaseId);
      expect(Number(targetPhase.progress_percentage)).toBe(0.00);
    });
  });
});
