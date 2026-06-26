const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Quotation Versioning and Comparison API', () => {
  let accessToken;
  let tenantId;
  let projectId;
  let quotationIdV1;
  let quotationIdV2;
  let item1Key;
  let item2Key;
  let userId;

  beforeAll(async () => {
    // 1. Login to get access token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    accessToken = loginRes.body.data.accessToken;

    // Fetch tenant ID
    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // Fetch user ID
    const userRes = await pool.query("SELECT id FROM users WHERE email = 'admin@demo.com'");
    userId = userRes.rows[0].id;

    // Create a dummy project
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Quotation Test Project',
        client_name: 'Test Client',
        client_phone: '9876543210',
        client_email: 'client@test.com',
        contract_file_key: 'test_key',
        contract_file_name: 'contract.pdf',
        contract_file_size: 1024,
        contract_file_mime: 'application/pdf'
      });
    
    projectId = projRes.body.data.id;
  });

  afterAll(async () => {
    // Clean up
    if (projectId) {
      await pool.query('DELETE FROM projects WHERE id = $1 AND tenant_id = $2', [projectId, tenantId]);
    }
    await pool.end();
  });

  describe('BOQ Versioning and Revise Workflow', () => {
    it('should create an initial quotation version 1 and allow adding items', async () => {
      const qNum = `QT-${Date.now().toString().slice(-6)}`;
      const res = await request(app)
        .post(`/api/projects/${projectId}/quotations`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          quotationNumber: qNum,
          notes: 'Notes v1',
          termsConditions: 'Terms v1'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.version).toBe(1);
      expect(res.body.data.status).toBe('draft');
      quotationIdV1 = res.body.data.id;

      // Add Item 1
      const item1 = await request(app)
        .post(`/api/projects/${projectId}/quotations/${quotationIdV1}/items`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          roomOrArea: 'Living Room',
          itemName: 'Sofa',
          description: '3-Seater Premium Sofa',
          unit: 'Nos',
          quantity: 1,
          unitPrice: 35000,
          markupPercentage: 10
        });

      expect(item1.status).toBe(201);
      item1Key = item1.body.data.item_key;

      // Add Item 2
      const item2 = await request(app)
        .post(`/api/projects/${projectId}/quotations/${quotationIdV1}/items`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          roomOrArea: 'Kitchen',
          itemName: 'Cabinets',
          description: 'Modular wall cabinets',
          unit: 'SqFt',
          quantity: 40,
          unitPrice: 1200,
          markupPercentage: 5
        });

      expect(item2.status).toBe(201);
      item2Key = item2.body.data.item_key;
    });

    it('should allow revising the quotation to version 2, cloning items with same item_key', async () => {
      const reviseRes = await request(app)
        .post(`/api/projects/${projectId}/quotations/${quotationIdV1}/revise`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          changeReason: 'Client requested solid wood sofa and removed kitchen cabinets'
        });

      expect(reviseRes.status).toBe(201);
      expect(reviseRes.body.success).toBe(true);
      expect(reviseRes.body.data.version).toBe(2);
      expect(reviseRes.body.data.change_reason).toBe('Client requested solid wood sofa and removed kitchen cabinets');
      quotationIdV2 = reviseRes.body.data.id;

      // Check cloned items keys
      const q2Details = await request(app)
        .get(`/api/projects/${projectId}/quotations/${quotationIdV2}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(q2Details.status).toBe(200);
      const items = q2Details.body.data.items;
      expect(items).toHaveLength(2);

      const keys = items.map(i => i.item_key);
      expect(keys).toContain(item1Key);
      expect(keys).toContain(item2Key);
    });

    it('should allow updates and deletions of items in version 2', async () => {
      // Find the cabinet item in v2
      const q2Details = await request(app)
        .get(`/api/projects/${projectId}/quotations/${quotationIdV2}`)
        .set('Authorization', `Bearer ${accessToken}`);
      
      const cabinetsItem = q2Details.body.data.items.find(i => i.item_key === item2Key);
      const sofaItem = q2Details.body.data.items.find(i => i.item_key === item1Key);

      // Delete Cabinets
      const delRes = await request(app)
        .delete(`/api/projects/${projectId}/quotations/${quotationIdV2}/items/${cabinetsItem.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(delRes.status).toBe(200);

      // Update Sofa Item (change quantity to 2)
      const updateRes = await request(app)
        .put(`/api/projects/${projectId}/quotations/${quotationIdV2}/items/${sofaItem.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          roomOrArea: 'Living Room',
          itemName: 'Sofa',
          description: 'Solid teak 3-Seater Sofa',
          unit: 'Nos',
          quantity: 2,
          unitPrice: 40000,
          markupPercentage: 10
        });
      expect(updateRes.status).toBe(200);

      // Add a new item to v2 (Coffee table)
      const newItemRes = await request(app)
        .post(`/api/projects/${projectId}/quotations/${quotationIdV2}/items`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          roomOrArea: 'Living Room',
          itemName: 'Coffee Table',
          description: 'Glass top modern coffee table',
          unit: 'Nos',
          quantity: 1,
          unitPrice: 15000,
          markupPercentage: 0
        });
      expect(newItemRes.status).toBe(201);
    });

    it('should compare version 1 and version 2 and correctly report additions, removals, and modifications', async () => {
      const compRes = await request(app)
        .get(`/api/projects/${projectId}/quotations/${quotationIdV1}/compare/${quotationIdV2}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(compRes.status).toBe(200);
      expect(compRes.body.success).toBe(true);
      
      const comp = compRes.body.data;
      expect(comp.baseQuotation.version).toBe(1);
      expect(comp.targetQuotation.version).toBe(2);
      expect(comp.targetQuotation.change_reason).toBe('Client requested solid wood sofa and removed kitchen cabinets');

      const diffs = comp.diffs;
      
      // We expect:
      // 1. Sofa (modified/changed)
      // 2. Cabinets (removed)
      // 3. Coffee Table (added)
      
      const sofaDiff = diffs.find(d => d.item_key === item1Key);
      expect(sofaDiff.type).toBe('changed');
      expect(sofaDiff.changes.quantity.old).toBe("1.00");
      expect(sofaDiff.changes.quantity.new).toBe("2.00");

      const cabinetsDiff = diffs.find(d => d.item_key === item2Key);
      expect(cabinetsDiff.type).toBe('removed');

      const tableDiff = diffs.find(d => d.type === 'added');
      expect(tableDiff.item_name).toBe('Coffee Table');
    });

    it('should support scope tracking and reduce subtotal for a reduction item', async () => {
      // 1. Create a change order
      const coRes = await request(app)
        .post(`/api/projects/${projectId}/change-orders`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Client Reductions',
          description: 'Reduction of items requested by client',
          amount: 5000
        });
      expect(coRes.status).toBe(201);
      const coId = coRes.body.data.id;

      // 2. Add an item with scope_type = 'reduction' linked to this change order
      const redItemRes = await request(app)
        .post(`/api/projects/${projectId}/quotations/${quotationIdV2}/items`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          roomOrArea: 'Living Room',
          itemName: 'Sofa Reduction',
          description: 'Reduction in sofa quantity',
          unit: 'Nos',
          quantity: 1,
          unitPrice: 10000,
          markupPercentage: 0,
          scopeType: 'reduction',
          changeOrderId: coId
        });
      expect(redItemRes.status).toBe(201);
      expect(redItemRes.body.data.scope_type).toBe('reduction');
      expect(redItemRes.body.data.change_order_id).toBe(coId);

      // 3. Fetch quotation and verify items and subtotal are updated
      const qRes = await request(app)
        .get(`/api/projects/${projectId}/quotations/${quotationIdV2}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(qRes.status).toBe(200);
      
      const qData = qRes.body.data;
      // Sofa total_price = 2 * 40000 * 1.1 = 88000
      // Coffee Table total_price = 1 * 15000 * 1.0 = 15000
      // Sofa Reduction total_price = 1 * 10000 * 1.0 = 10000 (subtracted)
      // Expected Subtotal: 88000 + 15000 - 10000 = 93000
      expect(Number(qData.subtotal)).toBe(93000);
    });
  });

  describe('Quotation Client Approval Gate for Execution Tasks', () => {
    let executionMilestoneId;
    let taskId;

    beforeAll(async () => {
      // 1. Lock/freeze the project design scope so that the design freeze check passes
      await pool.query('UPDATE projects SET is_scope_locked = true WHERE id = $1', [projectId]);

      // 2. Create an execution phase (is_execution = true)
      const phaseRes = await pool.query(`
        INSERT INTO project_phases (tenant_id, project_id, name, sort_order, status, is_execution)
        VALUES ($1, $2, 'Procurement Phase', 1, 'pending', true)
        RETURNING id
      `, [tenantId, projectId]);
      const phaseId = phaseRes.rows[0].id;

      // 3. Create a milestone under that execution phase
      const milestoneRes = await pool.query(`
        INSERT INTO milestones (tenant_id, project_id, phase_id, name, description, status)
        VALUES ($1, $2, $3, 'Procurement Milestone', 'Milestone for procurement', 'pending')
        RETURNING id
      `, [tenantId, projectId, phaseId]);
      executionMilestoneId = milestoneRes.rows[0].id;
    });

    it('should block execution task creation when quotation is not accepted (e.g. in draft/sent status or none exists)', async () => {
      // Create a task under the execution milestone.
      // Since quotationIdV2 is in 'draft' status (not accepted), this should be blocked.
      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          milestoneId: executionMilestoneId,
          title: 'Procure Steel',
          description: '10 tons of steel',
          priority: 'high'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('QUOTATION_NOT_ACCEPTED');
    });

    it('should block execution task state transition from todo to in_progress when quotation is not accepted', async () => {
      // To test state transition block, we need a task first.
      // But we cannot create a task in an execution milestone if quotation is not accepted.
      // So we insert the task directly into the database using a DB query (bypassing the service gate),
      // and then attempt to transition its status via API.
      const taskRes = await pool.query(`
        INSERT INTO tasks (tenant_id, project_id, milestone_id, title, description, status, priority, created_by)
        VALUES ($1, $2, $3, 'Procure Cement', '50 bags', 'todo', 'medium', $4)
        RETURNING id
      `, [tenantId, projectId, executionMilestoneId, userId]);
      taskId = taskRes.rows[0].id;

      // Try updating status from 'todo' to 'in_progress'
      const res = await request(app)
        .patch(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: 'in_progress'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('QUOTATION_NOT_ACCEPTED');
    });

    it('should allow sending, accepting, and rejecting the quotation version 2', async () => {
      // 1. Send the quotation (transition from draft to sent)
      const sendRes = await request(app)
        .post(`/api/projects/${projectId}/quotations/${quotationIdV2}/send`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(sendRes.status).toBe(200);
      expect(sendRes.body.success).toBe(true);
      expect(sendRes.body.data.status).toBe('sent');

      // 2. Reject the quotation (from sent to rejected)
      const rejectRes = await request(app)
        .post(`/api/projects/${projectId}/quotations/${quotationIdV2}/reject`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.success).toBe(true);
      expect(rejectRes.body.data.status).toBe('rejected');

      // 3. Since it is rejected, we revise it to version 3 to make a new draft
      const reviseRes = await request(app)
        .post(`/api/projects/${projectId}/quotations/${quotationIdV2}/revise`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ changeReason: 'Revise after rejection' });
      expect(reviseRes.status).toBe(201);
      const quotationIdV3 = reviseRes.body.data.id;

      // 4. Accept the new draft version 3
      const acceptRes = await request(app)
        .post(`/api/projects/${projectId}/quotations/${quotationIdV3}/accept`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.success).toBe(true);
      expect(acceptRes.body.data.status).toBe('accepted');
      expect(acceptRes.body.data.accepted_at).toBeTruthy();
    });

    it('should allow execution task creation and status transition once quotation is accepted', async () => {
      // 1. Create task via API
      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          milestoneId: executionMilestoneId,
          title: 'Procure Steel - Approved',
          description: '10 tons of steel',
          priority: 'high'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // 2. Transition task state from todo to in_progress via API
      const updateRes = await request(app)
        .patch(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: 'in_progress'
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.status).toBe('in_progress');
    });
  });

  describe('Quotation GST/Tax and Discount calculations and toggling', () => {
    let gstQuotationId;
    let item1Id;
    let item2Id;

    it('should calculate row-level and quotation-level CGST and SGST splits for a draft quotation', async () => {
      const qNum = `QT-GST-${Date.now().toString().slice(-4)}`;
      const res = await request(app)
        .post(`/api/projects/${projectId}/quotations`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          quotationNumber: qNum,
          notes: 'GST Test Quotation',
          termsConditions: 'Terms v1'
        });

      expect(res.status).toBe(201);
      gstQuotationId = res.body.data.id;

      // Add Item 1 with 18% GST
      const item1Res = await request(app)
        .post(`/api/projects/${projectId}/quotations/${gstQuotationId}/items`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          roomOrArea: 'Living Room',
          itemName: 'Teak wood dining table',
          unit: 'Nos',
          quantity: 2,
          unitPrice: 10000,
          markupPercentage: 10,
          hsnCode: '9954',
          gstRate: 18
        });
      expect(item1Res.status).toBe(201);
      item1Id = item1Res.body.data.id;
      // total_price = 2 * 10000 * 1.1 = 22000
      expect(Number(item1Res.body.data.total_price)).toBe(22000);
      expect(Number(item1Res.body.data.cgst_amount)).toBe(1980);
      expect(Number(item1Res.body.data.sgst_amount)).toBe(1980);
      expect(Number(item1Res.body.data.igst_amount)).toBe(0);

      // Add Item 2 with 12% GST
      const item2Res = await request(app)
        .post(`/api/projects/${projectId}/quotations/${gstQuotationId}/items`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          roomOrArea: 'Kitchen',
          itemName: 'Sink',
          unit: 'Nos',
          quantity: 1,
          unitPrice: 5000,
          markupPercentage: 0,
          hsnCode: '9954',
          gstRate: 12
        });
      expect(item2Res.status).toBe(201);
      item2Id = item2Res.body.data.id;
      // total_price = 1 * 5000 * 1 = 5000
      expect(Number(item2Res.body.data.total_price)).toBe(5000);
      expect(Number(item2Res.body.data.cgst_amount)).toBe(300);
      expect(Number(item2Res.body.data.sgst_amount)).toBe(300);
      expect(Number(item2Res.body.data.igst_amount)).toBe(0);

      // Fetch quotation totals
      const qRes = await request(app)
        .get(`/api/projects/${projectId}/quotations/${gstQuotationId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(qRes.status).toBe(200);
      const q = qRes.body.data;
      expect(q.gst_type).toBe('cgst_sgst');
      expect(Number(q.subtotal)).toBe(27000);
      expect(Number(q.cgst_total)).toBe(2280);
      expect(Number(q.sgst_total)).toBe(2280);
      expect(Number(q.igst_total)).toBe(0);
      expect(Number(q.tax_amount)).toBe(4560);
      expect(Number(q.total_amount)).toBe(31560);
    });

    it('should toggle gst_type to igst and update all item-level and quotation-level splits', async () => {
      // Toggle GST type to igst
      const updateRes = await request(app)
        .put(`/api/projects/${projectId}/quotations/${gstQuotationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          gstType: 'igst'
        });
      expect(updateRes.status).toBe(200);

      // Fetch quotation with items
      const qRes = await request(app)
        .get(`/api/projects/${projectId}/quotations/${gstQuotationId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(qRes.status).toBe(200);
      const q = qRes.body.data;
      expect(q.gst_type).toBe('igst');
      expect(Number(q.subtotal)).toBe(27000);
      expect(Number(q.cgst_total)).toBe(0);
      expect(Number(q.sgst_total)).toBe(0);
      expect(Number(q.igst_total)).toBe(4560);
      expect(Number(q.tax_amount)).toBe(4560);
      expect(Number(q.total_amount)).toBe(31560);

      // Check items
      const item1 = q.items.find(i => i.id === item1Id);
      expect(Number(item1.cgst_amount)).toBe(0);
      expect(Number(item1.sgst_amount)).toBe(0);
      expect(Number(item1.igst_amount)).toBe(3960);

      const item2 = q.items.find(i => i.id === item2Id);
      expect(Number(item2.cgst_amount)).toBe(0);
      expect(Number(item2.sgst_amount)).toBe(0);
      expect(Number(item2.igst_amount)).toBe(600);
    });

    it('should update discount_amount and recalculate the grand total', async () => {
      const updateRes = await request(app)
        .put(`/api/projects/${projectId}/quotations/${gstQuotationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          discountAmount: 1560
        });
      expect(updateRes.status).toBe(200);
      expect(Number(updateRes.body.data.discount_amount)).toBe(1560);
      expect(Number(updateRes.body.data.total_amount)).toBe(30000); // 27000 + 4560 - 1560 = 30000
    });
  });
});
