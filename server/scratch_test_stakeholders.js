require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('./src/config/db');
const projectRepository = require('./src/repositories/projectRepository');
const { createProject } = require('./src/services/projects/createProject');
const { updateProject } = require('./src/services/projects/updateProject');

async function testStakeholders() {
  console.log('Starting Stakeholders and Contacts Integration Verification...');

  try {
    // 1. Get a demo tenant and user
    const tenantRes = await pool.query('SELECT id FROM tenants LIMIT 1');
    const userRes = await pool.query('SELECT id FROM users LIMIT 1');

    if (tenantRes.rows.length === 0 || userRes.rows.length === 0) {
      console.error('Missing tenant or user in the database. Cannot run verification.');
      process.exit(1);
    }

    const tenantId = tenantRes.rows[0].id;
    const userId = userRes.rows[0].id;
    console.log(`Using Tenant ID: ${tenantId}, User ID: ${userId}`);

    // 2. Create a project with stakeholders
    const projectData = {
      name: 'Stakeholder Test Project',
      client_name: 'Primary Contact',
      client_phone: '1234567890',
      client_email: 'primary@example.com',
      contacts: [
        {
          name: 'Spouse Contact',
          phone: '9876543210',
          email: 'spouse@example.com',
          role: 'spouse',
          decision_authority: 'Influencer',
          relationship_notes: 'Spouse co-approves design'
        },
        {
          name: 'Architect Contact',
          phone: '5555555555',
          email: 'architect@example.com',
          role: 'architect',
          decision_authority: 'Consultant',
          relationship_notes: 'Architect coordinating design signoffs'
        }
      ]
    };

    console.log('\nCreating project with stakeholders...');
    const createdProject = await createProject({
      tenantId,
      userId,
      data: projectData
    });

    console.log(`Project created successfully! ID: ${createdProject.id}`);

    // 3. Fetch project details and verify stakeholders are attached
    console.log('\nFetching project to verify contacts...');
    const fetchedProject = await projectRepository.findProjectById(tenantId, createdProject.id);

    console.log('Fetched Contacts:');
    console.log(JSON.stringify(fetchedProject.contacts, null, 2));

    if (!fetchedProject.contacts || fetchedProject.contacts.length !== 2) {
      throw new Error(`Expected 2 contacts, but found: ${fetchedProject.contacts ? fetchedProject.contacts.length : 0}`);
    }
    console.log('SUCCESS: Contacts fetched correctly!');

    // 4. Update project (change one contact, delete one contact, and add a new contact)
    const spouseId = fetchedProject.contacts.find(c => c.role === 'spouse').id;
    const updateData = {
      name: 'Stakeholder Test Project Updated',
      contacts: [
        {
          id: spouseId, // keep and update existing contact
          name: 'Spouse Contact Updated',
          phone: '9876543211',
          email: 'spouse_updated@example.com',
          role: 'spouse',
          decision_authority: 'Primary',
          relationship_notes: 'Now has primary decision authority'
        },
        {
          name: 'Legal Representative', // new contact
          phone: '1111111111',
          email: 'legal@example.com',
          role: 'legal',
          decision_authority: 'Consultant',
          relationship_notes: 'Handles agreement review'
        }
      ]
    };

    console.log('\nUpdating project contacts (modifying Spouse, removing Architect, adding Legal)...');
    const updatedProject = await updateProject({
      tenantId,
      userId,
      projectId: createdProject.id,
      data: updateData
    });

    console.log('Updated Contacts:');
    console.log(JSON.stringify(updatedProject.contacts, null, 2));

    if (!updatedProject.contacts || updatedProject.contacts.length !== 2) {
      throw new Error(`Expected 2 contacts after update, but found: ${updatedProject.contacts ? updatedProject.contacts.length : 0}`);
    }

    const roles = updatedProject.contacts.map(c => c.role);
    if (!roles.includes('spouse') || !roles.includes('legal') || roles.includes('architect')) {
      throw new Error('Contacts not correctly synced! Architect should be deleted, Spouse updated, Legal added.');
    }

    const updatedSpouse = updatedProject.contacts.find(c => c.role === 'spouse');
    if (updatedSpouse.name !== 'Spouse Contact Updated' || updatedSpouse.decision_authority !== 'Primary') {
      throw new Error('Spouse contact was not updated correctly.');
    }

    console.log('SUCCESS: Contacts updated and synced successfully in PostgreSQL transaction!');

    // 5. Clean up by deleting the project (should cascade delete contacts)
    console.log('\nDeleting project to verify cascade delete...');
    await pool.query('DELETE FROM projects WHERE id = $1', [createdProject.id]);

    const countRes = await pool.query('SELECT count(*)::int FROM project_contacts WHERE project_id = $1', [createdProject.id]);
    console.log(`Contacts count for deleted project: ${countRes.rows[0].count}`);
    if (countRes.rows[0].count !== 0) {
      throw new Error('Cascade delete failed! Contacts still exist for deleted project.');
    }
    console.log('SUCCESS: Project and contacts cascade deleted successfully.');

  } catch (error) {
    console.error('\nTest Failed with error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testStakeholders();
