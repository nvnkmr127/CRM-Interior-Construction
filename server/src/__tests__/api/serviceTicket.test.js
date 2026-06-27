process.env.STORAGE_PROVIDER = 'local';
const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');
const crypto = require('crypto');

describe('Service Tickets API', () => {
  jest.setTimeout(25000);

  let accessToken;
  let portalToken = 'test-service-portal-token-122';
  let tenantId;
  let projectId;
  let portalUserId;
  let engineerId;
  let ticketId1;
  let ticketId2;
  let visitId;

  beforeAll(async () => {
    // 1. Login CRM admin
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    accessToken = loginRes.body.data.accessToken;

    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // Get a valid user (Admin) to use as assigned engineer
    const userRes = await pool.query("SELECT id FROM users WHERE email = 'admin@demo.com' AND tenant_id = $1", [tenantId]);
    engineerId = userRes.rows[0].id;

    // 2. Create project
    const projRes = await pool.query(
      `INSERT INTO projects (tenant_id, name, client_name, client_phone, client_email, status, contract_value)
       VALUES ($1, 'Test Service Project', 'Service Client', '9991112222', 'service@client.com', 'active', 800000)
       RETURNING id`,
      [tenantId]
    );
    projectId = projRes.rows[0].id;

    // 3. Create Client Portal User
    const portalTokenHash = crypto.createHash('sha256').update(portalToken).digest('hex');
    const expiry = new Date(Date.now() + 3600000).toISOString();
    const portalUserRes = await pool.query(
      `INSERT INTO client_portal_users (tenant_id, project_id, name, phone, portal_token_hash, portal_token_expires_at)
       VALUES ($1, $2, 'Service Client User', '9991112222', $3, $4)
       RETURNING id`,
      [tenantId, projectId, portalTokenHash, expiry]
    );
    portalUserId = portalUserRes.rows[0].id;
  });

  afterAll(async () => {
    if (projectId) {
      await pool.query('DELETE FROM service_visits WHERE tenant_id = $1', [tenantId]);
      await pool.query('DELETE FROM service_tickets WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM client_portal_users WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
  });

  it('should create a service ticket successfully by CRM admin', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/service-tickets`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Leaking Kitchen Sink',
        description: 'Water is dripping from the hot water connector pipe under the sink.',
        category: 'plumbing',
        priority: 'high',
        warrantyEligibility: 'eligible',
        assignedEngineerId: engineerId
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Leaking Kitchen Sink');
    expect(res.body.data.category).toBe('plumbing');
    expect(res.body.data.priority).toBe('high');
    expect(res.body.data.status).toBe('open');
    expect(res.body.data.ticket_number).toMatch(/^ST-\d{4}-\d{4}$/);
    
    ticketId1 = res.body.data.id;
  });

  it('should list service tickets for the project', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/service-tickets`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].title).toBe('Leaking Kitchen Sink');
  });

  it('should schedule a service visit successfully', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const res = await request(app)
      .post(`/api/projects/${projectId}/service-tickets/${ticketId1}/visits`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        scheduledDate: tomorrow.toISOString(),
        engineerId: engineerId,
        visitSummary: 'Inspect pipe and replace washers.'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('scheduled');
    expect(res.body.data.visit_summary).toBe('Inspect pipe and replace washers.');
    
    visitId = res.body.data.id;

    // Check if ticket status auto-updated to assigned since engineer is assigned
    const ticketCheck = await request(app)
      .get(`/api/projects/${projectId}/service-tickets/${ticketId1}`)
      .set('Authorization', `Bearer ${accessToken}`);
    
    expect(ticketCheck.body.data.status).toBe('assigned');
  });

  it('should update a service visit to completed', async () => {
    const now = new Date();
    const res = await request(app)
      .put(`/api/projects/${projectId}/service-tickets/${ticketId1}/visits/${visitId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        status: 'completed',
        completedDate: now.toISOString(),
        visitSummary: 'Replaced the damaged rubber washer. Checked for leaks, all dry.'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('completed');
  });

  it('client portal user should view project service tickets', async () => {
    const res = await request(app)
      .get('/api/portal/service-tickets')
      .set('Authorization', `Bearer ${portalToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].title).toBe('Leaking Kitchen Sink');
  });

  it('client portal user should view ticket details & visits', async () => {
    const res = await request(app)
      .get(`/api/portal/service-tickets/${ticketId1}`)
      .set('Authorization', `Bearer ${portalToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Leaking Kitchen Sink');
    expect(res.body.data.visits.length).toBeGreaterThan(0);
    expect(res.body.data.visits[0].status).toBe('completed');
  });

  it('client portal user should create a service ticket', async () => {
    const res = await request(app)
      .post('/api/portal/service-tickets')
      .set('Authorization', `Bearer ${portalToken}`)
      .send({
        title: 'Loose door hinge',
        description: 'The master bedroom wardrobe left door hinge is loose.',
        category: 'carpentry',
        priority: 'medium'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Loose door hinge');
    expect(res.body.data.category).toBe('carpentry');
    expect(res.body.data.status).toBe('open');
    expect(res.body.data.client_portal_user_id).toBe(portalUserId);

    ticketId2 = res.body.data.id;
  });

  it('should prevent rating a ticket that is not resolved/closed', async () => {
    const res = await request(app)
      .post(`/api/portal/service-tickets/${ticketId2}/feedback`)
      .set('Authorization', `Bearer ${portalToken}`)
      .send({
        rating: 5,
        comments: 'Excellent service'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should allow rating a resolved ticket', async () => {
    // Resolve ticket first via internal API
    await request(app)
      .put(`/api/projects/${projectId}/service-tickets/${ticketId2}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        status: 'resolved',
        resolutionDetails: 'Tightened the screws and aligned the door.'
      });

    const res = await request(app)
      .post(`/api/portal/service-tickets/${ticketId2}/feedback`)
      .set('Authorization', `Bearer ${portalToken}`)
      .send({
        rating: 5,
        comments: 'Hinges are perfect now. Fast resolution!'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.client_feedback_rating).toBe(5);
    expect(res.body.data.client_feedback_comments).toBe('Hinges are perfect now. Fast resolution!');
  });
});
