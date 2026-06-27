const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');
const crypto = require('crypto');

describe('Material Substitution Approvals API', () => {
  let accessToken;
  let tenantId;
  let projectId;
  let quotationId;
  let boqItemId;
  let clientToken;
  let subId;

  beforeAll(async () => {
    // 1. Log in to get access token for staff
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    accessToken = loginRes.body.data.accessToken;

    // Fetch tenant ID
    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // Create a project
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Substitution Test Project',
        client_name: 'Substitution Client',
        client_phone: '9876543210',
        client_email: 'sub@test.com',
        contract_file_key: 'test_key',
        contract_file_name: 'contract.pdf',
        contract_file_size: 1024,
        contract_file_mime: 'application/pdf'
      });
    projectId = projRes.body.data.id;

    // Create a client portal user with raw token
    clientToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(clientToken).digest('hex');

    await pool.query(
      `INSERT INTO client_portal_users (tenant_id, project_id, name, phone, portal_token_hash, portal_token_expires_at)
       VALUES ($1, $2, 'Substitution Client', '9876543210', $3, NOW() + INTERVAL '1 day')`,
      [tenantId, projectId, tokenHash]
    );

    // Create quotation
    const quoteRes = await request(app)
      .post(`/api/projects/${projectId}/quotations`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        quotationNumber: `QT-SUB-${Date.now().toString().slice(-4)}`,
        notes: 'Notes',
        termsConditions: 'Terms'
      });
    quotationId = quoteRes.body.data.id;

    // Add item to quotation
    const itemRes = await request(app)
      .post(`/api/projects/${projectId}/quotations/${quotationId}/items`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        roomOrArea: 'Bedroom',
        itemName: 'Wardrobe Slider',
        description: 'Glass wardrobe doors',
        unit: 'SqFt',
        quantity: 50,
        unitPrice: 1000,
        markupPercentage: 10,
        brand: 'Standard Brand',
        materialSpecifications: 'MDF board framing'
      });
    boqItemId = itemRes.body.data.id;

    // Accept the quotation to make it the active execution BOQ
    await pool.query(
      "UPDATE quotations SET status = 'accepted' WHERE id = $1 AND tenant_id = $2",
      [quotationId, tenantId]
    );
  });

  afterAll(async () => {
    // Clean up
    if (projectId) {
      await pool.query('DELETE FROM client_portal_users WHERE project_id = $1 AND tenant_id = $2', [projectId, tenantId]);
      await pool.query('DELETE FROM material_substitutions WHERE project_id = $1 AND tenant_id = $2', [projectId, tenantId]);
      await pool.query('DELETE FROM projects WHERE id = $1 AND tenant_id = $2', [projectId, tenantId]);
    }
    await pool.end();
  });

  it('should intercept BOQ specification changes and create a pending material substitution request', async () => {
    // Update the item brand and specs
    const updateRes = await request(app)
      .put(`/api/projects/${projectId}/quotations/${quotationId}/items/${boqItemId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        roomOrArea: 'Bedroom',
        itemName: 'Wardrobe Slider',
        description: 'Glass wardrobe doors',
        unit: 'SqFt',
        quantity: 50,
        unitPrice: 1200, // upgrading unitPrice from 1000 to 1200
        markupPercentage: 10,
        brand: 'Premium Brand', // upgrading brand from Standard Brand to Premium Brand
        materialSpecifications: 'Solid Ply framing' // upgrading spec
      });

    expect(updateRes.status).toBe(200);

    // Verify the item's brand in the database is STILL the original 'Standard Brand'
    const itemDbRes = await pool.query('SELECT brand, unit_price FROM quotation_items WHERE id = $1', [boqItemId]);
    expect(itemDbRes.rows[0].brand).toBe('Standard Brand');
    expect(Number(itemDbRes.rows[0].unit_price)).toBe(1000.00);

    // Verify that a pending material substitution was created
    const subDbRes = await pool.query('SELECT * FROM material_substitutions WHERE boq_item_id = $1', [boqItemId]);
    expect(subDbRes.rows.length).toBe(1);
    expect(subDbRes.rows[0].status).toBe('pending');
    expect(subDbRes.rows[0].replacement_brand).toBe('Premium Brand');
    expect(subDbRes.rows[0].original_brand).toBe('Standard Brand');
    expect(Number(subDbRes.rows[0].price_difference)).toBe(200.00);

    subId = subDbRes.rows[0].id;
  });

  it('should list material substitutions in the client portal route', async () => {
    const listRes = await request(app)
      .get('/api/portal/material-substitutions')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(listRes.body.data.length).toBe(1);
    expect(listRes.body.data[0].id).toBe(subId);
  });

  it('should allow the client to approve a material substitution and apply changes to the BOQ', async () => {
    const approveRes = await request(app)
      .post(`/api/portal/material-substitutions/${subId}/respond`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        status: 'approved',
        feedback: 'Approved this upgrade',
        signatureName: 'John Client'
      });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.success).toBe(true);

    // Verify substitution record is updated with client sign-off
    const subDbRes = await pool.query('SELECT status, client_signoff_name FROM material_substitutions WHERE id = $1', [subId]);
    expect(subDbRes.rows[0].status).toBe('approved');
    expect(subDbRes.rows[0].client_signoff_name).toBe('John Client');

    // Verify that the BOQ item is now updated with the replacement brand and unit price
    const itemDbRes = await pool.query('SELECT brand, unit_price FROM quotation_items WHERE id = $1', [boqItemId]);
    expect(itemDbRes.rows[0].brand).toBe('Premium Brand');
    expect(Number(itemDbRes.rows[0].unit_price)).toBe(1200.00);
  });
});
