const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Project Archive & Reopen API', () => {
  jest.setTimeout(20000);

  let accessToken;
  let tenantId;
  let projectId;
  let taskId;
  let milestoneId;
  let phaseId;

  beforeAll(async () => {
    // 1. Login CRM admin
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    accessToken = loginRes.body.data.accessToken;

    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // 2. Create a completed project
    const projRes = await pool.query(
      `INSERT INTO projects (tenant_id, name, client_name, client_phone, client_email, status, start_date, target_date, contract_value)
       VALUES ($1, 'Test Reopen Project', 'Reopen Client', '9998887772', 'reopen@client.com', 'completed', '2026-06-01', '2026-07-01', 700000)
       RETURNING id`,
      [tenantId]
    );
    projectId = projRes.rows[0].id;

    // 3. Create a phase
    const phRes = await pool.query(
      `INSERT INTO project_phases (tenant_id, project_id, name, starts_at, ends_at)
       VALUES ($1, $2, 'Test Phase', '2026-06-05', '2026-06-15')
       RETURNING id`,
      [tenantId, projectId]
    );
    phaseId = phRes.rows[0].id;

    // 4. Create a milestone
    const milRes = await pool.query(
      `INSERT INTO milestones (tenant_id, project_id, name, due_date, phase_id)
       VALUES ($1, $2, 'Test Milestone', '2026-06-15', $3)
       RETURNING id`,
      [tenantId, projectId, phaseId]
    );
    milestoneId = milRes.rows[0].id;

    // 5. Create a task
    const taskRes = await pool.query(
      `INSERT INTO tasks (tenant_id, project_id, milestone_id, title, start_date, due_date, status)
       VALUES ($1, $2, $3, 'Test Task', '2026-06-05', '2026-06-15', 'pending')
       RETURNING id`,
      [tenantId, projectId, milestoneId]
    );
    taskId = taskRes.rows[0].id;
  });

  afterAll(async () => {
    if (projectId) {
      await pool.query('DELETE FROM project_schedule_revisions WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM tasks WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM project_phases WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM milestones WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
  });

  it('should successfully archive a completed project', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/archive`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('archived');
  });

  it('should fail to reopen a project with malformed date format', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/reopen`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        newStartDate: '11-06-2026' // Invalid, must be YYYY-MM-DD
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should successfully reopen project and shift all related child schedules by exactly +10 days offset', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/reopen`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        newStartDate: '2026-06-11', // +10 days from original start_date '2026-06-01'
        newTargetDate: '2026-07-11' // +10 days target date
      });

    const formatDateToYYYYMMDD = (dateStr) => {
      const d = new Date(dateStr);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('active');
    expect(formatDateToYYYYMMDD(res.body.data.start_date)).toBe('2026-06-11');
    expect(formatDateToYYYYMMDD(res.body.data.target_date)).toBe('2026-07-11');

    // 1. Verify task start_date shifted from 2026-06-05 to 2026-06-15 and due_date shifted from 2026-06-15 to 2026-06-25
    const taskRes = await pool.query('SELECT start_date, due_date FROM tasks WHERE id = $1', [taskId]);
    const task = taskRes.rows[0];
    expect(formatDateToYYYYMMDD(task.start_date)).toBe('2026-06-15');
    expect(formatDateToYYYYMMDD(task.due_date)).toBe('2026-06-25');

    // 2. Verify milestone due_date shifted from 2026-06-15 to 2026-06-25
    const milRes = await pool.query('SELECT due_date FROM milestones WHERE id = $1', [milestoneId]);
    const milestone = milRes.rows[0];
    expect(formatDateToYYYYMMDD(milestone.due_date)).toBe('2026-06-25');

    // 3. Verify phase starts_at shifted to 2026-06-15 and ends_at to 2026-06-25
    const phRes = await pool.query('SELECT starts_at, ends_at FROM project_phases WHERE id = $1', [phaseId]);
    const phase = phRes.rows[0];
    expect(formatDateToYYYYMMDD(phase.starts_at)).toBe('2026-06-15');
    expect(formatDateToYYYYMMDD(phase.ends_at)).toBe('2026-06-25');

    // 4. Verify schedule revision log was generated
    const revRes = await pool.query('SELECT * FROM project_schedule_revisions WHERE project_id = $1', [projectId]);
    expect(revRes.rows).toHaveLength(1);
    expect(revRes.rows[0].reason).toBe('Project reopened and revived');
    expect(formatDateToYYYYMMDD(revRes.rows[0].previous_start_date)).toBe('2026-06-01');
    expect(formatDateToYYYYMMDD(revRes.rows[0].new_start_date)).toBe('2026-06-11');
  });
});
