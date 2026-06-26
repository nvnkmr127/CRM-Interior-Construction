const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Project Budget Tracking API', () => {
  let accessToken;
  let tenantId;
  let projectId;
  let expenseId;

  jest.setTimeout(30000);

  beforeAll(async () => {
    // 1. Login to get access token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    accessToken = loginRes.body.data.accessToken;

    // Fetch tenant ID
    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // Create a dummy project
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Budget Test Project',
        client_name: 'Budget Client',
        client_phone: '9876543211',
        client_email: 'budgetclient@test.com',
        contract_file_key: 'budget_test_key',
        contract_file_name: 'contract.pdf',
        contract_file_size: 2048,
        contract_file_mime: 'application/pdf'
      });
    
    projectId = projRes.body.data.id;
  });

  afterAll(async () => {
    if (projectId) {
      await pool.query('DELETE FROM projects WHERE id = $1 AND tenant_id = $2', [projectId, tenantId]);
    }
    await pool.end();
  });

  describe('Budget Summaries & Cost Transactions', () => {
    it('should return initial budget summaries with zeroed actual and committed costs', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/budget`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      
      const { categories, totals } = res.body.data;
      expect(categories).toHaveLength(3); // labour, material, vendor
      expect(totals.budgeted).toBe(0);
      expect(totals.committed).toBe(0);
      expect(totals.actual).toBe(0);
      expect(totals.variance).toBe(0);
    });

    it('should set category budget allocations correctly', async () => {
      // 1. Set Labour budget to 150000
      const labourRes = await request(app)
        .post(`/api/projects/${projectId}/budget`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ category: 'labour', budgetedCost: 150000 });
      expect(labourRes.status).toBe(200);
      expect(labourRes.body.success).toBe(true);
      expect(parseFloat(labourRes.body.data.budgeted_cost)).toBe(150000);

      // 2. Set Material budget to 400000
      const matRes = await request(app)
        .post(`/api/projects/${projectId}/budget`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ category: 'material', budgetedCost: 400000 });
      expect(matRes.status).toBe(200);

      // 3. Verify allocations in summary
      const summaryRes = await request(app)
        .get(`/api/projects/${projectId}/budget`)
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(summaryRes.status).toBe(200);
      const data = summaryRes.body.data;
      const labourSummary = data.categories.find(c => c.category === 'labour');
      const materialSummary = data.categories.find(c => c.category === 'material');

      expect(labourSummary.budgeted).toBe(150000);
      expect(materialSummary.budgeted).toBe(400000);
      expect(data.totals.budgeted).toBe(550000);
      expect(data.totals.variance).toBe(550000); // 550000 - 0 = 550000
    });

    it('should allow logging cost transactions (expenses and commitments)', async () => {
      // 1. Log a committed cost for Vendor (PO signed)
      const committedRes = await request(app)
        .post(`/api/projects/${projectId}/budget/expenses`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          category: 'vendor',
          type: 'committed',
          description: 'Signed vendor agreement for joinery',
          amount: 80000
        });
      expect(committedRes.status).toBe(201);
      expect(committedRes.body.success).toBe(true);

      // 2. Log an actual cost for Labour (wages paid)
      const actualRes = await request(app)
        .post(`/api/projects/${projectId}/budget/expenses`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          category: 'labour',
          type: 'actual',
          description: 'Paid weekly labour salary',
          amount: 45000
        });
      expect(actualRes.status).toBe(201);
      expenseId = actualRes.body.data.id;

      // 3. Verify rolled up values in summary
      const summaryRes = await request(app)
        .get(`/api/projects/${projectId}/budget`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(summaryRes.status).toBe(200);
      const data = summaryRes.body.data;
      
      const labour = data.categories.find(c => c.category === 'labour');
      const vendor = data.categories.find(c => c.category === 'vendor');

      expect(labour.actual).toBe(45000);
      expect(labour.variance).toBe(105000); // 150000 - 45000 = 105000
      expect(vendor.committed).toBe(80000);

      expect(data.totals.committed).toBe(80000);
      expect(data.totals.actual).toBe(45000);
      expect(data.totals.variance).toBe(505000); // 550000 - 45000 = 505000
    });

    it('should return the complete transaction list', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/budget/expenses`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });

    it('should delete a transaction and recalculate correct budget roll-ups', async () => {
      // Delete the actual expense
      const delRes = await request(app)
        .delete(`/api/projects/${projectId}/budget/expenses/${expenseId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);

      // Verify roll-ups update accordingly
      const summaryRes = await request(app)
        .get(`/api/projects/${projectId}/budget`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(summaryRes.status).toBe(200);
      const data = summaryRes.body.data;
      
      expect(data.totals.actual).toBe(0); // 45000 actual salary was deleted
      expect(data.totals.committed).toBe(80000); // vendor committed remains
      expect(data.totals.variance).toBe(550000); // variance back to 550000 - 0 = 550000
    });
  });
});
