process.env.STORAGE_PROVIDER = 'local';
const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Credit Notes & Refunds Financials API', () => {
  jest.setTimeout(30000);
  let accessToken;
  let _tenantId;
  let projectId;
  let creditNoteId;
  let refundId;

  beforeAll(async () => {
    // 1. Log in to get access token for staff
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    
    accessToken = loginRes.body.data.accessToken;

    // Fetch tenant ID
    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // 2. Create a project
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Financial Test Project',
        client_name: 'Financial Client',
        client_phone: '8888888888',
        client_email: 'financial-client@test.com',
        contract_file_key: 'test_key_fin',
        contract_file_name: 'contract.pdf',
        contract_file_size: 1024,
        contract_file_mime: 'application/pdf',
        site_address: '456 Financial Lane, Bangalore',
        payment_terms: 'Net 15'
      });
    projectId = projRes.body.data.id;
  });

  afterAll(async () => {
    // Clean up database
    if (projectId) {
      await pool.query('DELETE FROM project_expenses WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM project_budgets WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM payment_milestones WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM credit_notes WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM refunds WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
    await pool.end();
  });

  it('should retrieve empty credit notes and refunds list initially', async () => {
    const cnRes = await request(app)
      .get(`/api/financials/projects/${projectId}/credit-notes`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(cnRes.status).toBe(200);
    expect(cnRes.body.data).toEqual([]);

    const refRes = await request(app)
      .get(`/api/financials/projects/${projectId}/refunds`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(refRes.status).toBe(200);
    expect(refRes.body.data).toEqual([]);
  });

  it('should issue a credit note with correct tax calculations', async () => {
    const res = await request(app)
      .post('/api/financials/credit-notes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        projectId,
        subtotal: 50000.00,
        gstRate: 18.00,
        gstType: 'cgst_sgst',
        reason: 'Post-quotation discount'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const cn = res.body.data;
    creditNoteId = cn.id;

    expect(cn.credit_note_number).toMatch(/^CN-\d{4}-\d{4}$/);
    expect(cn.subtotal).toBe("50000.00");
    expect(cn.gst_type).toBe('cgst_sgst');
    expect(cn.cgst_amount).toBe("4500.00");
    expect(cn.sgst_amount).toBe("4500.00");
    expect(cn.igst_amount).toBe("0.00");
    expect(cn.total_amount).toBe("59000.00");
  });

  it('should list the issued credit note for the project', async () => {
    const res = await request(app)
      .get(`/api/financials/projects/${projectId}/credit-notes`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].id).toBe(creditNoteId);
    expect(res.body.data[0].credit_note_number).toBeDefined();
    expect(res.body.data[0].reason).toBe('Post-quotation discount');
  });

  it('should record a refund successfully', async () => {
    const res = await request(app)
      .post('/api/financials/refunds')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        projectId,
        amount: 25000.00,
        paymentMethod: 'Bank Transfer',
        referenceNumber: 'UTR9988776655',
        reason: 'Advance returned'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const ref = res.body.data;
    refundId = ref.id;

    expect(ref.refund_number).toMatch(/^REF-\d{4}-\d{4}$/);
    expect(ref.amount).toBe("25000.00");
    expect(ref.payment_method).toBe('Bank Transfer');
    expect(ref.reference_number).toBe('UTR9988776655');
  });

  it('should list the recorded refund for the project', async () => {
    const res = await request(app)
      .get(`/api/financials/projects/${projectId}/refunds`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].id).toBe(refundId);
    expect(res.body.data[0].refund_number).toBeDefined();
    expect(res.body.data[0].amount).toBe("25000.00");
  });

  it('should create and update a payment milestone with TDS details', async () => {
    // Create milestone
    const pmCreateRes = await request(app)
      .post('/api/payment-milestones')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        projectId,
        name: 'TDS Milestone Test',
        amount: 100000.00,
        percent: 10
      });

    expect(pmCreateRes.status).toBe(201);
    const pmId = pmCreateRes.body.data.id;

    // Update with TDS
    const pmUpdateRes = await request(app)
      .patch(`/api/payment-milestones/${pmId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        status: 'paid',
        paid_at: '2026-06-27',
        paid_amount: 98000.00,
        tds_rate: 2.00,
        tds_amount: 2000.00
      });

    expect(pmUpdateRes.status).toBe(200);
    expect(pmUpdateRes.body.data.status).toBe('paid');
    expect(pmUpdateRes.body.data.tds_rate).toBe("2.00");
    expect(pmUpdateRes.body.data.tds_amount).toBe("2000.00");
    expect(pmUpdateRes.body.data.paid_amount).toBe("98000.00");
  });

  it('should allow setting overhead budget and logging overhead expense', async () => {
    // Set budget allocation for overhead
    const budgetAllocRes = await request(app)
      .post(`/api/projects/${projectId}/budget`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        category: 'overhead',
        budgetedCost: 15000.00
      });
    expect(budgetAllocRes.status).toBe(200);
    expect(budgetAllocRes.body.data.category).toBe('overhead');
    expect(budgetAllocRes.body.data.budgeted_cost).toBe("15000.00");

    // Log overhead expense
    const expenseRes = await request(app)
      .post(`/api/projects/${projectId}/budget/expenses`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        category: 'overhead',
        type: 'actual',
        description: 'Office overhead allocation',
        amount: 12000.00
      });
    expect(expenseRes.status).toBe(201);
    expect(expenseRes.body.data.category).toBe('overhead');
    expect(expenseRes.body.data.amount).toBe("12000.00");
  });

  it('should include consolidated financials (credits, refunds, costs, margins) in project stats', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.stats).toBeDefined();
    expect(res.body.data.stats.totalCredits).toBe(59000);
    expect(res.body.data.stats.totalRefunds).toBe(25000);
    expect(res.body.data.stats.totalActualCost).toBe(12000);
    expect(res.body.data.stats.grossProfit).toBe(-12000);
    expect(res.body.data.stats.grossMarginPct).toBe(0);
    expect(res.body.data.stats.costBreakdown.overhead).toBe(12000);
  });
});
