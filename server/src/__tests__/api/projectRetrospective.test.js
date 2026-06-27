const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Project Retrospective API', () => {
  jest.setTimeout(20000);

  let accessToken;
  let tenantId;
  let projectId;
  let vendorId;

  beforeAll(async () => {
    // 1. Login CRM admin
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    accessToken = loginRes.body.data.accessToken;

    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // 2. Create a test project
    const projRes = await pool.query(
      `INSERT INTO projects (tenant_id, name, client_name, client_phone, client_email, status, contract_value)
       VALUES ($1, 'Test Retro Project', 'Retro Client', '9998887771', 'retro@client.com', 'active', 600000)
       RETURNING id`,
      [tenantId]
    );
    projectId = projRes.rows[0].id;

    // 3. Create a project vendor
    const vendorRes = await pool.query(
      `INSERT INTO project_vendors (tenant_id, project_id, vendor_name, scope_of_work, agreed_rate, status)
       VALUES ($1, $2, 'Retro Test Vendor', 'Tiling and Flooring', 45000, 'active')
       RETURNING id`,
      [tenantId, projectId]
    );
    vendorId = vendorRes.rows[0].id;
  });

  afterAll(async () => {
    if (projectId) {
      await pool.query('DELETE FROM project_retrospective_vendors WHERE tenant_id = $1', [tenantId]);
      await pool.query('DELETE FROM project_retrospectives WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM project_vendors WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
  });

  it('should fetch the default empty retrospective and include project vendors list', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/retrospective`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.retrospective).toBeNull();
    expect(res.body.data.vendorRatings).toHaveLength(1);
    expect(res.body.data.vendorRatings[0].project_vendor_id).toBe(vendorId);
    expect(res.body.data.vendorRatings[0].vendor_name).toBe('Retro Test Vendor');
    expect(res.body.data.vendorRatings[0].rating).toBeNull();
  });

  it('should fail to save retrospective with invalid rating range', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/retrospective`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        what_went_well: 'Design worked.',
        vendor_ratings: [
          {
            project_vendor_id: vendorId,
            rating: 10, // Invalid (max is 5)
            feedback: 'Terrible'
          }
        ]
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should successfully save retrospective and vendor ratings', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/retrospective`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        what_went_well: 'Great communication and woodwork.',
        what_went_wrong: 'Material supply delayed.',
        design_feedback: 'Render matches final look.',
        process_changes: 'Update estimation template buffer.',
        vendor_ratings: [
          {
            project_vendor_id: vendorId,
            rating: 4,
            feedback: 'Good work quality, slight delay.'
          }
        ]
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.retrospective).toBeDefined();
    expect(res.body.data.retrospective.what_went_well).toBe('Great communication and woodwork.');
    expect(res.body.data.vendorRatings[0].rating).toBe(4);
    expect(res.body.data.vendorRatings[0].feedback).toBe('Good work quality, slight delay.');
  });

  it('should persist the saved details on subsequent fetch', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/retrospective`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.retrospective.what_went_wrong).toBe('Material supply delayed.');
    expect(res.body.data.vendorRatings[0].rating).toBe(4);
    expect(res.body.data.vendorRatings[0].feedback).toBe('Good work quality, slight delay.');
  });
});
