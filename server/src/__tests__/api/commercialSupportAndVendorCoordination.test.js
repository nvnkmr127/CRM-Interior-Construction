process.env.STORAGE_PROVIDER = 'local';
const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Commercial Project Support & Multi-Vendor Coordination API', () => {
  jest.setTimeout(30000);
  let adminToken;
  let tenantId;
  let projectId;
  let complianceItemId;
  let vendorId;

  beforeAll(async () => {
    // 1. Login superadmin
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    adminToken = loginRes.body.data.accessToken;

    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // Cleanup potential stale projects
    await pool.query("DELETE FROM projects WHERE name = 'Commercial Tech Office'");
  });

  afterAll(async () => {
    // Cleanup
    if (projectId) {
      await pool.query('DELETE FROM project_compliance_checklists WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM project_vendors WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
    await pool.end();
  });

  it('should successfully create a commercial project and seed compliance items', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Commercial Tech Office',
        client_name: 'TechCorp HQ',
        project_category: 'commercial',
        fire_noc_status: 'pending',
        occupancy_permit_status: 'pending',
        retention_money_percentage: 7.5,
        ld_clause_details: 'LD of 1% per week of delay capped at 10%.',
        stakeholder_complexity: 'high',
        contract_file_key: 'test-contract-key',
        contract_file_name: 'techcorp_contract.pdf',
        contract_file_size: 15000,
        contract_file_mime: 'application/pdf',
        vendors: [
          {
            vendor_name: 'Modular Fitting Co',
            scope_of_work: 'Modular desk installations',
            agreed_rate: 85000,
            status: 'pending'
          }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.project_category).toBe('commercial');
    expect(parseFloat(res.body.data.retention_money_percentage)).toBe(7.5);
    projectId = res.body.data.id;

    // Verify vendor was added
    const vendorRes = await pool.query('SELECT id FROM project_vendors WHERE project_id = $1', [projectId]);
    expect(vendorRes.rows.length).toBe(1);
    vendorId = vendorRes.rows[0].id;
  });

  it('should retrieve category-specific compliance checklists', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/compliance`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(5); // Commercial seeds 5 items
    
    const fireNocItem = res.body.data.find(item => item.item_name === 'Fire NOC Approval');
    expect(fireNocItem).toBeDefined();
    expect(fireNocItem.status).toBe('pending');
    complianceItemId = fireNocItem.id;
  });

  it('should update and approve a compliance checklist item', async () => {
    const res = await request(app)
      .patch(`/api/projects/${projectId}/compliance/${complianceItemId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'approved',
        notes: 'Fire inspection passed, certificate received.'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('approved');
    expect(res.body.data.notes).toBe('Fire inspection passed, certificate received.');
    expect(res.body.data.approved_by).toBeDefined();
    expect(res.body.data.approved_at).toBeDefined();
  });

  it('should retrieve vendor coordination dashboard entries', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/vendor-coordination`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].vendor_name).toBe('Modular Fitting Co');
    expect(res.body.data[0].current_status).toBe('pending');
  });

  it('should update vendor schedule and blockers coordination status', async () => {
    const res = await request(app)
      .patch(`/api/projects/${projectId}/vendor-coordination/${vendorId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        scheduledStartDate: '2026-07-01',
        scheduledFinishDate: '2026-07-15',
        currentStatus: 'active',
        blockerDescription: 'Drywall plastering delayed'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.current_status).toBe('active');
    expect(res.body.data.blocker_description).toBe('Drywall plastering delayed');
    
    const start = new Date(res.body.data.scheduled_start_date);
    const finish = new Date(res.body.data.scheduled_finish_date);
    
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(6); // July
    expect(start.getDate()).toBe(1);
    
    expect(finish.getFullYear()).toBe(2026);
    expect(finish.getMonth()).toBe(6); // July
    expect(finish.getDate()).toBe(15);
  });
});
