const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Project Production Orders API', () => {
  let accessToken;
  let tenantId;
  let projectId;
  let boqItemId;
  let productionOrderId;
  let itemId;

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
        name: 'Production Test Project',
        client_name: 'Production Client',
        client_phone: '9876543222',
        client_email: 'prodclient@test.com',
        contract_file_key: 'prod_test_key',
        contract_file_name: 'contract.pdf',
        contract_file_size: 1024,
        contract_file_mime: 'application/pdf'
      });
    projectId = projRes.body.data.id;

    // Update project status to 'booked' to bypass verifyProjectBooked middleware
    await pool.query(
      "UPDATE projects SET status = 'booked' WHERE id = $1 AND tenant_id = $2",
      [projectId, tenantId]
    );

    // Create a dummy quotation/BOQ item for linking
    const quoteRes = await pool.query(
      `INSERT INTO quotations (tenant_id, project_id, quotation_number, status)
       VALUES ($1, $2, 'QUOTE-PROD-TEST', 'accepted') RETURNING id`,
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
    // Clean up
    if (projectId) {
      await pool.query('DELETE FROM projects WHERE id = $1 AND tenant_id = $2', [projectId, tenantId]);
    }
    await pool.end();
  });

  describe('Manage Production Orders', () => {
    it('should create a production order successfully', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/production-orders`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          factoryName: 'Main Woodwork Factory',
          expectedCompletionDate: new Date(Date.now() + 15 * 86400000).toISOString(),
          notes: 'Standard execution spec.',
          items: [
            {
              boqItemId: boqItemId,
              quantity: 5,
              factoryAssignment: 'Main Woodwork Factory'
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order_number).toBeDefined();
      expect(res.body.data.factory_name).toBe('Main Woodwork Factory');
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].item_name).toBe('Modular Kitchen Cabinet');
      
      productionOrderId = res.body.data.id;
      itemId = res.body.data.items[0].id;
    });

    it('should fetch list of production orders for a project', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/production-orders`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(productionOrderId);
    });

    it('should get detailed production order', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/production-orders/${productionOrderId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(productionOrderId);
      expect(res.body.data.items).toHaveLength(1);
    });

    it('should update production order metadata', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/production-orders/${productionOrderId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          notes: 'Updated specs with extra glue.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notes).toBe('Updated specs with extra glue.');
    });

    it('should update item-wise production schedule and status', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/production-orders/${productionOrderId}/items/${itemId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: 'in_production',
          productionStartDate: new Date().toISOString(),
          qcStatus: 'pending',
          packagingStatus: 'pending'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('in_production');
      expect(res.body.data.production_start_date).toBeDefined();

      // Check if parent order status auto-updated to scheduled / in_production
      const orderRes = await request(app)
        .get(`/api/projects/${projectId}/production-orders/${productionOrderId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(orderRes.body.data.status).toBe('in_production');
    });

    it('should complete production and record a failed QC inspection', async () => {
      // 1. Mark item production completed
      await request(app)
        .put(`/api/projects/${projectId}/production-orders/${productionOrderId}/items/${itemId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: 'completed',
          productionCompleteDate: new Date().toISOString()
        });

      // 2. Record failed QC inspection
      const res = await request(app)
        .post(`/api/projects/${projectId}/production-orders/${productionOrderId}/items/${itemId}/qc`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: 'failed',
          notes: 'Wardrobe door panel has a deep scratch on the edge banding.',
          photoKeys: ['defect_wardrobe_scratch_1.jpg', 'defect_wardrobe_scratch_2.jpg']
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('failed');
      expect(JSON.parse(res.body.data.photo_keys)).toContain('defect_wardrobe_scratch_1.jpg');

      // Verify item's qc_status is updated
      const orderRes = await request(app)
        .get(`/api/projects/${projectId}/production-orders/${productionOrderId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(orderRes.body.data.items[0].qc_status).toBe('failed');
    });

    it('should reject dispatch clearance when an item has failed QC', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/production-orders/${productionOrderId}/clear-dispatch`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(400); // Expect validation failure
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Cannot clear for dispatch');
    });

    it('should reject dispatching production order before QC clearance gate is approved', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/production-orders/${productionOrderId}/dispatch`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          vehicleNumber: 'KA-01-ME-1234',
          driverName: 'Ramesh Kumar',
          driverContact: '9876543210',
          expectedDeliveryDate: new Date().toISOString()
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('clearance gate');
    });

    it('should create a rework order for the failed item', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/production-orders/${productionOrderId}/items/${itemId}/rework`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          reworkInstructions: 'Re-apply edge banding laminate on the left border and polish.',
          assignedTo: 'Main Woodwork Factory - Line 2',
          targetDate: new Date(Date.now() + 2 * 86400000).toISOString() // 2 days from now
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rework_number).toBeDefined();
      expect(res.body.data.status).toBe('assigned');
      
      // Keep track of rework order id for completion
      const reworkId = res.body.data.id;

      // Verify item status is set back to in_production
      const orderRes = await request(app)
        .get(`/api/projects/${projectId}/production-orders/${productionOrderId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(orderRes.body.data.items[0].status).toBe('in_production');

      // Complete and verify rework order
      const completeRes = await request(app)
        .put(`/api/projects/${projectId}/production-orders/${productionOrderId}/rework/${reworkId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: 'verified'
        });

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.success).toBe(true);
      expect(completeRes.body.data.status).toBe('verified');

      // Verify item now has completed production status and passed QC
      const updatedOrderRes = await request(app)
        .get(`/api/projects/${projectId}/production-orders/${productionOrderId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(updatedOrderRes.body.data.items[0].status).toBe('completed');
      expect(updatedOrderRes.body.data.items[0].qc_status).toBe('passed');
    });

    it('should clear production order for dispatch once all items pass QC', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/production-orders/${productionOrderId}/clear-dispatch`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.is_cleared_for_dispatch).toBe(true);
      expect(res.body.data.cleared_by).toBeDefined();
    });

    it('should return the correct QC and Rework history summary', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/production-orders/${productionOrderId}/qc-rework-summary`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inspections).toHaveLength(1);
      expect(res.body.data.reworkOrders).toHaveLength(1);
      expect(res.body.data.inspections[0].item_name).toBe('Modular Kitchen Cabinet');
      expect(res.body.data.reworkOrders[0].item_name).toBe('Modular Kitchen Cabinet');
    });

    let dispatchId;

    it('should dispatch production order successfully once QC cleared', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/production-orders/${productionOrderId}/dispatch`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          vehicleNumber: 'KA-01-ME-1234',
          driverName: 'Ramesh Kumar',
          driverContact: '9876543210',
          expectedDeliveryDate: new Date(Date.now() + 1 * 86400000).toISOString()
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.dispatch_number).toBeDefined();
      expect(res.body.data.vehicle_number).toBe('KA-01-ME-1234');
      expect(res.body.data.status).toBe('in_transit');

      dispatchId = res.body.data.id;

      // Verify item packaging status is updated to 'dispatched'
      const orderRes = await request(app)
        .get(`/api/projects/${projectId}/production-orders/${productionOrderId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(orderRes.body.data.items[0].packaging_status).toBe('dispatched');
      expect(orderRes.body.data.items[0].dispatch_date).toBeDefined();
    });

    it('should confirm delivery receipt at site successfully', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/production-orders/${productionOrderId}/dispatch/${dispatchId}/receipt`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          receivedByName: 'Supervisor Amit',
          receiptNotes: 'All items received in good condition. Edge polish is verified.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('delivered');
      expect(res.body.data.received_by_name).toBe('Supervisor Amit');
      expect(res.body.data.actual_delivery_date).toBeDefined();
    });

    it('should retrieve list of dispatches/transits', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/production-orders/${productionOrderId}/dispatch`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(dispatchId);
      expect(res.body.data[0].status).toBe('delivered');
    });

    let damageId;

    it('should log transit damage successfully for a dispatched item', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/production-orders/${productionOrderId}/dispatch/${dispatchId}/items/${itemId}/damage`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          quantityDamaged: 2.00,
          damageSeverity: 'major',
          liabilityType: 'transporter',
          description: 'Laminate cracked on the corner of two cabinet doors during transport bump.',
          photoKeys: ['transit_crack_1.jpg', 'transit_crack_2.jpg'],
          resolutionTimeline: new Date(Date.now() + 3 * 86400000).toISOString()
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.damage_number).toBeDefined();
      expect(res.body.data.damage_severity).toBe('major');
      expect(res.body.data.liability_type).toBe('transporter');
      expect(res.body.data.status).toBe('reported');

      damageId = res.body.data.id;
    });

    it('should reject logging transit damage with quantity greater than shipped quantity', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/production-orders/${productionOrderId}/dispatch/${dispatchId}/items/${itemId}/damage`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          quantityDamaged: 10.00,
          damageSeverity: 'critical',
          description: 'Entire batch destroyed.'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('greater than shipped quantity');
    });

    it('should initiate a replacement production order successfully', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/production-orders/${productionOrderId}/damage/${damageId}/replacement`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.damageReport.status).toBe('replacement_initiated');
      expect(res.body.data.replacementOrder).toBeDefined();
      expect(res.body.data.replacementOrder.status).toBe('scheduled');
      expect(res.body.data.replacementOrder.order_number).toContain('REPL-');
    });

    it('should retrieve list of transit damages for a project/order', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/production-orders/${productionOrderId}/damage`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(damageId);
      expect(res.body.data[0].replacement_order_number).toBeDefined();
    });

    it('should update transit damage status and liability', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/production-orders/${productionOrderId}/damage/${damageId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: 'resolved',
          liabilityType: 'insurance_claim',
          resolutionNotes: 'Claim approved by insurance provider. Replacement batch completed installation at site.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('resolved');
      expect(res.body.data.liability_type).toBe('insurance_claim');
      expect(res.body.data.resolution_notes).toContain('Claim approved');
    });

    it('should get global factory production orders list', async () => {
      const res = await request(app)
        .get('/api/projects/factory/production-orders')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.some(o => o.id === productionOrderId)).toBe(true);
    });

    it('should update specific stage statuses for a production order item', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/production-orders/${productionOrderId}/items/${itemId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          cuttingStatus: 'in_progress',
          edgeBandingStatus: 'completed',
          drillingStatus: 'pending',
          assemblyStatus: 'na',
          cncStatus: 'pending_request'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.cutting_status).toBe('in_progress');
      expect(res.body.data.edge_banding_status).toBe('completed');
      expect(res.body.data.drilling_status).toBe('pending');
      expect(res.body.data.assembly_status).toBe('na');
      expect(res.body.data.cnc_status).toBe('pending_request');
    });

    it('should save and retrieve cutting list panels for a production order item', async () => {
      // 1. Save cutting list
      const saveRes = await request(app)
        .post(`/api/projects/${projectId}/production-orders/${productionOrderId}/items/${itemId}/cutting-list`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          panels: [
            {
              panel_name: 'Cabinet Side Panel L',
              length_mm: 720.00,
              width_mm: 560.00,
              thickness_mm: 18.00,
              material: 'Plywood',
              edge_banding: '2_long',
              quantity: 2,
              cnc_status: 'requested'
            },
            {
              panel_name: 'Cabinet Side Panel R',
              length_mm: 720.00,
              width_mm: 560.00,
              thickness_mm: 18.00,
              material: 'Plywood',
              edge_banding: '2_long',
              quantity: 2,
              cnc_status: 'not_required'
            }
          ]
        });

      expect(saveRes.status).toBe(200);
      expect(saveRes.body.success).toBe(true);

      // 2. Get cutting list
      const getRes = await request(app)
        .get(`/api/projects/${projectId}/production-orders/${productionOrderId}/items/${itemId}/cutting-list`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.success).toBe(true);
      expect(getRes.body.data).toHaveLength(2);
      expect(getRes.body.data[0].panel_name).toBe('Cabinet Side Panel L');
      expect(parseFloat(getRes.body.data[0].length_mm)).toBe(720);
      expect(getRes.body.data[0].edge_banding).toBe('2_long');
    });

    let cncRequestId;

    it('should create, retrieve, and update CNC requests for a production order', async () => {
      // 1. Create CNC request
      const createRes = await request(app)
        .post(`/api/projects/${projectId}/production-orders/${productionOrderId}/cnc-requests`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          programFileName: 'cabinet_left_router.cnc',
          notes: 'Groove depths must be exactly 8mm for back panel slide-in.'
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);
      expect(createRes.body.data.program_file_name).toBe('cabinet_left_router.cnc');
      expect(createRes.body.data.status).toBe('pending');
      
      cncRequestId = createRes.body.data.id;

      // 2. Retrieve CNC requests for order
      const getRes = await request(app)
        .get(`/api/projects/${projectId}/production-orders/${productionOrderId}/cnc-requests`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.success).toBe(true);
      expect(getRes.body.data.some(r => r.id === cncRequestId)).toBe(true);

      // 3. Retrieve global CNC requests list
      const globalRes = await request(app)
        .get('/api/projects/factory/cnc-requests')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(globalRes.status).toBe(200);
      expect(globalRes.body.success).toBe(true);
      expect(globalRes.body.data.some(r => r.id === cncRequestId)).toBe(true);

      // 4. Update CNC request status
      const updateRes = await request(app)
        .put(`/api/projects/${projectId}/production-orders/${productionOrderId}/cnc-requests/${cncRequestId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: 'completed',
          programFileName: 'cabinet_left_router_v2.cnc',
          notes: 'Design revised to include cable passage routing.'
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.status).toBe('completed');
      expect(updateRes.body.data.program_file_name).toBe('cabinet_left_router_v2.cnc');
      expect(updateRes.body.data.notes).toBe('Design revised to include cable passage routing.');
    });
  });
});
