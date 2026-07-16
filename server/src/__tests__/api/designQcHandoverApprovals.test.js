process.env.STORAGE_PROVIDER = 'local';
const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');
const crypto = require('crypto');

describe('Design, QC, and Handover Approvals API', () => {
  jest.setTimeout(30000);
  let _adminToken;
  let designerToken;
  let qcToken;
  let pmToken;
  let opsToken;
  let portalToken = 'test-client-portal-token-999';
  
  let tenantId;
  let projectId;
  let documentId;
  let activityId;
  let checklistId;

  let designerUserId, qcUserId, pmUserId, opsUserId;
  let designerRoleId, qcRoleId, pmRoleId, opsRoleId;

  beforeAll(async () => {
    // 1. Log in as superadmin
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    adminToken = loginRes.body.data.accessToken;

    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // 2. Create custom roles
    const designerRoleRes = await pool.query(
      `INSERT INTO roles (tenant_id, name, permissions) VALUES ($1, 'test_designer', '["projects:read", "projects:manage", "design:approve"]') RETURNING id`,
      [tenantId]
    );
    designerRoleId = designerRoleRes.rows[0].id;

    const qcRoleRes = await pool.query(
      `INSERT INTO roles (tenant_id, name, permissions) VALUES ($1, 'test_qc', '["projects:read", "projects:manage", "qc:approve"]') RETURNING id`,
      [tenantId]
    );
    qcRoleId = qcRoleRes.rows[0].id;

    const pmRoleRes = await pool.query(
      `INSERT INTO roles (tenant_id, name, permissions) VALUES ($1, 'test_pm', '["projects:read", "projects:manage"]') RETURNING id`,
      [tenantId]
    );
    pmRoleId = pmRoleRes.rows[0].id;

    const opsRoleRes = await pool.query(
      `INSERT INTO roles (tenant_id, name, permissions) VALUES ($1, 'test_ops', '["projects:read", "projects:manage", "handover:authorize"]') RETURNING id`,
      [tenantId]
    );
    opsRoleId = opsRoleRes.rows[0].id;

    // 3. Create users
    const designerUserRes = await pool.query(
      `INSERT INTO users (tenant_id, role_id, name, email, password_hash) 
       VALUES ($1, $2, 'Test Designer', 'testdesigner@demo.com', '$2b$12$Tn2032FMfBMmDXri2QeWbe76h2i/.JjClq0DEe74IkyFBDSkT6Mqm') RETURNING id`,
      [tenantId, designerRoleId]
    );
    designerUserId = designerUserRes.rows[0].id;

    const qcUserRes = await pool.query(
      `INSERT INTO users (tenant_id, role_id, name, email, password_hash) 
       VALUES ($1, $2, 'Test QC', 'testqc@demo.com', '$2b$12$Tn2032FMfBMmDXri2QeWbe76h2i/.JjClq0DEe74IkyFBDSkT6Mqm') RETURNING id`,
      [tenantId, qcRoleId]
    );
    qcUserId = qcUserRes.rows[0].id;

    const pmUserRes = await pool.query(
      `INSERT INTO users (tenant_id, role_id, name, email, password_hash) 
       VALUES ($1, $2, 'Test PM', 'testpm2@demo.com', '$2b$12$Tn2032FMfBMmDXri2QeWbe76h2i/.JjClq0DEe74IkyFBDSkT6Mqm') RETURNING id`,
      [tenantId, pmRoleId]
    );
    pmUserId = pmUserRes.rows[0].id;

    const opsUserRes = await pool.query(
      `INSERT INTO users (tenant_id, role_id, name, email, password_hash) 
       VALUES ($1, $2, 'Test Ops', 'testops@demo.com', '$2b$12$Tn2032FMfBMmDXri2QeWbe76h2i/.JjClq0DEe74IkyFBDSkT6Mqm') RETURNING id`,
      [tenantId, opsRoleId]
    );
    opsUserId = opsUserRes.rows[0].id;

    // Log in to get access tokens
    const dl = await request(app).post('/api/auth/login').send({ email: 'testdesigner@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    designerToken = dl.body.data.accessToken;

    const ql = await request(app).post('/api/auth/login').send({ email: 'testqc@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    qcToken = ql.body.data.accessToken;

    const pl = await request(app).post('/api/auth/login').send({ email: 'testpm2@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    pmToken = pl.body.data.accessToken;

    const ol = await request(app).post('/api/auth/login').send({ email: 'testops@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    opsToken = ol.body.data.accessToken;

    // 4. Create project
    const projRes = await pool.query(
      `INSERT INTO projects (tenant_id, name, client_name, client_phone, client_email, status, contract_value)
       VALUES ($1, 'Test Approvals Project', 'Approvals Client', '9898989898', 'approvals@client.com', 'active', 600000)
       RETURNING id`,
      [tenantId]
    );
    projectId = projRes.rows[0].id;

    // 5. Create Client Portal User
    const portalTokenHash = crypto.createHash('sha256').update(portalToken).digest('hex');
    const expiry = new Date(Date.now() + 3600000).toISOString();
    await pool.query(
      `INSERT INTO client_portal_users (tenant_id, project_id, name, phone, portal_token_hash, portal_token_expires_at)
       VALUES ($1, $2, 'Client User', '9898989898', $3, $4)`,
      [tenantId, projectId, portalTokenHash, expiry]
    );

    // 6. Create drawing document
    const docRes = await pool.query(
      `INSERT INTO documents (tenant_id, project_id, name, doc_type, version, storage_key, status)
       VALUES ($1, $2, 'Floor Plan Drawing', 'drawing', 1, 'floor_plan_key', 'pending_review')
       RETURNING id`,
      [tenantId, projectId]
    );
    documentId = docRes.rows[0].id;

    // 7. Create work activity with QC checklist
    const qcList = [
      { id: 'item_1', label: 'Verify dimensions', required: true, is_checked: true }
    ];
    const actRes = await pool.query(
      `INSERT INTO project_work_activities (tenant_id, project_id, room_name, trade, activity_name, status, qc_checklist)
       VALUES ($1, $2, 'Kitchen', 'carpentry', 'Modular base cabinets', 'in_progress', $3)
       RETURNING id`,
      [tenantId, projectId, JSON.stringify(qcList)]
    );
    activityId = actRes.rows[0].id;

    // 8. Create handover checklist with no items to trigger auto-population or insert checked items directly
    const checklistRes = await pool.query(
      `INSERT INTO handover_checklists (tenant_id, project_id, status)
       VALUES ($1, $2, 'in_progress')
       RETURNING id`,
      [tenantId, projectId]
    );
    checklistId = checklistRes.rows[0].id;

    await pool.query(
      `INSERT INTO handover_items (checklist_id, room, description, is_checked)
       VALUES ($1, 'Kitchen', 'Cabinets work perfectly', true)`,
      [checklistId]
    );
  });

  afterAll(async () => {
    // Cleanup
    if (projectId) {
      await pool.query('DELETE FROM client_portal_users WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM handover_items WHERE checklist_id = $1', [checklistId]);
      await pool.query('DELETE FROM handover_checklists WHERE id = $1', [checklistId]);
      await pool.query('DELETE FROM project_work_activities WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM documents WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }

    if (designerUserId) await pool.query('DELETE FROM users WHERE id = $1', [designerUserId]);
    if (qcUserId) await pool.query('DELETE FROM users WHERE id = $1', [qcUserId]);
    if (pmUserId) await pool.query('DELETE FROM users WHERE id = $1', [pmUserId]);
    if (opsUserId) await pool.query('DELETE FROM users WHERE id = $1', [opsUserId]);

    if (designerRoleId) await pool.query('DELETE FROM roles WHERE id = $1', [designerRoleId]);
    if (qcRoleId) await pool.query('DELETE FROM roles WHERE id = $1', [qcRoleId]);
    if (pmRoleId) await pool.query('DELETE FROM roles WHERE id = $1', [pmRoleId]);
    if (opsRoleId) await pool.query('DELETE FROM roles WHERE id = $1', [opsRoleId]);

    await pool.end();
  });

  describe('Finding 21.2 - Design Approval Permission Check', () => {
    it('should block a PM from approving a design document', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/documents/${documentId}/approve`)
        .set('Authorization', `Bearer ${pmToken}`);
      expect(res.status).toBe(403);
    });

    it('should allow a Designer to approve a design document', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/documents/${documentId}/approve`)
        .set('Authorization', `Bearer ${designerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('approved');
    });
  });

  describe('Finding 21.2 - QC Checklist Closure Permission Check', () => {
    it('should block a PM from marking a work activity as completed', async () => {
      const res = await request(app)
        .patch(`/api/projects/${projectId}/work-activities/${activityId}`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send({ status: 'completed' });
      expect(res.status).toBe(403);
    });

    it('should allow a QC officer to mark a work activity as completed', async () => {
      const res = await request(app)
        .patch(`/api/projects/${projectId}/work-activities/${activityId}`)
        .set('Authorization', `Bearer ${qcToken}`)
        .send({ status: 'completed' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('completed');
    });
  });

  describe('Finding 21.3 - Handover Internal Authorization step', () => {
    it('should reject client OTP requests if handover is not internally authorized', async () => {
      const res = await request(app)
        .post('/api/portal/handover/send-otp')
        .set('Authorization', `Bearer ${portalToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Internal Authorization Pending');
    });

    it('should reject client sign-off if handover is not internally authorized', async () => {
      const res = await request(app)
        .post('/api/portal/handover/sign-off')
        .set('Authorization', `Bearer ${portalToken}`)
        .send({ otp: '123456' });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Internal Authorization Pending');
    });

    it('should block a PM from authorizing the handover checklist', async () => {
      const res = await request(app)
        .post(`/api/handover/checklists/${checklistId}/authorize`)
        .set('Authorization', `Bearer ${pmToken}`);
      expect(res.status).toBe(403);
    });

    it('should allow an Ops user/Senior PM to authorize the handover checklist', async () => {
      const res = await request(app)
        .post(`/api/handover/checklists/${checklistId}/authorize`)
        .set('Authorization', `Bearer ${opsToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.is_internally_authorized).toBe(true);
    });

    it('should allow client to send OTP once internally authorized', async () => {
      const res = await request(app)
        .post('/api/portal/handover/send-otp')
        .set('Authorization', `Bearer ${portalToken}`);
      // In testing context, OTP sending will return 200 message (since third-party calls are bypassed or mocked in sendOtp).
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
