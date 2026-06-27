const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Resource Utilisation Analytics API', () => {
  jest.setTimeout(30000);
  let accessToken;
  let tenantId;
  let projectId;
  let pmId;
  let taskId;

  beforeAll(async () => {
    // 1. Log in
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    accessToken = loginRes.body.data.accessToken;

    // Fetch tenant ID and admin user ID (pmId)
    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    const userRes = await pool.query("SELECT id FROM users WHERE tenant_id = $1 LIMIT 1", [tenantId]);
    pmId = userRes.rows[0].id;

    // 2. Create active project allocated to this user as PM (10 hours PM allocation)
    const projRes = await pool.query(`
      INSERT INTO projects (tenant_id, name, client_name, client_phone, client_email, status, pm_id, pm_hours_allocated, designer_id, designer_hours_allocated)
      VALUES ($1, 'Resource Utilisation Project', 'Resource Client', '5555555555', 'resource@client.com', 'active', $2, 10, $2, 0)
      RETURNING id
    `, [tenantId, pmId]);
    projectId = projRes.rows[0].id;

    // 3. Create a task assigned to this user
    const taskRes = await pool.query(`
      INSERT INTO tasks (tenant_id, project_id, title, assignee_id, status)
      VALUES ($1, $2, 'Prepare designs', $3, 'done')
      RETURNING id
    `, [tenantId, projectId, pmId]);
    taskId = taskRes.rows[0].id;
  });

  afterAll(async () => {
    if (projectId) {
      await pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
    await pool.end();
  });

  it('should retrieve resource utilisation report and verify workloads and tasks', async () => {
    const res = await request(app)
      .get('/api/analytics/resource-utilisation')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const resources = res.body.data;
    const testUser = resources.find(u => u.id === pmId);
    
    expect(testUser).toBeDefined();
    expect(testUser.weeklyCapacity).toBe(40); // default capacity
    expect(testUser.totalHoursAllocated).toBe(10);
    
    // workloadScore = (10 / 40) * 100 = 25%
    expect(testUser.workloadScore).toBe(25.0);
    expect(testUser.availability).toBe(30); // 40 - 10 = 30
    
    // totalTasks = 1, completedTasks = 1 -> completionPercentage = 100%
    expect(testUser.totalTasks).toBe(1);
    expect(testUser.completedTasks).toBe(1);
    expect(testUser.completionPercentage).toBe(100.0);
    
    expect(testUser.activeProjectsCount).toBe(1);
    expect(testUser.activeProjects[0].name).toBe('Resource Utilisation Project');
  });
});
