const pool = require('../src/db/pool');

async function seed() {
  try {
    console.log('Seeding portal mock data...');

    // 1. Tenant
    let tenantRes = await pool.query(`SELECT id FROM tenants WHERE slug = 'digicloudify'`);
    let tenantId;
    if (tenantRes.rows.length === 0) {
      tenantRes = await pool.query(`INSERT INTO tenants (name, slug) VALUES ('Digicloudify Interiors', 'digicloudify') RETURNING id`);
    }
    tenantId = tenantRes.rows[0].id;
    
    // 2. Project
    let projRes = await pool.query(`SELECT id FROM projects WHERE tenant_id = $1 LIMIT 1`, [tenantId]);
    let projectId;
    if (projRes.rows.length === 0) {
      projRes = await pool.query(`
        INSERT INTO projects (tenant_id, name, status, start_date, target_date, client_name) 
        VALUES ($1, 'Villa Renovations', 'active', NOW(), NOW() + INTERVAL '30 days', 'John Doe') RETURNING id
      `, [tenantId]);
    }
    projectId = projRes.rows[0].id;

    // 3. Client Portal User
    const phone = '+919876543210';
    let clientRes = await pool.query(`SELECT id FROM client_portal_users WHERE tenant_id = $1 AND phone = $2`, [tenantId, phone]);
    if (clientRes.rows.length === 0) {
      await pool.query(`
        INSERT INTO client_portal_users (tenant_id, project_id, name, phone) 
        VALUES ($1, $2, 'John Doe', $3)
      `, [tenantId, projectId, phone]);
    }

    // 4. Project Phases
    await pool.query(`DELETE FROM project_phases WHERE project_id = $1`, [projectId]);
    const designPhaseRes = await pool.query(`
      INSERT INTO project_phases (tenant_id, project_id, name, status, sort_order) 
      VALUES ($1, $2, 'Design & 3D Modeling', 'completed', 1) RETURNING id
    `, [tenantId, projectId]);
    const designPhaseId = designPhaseRes.rows[0].id;

    const procurementPhaseRes = await pool.query(`
      INSERT INTO project_phases (tenant_id, project_id, name, status, sort_order) 
      VALUES ($1, $2, 'Material Procurement & Factory Production', 'in_progress', 2) RETURNING id
    `, [tenantId, projectId]);
    const procurementPhaseId = procurementPhaseRes.rows[0].id;

    const executionPhaseRes = await pool.query(`
      INSERT INTO project_phases (tenant_id, project_id, name, status, sort_order) 
      VALUES ($1, $2, 'On-Site Execution & Handover', 'pending', 3) RETURNING id
    `, [tenantId, projectId]);
    const executionPhaseId = executionPhaseRes.rows[0].id;

    // Seed Milestones
    await pool.query(`DELETE FROM milestones WHERE project_id = $1`, [projectId]);
    await pool.query(`INSERT INTO milestones (tenant_id, project_id, phase_id, name, description, status, due_date, sort_order) VALUES
      ($1, $2, $3, 'Initial Layout & Moodboards', 'Finalizing spatial planning and core styling direction.', 'completed', NOW() - INTERVAL '25 days', 1),
      ($1, $2, $3, '3D Visualizations & Walkthrough', 'Reviewing photorealistic renders of living, kitchen and bedrooms.', 'completed', NOW() - INTERVAL '15 days', 2),
      ($1, $2, $3, 'Working Drawings Sign-off', 'Technical approval of electrical, plumbing and woodwork plans.', 'completed', NOW() - INTERVAL '8 days', 3),
      
      ($1, $2, $4, 'Core Raw Material Sourcing', 'Ordering plywood, veneer, laminates and primary hardware.', 'completed', NOW() - INTERVAL '4 days', 1),
      ($1, $2, $4, 'Factory Woodwork Production', 'Precision cutting, edge banding, and carcass assembly in factory.', 'in_progress', NOW() + INTERVAL '2 days', 2),
      ($1, $2, $4, 'Pre-Dispatch Quality Inspection', 'Checking dimensions, surface finish and pre-drill quality before dispatch.', 'pending', NOW() + INTERVAL '7 days', 3),

      ($1, $2, $5, 'Site Demolition & Electrical Rough-ins', 'Chasing walls and laying plumbing/electrical conduits.', 'pending', NOW() + INTERVAL '12 days', 1),
      ($1, $2, $5, 'Woodwork Assembly & Installation', 'Assembling modular cabinets and fixing wardrobes on site.', 'pending', NOW() + INTERVAL '20 days', 2),
      ($1, $2, $5, 'Painting, Deep Cleaning & Handover', 'Final wall finishes, cleaning, snag resolution, and handing keys.', 'pending', NOW() + INTERVAL '30 days', 3)
    `, [tenantId, projectId, designPhaseId, procurementPhaseId, executionPhaseId]);

    // 5. Payment Milestones
    await pool.query(`DELETE FROM payment_milestones WHERE project_id = $1`, [projectId]);
    await pool.query(`INSERT INTO payment_milestones (tenant_id, project_id, name, amount, due_date, status) VALUES
      ($1, $2, 'Advance Payment', 50000, NOW() - INTERVAL '10 days', 'paid'),
      ($1, $2, 'Material Delivery', 150000, NOW() - INTERVAL '2 days', 'invoice_raised'),
      ($1, $2, 'Completion', 100000, NOW() + INTERVAL '15 days', 'scheduled')
    `, [tenantId, projectId]);

    // 6. Documents (Pending Approval)
    await pool.query(`DELETE FROM documents WHERE project_id = $1 AND name = 'Living Room 3D Render'`, [projectId]);
    await pool.query(`INSERT INTO documents (tenant_id, project_id, name, doc_type, version, status, is_visible_to_client, storage_key) VALUES
      ($1, $2, 'Living Room 3D Render', 'design', 1, 'pending_review', true, 'mock_key.pdf')
    `, [tenantId, projectId]);

    // 7. Snags
    await pool.query(`DELETE FROM snags WHERE project_id = $1`, [projectId]);
    await pool.query(`INSERT INTO snags (tenant_id, project_id, title, category, status, raised_by_client) VALUES
      ($1, $2, 'Paint chipping near window', 'Paint', 'open', true),
      ($1, $2, 'Cabinet door misalignment', 'Carpentry', 'resolved', true)
    `, [tenantId, projectId]);

    console.log('Seed complete! You can login with:');
    console.log('Tenant slug: digicloudify');
    console.log('Phone: +919876543210');
    console.log('Check your terminal (where the server is running) for the 6-digit OTP when you click "Send OTP".');
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seed();
