require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const pool = require('../src/config/db');
const projectRepository = require('../src/repositories/projectRepository');

async function test() {
  try {
    console.log('Running verification test for site access & keys...');

    // 1. Get tenant and user
    const tenantRes = await pool.query('SELECT id FROM tenants LIMIT 1');
    const userRes = await pool.query('SELECT id FROM users LIMIT 1');

    if (tenantRes.rows.length === 0 || userRes.rows.length === 0) {
      console.error('Missing tenants or users in the database to run the test.');
      return;
    }

    const tenantId = tenantRes.rows[0].id;
    const userId = userRes.rows[0].id;

    // 2. Test createProject with Site Access data
    console.log('Testing createProject service with site access...');
    const projectData = {
      name: 'Site Access Test Project',
      client_name: 'Access Client',
      client_phone: '9876543210',
      client_email: 'access@client.com',
      booking_amount: 15000.00,
      status: 'active',
      custom_fields: {},
      created_by: userId,
      allowed_design_revisions: 3,
      current_design_revisions: 0,
      fire_noc_status: 'pending',
      occupancy_permit_status: 'pending',
      ld_clause_details: '',
      stakeholder_complexity: 'low',
      
      // New access fields
      key_holder_name: 'Vijay PM',
      key_holder_phone: '+91 98888 77777',
      spare_key_location: 'Guard Desk, Box B',
      gate_pass_number: 'GP-9988-2026',
      access_card_holder: 'Vijay PM / Painter Lead',
      access_time_restrictions: '8:30 AM to 6:00 PM'
    };

    const project = await projectRepository.createProject(tenantId, projectData);
    const projectId = project.id;
    console.log('Project created successfully with ID:', projectId);

    // Fetch and check
    const fetchRes = await pool.query('SELECT * FROM projects WHERE id = $1', [projectId]);
    const fetched = fetchRes.rows[0];

    console.log('Fetched key_holder_name:', fetched.key_holder_name);
    console.log('Fetched key_holder_phone:', fetched.key_holder_phone);
    console.log('Fetched spare_key_location:', fetched.spare_key_location);
    console.log('Fetched gate_pass_number:', fetched.gate_pass_number);
    console.log('Fetched access_card_holder:', fetched.access_card_holder);
    console.log('Fetched access_time_restrictions:', fetched.access_time_restrictions);

    if (
      fetched.key_holder_name !== 'Vijay PM' ||
      fetched.key_holder_phone !== '+91 98888 77777' ||
      fetched.spare_key_location !== 'Guard Desk, Box B' ||
      fetched.gate_pass_number !== 'GP-9988-2026' ||
      fetched.access_card_holder !== 'Vijay PM / Painter Lead' ||
      fetched.access_time_restrictions !== '8:30 AM to 6:00 PM'
    ) {
      throw new Error('Creation assertions failed!');
    }
    console.log('Creation assertions passed.');

    // 3. Test updateProject with Site Access data
    console.log('Testing updateProject service with site access...');
    const updateData = {
      key_holder_name: 'Vijay PM Updated',
      key_holder_phone: '+91 98888 66666',
      spare_key_location: 'Guard Desk, Box C'
    };

    await projectRepository.updateProject(tenantId, projectId, updateData);
    console.log('Project updated successfully.');

    const fetchUpdatedRes = await pool.query('SELECT * FROM projects WHERE id = $1', [projectId]);
    const fetchedUpdated = fetchUpdatedRes.rows[0];

    console.log('Fetched updated key_holder_name:', fetchedUpdated.key_holder_name);
    console.log('Fetched updated key_holder_phone:', fetchedUpdated.key_holder_phone);
    console.log('Fetched updated spare_key_location:', fetchedUpdated.spare_key_location);

    if (
      fetchedUpdated.key_holder_name !== 'Vijay PM Updated' ||
      fetchedUpdated.key_holder_phone !== '+91 98888 66666' ||
      fetchedUpdated.spare_key_location !== 'Guard Desk, Box C' ||
      fetchedUpdated.gate_pass_number !== 'GP-9988-2026' // should remain unchanged
    ) {
      throw new Error('Update assertions failed!');
    }
    console.log('Update assertions passed.');

    // Cleanup
    console.log('Cleaned up test project.');
    await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    console.log('Test completed successfully!');

  } catch (err) {
    console.error('Test failed with error:', err);
  } finally {
    await pool.end();
  }
}

test();
