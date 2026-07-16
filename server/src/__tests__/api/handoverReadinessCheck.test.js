const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Handover Readiness Checklist Gates & Appointment Scheduling API', () => {
  jest.setTimeout(30000);

  let accessToken;
  let tenantId;
  let userId;
  let projectId;
  let taskId;
  let snagId;
  let milestoneId;
  let _docId;

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
       VALUES ($1, 'Handover Ready Test Project', 'Ready Client', '9876543210', 'ready@client.com', 'active', $2, 500000)
       RETURNING id`,
      [tenantId, userId]
    );
    projectId = projRes.rows[0].id;

    // 3. Add a pending task
    const taskRes = await pool.query(
      `INSERT INTO tasks (tenant_id, project_id, title, status)
       VALUES ($1, $2, 'Pending Site Cleanup', 'todo')
       RETURNING id`,
      [tenantId, projectId]
    );
    taskId = taskRes.rows[0].id;

    // 4. Add an open snag
    const snagRes = await pool.query(
      `INSERT INTO snags (tenant_id, project_id, title, status, raised_by)
       VALUES ($1, $2, 'Scratched Kitchen Cabinet', 'open', $3)
       RETURNING id`,
      [tenantId, projectId, userId]
    );
    snagId = snagRes.rows[0].id;

    // 5. Add an unpaid payment milestone
    const pmRes = await pool.query(
      `INSERT INTO payment_milestones (tenant_id, project_id, name, percentage, amount, status)
       VALUES ($1, $2, 'Retainage / Final Installment', 10.0, 50000, 'invoice_raised')
       RETURNING id`,
      [tenantId, projectId]
    );
    milestoneId = pmRes.rows[0].id;
  });

  afterEach(async () => {
    if (projectId) {
      await pool.query('DELETE FROM handover_appointments WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM handover_readiness_gates WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM documents WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM payment_milestones WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM snags WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM tasks WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it('should initially fail evaluateReadinessGates and block PM sign-off / scheduling appointments', async () => {
    // 1. Fetch current readiness gates
    const evalRes = await request(app)
      .get(`/api/projects/${projectId}/handover/readiness`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(evalRes.status).toBe(200);
    expect(evalRes.body.success).toBe(true);
    expect(evalRes.body.data.overallReady).toBe(false);
    expect(evalRes.body.data.gates.tasksCompleted.passed).toBe(false);
    expect(evalRes.body.data.gates.snagsResolved.passed).toBe(false);
    expect(evalRes.body.data.gates.paymentsCleared.passed).toBe(false);
    expect(evalRes.body.data.gates.documentsUploaded.passed).toBe(false);
    expect(evalRes.body.data.gates.pmSignedOff.passed).toBe(false);

    // 2. Attempt PM sign-off (should block)
    const signRes = await request(app)
      .post(`/api/projects/${projectId}/handover/readiness/pm-sign-off`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(signRes.status).toBe(400);
    expect(signRes.body.success).toBe(false);
    expect(signRes.body.error.message).toContain('Cannot sign off');

    // 3. Attempt Appointment scheduling (should block)
    const apptRes = await request(app)
      .post(`/api/projects/${projectId}/handover/appointments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        appointmentDate: '2026-07-25T10:00:00Z',
        notes: 'Final key handover.'
      });

    expect(apptRes.status).toBe(400);
    expect(apptRes.body.success).toBe(false);
    expect(apptRes.body.error.message).toContain('Cannot schedule appointment');
  });

  it('should succeed PM sign-off and schedule appointment when all gates are satisfied', async () => {
    // 1. Mark task as done
    await pool.query("UPDATE tasks SET status = 'done' WHERE id = $1", [taskId]);

    // 2. Resolve snag
    await pool.query("UPDATE snags SET status = 'resolved' WHERE id = $1", [snagId]);

    // 3. Mark payment milestone as paid
    await pool.query("UPDATE payment_milestones SET status = 'paid' WHERE id = $1", [milestoneId]);

    // 4. Create and approve a project document
    const docRes = await pool.query(
      `INSERT INTO documents (tenant_id, project_id, name, doc_type, storage_key, status, uploaded_by)
       VALUES ($1, $2, 'Handover Certificate.pdf', 'contract', 'mock-key-handover-cert', 'approved', $3)
       RETURNING id`,
      [tenantId, projectId, userId]
    );
    docId = docRes.rows[0].id;

    // 5. Re-evaluate gates (first 4 should now pass)
    const evalRes = await request(app)
      .get(`/api/projects/${projectId}/handover/readiness`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(evalRes.status).toBe(200);
    expect(evalRes.body.data.gates.tasksCompleted.passed).toBe(true);
    expect(evalRes.body.data.gates.snagsResolved.passed).toBe(true);
    expect(evalRes.body.data.gates.paymentsCleared.passed).toBe(true);
    expect(evalRes.body.data.gates.documentsUploaded.passed).toBe(true);
    expect(evalRes.body.data.gates.pmSignedOff.passed).toBe(false); // PM still pending
    expect(evalRes.body.data.overallReady).toBe(false);

    // 6. Sign off PM Gate
    const pmSignRes = await request(app)
      .post(`/api/projects/${projectId}/handover/readiness/pm-sign-off`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(pmSignRes.status).toBe(200);
    expect(pmSignRes.body.success).toBe(true);

    // 7. Verify PM Gate passes now
    const evalRes2 = await request(app)
      .get(`/api/projects/${projectId}/handover/readiness`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(evalRes2.body.data.gates.pmSignedOff.passed).toBe(true);
    expect(evalRes2.body.data.overallReady).toBe(true);

    // 8. Schedule Appointment (should now succeed)
    const apptRes = await request(app)
      .post(`/api/projects/${projectId}/handover/appointments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        appointmentDate: '2026-07-25T10:00:00.000Z',
        notes: 'Final Key Handover and Client walkthrough.'
      });

    expect(apptRes.status).toBe(200);
    expect(apptRes.body.success).toBe(true);
    expect(apptRes.body.data.notes).toBe('Final Key Handover and Client walkthrough.');

    // 9. Fetch scheduled appointments
    const listRes = await request(app)
      .get(`/api/projects/${projectId}/handover/appointments`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].notes).toBe('Final Key Handover and Client walkthrough.');

    // 10. Fetch dashboard and verify gates status output
    const dashRes = await request(app)
      .get(`/api/projects/handover/readiness-dashboard`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(dashRes.status).toBe(200);
    const projRecord = dashRes.body.data.find(p => p.projectId === projectId);
    expect(projRecord).toBeDefined();
    expect(projRecord.overallReady).toBe(true);
    expect(projRecord.gates.tasksCompleted.passed).toBe(true);
    expect(projRecord.gates.snagsResolved.passed).toBe(true);
    expect(projRecord.gates.paymentsCleared.passed).toBe(true);
    expect(projRecord.gates.documentsUploaded.passed).toBe(true);
    expect(projRecord.gates.pmSignedOff.passed).toBe(true);
  });
});
