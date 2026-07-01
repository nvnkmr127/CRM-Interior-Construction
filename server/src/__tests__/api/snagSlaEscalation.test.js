const pool = require('../../db/pool');
const slaEngine = require('../../services/workflows/slaEngine');
const eventBus = require('../../utils/eventBus');

describe('Snag SLA Escalation Engine', () => {
  let tenantId;
  let projectId;
  let pmUserId;
  let assigneeId;

  let snag50, snag100, snag200, snag300, snagOk;

  const events = [];
  const onSlaEscalated = (data) => events.push(data);

  beforeAll(async () => {
    eventBus.on('snag.sla_escalated', onSlaEscalated);

    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // PM user
    const pmRes = await pool.query("SELECT id FROM users WHERE tenant_id = $1 LIMIT 1", [tenantId]);
    pmUserId = pmRes.rows[0].id;
    
    // Assignee user
    const asRes = await pool.query("SELECT id FROM users WHERE tenant_id = $1 AND id != $2 LIMIT 1", [tenantId, pmUserId]);
    assigneeId = asRes.rows[0] ? asRes.rows[0].id : pmUserId;

    // Create project
    const projRes = await pool.query(`
      INSERT INTO projects (tenant_id, name, client_name, client_phone, client_email, status, pm_id) VALUES ($1, 'Snag SLA Project', 'Snag Client', '7777777777', 'snag@client.com', 'active', $2) RETURNING id
    `, [tenantId, pmUserId]);
    projectId = projRes.rows[0].id;
  });

  afterAll(async () => {
    eventBus.off('snag.sla_escalated', onSlaEscalated);
    if (projectId) {
      await pool.query('DELETE FROM snags WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM snags WHERE project_id = $1', [projectId]);
    events.length = 0;
  });

  it('should escalate snags at 50%, 100%, 200%, and 300% of their SLA', async () => {
    // We will set sla_hours to 48.
    // snag50: elapsed = 25h (50%+)
    const r50 = await pool.query(`INSERT INTO snags (tenant_id, project_id, title, status, created_at, sla_hours, assignee_id) VALUES ($1, $2, '50%', 'open', NOW() - INTERVAL '25 hours', 48, $3) RETURNING id`, [tenantId, projectId, assigneeId]);
    snag50 = r50.rows[0].id;
    
    // snag100: elapsed = 50h (100%+)
    const r100 = await pool.query(`INSERT INTO snags (tenant_id, project_id, title, status, created_at, sla_hours, assignee_id) VALUES ($1, $2, '100%', 'open', NOW() - INTERVAL '50 hours', 48, $3) RETURNING id`, [tenantId, projectId, assigneeId]);
    snag100 = r100.rows[0].id;

    // snag200: elapsed = 100h (200%+)
    const r200 = await pool.query(`INSERT INTO snags (tenant_id, project_id, title, status, created_at, sla_hours, assignee_id) VALUES ($1, $2, '200%', 'open', NOW() - INTERVAL '100 hours', 48, $3) RETURNING id`, [tenantId, projectId, assigneeId]);
    snag200 = r200.rows[0].id;

    // snag300: elapsed = 150h (300%+)
    const r300 = await pool.query(`INSERT INTO snags (tenant_id, project_id, title, status, created_at, sla_hours, assignee_id) VALUES ($1, $2, '300%', 'open', NOW() - INTERVAL '150 hours', 48, $3) RETURNING id`, [tenantId, projectId, assigneeId]);
    snag300 = r300.rows[0].id;

    // snagOk: elapsed = 10h (No escalation)
    const rOk = await pool.query(`INSERT INTO snags (tenant_id, project_id, title, status, created_at, sla_hours, assignee_id) VALUES ($1, $2, 'OK', 'open', NOW() - INTERVAL '10 hours', 48, $3) RETURNING id`, [tenantId, projectId, assigneeId]);
    snagOk = rOk.rows[0].id;

    await slaEngine.checkSnagSLAs();

    const mySnags = [snag50, snag100, snag200, snag300, snagOk];
    const myEvents = events.filter(e => mySnags.includes(e.snag.id));

    expect(myEvents.length).toBe(4);
    const levels = myEvents.map(e => e.level);
    expect(levels).toContain('snag_sla_50');
    expect(levels).toContain('snag_sla_100');
    expect(levels).toContain('snag_sla_200');
    expect(levels).toContain('snag_sla_300');

    // Run again, deduplication should prevent duplicates
    const preCount = events.length;
    await slaEngine.checkSnagSLAs();
    const myEventsAfter = events.filter(e => mySnags.includes(e.snag.id));
    expect(myEventsAfter.length).toBe(4);
  });
});
