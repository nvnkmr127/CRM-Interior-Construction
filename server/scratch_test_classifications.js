require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('./src/config/db');

async function runTests() {
  try {
    console.log('Connected to DB via pool successfully.');

    // 1. Fetch valid tenant & user
    const tenantRes = await pool.query('SELECT id FROM tenants LIMIT 1');
    if (tenantRes.rows.length === 0) {
      throw new Error('No tenants found in database.');
    }
    const tenantId = tenantRes.rows[0].id;

    const userRes = await pool.query('SELECT id FROM users WHERE tenant_id = $1 LIMIT 1', [tenantId]);
    if (userRes.rows.length === 0) {
      throw new Error('No users found for this tenant.');
    }
    const userId = userRes.rows[0].id;
    console.log(`Using Tenant: ${tenantId}, User: ${userId}`);

    // 2. Create a project directly with classifications
    console.log('\nCreating project with classification fields...');
    const { createProject } = require('./src/services/projects/createProject');
    const project = await createProject({
      tenantId,
      userId,
      data: {
        name: 'Classification Test Project',
        project_type: 'full_interior',
        client_name: 'Test Client',
        client_phone: '9999988888',
        contract_file_key: 'test_key',
        contract_file_name: 'contract.pdf',
        contract_file_size: 1024,
        contract_file_mime: 'application/pdf',
        project_category: 'residential',
        project_sub_category: 'apartment',
        property_type: 'owned',
        property_age: 'new',
        renovation_scope: 'none',
        segment: 'luxury'
      }
    });

    console.log(`Project created: ${project.id}`);
    console.log(`Category: ${project.project_category}`);
    console.log(`Sub-category: ${project.project_sub_category}`);
    console.log(`Property Type: ${project.property_type}`);
    console.log(`Property Age: ${project.property_age}`);
    console.log(`Renovation Scope: ${project.renovation_scope}`);
    console.log(`Segment: ${project.segment}`);

    if (
      project.project_category !== 'residential' ||
      project.project_sub_category !== 'apartment' ||
      project.property_type !== 'owned' ||
      project.property_age !== 'new' ||
      project.renovation_scope !== 'none' ||
      project.segment !== 'luxury'
    ) {
      throw new Error('Classifications properties mismatch during project creation!');
    }
    console.log('Project creation classifications verified successfully.');

    // 3. Test updating project classifications
    console.log('\nTesting updating project classifications...');
    const { updateProject } = require('./src/services/projects/updateProject');
    const updatedProject = await updateProject({
      tenantId,
      userId,
      projectId: project.id,
      data: {
        project_category: 'commercial',
        project_sub_category: 'office',
        property_type: 'rented',
        property_age: '1-5_years',
        renovation_scope: 'full',
        segment: 'standard'
      }
    });

    console.log(`Updated Category: ${updatedProject.project_category}`);
    console.log(`Updated Sub-category: ${updatedProject.project_sub_category}`);
    console.log(`Updated Property Type: ${updatedProject.property_type}`);
    console.log(`Updated Property Age: ${updatedProject.property_age}`);
    console.log(`Updated Renovation Scope: ${updatedProject.renovation_scope}`);
    console.log(`Updated Segment: ${updatedProject.segment}`);

    if (
      updatedProject.project_category !== 'commercial' ||
      updatedProject.project_sub_category !== 'office' ||
      updatedProject.property_type !== 'rented' ||
      updatedProject.property_age !== '1-5_years' ||
      updatedProject.renovation_scope !== 'full' ||
      updatedProject.segment !== 'standard'
    ) {
      throw new Error('Classifications updates failed!');
    }
    console.log('Project classifications updates verified successfully.');

    // 4. Test lead conversion mapping
    console.log('\nCreating dummy lead for conversion test...');
    const leadRes = await pool.query(
      `INSERT INTO leads (tenant_id, name, phone, status, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [tenantId, 'Conversion Classification Lead', '9999911111', 'active', userId]
    );
    const lead = leadRes.rows[0];

    console.log('Converting lead with classification options in payload...');
    const projectFromConvert = await createProject({
      tenantId,
      userId,
      data: {
        lead_id: lead.id,
        name: 'Converted Classification Project',
        project_type: 'modular_kitchen',
        client_name: lead.name,
        client_phone: lead.phone,
        contract_file_key: 'test_key2',
        contract_file_name: 'contract2.pdf',
        contract_file_size: 1024,
        contract_file_mime: 'application/pdf',
        project_category: 'residential',
        project_sub_category: 'villa',
        property_type: 'owned',
        property_age: '5-10_years',
        renovation_scope: 'partial',
        segment: 'premium'
      }
    });

    console.log(`Converted Project Category: ${projectFromConvert.project_category}`);
    console.log(`Converted Project Sub-category: ${projectFromConvert.project_sub_category}`);
    if (
      projectFromConvert.project_category !== 'residential' ||
      projectFromConvert.project_sub_category !== 'villa' ||
      projectFromConvert.property_type !== 'owned' ||
      projectFromConvert.property_age !== '5-10_years' ||
      projectFromConvert.renovation_scope !== 'partial' ||
      projectFromConvert.segment !== 'premium'
    ) {
      throw new Error('Classification properties mismatch during lead conversion!');
    }
    console.log('Lead conversion classification fields mapping verified successfully.');

    // 5. Cleanup
    console.log('\nCleaning up database records...');
    await pool.query('DELETE FROM projects WHERE id IN ($1, $2)', [project.id, projectFromConvert.id]);
    await pool.query('DELETE FROM leads WHERE id = $1', [lead.id]);
    console.log('Cleanup completed successfully.');

    console.log('\nALL TESTS PASSED SUCCESSFULLY! 🎉');

  } catch (err) {
    console.error('Test failed with error:', err);
  } finally {
    await pool.end();
  }
}

runTests();
