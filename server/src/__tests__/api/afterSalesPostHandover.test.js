const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Warranty, Service Tickets, and Customer Retention After-Sales API', () => {
  jest.setTimeout(30000);

  let accessToken;
  let tenantId;
  let userId;
  let projectId;

  beforeAll(async () => {
    // 1. Admin login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    accessToken = loginRes.body.data.accessToken;

    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    const userRes = await pool.query("SELECT id FROM users WHERE tenant_id = $1 LIMIT 1", [tenantId]);
    userId = userRes.rows[0].id;
  });

  beforeEach(async () => {
    // 2. Create test project (active)
    const projRes = await pool.query(
      `INSERT INTO projects (tenant_id, name, client_name, client_phone, client_email, status, pm_id, contract_value)
       VALUES ($1, 'After Sales Test Project', 'Sales Client', '9999999999', 'sales@client.com', 'active', $2, 600000)
       RETURNING id`,
      [tenantId, userId]
    );
    projectId = projRes.rows[0].id;
  });

  afterEach(async () => {
    if (projectId) {
      await pool.query('DELETE FROM service_visits WHERE ticket_id IN (SELECT id FROM service_tickets WHERE project_id = $1)', [projectId]);
      await pool.query('DELETE FROM service_tickets WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM warranties WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM customer_retention_schedules WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it('should automatically trigger installation warranty & retention follow-ups on project.handover_signed event', async () => {
    // 1. Emit the project.handover_signed event
    const eventBus = require('../../utils/eventBus');
    eventBus.emit('project.handover_signed', {
      tenantId,
      projectId
    });

    // 2. Wait a brief moment for the async event subscriber to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. Verify project table handover date was set
    const projRes = await pool.query('SELECT property_handover_date::TEXT FROM projects WHERE id = $1', [projectId]);
    expect(projRes.rows[0].property_handover_date).not.toBeNull();

    // 4. Verify warranties table has been populated with the workmanship warranty
    const warrantyRes = await pool.query('SELECT * FROM warranties WHERE project_id = $1', [projectId]);
    expect(warrantyRes.rows.length).toBe(1);
    expect(warrantyRes.rows[0].product_name).toContain('1-Year Installation');
    expect(warrantyRes.rows[0].brand).toBe('In-House');

    // 5. Verify the 4 retention follow-up milestones were generated
    const retentionRes = await request(app)
      .get(`/api/projects/${projectId}/retention`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(retentionRes.status).toBe(200);
    expect(retentionRes.body.success).toBe(true);
    expect(retentionRes.body.data.length).toBe(4);
    
    const stages = retentionRes.body.data.map(s => s.stage);
    expect(stages).toContain('30_day');
    expect(stages).toContain('90_day');
    expect(stages).toContain('180_day');
    expect(stages).toContain('365_day');

    const scheduleId = retentionRes.body.data[0].id;

    // 6. Test updating a customer retention follow-up check-in outcome
    const updateRes = await request(app)
      .patch(`/api/projects/${projectId}/retention/${scheduleId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        status: 'completed',
        csatScore: 5,
        feedback: 'Client is extremely satisfied with the design and handover experience!',
        notes: 'Handed over premium gift box during retention check-in call.',
        actualDate: new Date().toISOString().split('T')[0]
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.data.status).toBe('completed');
    expect(updateRes.body.data.csat_score).toBe(5);

    // 7. Verify the update shows up on the global retention dashboard
    const dashboardRes = await request(app)
      .get('/api/projects/retention/dashboard')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(dashboardRes.status).toBe(200);
    expect(dashboardRes.body.success).toBe(true);
    const item = dashboardRes.body.data.find(x => x.id === scheduleId);
    expect(item).toBeDefined();
    expect(item.project_name).toBe('After Sales Test Project');
    expect(item.csat_score).toBe(5);
  });

  it('should support creation, update, visits, and csat queries for service tickets', async () => {
    // 1. Create a service ticket
    const ticketRes = await request(app)
      .post(`/api/projects/${projectId}/service-tickets`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Leaking kitchen pipe',
        description: 'Sink outlet pipe joints are dripping water.',
        category: 'Plumbing',
        priority: 'high',
        warrantyEligibility: 'eligible',
        assignedEngineerId: userId
      });

    expect(ticketRes.status).toBe(201);
    expect(ticketRes.body.success).toBe(true);
    expect(ticketRes.body.data.title).toBe('Leaking kitchen pipe');
    const ticketId = ticketRes.body.data.id;

    // 2. Schedule a service visit for the ticket
    const visitRes = await request(app)
      .post(`/api/projects/${projectId}/service-tickets/${ticketId}/visits`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        scheduledDate: new Date().toISOString(),
        engineerId: userId,
        visitSummary: 'Plumbing inspector visit scheduled'
      });

    expect(visitRes.status).toBe(201);
    expect(visitRes.body.success).toBe(true);
    expect(visitRes.body.data.visit_summary).toBe('Plumbing inspector visit scheduled');
    const visitId = visitRes.body.data.id;

    // 3. Update the visit completion status and client confirmation
    const updateVisitRes = await request(app)
      .put(`/api/projects/${projectId}/service-tickets/${ticketId}/visits/${visitId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        status: 'completed',
        completedDate: new Date().toISOString(),
        clientConfirmed: true,
        visitOutcome: 'Replaced washers on the joint. Fully resolved.'
      });

    expect(updateVisitRes.status).toBe(200);
    expect(updateVisitRes.body.success).toBe(true);
    expect(updateVisitRes.body.data.status).toBe('completed');
    expect(updateVisitRes.body.data.visit_outcome).toBe('Replaced washers on the joint. Fully resolved.');

    // 4. Verify getting CSAT metrics returns successfully
    const metricsRes = await request(app)
      .get(`/api/projects/${projectId}/service-tickets/csat-metrics`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(metricsRes.status).toBe(200);
    expect(metricsRes.body.success).toBe(true);
    expect(metricsRes.body.data).toBeDefined();
  });
});
