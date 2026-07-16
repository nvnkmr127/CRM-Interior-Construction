const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Configurable Trade Activities, Dependencies, and Photo Evidence API', () => {
  let accessToken;
  let tenantId;
  let projectId;
  let phaseId;
  let activityAId;
  let activityBId;
  let templateId;
  let _dependencyId;
  let photoId;

  beforeAll(async () => {
    // 1. Login to get access token (with superadmin/config access)
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    accessToken = loginRes.body.data.accessToken;

    // Fetch tenant ID
    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // 2. Create a test project
    const projRes = await pool.query(
      `INSERT INTO projects (tenant_id, name, client_name, client_phone, client_email, status, contract_value, enforce_dependencies)
       VALUES ($1, 'Test Trade Dependencies Project', 'Test Client', '9999999999', 'test@client.com', 'active', 500000, true)
       RETURNING id`,
      [tenantId]
    );
    projectId = projRes.rows[0].id;

    // 3. Create a test phase
    const phaseRes = await pool.query(
      `INSERT INTO project_phases (tenant_id, project_id, name, status, sort_order, is_execution)
       VALUES ($1, $2, 'Execution Phase', 'in_progress', 1, true)
       RETURNING id`,
      [tenantId, projectId]
    );
    phaseId = phaseRes.rows[0].id;

    // 4. Create two activities for dependency testing
    const actARes = await pool.query(
      `INSERT INTO project_work_activities (tenant_id, project_id, phase_id, room_name, trade, activity_name, status, qc_checklist)
       VALUES ($1, $2, $3, 'Bedroom 1', 'carpentry', 'Wardrobe assembly', 'todo', '[]')
       RETURNING id`,
      [tenantId, projectId, phaseId]
    );
    activityAId = actARes.rows[0].id;

    const actBRes = await pool.query(
      `INSERT INTO project_work_activities (tenant_id, project_id, phase_id, room_name, trade, activity_name, status, qc_checklist)
       VALUES ($1, $2, $3, 'Bedroom 1', 'painting', 'Wall putty application', 'todo', '[]')
       RETURNING id`,
      [tenantId, projectId, phaseId]
    );
    activityBId = actBRes.rows[0].id;
  });

  afterAll(async () => {
    // Clean up test data
    if (projectId) {
      await pool.query('DELETE FROM work_activity_photos WHERE tenant_id = $1', [tenantId]);
      await pool.query('DELETE FROM work_activity_dependencies WHERE tenant_id = $1', [tenantId]);
      await pool.query('DELETE FROM project_work_activities WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM project_phases WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
    if (templateId) {
      await pool.query('DELETE FROM trade_activity_templates WHERE id = $1', [templateId]);
    }
  });

  describe('Configurable Trade Activity Templates CRUD', () => {
    it('GET /api/config/trade-activity-templates lists merged templates', async () => {
      const res = await request(app)
        .get('/api/config/trade-activity-templates')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      // verify global template presence
      const hasCivilDemo = res.body.data.some(t => t.trade === 'civil' && t.activity_name === 'Demolition and hacking');
      expect(hasCivilDemo).toBe(true);
    });

    it('POST /api/config/trade-activity-templates creates a custom template', async () => {
      const res = await request(app)
        .post('/api/config/trade-activity-templates')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          trade: 'electrical',
          room_type: 'Kitchen',
          activity_name: 'Test Custom Electrical Task',
          description: 'Custom description here',
          sort_order: 95
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.activity_name).toBe('Test Custom Electrical Task');
      expect(res.body.data.tenant_id).toBe(tenantId);
      templateId = res.body.data.id;
    });

    it('PATCH /api/config/trade-activity-templates/:id updates custom template', async () => {
      const res = await request(app)
        .patch(`/api/config/trade-activity-templates/${templateId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          activity_name: 'Updated Custom Task Name',
          sort_order: 100
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.activity_name).toBe('Updated Custom Task Name');
      expect(res.body.data.sort_order).toBe(100);
    });

    it('DELETE /api/config/trade-activity-templates/:id deletes custom template', async () => {
      const res = await request(app)
        .delete(`/api/config/trade-activity-templates/${templateId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(204);
      templateId = null;
    });
  });

  describe('Work Activity Trade Dependencies', () => {
    it('POST /api/projects/:projectId/work-activities/dependencies creates a finish-to-start dependency relationship', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/work-activities/dependencies`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          activityId: activityAId,
          dependsOnActivityId: activityBId
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.activity_id).toBe(activityAId);
      expect(res.body.data.depends_on_activity_id).toBe(activityBId);
      dependencyId = res.body.data.id;
    });

    it('GET /api/projects/:projectId/work-activities/dependencies lists current project dependencies', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/work-activities/dependencies`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].activity_id).toBe(activityAId);
    });

    it('enforces dependencies when updating activity A status without satisfying prereq B', async () => {
      const res = await request(app)
        .patch(`/api/projects/${projectId}/work-activities/${activityAId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: 'completed'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('DEPENDENCY_UNSATISFIED');
    });

    it('resolves and allows activity status transition when prerequisite activity B is completed', async () => {
      // 1. Complete activity B
      const resB = await request(app)
        .patch(`/api/projects/${projectId}/work-activities/${activityBId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: 'completed'
        });
      expect(resB.status).toBe(200);
      expect(resB.body.data.status).toBe('completed');

      // 2. Complete activity A now should succeed
      const resA = await request(app)
        .patch(`/api/projects/${projectId}/work-activities/${activityAId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: 'completed'
        });
      expect(resA.status).toBe(200);
      expect(resA.body.data.status).toBe('completed');
    });
  });

  describe('Completion Evidence (Photos) Upload and Removal', () => {
    it('uploads photo evidence for a work activity successfully', async () => {
      const buffer = Buffer.from('fake image binary content data');
      const res = await request(app)
        .post(`/api/projects/${projectId}/work-activities/${activityAId}/photos`)
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', buffer, 'completion_proof.jpg')
        .field('caption', 'Completed wardrobe final structure');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.activity_id).toBe(activityAId);
      expect(res.body.data.caption).toBe('Completed wardrobe final structure');
      expect(res.body.data.url).toBeDefined();
      photoId = res.body.data.id;
    });

    it('returns photos array inside the work activity payload', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/work-activities`)
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ trade: 'carpentry' });

      expect(res.status).toBe(200);
      const act = res.body.data.find(a => a.id === activityAId);
      expect(act).toBeDefined();
      expect(Array.isArray(act.photos)).toBe(true);
      expect(act.photos.length).toBe(1);
      expect(act.photos[0].id).toBe(photoId);
      expect(act.photos[0].caption).toBe('Completed wardrobe final structure');
    });

    it('deletes photo evidence from activity successfully', async () => {
      const res = await request(app)
        .delete(`/api/projects/${projectId}/work-activities/${activityAId}/photos/${photoId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify removal
      const listRes = await request(app)
        .get(`/api/projects/${projectId}/work-activities`)
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ trade: 'carpentry' });
      const act = listRes.body.data.find(a => a.id === activityAId);
      expect(act.photos.length).toBe(0);
    });
  });
});
