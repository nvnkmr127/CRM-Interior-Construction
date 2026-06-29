require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const pool = require('../src/config/db');
const { createProject } = require('../src/services/projects/createProject');
const { updateProject } = require('../src/services/projects/updateProject');
const projectRepository = require('../src/repositories/projectRepository');

async function test() {
  try {
    // 1. Get a tenant and user
    const tenantRes = await pool.query('SELECT id FROM tenants LIMIT 1');
    const userRes = await pool.query('SELECT id FROM users LIMIT 1');

    if (tenantRes.rows.length === 0 || userRes.rows.length === 0) {
      console.error('Missing tenants or users in the database to run the test.');
      return;
    }

    const tenantId = tenantRes.rows[0].id;
    const userId = userRes.rows[0].id;

    console.log(`Running verification test for site logistics...`);

    // 2. Mock project data with site logistics info
    const projectData = {
      name: 'Logistics Test Project',
      client_name: 'Primary client',
      client_phone: '1234567890',
      client_email: 'primary@example.com',
      contract_file_key: 'test_key',
      contract_file_name: 'test_contract.pdf',
      contract_file_size: 1024,
      contract_file_mime: 'application/pdf',
      
      // New logistics fields
      lift_availability: 'service',
      lift_dimensions: '6ft x 6ft x 8ft',
      staircase_access: 'wide, clear staircase',
      working_hour_window: '9 AM - 5 PM',
      society_contact: 'Sec Supervisor Mr. Rao (+91 9999999999)',
      parking_permission: 'allowed',
      unloading_area: 'Basement B1, parking bay 4',
      noc_requirements: 'Needs deposit check of 10000 INR and vendor list submit.'
    };

    // 3. Create Project
    console.log('Testing createProject service with site logistics...');
    const created = await createProject({ tenantId, userId, data: projectData });
    console.log('Project created successfully with ID:', created.id);

    // Fetch the project directly to inspect columns
    let fetched = await projectRepository.findProjectById(tenantId, created.id);
    console.log('Fetched lift_availability:', fetched.lift_availability);
    console.log('Fetched lift_dimensions:', fetched.lift_dimensions);
    console.log('Fetched staircase_access:', fetched.staircase_access);
    console.log('Fetched working_hour_window:', fetched.working_hour_window);
    console.log('Fetched society_contact:', fetched.society_contact);
    console.log('Fetched parking_permission:', fetched.parking_permission);
    console.log('Fetched unloading_area:', fetched.unloading_area);
    console.log('Fetched noc_requirements:', fetched.noc_requirements);

    // Assert values
    if (
      fetched.lift_availability !== 'service' ||
      fetched.lift_dimensions !== '6ft x 6ft x 8ft' ||
      fetched.staircase_access !== 'wide, clear staircase' ||
      fetched.working_hour_window !== '9 AM - 5 PM' ||
      fetched.society_contact !== 'Sec Supervisor Mr. Rao (+91 9999999999)' ||
      fetched.parking_permission !== 'allowed' ||
      fetched.unloading_area !== 'Basement B1, parking bay 4' ||
      fetched.noc_requirements !== 'Needs deposit check of 10000 INR and vendor list submit.'
    ) {
      throw new Error('Site logistics assertions failed during creation!');
    }
    console.log('Creation assertions passed.');

    // 4. Update Project
    console.log('Testing updateProject service with site logistics...');
    const updateData = {
      lift_availability: 'passenger_only',
      working_hour_window: '10 AM - 4 PM',
      parking_permission: 'restricted'
    };

    await updateProject({ tenantId, userId, projectId: created.id, data: updateData });
    console.log('Project updated successfully.');

    fetched = await projectRepository.findProjectById(tenantId, created.id);
    console.log('Fetched updated lift_availability:', fetched.lift_availability);
    console.log('Fetched updated working_hour_window:', fetched.working_hour_window);
    console.log('Fetched updated parking_permission:', fetched.parking_permission);

    if (
      fetched.lift_availability !== 'passenger_only' ||
      fetched.working_hour_window !== '10 AM - 4 PM' ||
      fetched.parking_permission !== 'restricted'
    ) {
      throw new Error('Site logistics assertions failed during update!');
    }
    console.log('Update assertions passed.');

    // 5. Clean up the project
    await pool.query('DELETE FROM projects WHERE id = $1', [created.id]);
    console.log('Cleaned up test project. Test completed successfully!');

  } catch (err) {
    console.error('Test failed with error:', err);
  } finally {
    await pool.end();
  }
}

test();
