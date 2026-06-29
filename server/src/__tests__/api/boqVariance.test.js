const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');
const crypto = require('crypto');

describe('BOQ Variance Reports API', () => {
  jest.setTimeout(30000);
  let accessToken;
  let tenantId;
  let projectId;
  let quotationId;
  let originalItemId;
  let changeOrderId;
  let clientToken;

  beforeAll(async () => {
    // 1. Log in as admin
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
        name: 'Variance Test Project',
        client_name: 'Variance Client',
        client_phone: '7777777777',
        client_email: 'variance@test.com',
        contract_file_key: 'var_test_key',
        contract_file_name: 'contract.pdf',
        contract_file_size: 1024,
        contract_file_mime: 'application/pdf',
        site_address: '123 Variance Road, Bangalore',
        payment_terms: 'Net 15'
      });
    projectId = projRes.body.data.id;

    // Set project status to 'ongoing' to bypass booking lock restrictions
    await pool.query(
      `UPDATE projects 
       SET status = 'ongoing' 
       WHERE id = $1`, 
      [projectId]
    );

    // Create client portal user for signing substitutions
    clientToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(clientToken).digest('hex');
    await pool.query(
      `INSERT INTO client_portal_users (tenant_id, project_id, name, phone, portal_token_hash, portal_token_expires_at)
       VALUES ($1, $2, 'Variance Client', '7777777777', $3, NOW() + INTERVAL '1 day')`,
      [tenantId, projectId, tokenHash]
    );

    // 3. Create a quotation
    const quoteRes = await request(app)
      .post(`/api/projects/${projectId}/quotations`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        quotationNumber: `QT-VAR-${Date.now().toString().slice(-4)}`,
        notes: 'Initial Quotation Notes',
        termsConditions: 'T&C'
      });
    quotationId = quoteRes.body.data.id;

    // 4. Add original item to quotation (Qty = 10, Price = 1000, Markup = 10% -> Total = 11000)
    const itemRes = await request(app)
      .post(`/api/projects/${projectId}/quotations/${quotationId}/items`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        roomOrArea: 'Living Room',
        itemName: 'Luxury Sofa Set',
        description: '3-seater leather sofa',
        unit: 'Nos',
        quantity: 10,
        unitPrice: 1000,
        markupPercentage: 10,
        brand: 'SofaCo',
        materialSpecifications: 'Genuine Italian leather'
      });
    originalItemId = itemRes.body.data.id;

    // 5. Accept the quotation
    await request(app)
      .post(`/api/projects/${projectId}/quotations/${quotationId}/accept`)
      .set('Authorization', `Bearer ${accessToken}`);

    // 6. Create a change order
    const coRes = await request(app)
      .post(`/api/projects/${projectId}/change-orders`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Extra living room lighting',
        description: 'Add spot lights and dimmers',
        reason: 'client-requested',
        amount: 11000,
        timeline_impact_days: 2,
        status: 'draft'
      });
    changeOrderId = coRes.body.data.id;

    // 7. Add scope addition item to quotation (Qty = 5, Price = 2000, Markup = 10% -> Total = 11000)
    await request(app)
      .post(`/api/projects/${projectId}/quotations/${quotationId}/items`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        roomOrArea: 'Living Room',
        itemName: 'LED Spotlights',
        description: 'Dimmable warm LEDs',
        unit: 'Nos',
        quantity: 5,
        unitPrice: 2000,
        markupPercentage: 10,
        scopeType: 'addition',
        changeOrderId: changeOrderId
      });

    // 8. Approve the change order
    await request(app)
      .patch(`/api/projects/${projectId}/change-orders/${changeOrderId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'approved' });

    // 9. Propose and approve a material substitution
    // Original price: 1000 -> Replacement price: 1200 -> Price Difference: 200 * 10 Qty * 1.1 markup = 2200 impact
    const subRes = await request(app)
      .post(`/api/projects/${projectId}/material-substitutions`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        boqItemId: originalItemId,
        reasonShortage: 'Italian leather out of stock, replacing with premium fabric',
        replacementItemName: 'Luxury Sofa Set - Premium Fabric',
        replacementBrand: 'FabricCo',
        replacementMaterialSpecifications: 'Premium velvet fabric',
        replacementUnitPrice: 1200
      });
    const substitutionId = subRes.body.data.id;

    // Approve substitution using portal route or respond route
    await request(app)
      .put(`/api/projects/${projectId}/material-substitutions/${substitutionId}/respond`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        clientApprovalStatus: 'approved',
        clientFeedback: 'Looks good'
      });
  });

  afterAll(async () => {
    if (projectId) {
      await pool.query('DELETE FROM material_substitutions WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM client_portal_users WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM project_change_orders WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM quotation_items WHERE tenant_id = $1 AND quotation_id = $2', [tenantId, quotationId]);
      await pool.query('DELETE FROM quotations WHERE id = $1', [quotationId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
    await pool.end();
  });

  it('should retrieve a detailed BOQ variance report for a single project', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/boq-variance`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.project.name).toBe('Variance Test Project');

    // Summary calculations verification:
    // Original Quote (base original items before substitution): 11000
    // Approved Change Orders: 11000
    // Material Revisions Impact: 2200 (price diff: 200 * qty: 10 * 1.1 markup)
    // Current Contract Value (subtotal): 11000 + 11000 + 2200 = 24200
    // Net Variance: 24200 - 11000 = 13200
    // Variance %: (13200 / 11000) * 100 = 120%
    const summary = data.summary;
    expect(Number(summary.originalSubtotal)).toBeCloseTo(11000, 2);
    expect(Number(summary.changeOrderSubtotal)).toBeCloseTo(11000, 2);
    expect(Number(summary.materialRevisionSubtotal)).toBeCloseTo(2200, 2);
    expect(Number(summary.currentSubtotal)).toBeCloseTo(24200, 2);
    expect(Number(summary.varianceAmount)).toBeCloseTo(13200, 2);
    expect(Number(summary.variancePercentage)).toBeCloseTo(120, 2);

    // Change Orders detailed check
    expect(data.changeOrders.length).toBe(1);
    expect(data.changeOrders[0].title).toBe('Extra living room lighting');
    expect(data.changeOrders[0].items.length).toBe(1);
    expect(data.changeOrders[0].items[0].item_name).toBe('LED Spotlights');

    // Material substitutions details check
    expect(data.materialSubstitutions.length).toBe(1);
    expect(data.materialSubstitutions[0].originalName).toBe('Luxury Sofa Set');
    expect(data.materialSubstitutions[0].replacementName).toBe('Luxury Sofa Set - Premium Fabric');
    expect(Number(data.materialSubstitutions[0].totalImpact)).toBeCloseTo(2200, 2);

    // Room breakdown detailed check
    expect(data.roomBreakdown.length).toBe(1);
    expect(data.roomBreakdown[0].roomOrArea).toBe('Living Room');
    expect(Number(data.roomBreakdown[0].originalValue)).toBeCloseTo(11000, 2);
    expect(Number(data.roomBreakdown[0].currentValue)).toBeCloseTo(24200, 2);
  });

  it('should retrieve a portfolio-wide BOQ variance report', async () => {
    const res = await request(app)
      .get('/api/projects/boq-variance')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const projectRow = res.body.data.find(r => r.projectId === projectId);
    expect(projectRow).toBeDefined();
    expect(projectRow.projectName).toBe('Variance Test Project');
    expect(Number(projectRow.originalSubtotal)).toBeCloseTo(11000, 2);
    expect(Number(projectRow.changeOrderSubtotal)).toBeCloseTo(11000, 2);
    expect(Number(projectRow.materialRevisionSubtotal)).toBeCloseTo(2200, 2);
    expect(Number(projectRow.currentSubtotal)).toBeCloseTo(24200, 2);
    expect(Number(projectRow.varianceAmount)).toBeCloseTo(13200, 2);
    expect(Number(projectRow.variancePercentage)).toBeCloseTo(120, 2);
  });
});
