const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Pre-Dispatch Quality Control (QC) Module Integration Tests', () => {
  let accessToken;
  let tenantId;
  let projectId;
  let boqItemId;
  let productionOrderId;
  let itemId;

  jest.setTimeout(30000);

  beforeAll(async () => {
    // 1. Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    accessToken = loginRes.body.data.accessToken;

    // Fetch tenant ID
    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // 2. Create test project
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Pre-Dispatch QC Test Project',
        client_name: 'QC Client',
        client_phone: '9876543009',
        client_email: 'qc@test.com',
        contract_file_key: 'qc_test_key',
        contract_file_name: 'contract.pdf',
        contract_file_size: 1024,
        contract_file_mime: 'application/pdf'
      });
    projectId = projRes.body.data.id;

    // Set status to booked to bypass status constraints
    await pool.query(
      "UPDATE projects SET status = 'booked' WHERE id = $1 AND tenant_id = $2",
      [projectId, tenantId]
    );

    // Create a dummy quotation/BOQ item for linking
    const quoteRes = await pool.query(
      `INSERT INTO quotations (tenant_id, project_id, quotation_number, status)
       VALUES ($1, $2, 'QUOTE-QC-TEST', 'accepted') RETURNING id`,
      [tenantId, projectId]
    );
    const quotationId = quoteRes.rows[0].id;

    const itemRes = await pool.query(
      `INSERT INTO quotation_items (tenant_id, quotation_id, item_name, quantity, unit_price, unit)
       VALUES ($1, $2, 'Modular Wardrobe Panel', 5, 12000, 'Nos') RETURNING id`,
      [tenantId, quotationId]
    );
    boqItemId = itemRes.rows[0].id;
  });

  afterAll(async () => {
    if (projectId) {
      await pool.query('DELETE FROM projects WHERE id = $1 AND tenant_id = $2', [projectId, tenantId]);
    }
    await pool.end();
  });

  it('should create a production order successfully', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/production-orders`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        factoryName: 'QC Woodwork Factory',
        expectedCompletionDate: new Date(Date.now() + 10 * 86400000).toISOString(),
        notes: 'QC check order spec',
        items: [
          {
            boqItemId: boqItemId,
            quantity: 5,
            factoryAssignment: 'QC Woodwork Factory'
          }
        ]
      });
    expect(res.status).toBe(201);
    productionOrderId = res.body.data.id;
    itemId = res.body.data.items[0].id;
  });

  it('should reject failed QC inspection if no defect photo is provided (QC_PHOTO_REQUIRED)', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/production-orders/${productionOrderId}/items/${itemId}/qc`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        status: 'failed',
        notes: 'Chipping on edge bands.',
        photoKeys: [],
        checklist: [
          { parameter: 'Dimensional Accuracy', passed: true, remarks: '' },
          { parameter: 'Edge Banding Finish', passed: false, remarks: 'Delamination' },
          { parameter: 'Boring & Pre-Drills', passed: true, remarks: '' },
          { parameter: 'Surface & Core Quality', passed: true, remarks: '' },
          { parameter: 'Hardware Compatibility', passed: true, remarks: '' }
        ]
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('QC_PHOTO_REQUIRED');
    expect(res.body.error.message).toContain('At least one defect photograph is required');
  });

  it('should reject passed QC inspection if any checklist item is unchecked (QC_CHECKLIST_FAILED)', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/production-orders/${productionOrderId}/items/${itemId}/qc`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        status: 'passed',
        notes: 'Looks okay except for dimensions.',
        photoKeys: [],
        checklist: [
          { parameter: 'Dimensional Accuracy', passed: false, remarks: 'Too short' },
          { parameter: 'Edge Banding Finish', passed: true, remarks: '' },
          { parameter: 'Boring & Pre-Drills', passed: true, remarks: '' },
          { parameter: 'Surface & Core Quality', passed: true, remarks: '' },
          { parameter: 'Hardware Compatibility', passed: true, remarks: '' }
        ]
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('QC_CHECKLIST_FAILED');
    expect(res.body.error.message).toContain('one or more checklist items have failed');
  });

  it('should record failed QC inspection successfully if defect photos are provided', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/production-orders/${productionOrderId}/items/${itemId}/qc`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        status: 'failed',
        notes: 'Edge band chipping.',
        photoKeys: ['defect_edge_chipping.jpg'],
        checklist: [
          { parameter: 'Dimensional Accuracy', passed: true, remarks: '' },
          { parameter: 'Edge Banding Finish', passed: false, remarks: 'Chipping' },
          { parameter: 'Boring & Pre-Drills', passed: true, remarks: '' },
          { parameter: 'Surface & Core Quality', passed: true, remarks: '' },
          { parameter: 'Hardware Compatibility', passed: true, remarks: '' }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('failed');
    expect(res.body.data.photo_keys).toContain('defect_edge_chipping.jpg');

    // Verify item qc_status has been set to failed
    const itemRes = await pool.query('SELECT qc_status FROM production_order_items WHERE id = $1', [itemId]);
    expect(itemRes.rows[0].qc_status).toBe('failed');
  });

  it('should record passed QC inspection successfully when all checklist items pass', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/production-orders/${productionOrderId}/items/${itemId}/qc`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        status: 'passed',
        notes: 'All items are perfect.',
        photoKeys: [],
        checklist: [
          { parameter: 'Dimensional Accuracy', passed: true, remarks: '' },
          { parameter: 'Edge Banding Finish', passed: true, remarks: '' },
          { parameter: 'Boring & Pre-Drills', passed: true, remarks: '' },
          { parameter: 'Surface & Core Quality', passed: true, remarks: '' },
          { parameter: 'Hardware Compatibility', passed: true, remarks: '' }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('passed');

    // Verify item qc_status has been set to passed
    const itemRes = await pool.query('SELECT qc_status FROM production_order_items WHERE id = $1', [itemId]);
    expect(itemRes.rows[0].qc_status).toBe('passed');
  });
});
