process.env.STORAGE_PROVIDER = 'local';
const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Warranty Repeats & Budget Overrun Alerts API', () => {
  jest.setTimeout(30000);
  let adminToken;
  let tenantId;
  let projectId;
  let warrantyId;
  let claim1Id, claim2Id;
  let expense1Id, expense2Id;

  beforeAll(async () => {
    // 1. Login superadmin
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    adminToken = loginRes.body.data.accessToken;

    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // Clean up stale test data
    await pool.query("DELETE FROM projects WHERE name = 'Budget Alerts Test Project'");

    // 2. Create project
    const projRes = await pool.query(
      `INSERT INTO projects (tenant_id, name, client_name, status, contract_value)
       VALUES ($1, 'Budget Alerts Test Project', 'Budget Client', 'active', 100000)
       RETURNING id`,
      [tenantId]
    );
    projectId = projRes.rows[0].id;

    // 3. Create warranty item
    const warrantyRes = await pool.query(
      `INSERT INTO warranties (tenant_id, project_id, product_name, start_date, end_date, status)
       VALUES ($1, $2, 'Kitchen Shutter A', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year', 'active')
       RETURNING id`,
      [tenantId, projectId]
    );
    warrantyId = warrantyRes.rows[0].id;
  });

  afterAll(async () => {
    // Clean up
    if (projectId) {
      await pool.query('DELETE FROM notifications WHERE tenant_id = $1', [tenantId]);
      await pool.query('DELETE FROM project_expenses WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM warranty_claims WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM warranties WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
    await pool.end();
  });

  describe('Repeat Warranty Claims', () => {
    it('should allow first claim on a warranty item and mark is_repeat_claim = false', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/warranty-claims`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          warrantyId,
          claimNumber: 'CLAIM-A-001',
          natureOfDefect: 'Shutter alignment issue'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.is_repeat_claim).toBe(false);
      expect(res.body.data.repeat_claim_count).toBe(0);
      claim1Id = res.body.data.id;
    });

    it('should flag second claim on same item as is_repeat_claim = true and send alert notification', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/warranty-claims`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          warrantyId,
          claimNumber: 'CLAIM-A-002',
          natureOfDefect: 'Shutter alignment issue again'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.is_repeat_claim).toBe(true);
      expect(res.body.data.repeat_claim_count).toBe(1);
      claim2Id = res.body.data.id;

      // Verify a repeat_warranty_claim notification was inserted
      const notifRes = await pool.query(
        "SELECT * FROM notifications WHERE tenant_id = $1 AND type = 'repeat_warranty_claim' ORDER BY created_at DESC LIMIT 1",
        [tenantId]
      );
      expect(notifRes.rows.length).toBe(1);
      expect(notifRes.rows[0].message).toContain('claimed 2 times');
    });
  });

  describe('Budget Overrun Warnings', () => {
    it('should trigger 80% warning notification when actual expenses reach 80% contract value', async () => {
      // 85,000 is 85% of 100,000 contract value
      const res = await request(app)
        .post(`/api/projects/${projectId}/budget/expenses`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          category: 'material',
          type: 'actual',
          description: 'Wood purchase',
          amount: 85000
        });

      expect(res.status).toBe(201);
      expense1Id = res.body.data.id;

      // Verify project alert flag is true
      const projDb = await pool.query('SELECT alert_80_sent, alert_90_sent, alert_100_sent FROM projects WHERE id = $1', [projectId]);
      expect(projDb.rows[0].alert_80_sent).toBe(true);
      expect(projDb.rows[0].alert_90_sent).toBe(false);

      // Verify notification is created
      const notifRes = await pool.query(
        "SELECT * FROM notifications WHERE tenant_id = $1 AND type = 'budget_warning' ORDER BY created_at DESC LIMIT 1",
        [tenantId]
      );
      expect(notifRes.rows.length).toBe(1);
      expect(notifRes.rows[0].message).toContain('reached 80%');
    });

    it('should trigger 90% and 100% warnings when actual expenses cross 100% contract value', async () => {
      // Add another 20,000 to reach 105,000 (105% of contract value)
      const res = await request(app)
        .post(`/api/projects/${projectId}/budget/expenses`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          category: 'labour',
          type: 'actual',
          description: 'Carpentry wages',
          amount: 20000
        });

      expect(res.status).toBe(201);
      expense2Id = res.body.data.id;

      // Verify project alert flags are true
      const projDb = await pool.query('SELECT alert_80_sent, alert_90_sent, alert_100_sent FROM projects WHERE id = $1', [projectId]);
      expect(projDb.rows[0].alert_90_sent).toBe(true);
      expect(projDb.rows[0].alert_100_sent).toBe(true);

      // Verify 100% warning notification
      const notifRes = await pool.query(
        "SELECT * FROM notifications WHERE tenant_id = $1 AND type = 'budget_warning' AND message LIKE '%100%%' ORDER BY created_at DESC LIMIT 1",
        [tenantId]
      );
      expect(notifRes.rows.length).toBe(1);
    });

    it('should reset alert flags if expenses are deleted dropping total cost below the threshold', async () => {
      // Delete the second expense, total goes back to 85,000 (85%)
      const res = await request(app)
        .delete(`/api/projects/${projectId}/budget/expenses/${expense2Id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      // Verify flags reset
      const projDb = await pool.query('SELECT alert_80_sent, alert_90_sent, alert_100_sent FROM projects WHERE id = $1', [projectId]);
      expect(projDb.rows[0].alert_80_sent).toBe(true);
      expect(projDb.rows[0].alert_90_sent).toBe(false);
      expect(projDb.rows[0].alert_100_sent).toBe(false);
    });
  });
});
