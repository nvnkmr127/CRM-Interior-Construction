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

    // 2. Create a dummy lead
    console.log('\nCreating a dummy lead...');
    const leadRes = await pool.query(
      `INSERT INTO leads (tenant_id, name, phone, status, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [tenantId, 'Measurement Test Lead', '9999988888', 'active', userId]
    );
    const lead = leadRes.rows[0];
    console.log(`Lead created: ${lead.id}`);

    // 3. Add lead measurements
    console.log('Adding lead measurements...');
    await pool.query(
      `INSERT INTO lead_measurements (tenant_id, lead_id, room_name, length, width, height, unit, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [tenantId, lead.id, 'Kitchen Test', 10, 8, 9.5, 'feet', 'Lead kitchen notes', userId]
    );
    await pool.query(
      `INSERT INTO lead_measurements (tenant_id, lead_id, room_name, length, width, height, unit, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [tenantId, lead.id, 'Bedroom Test', 12, 10, 9.5, 'feet', 'Lead bedroom notes', userId]
    );
    console.log('Lead measurements added successfully.');

    // 4. Test conversion / project creation with cloning
    console.log('\nCreating a project linked to the lead (to trigger auto-cloning)...');
    const { createProject } = require('./src/services/projects/createProject');
    const project = await createProject({
      tenantId,
      userId,
      data: {
        lead_id: lead.id,
        name: 'Auto-cloned Project',
        project_type: 'full_interior',
        client_name: lead.name,
        client_phone: lead.phone,
        contract_file_key: 'test_key',
        contract_file_name: 'contract.pdf',
        contract_file_size: 1024,
        contract_file_mime: 'application/pdf',
        carpet_area: 1200,
        built_up_area: 1500,
        number_of_rooms: 4
      }
    });

    console.log(`Project created: ${project.id}`);
    console.log(`Carpet Area: ${project.carpet_area}, Built-up Area: ${project.built_up_area}, Rooms: ${project.number_of_rooms}`);

    // Verify project measurements were cloned
    const projMeasRes = await pool.query(
      'SELECT room_name, length, width, height, area, unit, notes FROM project_measurements WHERE project_id = $1 ORDER BY room_name ASC',
      [project.id]
    );
    console.log(`Retrieved ${projMeasRes.rows.length} cloned project measurements:`);
    projMeasRes.rows.forEach(row => {
      console.log(`- Room: ${row.room_name}, Dims: ${row.length}x${row.width}x${row.height}, Area: ${row.area}, Notes: "${row.notes}"`);
    });

    if (projMeasRes.rows.length !== 2) {
      throw new Error(`Expected 2 cloned measurements, got ${projMeasRes.rows.length}`);
    }

    // 5. Test project measurements update/sync
    console.log('\nTesting updating project measurements...');
    const { updateProject } = require('./src/services/projects/updateProject');
    await updateProject({
      tenantId,
      userId,
      projectId: project.id,
      data: {
        name: 'Updated Project Name',
        carpet_area: 1300,
        built_up_area: 1600,
        number_of_rooms: 5,
        measurements: [
          { room_name: 'Updated Kitchen', length: 11, width: 9, height: 9.5, area: 99, unit: 'feet', notes: 'Enlarged kitchen' }
        ]
      }
    });

    // Verify update
    const updatedProjRes = await pool.query('SELECT carpet_area, built_up_area, number_of_rooms FROM projects WHERE id = $1', [project.id]);
    const updatedProj = updatedProjRes.rows[0];
    console.log(`Updated Project Fields: Carpet: ${updatedProj.carpet_area}, Built-up: ${updatedProj.built_up_area}, Rooms: ${updatedProj.number_of_rooms}`);
    if (Number(updatedProj.carpet_area) !== 1300 || updatedProj.number_of_rooms !== 5) {
      throw new Error('Project fields update failed.');
    }

    const updatedMeasRes = await pool.query(
      'SELECT room_name, length, width, height, area, unit, notes FROM project_measurements WHERE project_id = $1',
      [project.id]
    );
    console.log(`Retrieved ${updatedMeasRes.rows.length} updated project measurements:`);
    updatedMeasRes.rows.forEach(row => {
      console.log(`- Room: ${row.room_name}, Dims: ${row.length}x${row.width}x${row.height}, Area: ${row.area}, Notes: "${row.notes}"`);
    });

    if (updatedMeasRes.rows.length !== 1 || updatedMeasRes.rows[0].room_name !== 'Updated Kitchen') {
      throw new Error('Measurements update/sync failed.');
    }

    // 6. Test Cascade Delete
    console.log('\nDeleting project to test cascade deletion of project measurements...');
    await pool.query('DELETE FROM projects WHERE id = $1', [project.id]);
    const postDeleteMeas = await pool.query('SELECT COUNT(*) FROM project_measurements WHERE project_id = $1', [project.id]);
    const count = Number(postDeleteMeas.rows[0].count);
    console.log(`Project measurements remaining: ${count}`);
    if (count !== 0) {
      throw new Error('Cascade delete did not work! Measurements still exist.');
    }
    console.log('Cascade deletion verified successfully!');

    // Cleanup Lead
    console.log('\nCleaning up dummy lead...');
    await pool.query('DELETE FROM lead_measurements WHERE lead_id = $1', [lead.id]);
    await pool.query('DELETE FROM leads WHERE id = $1', [lead.id]);
    console.log('Lead cleanup complete.');

    console.log('\nALL TESTS PASSED SUCCESSFULLY! 🎉');

  } catch (err) {
    console.error('Test failed with error:', err);
  } finally {
    await pool.end();
  }
}

runTests();
