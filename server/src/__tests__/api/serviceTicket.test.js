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
      `INSERT INTO projects (tenant_id, name, client_name, client_phone, client_email, status, contract_value, pm_id, designer_id)
       VALUES ($1, 'Test Service Project', 'Service Client', '9991112222', 'service@client.com', 'active', 800000, $2, $2)
       RETURNING id`,
      [tenantId, engineerId]
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

  it('should calculate priority-based SLA values on ticket creation', async () => {
    // 1. Critical priority (4 hours)
    const res1 = await request(app)
      .post(`/api/projects/${projectId}/service-tickets`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Water pipe burst',
        category: 'plumbing',
        priority: 'critical'
      });
    expect(res1.status).toBe(201);
    expect(res1.body.data.sla_hours).toBe(4);
    expect(res1.body.data.due_date).toBeDefined();

    // 2. High priority (24 hours)
    const res2 = await request(app)
      .post(`/api/projects/${projectId}/service-tickets`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Broken electrical switch',
        category: 'electrical',
        priority: 'high'
      });
    expect(res2.status).toBe(201);
    expect(res2.body.data.sla_hours).toBe(24);
  });

  it('should recalculate SLA hours and due_date when priority is updated', async () => {
    // Create medium ticket first (72 hours)
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/service-tickets`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Creaky wooden flooring',
        category: 'carpentry',
        priority: 'medium'
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.sla_hours).toBe(72);
    const originalDueDate = new Date(createRes.body.data.due_date);

    // Update priority to critical
    const updateRes = await request(app)
      .put(`/api/projects/${projectId}/service-tickets/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        priority: 'critical'
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.sla_hours).toBe(4);
    
    // Ensure due_date was adjusted forward (less time remaining)
    const newDueDate = new Date(updateRes.body.data.due_date);
    expect(newDueDate.getTime()).toBeLessThan(originalDueDate.getTime());
  });

  it('should detect service ticket breach in the SLA Engine', async () => {
    const slaEngine = require('../../services/workflows/slaEngine');
    const eventBus = require('../../utils/eventBus');

    // Insert a service ticket directly that is past its due_date
    const pastDate = new Date(Date.now() - 5 * 3600 * 1000).toISOString(); // 5 hours ago
    const insertRes = await pool.query(
      `INSERT INTO service_tickets (
        tenant_id, project_id, ticket_number, title, description, category, priority, status, sla_hours, due_date
      )
      VALUES ($1, $2, 'ST-BREACH-TEST', 'Breaching Ticket', 'A critical ticket that has breached SLA', 'plumbing', 'critical', 'open', 4, $3)
      RETURNING *`,
      [tenantId, projectId, pastDate]
    );
    const ticketId = insertRes.rows[0].id;

    let eventEmitted = false;
    let eventPayload = null;
    eventBus.on('service_ticket.sla_breached', (data) => {
      eventEmitted = true;
      eventPayload = data;
    });

    // Run SLA Engine check
    await slaEngine.checkSLABreaches();

    expect(eventEmitted).toBe(true);
    expect(eventPayload.ticket.ticket_number).toBe('ST-BREACH-TEST');

    // Verify audit log exists
    const auditRes = await pool.query(
      `SELECT * FROM audit_logs WHERE entity = 'service_ticket' AND entity_id = $1 AND action = 'sla_breach'`,
      [ticketId]
    );
    expect(auditRes.rows.length).toBeGreaterThan(0);

    // Cleanup the breach test ticket
    await pool.query('DELETE FROM service_tickets WHERE id = $1', [ticketId]);
  });

  it('should manage service visit scheduling, portal client confirmation, outcome recording, and reminders', async () => {
    // 1. Create a service visit via internal API
    const visitDate = new Date();
    visitDate.setHours(visitDate.getHours() + 12); // Scheduled for 12 hours from now (to trigger reminder)

    const createRes = await request(app)
      .post(`/api/projects/${projectId}/service-tickets/${ticketId1}/visits`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        scheduledDate: visitDate.toISOString(),
        engineerId: engineerId,
        visitSummary: 'Perform repairs on kitchen plumbing.'
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.data.client_confirmed).toBe(false);
    expect(createRes.body.data.reminder_sent).toBe(false);

    const testVisitId = createRes.body.data.id;

    // 2. Confirm the visit via client portal API
    const confirmRes = await request(app)
      .post(`/api/portal/service-tickets/${ticketId1}/visits/${testVisitId}/confirm`)
      .set('Authorization', `Bearer ${portalToken}`);

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.success).toBe(true);
    expect(confirmRes.body.data.client_confirmed).toBe(true);
    expect(confirmRes.body.data.client_confirmed_at).toBeDefined();

    // 3. Trigger reminders scan via the SLA Engine
    const slaEngine = require('../../services/workflows/slaEngine');
    await slaEngine.checkSLABreaches();

    // Verify the reminder was processed
    const checkRes = await pool.query(
      'SELECT reminder_sent FROM service_visits WHERE id = $1',
      [testVisitId]
    );
    expect(checkRes.rows[0].reminder_sent).toBe(true);

    // 4. Update the visit status to completed and record the outcome as internal user
    const finalUpdateRes = await request(app)
      .put(`/api/projects/${projectId}/service-tickets/${ticketId1}/visits/${testVisitId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        status: 'completed',
        visitOutcome: 'resolved',
        visitSummary: 'Fixed the leak and verified water flow.'
      });

    expect(finalUpdateRes.status).toBe(200);
    expect(finalUpdateRes.body.success).toBe(true);
    expect(finalUpdateRes.body.data.status).toBe('completed');
    expect(finalUpdateRes.body.data.visit_outcome).toBe('resolved');

    // Cleanup the visit
    await pool.query('DELETE FROM service_visits WHERE id = $1', [testVisitId]);
  });

  it('should support client portal CSAT feedback submission and PM/Designer mapping', async () => {
    // 1. Submit CSAT feedback from client portal for a mock service visit
    const mockVisitId = crypto.randomUUID();
    const csatRes = await request(app)
      .post('/api/portal/service-tickets/csat')
      .set('Authorization', `Bearer ${portalToken}`)
      .send({
        referenceType: 'service_visit',
        referenceId: mockVisitId,
        score: 5,
        comments: 'Outstanding work by the team!'
      });

    expect(csatRes.status).toBe(201);
    expect(csatRes.body.success).toBe(true);
    expect(csatRes.body.data.score).toBe(5);
    expect(csatRes.body.data.pm_id).toBe(engineerId); // Set from project in setup
    expect(csatRes.body.data.designer_id).toBe(engineerId); // Set from project in setup

    // 2. Query CSAT metrics internally
    const metricsRes = await request(app)
      .get(`/api/projects/${projectId}/service-tickets/csat-metrics`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(metricsRes.status).toBe(200);
    expect(metricsRes.body.success).toBe(true);
    expect(metricsRes.body.data.byProject.length).toBeGreaterThan(0);
    expect(metricsRes.body.data.byPM.length).toBeGreaterThan(0);
    expect(metricsRes.body.data.byDesigner.length).toBeGreaterThan(0);

    // Cleanup CSAT
    await pool.query('DELETE FROM csat_feedback WHERE reference_id = $1', [mockVisitId]);
  });

  it('should automatically escalate ticket to PM after 2x SLA breach', async () => {
    const past2xDate = new Date();
    past2xDate.setHours(past2xDate.getHours() - 10); // 10 hours ago, sla = 4 hrs

    const ticket2xRes = await pool.query(
      `INSERT INTO service_tickets (tenant_id, project_id, ticket_number, title, description, category, priority, status, sla_hours, due_date, created_at)
       VALUES ($1, $2, 'ST-ESC-2X', '2X Overdue Ticket', 'Overdue by 2x SLA', 'electrical', 'high', 'open', 4, $3, $4)
       RETURNING *`,
      [tenantId, projectId, new Date(past2xDate.getTime() + 4 * 3600000).toISOString(), past2xDate.toISOString()]
    );
    const ticketId = ticket2xRes.rows[0].id;

    // Run SLA Engine check to trigger escalations
    const slaEngine = require('../../services/workflows/slaEngine');
    await slaEngine.checkSLABreaches();

    // Query ticket back and check escalations
    const getRes = await request(app)
      .get(`/api/projects/${projectId}/service-tickets/${ticketId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.escalation_level).toBe(1);
    expect(getRes.body.data.escalations.length).toBeGreaterThan(0);
    expect(getRes.body.data.escalations[0].escalated_to_role).toBe('pm');

    // Cleanup
    await pool.query('DELETE FROM service_ticket_escalations WHERE ticket_id = $1', [ticketId]);
    await pool.query('DELETE FROM service_tickets WHERE id = $1', [ticketId]);
  });

  it('should automatically escalate ticket to director after 3x SLA breach', async () => {
    const past3xDate = new Date();
    past3xDate.setHours(past3xDate.getHours() - 15); // 15 hours ago, sla = 4 hrs

    const ticket3xRes = await pool.query(
      `INSERT INTO service_tickets (tenant_id, project_id, ticket_number, title, description, category, priority, status, sla_hours, due_date, created_at)
       VALUES ($1, $2, 'ST-ESC-3X', '3X Overdue Ticket', 'Overdue by 3x SLA', 'electrical', 'high', 'open', 4, $3, $4)
       RETURNING *`,
      [tenantId, projectId, new Date(past3xDate.getTime() + 4 * 3600000).toISOString(), past3xDate.toISOString()]
    );
    const ticketId = ticket3xRes.rows[0].id;

    // Run SLA Engine check to trigger escalations
    const slaEngine = require('../../services/workflows/slaEngine');
    await slaEngine.checkSLABreaches();

    // Query ticket back and check escalations
    const getRes = await request(app)
      .get(`/api/projects/${projectId}/service-tickets/${ticketId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.escalation_level).toBe(2);
    expect(getRes.body.data.escalations.length).toBeGreaterThan(0);
    // There should be a pm escalation (level 1) and director escalation (level 2)
    const directorEscalation = getRes.body.data.escalations.find(e => e.escalated_to_role === 'director');
    expect(directorEscalation).toBeDefined();

    // Cleanup
    await pool.query('DELETE FROM service_ticket_escalations WHERE ticket_id = $1', [ticketId]);
    await pool.query('DELETE FROM service_tickets WHERE id = $1', [ticketId]);
  });
});
