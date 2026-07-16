process.env.STORAGE_PROVIDER = 'local';
const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Tax Invoice Generation API', () => {
  jest.setTimeout(30000);
  let accessToken;
  let _tenantId;
  let projectId;
  let milestoneId;
  let invoiceId;

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
        name: 'Invoice Test Project',
        client_name: 'Invoice Client',
        client_phone: '9999999999',
        client_email: 'invoice-client@test.com',
        contract_file_key: 'test_key',
        contract_file_name: 'contract.pdf',
        contract_file_size: 1024,
        contract_file_mime: 'application/pdf',
        site_address: '123 Test Street, Bangalore',
        payment_terms: 'Net 30'
      });
    projectId = projRes.body.data.id;

    // 3. Create a payment milestone
    const msRes = await request(app)
      .post('/api/payment-milestones')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        projectId,
        name: 'First Installment',
        amount: 100000.00,
        percent: 10.00,
        dueDate: '2026-08-30',
        notes: 'Initial billing'
      });
    milestoneId = msRes.body.data.id;
  });

  afterAll(async () => {
    // Clean up database
    if (milestoneId) {
      await pool.query('DELETE FROM invoices WHERE payment_milestone_id = $1', [milestoneId]);
      await pool.query('DELETE FROM payment_milestones WHERE id = $1', [milestoneId]);
    }
    if (projectId) {
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
    await pool.end();
  });

  it('should retrieve pre-populated draft invoice details for a payment milestone', async () => {
    const res = await request(app)
      .get(`/api/invoices/milestone/${milestoneId}/draft`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    
    const draft = res.body.data;
    expect(draft.billingName).toBe('Invoice Client');
    expect(draft.billingAddress).toContain('123 Test Street');
    expect(draft.amount).toBe(100000);
    expect(draft.paymentTerms).toBe('Net 30');
    expect(draft.gstType).toBe('cgst_sgst');
    expect(draft.gstRate).toBe(18.00);
  });

  it('should fail to fetch invoice before it is generated', async () => {
    const res = await request(app)
      .get(`/api/invoices/milestone/${milestoneId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('should generate a tax invoice and return it, updating the milestone status', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        milestoneId,
        companyName: 'ACME Designs',
        companyAddress: 'Suite 400, Bangalore',
        companyGstin: '29ABCDE1234F1Z5',
        billingGstin: '29FGHIJ5678K2Z3',
        gstRate: 18.00,
        gstType: 'cgst_sgst'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    
    const invoice = res.body.data;
    invoiceId = invoice.id;

    expect(invoice.invoice_number).toMatch(/^INV-\d{4}-\d{4}$/);
    expect(invoice.company_name).toBe('ACME Designs');
    expect(invoice.subtotal).toBe("100000.00");
    expect(invoice.gst_type).toBe('cgst_sgst');
    
    // CGST & SGST calculations verification (100000 * 9% each = 9000 each)
    expect(invoice.cgst_amount).toBe("9000.00");
    expect(invoice.sgst_amount).toBe("9000.00");
    expect(invoice.igst_amount).toBe("0.00");
    expect(invoice.total_amount).toBe("118000.00");

    // Check if the payment milestone has been updated in database
    const msRes = await pool.query('SELECT * FROM payment_milestones WHERE id = $1', [milestoneId]);
    expect(msRes.rows[0].status).toBe('invoice_raised');
    expect(msRes.rows[0].invoice_reference).toBe(invoice.invoice_number);
  });

  it('should retrieve the generated invoice', async () => {
    const res = await request(app)
      .get(`/api/invoices/milestone/${milestoneId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(invoiceId);
    expect(res.body.data.invoice_number).toBeDefined();
  });

  it('should prevent generating a duplicate invoice for the same milestone', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        milestoneId,
        companyName: 'Duplicate Attempt'
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('should download/stream the invoice PDF successfully', async () => {
    const res = await request(app)
      .get(`/api/invoices/milestone/${milestoneId}/download`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toBe('application/pdf');
    expect(res.header['content-disposition']).toContain('attachment');
    expect(res.body).toBeDefined();
  });
});
