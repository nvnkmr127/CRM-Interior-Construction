const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Warehouse and Inventory Management API', () => {
  jest.setTimeout(30000);
  let accessToken;
  let tenantId;
  let projectId;
  let warehouseId;
  let itemId;
  let quarantinedItemId;

  beforeAll(async () => {
    // 1. Log in as admin
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    accessToken = loginRes.body.data.accessToken;

    // Fetch tenant ID
    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // 2. Create project
    const projRes = await pool.query(`
      INSERT INTO projects (tenant_id, name, client_name, client_phone, client_email, status, contract_value)
      VALUES ($1, 'Warehouse Test Project', 'WH Client', '5559990000', 'wh@client.com', 'active', 40000)
      RETURNING id
    `, [tenantId]);
    projectId = projRes.rows[0].id;
  });

  afterAll(async () => {
    if (projectId) {
      await pool.query('DELETE FROM inventory_transactions WHERE tenant_id = $1', [tenantId]);
      await pool.query('DELETE FROM quarantined_items WHERE tenant_id = $1', [tenantId]);
      await pool.query('DELETE FROM inventory_items WHERE tenant_id = $1', [tenantId]);
      await pool.query('DELETE FROM warehouses WHERE tenant_id = $1', [tenantId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
  });

  test('1. Create a warehouse successfully', async () => {
    const res = await request(app)
      .post('/api/warehouses')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Bangalore Central Warehouse',
        location: 'Indiranagar, Bangalore'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Bangalore Central Warehouse');
    warehouseId = res.body.data.id;
  });

  test('2. List warehouses', async () => {
    const res = await request(app)
      .get('/api/warehouses')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('3. Receive material (adds stock level, logs transaction)', async () => {
    const res = await request(app)
      .post(`/api/warehouses/${warehouseId}/receive`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        itemName: '19mm Teak Board',
        materialSpecifications: 'Marine Grade Commercial',
        brand: 'CenturyPly',
        quantity: 100,
        unit: 'Nos',
        binLocation: 'Aisle 2 - Shelf A',
        notes: 'Initial stock load'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(Number(res.body.data.quantity)).toBe(100);
    itemId = res.body.data.id;
  });

  test('4. Get active inventory list', async () => {
    const res = await request(app)
      .get(`/api/warehouses/${warehouseId}/inventory`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].item_name).toBe('19mm Teak Board');
  });

  test('5. Dispatch material to a site (logs dispatch, decrements stock)', async () => {
    const res = await request(app)
      .post(`/api/warehouses/${warehouseId}/dispatch`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        itemId,
        projectId,
        quantity: 30,
        notes: 'Dispatched to construction site.'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Number(res.body.data.quantity)).toBe(70); // 100 - 30
  });

  test('6. Validate dispatch amount (cannot dispatch more than available)', async () => {
    const res = await request(app)
      .post(`/api/warehouses/${warehouseId}/dispatch`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        itemId,
        projectId,
        quantity: 80, // only 70 left
        notes: 'Attempting over-dispatching'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('7. Return material from site (logs return, increments stock)', async () => {
    const res = await request(app)
      .post(`/api/warehouses/${warehouseId}/return`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        projectId,
        itemName: '19mm Teak Board',
        materialSpecifications: 'Marine Grade Commercial',
        brand: 'CenturyPly',
        quantity: 5,
        unit: 'Nos',
        binLocation: 'Aisle 2 - Shelf A',
        notes: 'Excess ply boards returned unused'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    // Since it matches on item_name, brand, specs, and project_id (which is projectId now!)
    // Wait, the returned stock is project_tagged, so it creates/adds to a project-tagged stock entry!
    expect(Number(res.body.data.quantity)).toBe(5);
    expect(res.body.data.project_id).toBe(projectId);
  });

  test('8. Move material to quarantine (logs quarantine, moves stock)', async () => {
    const res = await request(app)
      .post(`/api/warehouses/${warehouseId}/quarantine`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        itemId,
        quantity: 10,
        reason: 'Water/Moisture Damage',
        notes: 'Discovered leak in roof section B'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Number(res.body.data.quantity)).toBe(10);
    expect(res.body.data.reason).toBe('Water/Moisture Damage');
    quarantinedItemId = res.body.data.id;

    // Check that active stock decremented to 60 (70 - 10)
    const activeRes = await pool.query('SELECT quantity FROM inventory_items WHERE id = $1', [itemId]);
    expect(Number(activeRes.rows[0].quantity)).toBe(60);
  });

  test('9. Release material from quarantine (logs release, increments stock)', async () => {
    const res = await request(app)
      .post(`/api/warehouses/${warehouseId}/release`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        quarantinedItemId,
        quantity: 4,
        notes: 'Repolished, fully dried and QC approved'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    
    // Check that active stock incremented to 64 (60 + 4)
    const activeRes = await pool.query('SELECT quantity FROM inventory_items WHERE id = $1', [itemId]);
    expect(Number(activeRes.rows[0].quantity)).toBe(64);

    // Check that quarantined stock decremented to 6 (10 - 4)
    const qRes = await pool.query('SELECT quantity FROM quarantined_items WHERE id = $1', [quarantinedItemId]);
    expect(Number(qRes.rows[0].quantity)).toBe(6);
  });
});
