const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Physical Sample and Material Approval Tracking', () => {
  jest.setTimeout(30000);
  let accessToken;
  let tenantId;
  let projectId;
  let quotationId;
  let boqItemId;
  let paletteItemId;

  beforeAll(async () => {
    // 1. Login to get access token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    accessToken = loginRes.body.data.accessToken;

    // Fetch tenant ID
    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // 2. Create project
    const projRes = await pool.query(`
      INSERT INTO projects (tenant_id, name, client_name, status)
      VALUES ($1, 'Material Sample Test Project', 'Jack Sparrow', 'active')
      RETURNING id
    `, [tenantId]);
    projectId = projRes.rows[0].id;

    // 3. Create Quotation and BOQ item
    const quoteRes = await pool.query(`
      INSERT INTO quotations (tenant_id, project_id, quotation_number, status)
      VALUES ($1, $2, 'QT-TEST-99', 'sent')
      RETURNING id
    `, [tenantId, projectId]);
    quotationId = quoteRes.rows[0].id;

    const itemRes = await pool.query(`
      INSERT INTO quotation_items (tenant_id, quotation_id, room_or_area, item_name, unit, quantity, unit_price)
      VALUES ($1, $2, 'Kitchen', 'Quartz Countertop', 'SqFt', 40, 350)
      RETURNING id
    `, [tenantId, quotationId]);
    boqItemId = itemRes.rows[0].id;
  });

  afterAll(async () => {
    if (paletteItemId) {
      await pool.query('DELETE FROM project_material_palettes WHERE id = $1', [paletteItemId]);
    }
    if (boqItemId) {
      await pool.query('DELETE FROM quotation_items WHERE id = $1', [boqItemId]);
    }
    if (quotationId) {
      await pool.query('DELETE FROM quotations WHERE id = $1', [quotationId]);
    }
    if (projectId) {
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
  });

  it('fetches BOQ items for material palette linking', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/material-palettes/boq-items`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].item_name).toBe('Quartz Countertop');
  });

  it('creates a material sample with sample category and links it to BOQ item', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/material-palettes`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        room_name: 'Kitchen',
        item_name: 'Quartz Swatch',
        brand: 'KalingaStone',
        shade_code: 'KS-Quartz-902',
        finish: 'Glossy Polish',
        sample_category: 'Tile / Marble',
        date_presented: '2026-06-29',
        client_decision: 'deferred',
        boq_item_id: boqItemId
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sample_category).toBe('Tile / Marble');
    expect(res.body.data.client_decision).toBe('deferred');
    expect(res.body.data.boq_item_id).toBe(boqItemId);
    paletteItemId = res.body.data.id;
  });

  it('approves a sample, auto-aligning status and setting client sign-off metadata', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/material-palettes/${paletteItemId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        client_decision: 'approved',
        approved_by_signature: 'Jack Sparrow',
        client_feedback: 'Loved the polished finish and thickness'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.client_decision).toBe('approved');
    expect(res.body.data.status).toBe('approved');
    expect(res.body.data.approved_by_signature).toBe('Jack Sparrow');
    expect(res.body.data.client_approved_at).not.toBeNull();
  });

  it('lists material palette items containing joined BOQ item detail fields', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/material-palettes`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const item = res.body.data.find(i => i.id === paletteItemId);
    expect(item).toBeDefined();
    expect(item.boq_item_name).toBe('Quartz Countertop');
    expect(item.boq_room_or_area).toBe('Kitchen');
  });
});
