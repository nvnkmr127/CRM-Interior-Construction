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
        name: 'Quotation Test Project',
        client_name: 'Test Client',
        client_phone: '9876543210',
        client_email: 'client@test.com',
        contract_file_key: 'test_key',
        contract_file_name: 'contract.pdf',
        contract_file_size: 1024,
        contract_file_mime: 'application/pdf'
      });
    
    projectId = projRes.body.data.project_id;
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
  });
});
