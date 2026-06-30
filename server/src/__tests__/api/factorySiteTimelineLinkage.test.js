const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Factory-to-Project Timeline Linkage Integration Tests', () => {
  let accessToken;
  let tenantId;
  let projectId;
  let factoryTaskId;
  let installationTaskId;
  let boqItemId;
  let productionOrderId;
  let dispatchId;

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

    // 2. Create test project
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Timeline Linkage Test Project',
        client_name: 'Linkage Client',
        client_phone: '9876543111',
        client_email: 'linkage@test.com',
        contract_file_key: 'linkage_test_key',
        contract_file_name: 'contract.pdf',
        contract_file_size: 1024,
        contract_file_mime: 'application/pdf'
      });
    projectId = projRes.body.data.id;

    // Set to booked to bypass status locks if any
    await pool.query(
      "UPDATE projects SET status = 'booked' WHERE id = $1 AND tenant_id = $2",
      [projectId, tenantId]
    );

    // Create a dummy quotation/BOQ item for linking
    const quoteRes = await pool.query(
      `INSERT INTO quotations (tenant_id, project_id, quotation_number, status)
       VALUES ($1, $2, 'QUOTE-LINK-TEST', 'accepted') RETURNING id`,
      [tenantId, projectId]
    );
    const quotationId = quoteRes.rows[0].id;

    const itemRes = await pool.query(
      `INSERT INTO quotation_items (tenant_id, quotation_id, item_name, quantity, unit_price, unit)
       VALUES ($1, $2, 'Modular Kitchen Cabinet', 5, 25000, 'Nos') RETURNING id`,
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

  it('should auto-create dependency link between factory production and site installation tasks', async () => {
    // 1. Create factory task
    const factoryRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Factory Woodwork Production'
      });
    expect(factoryRes.status).toBe(201);
    factoryTaskId = factoryRes.body.data.id;

    // 2. Create installation task
    const installRes = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Woodwork Assembly & Installation'
      });
    expect(installRes.status).toBe(201);
    installationTaskId = installRes.body.data.id;

    // 3. Query dependencies to verify autoLinkService established finish-to-start linkage
    const depsRes = await request(app)
      .get(`/api/projects/${projectId}/task-dependencies`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(depsRes.status).toBe(200);
    const match = depsRes.body.data.find(
      (d) => d.task_id === installationTaskId && d.depends_on_task_id === factoryTaskId
    );
    expect(match).toBeDefined();
    expect(match.dependency_type).toBe('finish-to-start');
  });

  it('should allow completing the factory production task', async () => {
    const res = await request(app)
      .patch(`/api/projects/${projectId}/tasks/${factoryTaskId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'done' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('done');
  });

  it('should block starting installation task when no production order exists (FACTORY_PRODUCTION_REQUIRED)', async () => {
    const res = await request(app)
      .patch(`/api/projects/${projectId}/tasks/${installationTaskId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'in_progress' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('FACTORY_PRODUCTION_REQUIRED');
    expect(res.body.error.message).toContain('Factory production must be scheduled');
  });

  it('should block starting installation task when production order exists but not dispatched (FACTORY_DISPATCH_REQUIRED)', async () => {
    // 1. Create production order
    const poRes = await request(app)
      .post(`/api/projects/${projectId}/production-orders`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        factoryName: 'Linkage Factory',
        expectedCompletionDate: new Date(Date.now() + 10 * 86400000).toISOString(),
        notes: 'Integration linkage test',
        items: [
          {
            boqItemId: boqItemId,
            quantity: 5,
            factoryAssignment: 'Linkage Factory'
          }
        ]
      });
    expect(poRes.status).toBe(201);
    productionOrderId = poRes.body.data.id;
    const itemId = poRes.body.data.items[0].id;

    // Mark item production status and packaging status as completed
    await pool.query(
      `UPDATE production_order_items 
       SET status = 'completed',
           cutting_status = 'completed',
           edge_banding_status = 'completed',
           drilling_status = 'completed',
           assembly_status = 'completed',
           qc_status = 'passed',
           packaging_status = 'packaged'
       WHERE id = $1`,
      [itemId]
    );

    // 2. Try starting installation task
    const res = await request(app)
      .patch(`/api/projects/${projectId}/tasks/${installationTaskId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'in_progress' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('FACTORY_DISPATCH_REQUIRED');
    expect(res.body.error.message).toContain('Factory dispatch must be confirmed');
  });

  it('should block starting installation task when order dispatched but not delivered (MATERIAL_RECEIPT_REQUIRED)', async () => {
    // 1. Clear dispatch gate
    const clearRes = await request(app)
      .post(`/api/projects/${projectId}/production-orders/${productionOrderId}/clear-dispatch`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(clearRes.status).toBe(200);

    // 2. Dispatch order (creates dispatch record, status = 'in_transit')
    const dispatchRes = await request(app)
      .post(`/api/projects/${projectId}/production-orders/${productionOrderId}/dispatch`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        vehicleNumber: 'KA-03-HA-1234',
        driverName: 'Ramesh Singh',
        driverContact: '9876543000',
        expectedDeliveryDate: new Date(Date.now() + 2 * 86400000).toISOString()
      });
    expect(dispatchRes.status).toBe(201);
    dispatchId = dispatchRes.body.data.id;

    // 3. Try starting installation task
    const res = await request(app)
      .patch(`/api/projects/${projectId}/tasks/${installationTaskId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'in_progress' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MATERIAL_RECEIPT_REQUIRED');
    expect(res.body.error.message).toContain('Material receipt at site has not been recorded');
  });

  it('should allow starting installation task once material receipt is recorded (status = delivered)', async () => {
    // 1. Record site delivery
    const deliveryRes = await request(app)
      .put(`/api/projects/${projectId}/production-orders/${productionOrderId}/dispatch/${dispatchId}/receipt`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        receivedByName: 'Site Supervisor Amit',
        notes: 'All items received intact.'
      });
    expect(deliveryRes.status).toBe(200);

    // 2. Start installation task
    const res = await request(app)
      .patch(`/api/projects/${projectId}/tasks/${installationTaskId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'in_progress' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('in_progress');
  });
});
