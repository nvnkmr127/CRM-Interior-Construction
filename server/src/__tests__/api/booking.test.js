const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Project Booking Confirmation Module & Gate Validation', () => {
  jest.setTimeout(30000);
  let accessToken;
  let tenantId;
  let userId;
  let projectId;
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

    // Fetch a user with designer role to assign
    const designerRes = await pool.query(
      `SELECT u.id FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.tenant_id = $1 AND r.name = 'designer' LIMIT 1`,
      [tenantId]
    );
    designerId = designerRes.rows[0]?.id || userId;
  });

  it('should create a new project in pending_booking status', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        client_name: 'Booking Client',
        name: 'Booking Integration Project',
        project_type: 'full_interior',
        contract_value: 120000,
        client_phone: '9988998899',
        client_email: 'booking.client@example.com',
        contract_file_key: 'demo-tenant/contract/agreement.pdf',
        contract_file_name: 'agreement.pdf',
        contract_file_size: 500000,
        contract_file_mime: 'application/pdf'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    projectId = res.body.data.id;
    expect(res.body.data.status).toBe('pending_booking');
  });

  it('should block task creation on the project since it is pending booking', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Draft Design Layout',
        priority: 'high',
        dueDate: '2026-07-31'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('BOOKING_REQUIRED');
  });

  it('should block budget addition on the project since it is pending booking', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/budget`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        category: 'material',
        allocated_amount: 50000
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('BOOKING_REQUIRED');
  });

  it('should block manual transition of status to active via PATCH when booking is not confirmed', async () => {
    const res = await request(app)
      .patch(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        status: 'active'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('BOOKING_REQUIRED');
  });

  it('should successfully confirm booking and activate the project', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/booking`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        advance_amount: 12000,
        payment_method: 'upi',
        agreed_scope_summary: 'Full living room + kitchen cabinetry works.',
        design_freeze_target_date: '2026-07-25',
        project_start_date: '2026-07-05',
        assigned_designer_id: designerId,
        agreement_file_key: 'demo-tenant/contract/confirmed_agreement.pdf',
        agreement_file_name: 'confirmed_agreement.pdf',
        agreement_file_size: 450000,
        agreement_file_mime: 'application/pdf'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.advance_amount).toBe('12000.00');
    expect(res.body.data.payment_method).toBe('upi');

    // Fetch the project to verify changes are synced
    const projectRes = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(projectRes.status).toBe(200);
    expect(projectRes.body.data.status).toBe('active');
    expect(projectRes.body.data.designer_id).toBe(designerId);
    expect(projectRes.body.data.booking_amount).toBe('12000.00');
    expect(projectRes.body.data.booking).toBeDefined();
    expect(projectRes.body.data.booking.agreed_scope_summary).toBe('Full living room + kitchen cabinetry works.');
  }, 15000);

  it('should now allow task creation after booking confirmation is complete', async () => {
    // 1. Create a phase and milestone first
    const phaseRes = await request(app)
      .post(`/api/projects/${projectId}/phases`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Design Phase',
        sort_order: 1,
        is_execution: false
      });
    expect(phaseRes.status).toBe(201);
    const phaseId = phaseRes.body.data.id;

    const milestoneRes = await request(app)
      .post(`/api/phases/${phaseId}/milestones`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Concept Design Freeze',
        percentage: 0
      });
    expect(milestoneRes.status).toBe(201);
    const milestoneId = milestoneRes.body.data.id;

    // 2. Create the task under this milestone
    const res = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Draft Design Layout',
        priority: 'high',
        dueDate: '2026-07-31',
        milestoneId
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Draft Design Layout');
  });
});
