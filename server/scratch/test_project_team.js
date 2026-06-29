require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const pool = require('../src/config/db');
const projectRepository = require('../src/repositories/projectRepository');

async function test() {
  try {
    console.log('Running verification test for project team roles...');

    // 1. Get tenant and user
    const tenantRes = await pool.query('SELECT id FROM tenants LIMIT 1');
    const userRes = await pool.query('SELECT id FROM users LIMIT 1');

    if (tenantRes.rows.length === 0 || userRes.rows.length === 0) {
      console.error('Missing tenants or users in the database to run the test.');
      return;
    }

    const tenantId = tenantRes.rows[0].id;
    const userId = userRes.rows[0].id;

    // 2. Test createProject with team roles data
    console.log('Testing createProject service with team roles...');
    const projectData = {
      name: 'Project Team Test Project',
      client_name: 'Team Client',
      client_phone: '9876543210',
      client_email: 'team@client.com',
      booking_amount: 10000.00,
      status: 'active',
      custom_fields: {},
      created_by: userId,
      allowed_design_revisions: 3,
      current_design_revisions: 0,
      fire_noc_status: 'pending',
      occupancy_permit_status: 'pending',
      ld_clause_details: '',
      stakeholder_complexity: 'low',
      
      // Team roles IDs pointing to the single user
      lead_designer_id: userId,
      junior_designer_id: userId,
      site_engineer_id: userId,
      qc_engineer_id: userId,
      site_supervisor_id: userId,
      crm_executive_id: userId,
      procurement_officer_id: userId
    };

    const project = await projectRepository.createProject(tenantId, projectData);
    const projectId = project.id;
    console.log('Project created successfully with ID:', projectId);

    // Fetch and check
    const fetched = await projectRepository.findProjectById(tenantId, projectId);

    console.log('Fetched lead_designer_id:', fetched.lead_designer_id);
    console.log('Fetched lead_designer_name:', fetched.lead_designer_name);
    console.log('Fetched junior_designer_id:', fetched.junior_designer_id);
    console.log('Fetched junior_designer_name:', fetched.junior_designer_name);
    console.log('Fetched site_engineer_id:', fetched.site_engineer_id);
    console.log('Fetched site_engineer_name:', fetched.site_engineer_name);
    console.log('Fetched qc_engineer_id:', fetched.qc_engineer_id);
    console.log('Fetched qc_engineer_name:', fetched.qc_engineer_name);
    console.log('Fetched site_supervisor_id:', fetched.site_supervisor_id);
    console.log('Fetched site_supervisor_name:', fetched.site_supervisor_name);
    console.log('Fetched crm_executive_id:', fetched.crm_executive_id);
    console.log('Fetched crm_executive_name:', fetched.crm_executive_name);
    console.log('Fetched procurement_officer_id:', fetched.procurement_officer_id);
    console.log('Fetched procurement_officer_name:', fetched.procurement_officer_name);

    if (
      fetched.lead_designer_id !== userId ||
      fetched.junior_designer_id !== userId ||
      fetched.site_engineer_id !== userId ||
      fetched.qc_engineer_id !== userId ||
      fetched.site_supervisor_id !== userId ||
      fetched.crm_executive_id !== userId ||
      fetched.procurement_officer_id !== userId ||
      !fetched.lead_designer_name ||
      !fetched.junior_designer_name ||
      !fetched.site_engineer_name ||
      !fetched.qc_engineer_name ||
      !fetched.site_supervisor_name ||
      !fetched.crm_executive_name ||
      !fetched.procurement_officer_name
    ) {
      throw new Error('Creation or JOIN assertions failed!');
    }
    console.log('Creation and JOIN assertions passed.');

    // 3. Test updateProject service with team roles
    console.log('Testing updateProject service with team roles...');
    const updateData = {
      lead_designer_id: null,
      junior_designer_id: null
    };

    await projectRepository.updateProject(tenantId, projectId, updateData);
    console.log('Project updated successfully.');

    const fetchedUpdated = await projectRepository.findProjectById(tenantId, projectId);

    console.log('Fetched updated lead_designer_id:', fetchedUpdated.lead_designer_id);
    console.log('Fetched updated lead_designer_name:', fetchedUpdated.lead_designer_name);

    if (
      fetchedUpdated.lead_designer_id !== null ||
      fetchedUpdated.junior_designer_id !== null ||
      fetchedUpdated.site_engineer_id !== userId || // remains unchanged
      fetchedUpdated.lead_designer_name !== null
    ) {
      throw new Error('Update assertions failed!');
    }
    console.log('Update assertions passed.');

    // Cleanup
    console.log('Cleaning up test project...');
    await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    console.log('Test completed successfully!');

  } catch (err) {
    console.error('Test failed with error:', err);
  } finally {
    await pool.end();
  }
}

test();
