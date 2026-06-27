process.env.STORAGE_PROVIDER = 'local';
const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Project Pause and Cancellation Workflows API', () => {
  jest.setTimeout(30000);
  let adminToken;
  let tenantId;
  let projectId;
  let teamMemberId;
  let milestoneId;
  let activity1Id, activity2Id;

  beforeAll(async () => {
    // 1. Login superadmin
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    adminToken = loginRes.body.data.accessToken;

    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // Clean up any potential stale records
    await pool.query("DELETE FROM projects WHERE name = 'Pause & Cancel Test Project'");

    // 2. Create project
    const projRes = await pool.query(
      `INSERT INTO projects (tenant_id, name, client_name, status, contract_value)
       VALUES ($1, 'Pause & Cancel Test Project', 'Workflow Client', 'active', 500000)
       RETURNING id`,
      [tenantId]
    );
    projectId = projRes.rows[0].id;

    // 3. Create project site team member
    const teamRes = await pool.query(
      `INSERT INTO project_site_team (tenant_id, project_id, role, name, status)
       VALUES ($1, $2, 'carpenter', 'Test Carpenter', 'active')
       RETURNING id`,
      [tenantId, projectId]
    );
    teamMemberId = teamRes.rows[0].id;

    // 4. Create paid milestone (amount = 150000)
    const msRes = await pool.query(
      `INSERT INTO payment_milestones (tenant_id, project_id, name, amount, percentage, status)
       VALUES ($1, $2, 'First Milestone', 150000, 30, 'paid')
       RETURNING id`,
      [tenantId, projectId]
    );
    milestoneId = msRes.rows[0].id;

    // 5. Create two work activities (1 completed, 1 in_progress)
    const act1Res = await pool.query(
      `INSERT INTO project_work_activities (tenant_id, project_id, room_name, trade, activity_name, status)
       VALUES ($1, $2, 'Living Room', 'electrical', 'Wiring', 'completed')
       RETURNING id`,
      [tenantId, projectId]
    );
    activity1Id = act1Res.rows[0].id;

    const act2Res = await pool.query(
      `INSERT INTO project_work_activities (tenant_id, project_id, room_name, trade, activity_name, status)
       VALUES ($1, $2, 'Kitchen', 'carpentry', 'Cabinets installation', 'in_progress')
       RETURNING id`,
      [tenantId, projectId]
    );
    activity2Id = act2Res.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup (Note: audit_logs and automation_jobs are immutable or handle cascade, we clean parent elements)
    if (projectId) {
      await pool.query('DELETE FROM communications WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM project_site_team WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM payment_milestones WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM project_work_activities WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
    await pool.end();
  });

  describe('Project Pause/Hold Workflow', () => {
    it('should successfully pause the project, deactivate site team, and record client communication', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/pause`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Client traveling out of country for 2 months',
          expectedResumeDate: '2026-08-27',
          clientCommunication: {
            channel: 'email',
            direction: 'outbound',
            subject: 'Project Paused Confirmation',
            body: 'Dear client, as requested we have paused the work until 2026-08-27.'
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('on_hold');
      expect(res.body.data.on_hold_reason).toBe('Client traveling out of country for 2 months');

      // Verify resource reallocation trigger: site team deactivated
      const teamRes = await pool.query('SELECT status FROM project_site_team WHERE id = $1', [teamMemberId]);
      expect(teamRes.rows[0].status).toBe('inactive');

      // Verify communication record
      const commRes = await pool.query('SELECT * FROM communications WHERE project_id = $1', [projectId]);
      expect(commRes.rows.length).toBe(1);
      expect(commRes.rows[0].channel).toBe('email');
      expect(commRes.rows[0].body).toContain('Dear client, as requested');
    });

    it('should successfully resume the paused project', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/resume`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('active');
      expect(res.body.data.expected_resume_date).toBeNull();
    });
  });

  describe('Project Cancellation Workflow with Financial Settlement', () => {
    it('should successfully cancel the project and calculate default financial settlement', async () => {
      // Re-activate site team member to test deactivation on cancellation
      await pool.query("UPDATE project_site_team SET status = 'active' WHERE id = $1", [teamMemberId]);

      const res = await request(app)
        .post(`/api/projects/${projectId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Client ran into budget issues and cancelled contract',
          settlementNotes: 'Settled based on 50% work completed'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('cancelled');
      expect(res.body.data.cancellation_reason).toBe('Client ran into budget issues and cancelled contract');
      
      // Calculate:
      // Contract value = 500,000.
      // Completed ratio = 1 of 2 activities completed = 50%.
      // Work completed value = 250,000.
      // Total paid = 150,000.
      // Under-payment (recoverable) = 250,000 - 150,000 = 100,000.
      expect(parseFloat(res.body.data.settlement_amount_recovered)).toBe(100000);
      expect(parseFloat(res.body.data.settlement_amount_refunded)).toBe(0);

      // Verify site team deactivated
      const teamRes = await pool.query('SELECT status FROM project_site_team WHERE id = $1', [teamMemberId]);
      expect(teamRes.rows[0].status).toBe('inactive');

      // Verify automation job created
      const jobRes = await pool.query(
        "SELECT * FROM automation_jobs WHERE event_type = 'generate_project_cancellation_pdf' ORDER BY created_at DESC LIMIT 1"
      );
      expect(jobRes.rows.length).toBe(1);
      expect(JSON.parse(jobRes.rows[0].record).projectId).toBe(projectId);
    });

    it('should allow the client to acknowledge the settlement closure', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/cancel/acknowledge`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.cancellation_client_acknowledged).toBe(true);
      expect(res.body.data.settlement_status).toBe('settled');
    });
  });
});
