const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

jest.setTimeout(60000);

describe('Room-Wise Completion Progress API', () => {
  let accessToken;
  let tenantId;
  let projectId;
  let userId;

  beforeAll(async () => {
    // Login to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    accessToken = loginRes.body.data.accessToken;

    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    const userRes = await pool.query("SELECT id FROM users WHERE email = 'admin@demo.com'");
    userId = userRes.rows[0].id;

    // Create test project
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Room Progress Test Project',
        client_name: 'Progress Client',
        client_phone: '9876543210',
        client_email: 'progress@test.com',
        contract_file_key: 'test_key',
        contract_file_name: 'contract.pdf',
        contract_file_size: 1024,
        contract_file_mime: 'application/pdf'
      });
    projectId = projRes.body.data.id;
  });

  afterAll(async () => {
    if (projectId) {
      await pool.query('DELETE FROM project_measurements WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM project_work_activities WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM tasks WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1 AND tenant_id = $2', [projectId, tenantId]);
    }
    await pool.end();
  });

  it('should return empty progress list initially', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/room-progress`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBe(0);
  });

  it('should successfully roll up progress from tasks and activities', async () => {
    // 1. Seed project measurement for 'Master Bedroom'
    await pool.query(`
      INSERT INTO project_measurements (tenant_id, project_id, room_name, length, width, height, area, unit)
      VALUES ($1, $2, 'Master Bedroom', 12, 10, 9, 120, 'feet')
    `, [tenantId, projectId]);

    // 2. Seed a completed project work activity in 'Master Bedroom'
    await pool.query(`
      INSERT INTO project_work_activities (tenant_id, project_id, room_name, trade, activity_name, status)
      VALUES ($1, $2, 'Master Bedroom', 'civil', 'Hacking & prep', 'completed')
    `, [tenantId, projectId]);

    // 3. Seed an incomplete project work activity in 'Master Bedroom'
    await pool.query(`
      INSERT INTO project_work_activities (tenant_id, project_id, room_name, trade, activity_name, status)
      VALUES ($1, $2, 'Master Bedroom', 'electrical', 'Wiring conduits', 'todo')
    `, [tenantId, projectId]);

    // 4. Seed a room-tagged task for 'Master Bedroom' that is completed (status = 'done')
    await pool.query(`
      INSERT INTO tasks (tenant_id, project_id, title, status, room_name)
      VALUES ($1, $2, 'Inspect Bed frame installation', 'done', 'Master Bedroom')
    `, [tenantId, projectId]);

    // 5. Seed a room-tagged task for 'Kitchen' (which has no measurements or activities) that is todo
    await pool.query(`
      INSERT INTO tasks (tenant_id, project_id, title, status, room_name)
      VALUES ($1, $2, 'Install modular chimney', 'todo', 'Kitchen')
    `, [tenantId, projectId]);

    // Call room progress endpoint
    const res = await request(app)
      .get(`/api/projects/${projectId}/room-progress`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(2); // 'Master Bedroom' and 'Kitchen'

    // Sort room details to ensure deterministic checks
    const data = res.body.data.sort((a, b) => a.roomName.localeCompare(b.roomName));
    
    // Kitchen validation (only 1 task which is 'todo')
    const kitchen = data.find(r => r.roomName === 'Kitchen');
    expect(kitchen).toBeDefined();
    expect(kitchen.measurements).toBeNull();
    expect(kitchen.totalTasks).toBe(1);
    expect(kitchen.completedTasks).toBe(0);
    expect(kitchen.progressPercentage).toBe(0);

    // Master Bedroom validation (2 activities (1 completed, 1 todo) + 1 task (completed))
    // Completed items = 1 activity + 1 task = 2
    // Total items = 2 activities + 1 task = 3
    // Progress percentage = 2 / 3 = 66.67%
    const masterBedroom = data.find(r => r.roomName === 'Master Bedroom');
    expect(masterBedroom).toBeDefined();
    expect(masterBedroom.measurements.area).toBe(120);
    expect(masterBedroom.totalActivities).toBe(2);
    expect(masterBedroom.completedActivities).toBe(1);
    expect(masterBedroom.totalTasks).toBe(1);
    expect(masterBedroom.completedTasks).toBe(1);
    expect(masterBedroom.progressPercentage).toBeCloseTo(66.67, 1);
  });
});
