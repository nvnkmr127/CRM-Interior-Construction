const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Design to Commercial Approval Transition Gate', () => {
  jest.setTimeout(30000);
  let accessToken;
  let tenantId;
  let userId;
  let projectId;
  let executionPhaseId;
  let designerId;

  beforeAll(async () => {
    // Reset tenant config to empty before starting tests
    await pool.query("UPDATE tenants SET config = '{}' WHERE slug = 'demo'");

    // Login as admin
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    accessToken = loginRes.body.data.accessToken;

    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;
    const userRes = await pool.query("SELECT id FROM users WHERE email = 'admin@demo.com'");
    userId = userRes.rows[0].id;

    // Fetch designer ID
    const designerRes = await pool.query(
      `SELECT u.id FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.tenant_id = $1 AND r.name = 'designer' LIMIT 1`,
      [tenantId]
    );
    designerId = designerRes.rows[0]?.id || userId;
  });

  it('should create and confirm booking for a project to make it active', async () => {
    // 1. Create project
    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        client_name: 'Commercial Gate Client',
        name: 'Commercial Gate Project',
        project_type: 'turnkey',
        contract_value: 100000,
        client_phone: '9977889988',
        client_email: 'comm.client@example.com',
        contract_file_key: 'demo/contract/doc.pdf',
        contract_file_name: 'doc.pdf',
        contract_file_size: 100000,
        contract_file_mime: 'application/pdf'
      });

    expect(createRes.status).toBe(201);
    projectId = createRes.body.data.id;

    // 2. Confirm booking
    const bookingRes = await request(app)
      .post(`/api/projects/${projectId}/booking`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        advance_amount: 10000,
        payment_method: 'bank_transfer',
        agreed_scope_summary: 'Baseline design scope details.',
        design_freeze_target_date: '2026-07-30',
        project_start_date: '2026-07-01',
        assigned_designer_id: designerId,
        agreement_file_key: 'demo/contract/doc.pdf',
        agreement_file_name: 'doc.pdf',
        agreement_file_size: 100000,
        agreement_file_mime: 'application/pdf'
      });

    expect(bookingRes.status).toBe(200);
  }, 15000);

  it('should create an execution phase and verify status transitions are blocked without commercial approval', async () => {
    // 1. Create an execution phase
    const phaseRes = await request(app)
      .post(`/api/projects/${projectId}/phases`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Execution Kickoff Phase',
        sort_order: 2,
        is_execution: true
      });

    expect(phaseRes.status).toBe(201);
    executionPhaseId = phaseRes.body.data.id;

    // 2. Attempt to start execution kickoff phase -> should be blocked by checkScopeLock
    const updateRes = await request(app)
      .put(`/api/projects/${projectId}/phases/${executionPhaseId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        status: 'in_progress'
      });

    expect(updateRes.status).toBe(400);
    expect(updateRes.body.success).toBe(false);
    expect(updateRes.body.error.code).toBe('COMMERCIAL_APPROVAL_REQUIRED');
  }, 15000);

  it('should get commercial approval checklist and verify pending fields', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/commercial-approval`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.boq_accepted).toBe(false);
    expect(res.body.data.all_revisions_closed).toBe(true); // No design review rounds exist yet
    expect(res.body.data.payment_schedule_agreed).toBe(false); // Only 10% advance milestone exists
    expect(res.body.data.is_approved).toBe(false);
  });

  it('should block POST commercial approval sign-off if checklist is not satisfied', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/commercial-approval`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        notes: 'Trying to force approval.'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('COMMERCIAL_GATE_FAILED');
  });

  it('should satisfy commercial checklist conditions (BOQ quotation accepted and payment milestones = 100%) and sign off', async () => {
    // 1. Add accepted quotation for project
    await pool.query(
      `INSERT INTO quotations (tenant_id, project_id, quotation_number, status, total_amount, accepted_at)
       VALUES ($1, $2, 'QT-COMM-TEST', 'accepted', 100000, NOW())`,
      [tenantId, projectId]
    );

    // 2. Adjust payment milestones to equal 100% total (e.g. Booking Advance is 10%, we add 90% milestone)
    // Wait, let's delete existing milestones and add a single 100% milestone to be safe & clean
    await pool.query('DELETE FROM payment_milestones WHERE project_id = $1', [projectId]);
    await pool.query(
      `INSERT INTO payment_milestones (tenant_id, project_id, name, amount, percentage, status)
       VALUES ($1, $2, 'Execution Release', 100000, 100, 'scheduled')`,
      [tenantId, projectId]
    );

    // 3. Check status is now satisfied
    const checkRes = await request(app)
      .get(`/api/projects/${projectId}/commercial-approval`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(checkRes.status).toBe(200);
    expect(checkRes.body.data.boq_accepted).toBe(true);
    expect(checkRes.body.data.payment_schedule_agreed).toBe(true);
    // 3. Mark scope locked and contract document approved
    await pool.query('UPDATE projects SET is_scope_locked = true WHERE id = $1', [projectId]);
    await pool.query(
      `INSERT INTO documents (tenant_id, project_id, name, doc_type, version, storage_key, file_size_bytes, mime_type, status)
       VALUES ($1, $2, 'contract.pdf', 'contract', 1, 'demo/contract/doc.pdf', 100000, 'application/pdf', 'approved')`,
      [tenantId, projectId]
    );

    // 4. Create site readiness checklist dummy seed to allow phase progression
    const siteReadinessRepository = require('../../repositories/siteReadinessRepository');
    await siteReadinessRepository.findChecklist(tenantId, projectId);
    await pool.query(
      "UPDATE project_site_readiness SET is_completed = true WHERE project_id = $1 AND tenant_id = $2",
      [projectId, tenantId]
    );

    // 5. Submit commercial approval
    const signOffRes = await request(app)
      .post(`/api/projects/${projectId}/commercial-approval`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        notes: 'Commercial baseline finalized and checked.'
      });

    expect(signOffRes.status).toBe(200);
    expect(signOffRes.body.success).toBe(true);
    expect(signOffRes.body.data.notes).toBe('Commercial baseline finalized and checked.');

    // 6. Attempt execution phase update again -> should succeed now!
    const updateRes = await request(app)
      .put(`/api/projects/${projectId}/phases/${executionPhaseId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        status: 'in_progress'
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.data.status).toBe('in_progress');
  }, 20000);
});
