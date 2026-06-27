process.env.STORAGE_PROVIDER = 'local';
const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Material Discontinuation & Room Handovers API', () => {
  jest.setTimeout(30000);
  let adminToken;
  let tenantId;
  let projectId;
  let quotationId;
  let boqItemId;
  let subId;
  let checklistId;
  let item1Id, item2Id;

  beforeAll(async () => {
    // 1. Login superadmin
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    adminToken = loginRes.body.data.accessToken;

    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // Clean up
    await pool.query("DELETE FROM projects WHERE name = 'Discontinue & Room Handover Project'");

    // 2. Create project
    const projRes = await pool.query(
      `INSERT INTO projects (tenant_id, name, client_name, status)
       VALUES ($1, 'Discontinue & Room Handover Project', 'Alice Client', 'active')
       RETURNING id`,
      [tenantId]
    );
    projectId = projRes.rows[0].id;

    // 3. Create quotation & item
    const quoteRes = await pool.query(
      `INSERT INTO quotations (tenant_id, project_id, quotation_number, status, version)
       VALUES ($1, $2, 'Q-DISC-101', 'approved', 1)
       RETURNING id`,
      [tenantId, projectId]
    );
    quotationId = quoteRes.rows[0].id;

    const boqRes = await pool.query(
      `INSERT INTO quotation_items (tenant_id, quotation_id, item_name, unit_price, quantity, material_specifications, brand, room_or_area)
       VALUES ($1, $2, 'Teak Wood Panel', 500, 10, 'Grade A teak veneer', 'TeakCorp', 'Living Room')
       RETURNING id`,
      [tenantId, quotationId]
    );
    boqItemId = boqRes.rows[0].id;

    // 4. Create handover checklist
    const checklistRes = await pool.query(
      `INSERT INTO handover_checklists (tenant_id, project_id, status, is_internally_authorized)
       VALUES ($1, $2, 'in_progress', TRUE)
       RETURNING id`,
      [tenantId, projectId]
    );
    checklistId = checklistRes.rows[0].id;

    // 5. Create handover items
    const hi1Res = await pool.query(
      `INSERT INTO handover_items (checklist_id, room, description, is_checked)
       VALUES ($1, 'Living Room', 'Paneling work complete', TRUE)
       RETURNING id`,
      [checklistId]
    );
    item1Id = hi1Res.rows[0].id;

    const hi2Res = await pool.query(
      `INSERT INTO handover_items (checklist_id, room, description, is_checked)
       VALUES ($1, 'Kitchen', 'Modular cabinets installed', FALSE)
       RETURNING id`,
      [checklistId]
    );
    item2Id = hi2Res.rows[0].id;
  });

  afterAll(async () => {
    // Clean up records in reverse order
    if (projectId) {
      await pool.query('DELETE FROM project_room_handovers WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM material_substitutions WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM handover_items WHERE checklist_id = $1', [checklistId]);
      await pool.query('DELETE FROM handover_checklists WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM quotation_items WHERE quotation_id = $1', [quotationId]);
      await pool.query('DELETE FROM quotations WHERE id = $1', [quotationId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
    await pool.end();
  });

  describe('Material Discontinuation Workflow', () => {
    it('should successfully flag a BOQ item as discontinued', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/boq-items/${boqItemId}/discontinue`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.is_discontinued).toBe(true);

      const checkDb = await pool.query('SELECT is_discontinued FROM quotation_items WHERE id = $1', [boqItemId]);
      expect(checkDb.rows[0].is_discontinued).toBe(true);
    });

    it('should reset is_discontinued to false once substitution is approved', async () => {
      // 1. Propose substitution
      const propRes = await request(app)
        .post(`/api/projects/${projectId}/material-substitutions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          boqItemId,
          reasonShortage: 'Material discontinued by supplier',
          replacementItemName: 'Premium Engineered Wood Panel',
          replacementBrand: 'WoodArt',
          replacementMaterialSpecifications: 'Engineered oak sheet veneer',
          replacementUnitPrice: 550
        });

      expect(propRes.status).toBe(201);
      subId = propRes.body.data.id;

      // 2. Client approves substitution
      const appRes = await request(app)
        .put(`/api/projects/${projectId}/material-substitutions/${subId}/respond`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          clientApprovalStatus: 'approved',
          clientSignoffName: 'Alice',
          clientSignatureData: 'signature-raw-data',
          clientFeedback: 'Oak panels are fine'
        });

      expect(appRes.status).toBe(200);
      expect(appRes.body.data.status).toBe('approved');

      // 3. Verify BOQ item is no longer marked discontinued and has updated specs
      const boqDb = await pool.query('SELECT * FROM quotation_items WHERE id = $1', [boqItemId]);
      expect(boqDb.rows[0].is_discontinued).toBe(false);
      expect(boqDb.rows[0].item_name).toBe('Premium Engineered Wood Panel');
      expect(parseFloat(boqDb.rows[0].unit_price)).toBe(550);
    });
  });

  describe('Partial Room-level Handover Workflow', () => {
    it('should retrieve list of rooms with their handover statuses', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/room-handovers`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2); // Living Room & Kitchen
      
      const living = res.body.data.find(r => r.room === 'Living Room');
      expect(living.status).toBe('pending');
    });

    it('should sign off Living Room successfully (all items are checked)', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/room-handovers/sign-off`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          checklistId,
          roomName: 'Living Room',
          clientName: 'Alice Client',
          otp: '1234'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('signed_off');
      expect(res.body.data.room_name).toBe('Living Room');

      // Verify automation job created
      const jobRes = await pool.query(
        "SELECT * FROM automation_jobs WHERE event_type = 'generate_room_handover_pdf' ORDER BY created_at DESC LIMIT 1"
      );
      expect(jobRes.rows.length).toBe(1);
      expect(JSON.parse(jobRes.rows[0].record).roomName).toBe('Living Room');
    });

    it('should refuse to sign off Kitchen (contains unchecked items)', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/room-handovers/sign-off`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          checklistId,
          roomName: 'Kitchen',
          clientName: 'Alice Client',
          otp: '1234'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Cannot sign off room Kitchen');
    });
  });
});
