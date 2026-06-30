const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Dispatch and Logistics Tracking Integration Tests', () => {
  let accessToken;
  let tenantId;
  let projectId;
  let boqItemId;
  let productionOrderId;
  let itemId;
  let dispatchId;

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
        name: 'Dispatch Logistics Test Project',
        client_name: 'Logistics Client',
        client_phone: '9876543088',
        client_email: 'logistics@test.com',
        contract_file_key: 'logistics_test_key',
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
       VALUES ($1, $2, 'QUOTE-LOGISTICS-TEST', 'accepted') RETURNING id`,
      [tenantId, projectId]
    );
    const quotationId = quoteRes.rows[0].id;

    const itemRes = await pool.query(
      `INSERT INTO quotation_items (tenant_id, quotation_id, item_name, quantity, unit_price, unit)
       VALUES ($1, $2, 'Kitchen Overhead Cabinet Set', 2, 24000, 'Sets') RETURNING id`,
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
        factoryName: 'Logistics Core Woodworks',
        expectedCompletionDate: new Date(Date.now() + 10 * 86400000).toISOString(),
        notes: 'Logistics dispatch order spec',
        items: [
          {
            boqItemId: boqItemId,
            quantity: 2,
            factoryAssignment: 'Logistics Core Woodworks'
          }
        ]
      });
    expect(res.status).toBe(201);
    productionOrderId = res.body.data.id;
    itemId = res.body.data.items[0].id;
  });

  it('should record passed QC inspection and clear order for dispatch', async () => {
    // 1. Pass QC
    const qcRes = await request(app)
      .post(`/api/projects/${projectId}/production-orders/${productionOrderId}/items/${itemId}/qc`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        status: 'passed',
        notes: 'Dimensions and finishes verified.',
        photoKeys: [],
        checklist: [
          { parameter: 'Dimensional Accuracy', passed: true, remarks: '' },
          { parameter: 'Edge Banding Finish', passed: true, remarks: '' },
          { parameter: 'Boring & Pre-Drills', passed: true, remarks: '' },
          { parameter: 'Surface & Core Quality', passed: true, remarks: '' },
          { parameter: 'Hardware Compatibility', passed: true, remarks: '' }
        ]
      });
    expect(qcRes.status).toBe(201);

    // 2. Clear for dispatch
    const clearRes = await request(app)
      .post(`/api/projects/${projectId}/production-orders/${productionOrderId}/clear-dispatch`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(clearRes.status).toBe(200);
    expect(clearRes.body.data.is_cleared_for_dispatch).toBe(true);
  });

  it('should dispatch production order with vehicle details, expected delivery date & time and verify manifest creation', async () => {
    const expectedDelivery = '2026-07-05T14:30:00.000Z';
    const res = await request(app)
      .post(`/api/projects/${projectId}/production-orders/${productionOrderId}/dispatch`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        vehicleNumber: 'KA-03-HA-8877',
        driverName: 'Driver Mahesh',
        driverContact: '9880011223',
        expectedDeliveryDate: expectedDelivery
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('in_transit');
    expect(res.body.data.vehicle_number).toBe('KA-03-HA-8877');
    expect(res.body.data.driver_name).toBe('Driver Mahesh');
    expect(res.body.data.driver_contact).toBe('9880011223');
    expect(res.body.data.expected_delivery_date).not.toBeNull();
    const dateObj = new Date(res.body.data.expected_delivery_date);
    expect(dateObj.getFullYear()).toBe(2026);
    expect(dateObj.getMonth()).toBe(6); // July is 6
    expect(dateObj.getDate()).toBe(5);

    dispatchId = res.body.data.id;

    // Verify manifest contents
    const manifest = res.body.data.manifest;
    expect(Array.isArray(manifest)).toBe(true);
    expect(manifest.length).toBe(1);
    expect(manifest[0].item_name).toBe('Kitchen Overhead Cabinet Set');
    expect(Number(manifest[0].quantity)).toBe(2);
    expect(manifest[0].unit).toBe('Sets');
  });

  it('should record delivery confirmation workflow on site', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/production-orders/${productionOrderId}/dispatch/${dispatchId}/receipt`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        receivedByName: 'Supervisor Amit Kumar',
        receiptNotes: 'Received all 2 sets in perfect condition. Unloading complete.'
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('delivered');
    expect(res.body.data.received_by_name).toBe('Supervisor Amit Kumar');
    expect(res.body.data.receipt_notes).toBe('Received all 2 sets in perfect condition. Unloading complete.');
    expect(res.body.data.actual_delivery_date).not.toBeNull();
  });
});
