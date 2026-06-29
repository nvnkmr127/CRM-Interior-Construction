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

    console.log(`Running verification test for tenant ${tenantId} and user ${userId}...`);

    // 2. Mock project data with household profile
    const projectData = {
      name: 'Verification Test Project',
      client_name: 'Primary client',
      client_phone: '1234567890',
      client_email: 'primary@example.com',
      contract_file_key: 'test_key',
      contract_file_name: 'test_contract.pdf',
      contract_file_size: 1024,
      contract_file_mime: 'application/pdf',
      
      // New fields
      spouse_name: 'Partner Doe',
      spouse_phone: '9876543210',
      spouse_email: 'partner@example.com',
      number_of_family_members: 5,
      lifestyle_preferences: 'Wants open space layouts and glass finishes.',
      preferred_communication_channel: 'WhatsApp',

      contacts: [
        {
          name: 'Partner Doe',
          phone: '9876543210',
          email: 'partner@example.com',
          role: 'spouse',
          decision_authority: 'Primary',
          contact_preference: 'WhatsApp',
          approval_authority_level: 'Joint'
        }
      ]
    };

    // 3. Create Project
    console.log('Testing createProject service...');
    const created = await createProject({ tenantId, userId, data: projectData });
    console.log('Project created successfully with ID:', created.id);

    // Fetch the project and contacts directly to inspect
    let fetched = await projectRepository.findProjectById(tenantId, created.id);
    console.log('Fetched project spouse_name:', fetched.spouse_name);
    console.log('Fetched project preferred channel:', fetched.preferred_communication_channel);
    console.log('Fetched project family count:', fetched.number_of_family_members);
    console.log('Fetched project contacts length:', fetched.contacts.length);
    console.log('Fetched project contact 0 preference:', fetched.contacts[0]?.contact_preference);
    console.log('Fetched project contact 0 approval:', fetched.contacts[0]?.approval_authority_level);

    // Assert values
    if (
      fetched.spouse_name !== 'Partner Doe' ||
      fetched.number_of_family_members !== 5 ||
      fetched.preferred_communication_channel !== 'WhatsApp' ||
      fetched.contacts[0]?.contact_preference !== 'WhatsApp' ||
      fetched.contacts[0]?.approval_authority_level !== 'Joint'
    ) {
      throw new Error('Verification assertion failed during creation!');
    }
    console.log('Creation assertions passed.');

    // 4. Update Project
    console.log('Testing updateProject service...');
    const updateData = {
      spouse_name: 'Spouse Doe Updated',
      number_of_family_members: 6,
      contacts: [
        {
          name: 'Spouse Doe Updated',
          phone: '9876543210',
          email: 'partner@example.com',
          role: 'spouse',
          decision_authority: 'Primary',
          contact_preference: 'Email',
          approval_authority_level: 'Full'
        }
      ]
    };

    const updated = await updateProject({ tenantId, userId, projectId: created.id, data: updateData });
    console.log('Project updated successfully.');

    fetched = await projectRepository.findProjectById(tenantId, created.id);
    console.log('Fetched updated project spouse_name:', fetched.spouse_name);
    console.log('Fetched updated project family count:', fetched.number_of_family_members);
    console.log('Fetched updated contact preference:', fetched.contacts[0]?.contact_preference);
    console.log('Fetched updated contact approval:', fetched.contacts[0]?.approval_authority_level);

    if (
      fetched.spouse_name !== 'Spouse Doe Updated' ||
      fetched.number_of_family_members !== 6 ||
      fetched.contacts[0]?.contact_preference !== 'Email' ||
      fetched.contacts[0]?.approval_authority_level !== 'Full'
    ) {
      throw new Error('Verification assertion failed during update!');
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
