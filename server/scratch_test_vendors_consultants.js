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

    // 2. Create project with vendors & consultants
    console.log('\nCreating project with vendors and consultants...');
    const { createProject } = require('./src/services/projects/createProject');
    const project = await createProject({
      tenantId,
      userId,
      data: {
        name: 'Vendors & Consultants Test Project',
        project_type: 'full_interior',
        client_name: 'Test Client',
        client_phone: '9999988888',
        contract_file_key: 'test_key',
        contract_file_name: 'contract.pdf',
        contract_file_size: 1024,
        contract_file_mime: 'application/pdf',
        vendors: [
          {
            vendor_name: 'Vendor Plumbing Pro',
            scope_of_work: 'Plumbing installations',
            agreed_rate: 15000.00,
            payment_terms: '50% advance, 50% handover',
            status: 'active'
          },
          {
            vendor_name: 'Vendor WireMaster',
            scope_of_work: 'Electrical wiring',
            agreed_rate: 22000.50,
            payment_terms: 'Milestone based',
            status: 'pending'
          }
        ],
        consultants: [
          {
            name: 'Consultant Dr. John',
            role: 'structural_engineer',
            firm: 'John Structural Ltd',
            email: 'john@struct.com',
            phone: '9876543210'
          },
          {
            name: 'Consultant Alice',
            role: 'lighting_designer',
            firm: 'Alice Glow Designs',
            email: 'alice@glow.com',
            phone: '9876543211'
          }
        ]
      }
    });

    console.log(`Project created: ${project.id}`);
    
    // Fetch project and verify relations
    const projectRepository = require('./src/repositories/projectRepository');
    const fetchedProject = await projectRepository.findProjectById(tenantId, project.id);
    
    console.log('Fetched Vendors:', fetchedProject.vendors);
    console.log('Fetched Consultants:', fetchedProject.consultants);

    if (!fetchedProject.vendors || fetchedProject.vendors.length !== 2) {
      throw new Error('Project vendors mismatch during creation!');
    }
    if (!fetchedProject.consultants || fetchedProject.consultants.length !== 2) {
      throw new Error('Project consultants mismatch during creation!');
    }

    const plumbing = fetchedProject.vendors.find(v => v.vendor_name === 'Vendor Plumbing Pro');
    if (!plumbing || Number(plumbing.agreed_rate) !== 15000.00) {
      throw new Error('Plumbing vendor properties mismatch!');
    }

    const engineer = fetchedProject.consultants.find(c => c.role === 'structural_engineer');
    if (!engineer || engineer.name !== 'Consultant Dr. John') {
      throw new Error('Structural engineer consultant properties mismatch!');
    }

    console.log('Project creation with vendors & consultants verified successfully.');

    // 3. Test updating vendors & consultants
    console.log('\nTesting updating project vendors & consultants...');
    const { updateProject } = require('./src/services/projects/updateProject');
    
    const updated = await updateProject({
      tenantId,
      userId,
      projectId: project.id,
      data: {
        vendors: [
          {
            vendor_name: 'Vendor Plumbing Pro', // updated rate
            scope_of_work: 'Plumbing installations',
            agreed_rate: 16500.00,
            payment_terms: '50% advance, 50% handover',
            status: 'active'
          },
          {
            vendor_name: 'Vendor PaintExpert', // new vendor replacing WireMaster
            scope_of_work: 'Interior painting',
            agreed_rate: 35000.00,
            payment_terms: '100% post completion',
            status: 'pending'
          }
        ],
        consultants: [
          // structural engineer remains, lighting designer removed
          {
            name: 'Consultant Dr. John',
            role: 'structural_engineer',
            firm: 'John Structural Ltd',
            email: 'john@struct.com',
            phone: '9876543210'
          }
        ]
      }
    });

    console.log('Updated Vendors:', updated.vendors);
    console.log('Updated Consultants:', updated.consultants);

    if (!updated.vendors || updated.vendors.length !== 2) {
      throw new Error('Vendors length mismatch after update!');
    }
    if (!updated.consultants || updated.consultants.length !== 1) {
      throw new Error('Consultants length mismatch after update!');
    }

    const paint = updated.vendors.find(v => v.vendor_name === 'Vendor PaintExpert');
    if (!paint || Number(paint.agreed_rate) !== 35000.00) {
      throw new Error('Paint vendor properties mismatch after update!');
    }

    const aliceGlow = updated.consultants.find(c => c.name === 'Consultant Alice');
    if (aliceGlow) {
      throw new Error('Consultant Alice was not removed after update!');
    }

    console.log('Project updates verified successfully.');

    // 4. Test Lead Conversion mapping
    console.log('\nCreating dummy lead for conversion test...');
    const leadRes = await pool.query(
      `INSERT INTO leads (tenant_id, name, phone, status, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [tenantId, 'Conversion Vendors Lead', '9999922222', 'active', userId]
    );
    const lead = leadRes.rows[0];

    console.log('Converting lead with vendors & consultants in payload...');
    const convertedProject = await createProject({
      tenantId,
      userId,
      data: {
        lead_id: lead.id,
        name: 'Converted Vendors Project',
        project_type: 'modular_kitchen',
        client_name: lead.name,
        client_phone: lead.phone,
        contract_file_key: 'test_key2',
        contract_file_name: 'contract2.pdf',
        contract_file_size: 1024,
        contract_file_mime: 'application/pdf',
        vendors: [
          {
            vendor_name: 'Conversion Vendor X',
            scope_of_work: 'Carpentry',
            agreed_rate: 8000.00,
            payment_terms: 'COD',
            status: 'active'
          }
        ],
        consultants: [
          {
            name: 'Conversion Consultant Y',
            role: 'mep_consultant',
            firm: 'MEP Consulting',
            email: 'y@mep.com',
            phone: '9876543212'
          }
        ]
      }
    });

    const convertedFetched = await projectRepository.findProjectById(tenantId, convertedProject.id);
    console.log('Converted Project Vendors:', convertedFetched.vendors);
    console.log('Converted Project Consultants:', convertedFetched.consultants);

    if (!convertedFetched.vendors || convertedFetched.vendors.length !== 1) {
      throw new Error('Project vendors mismatch during conversion!');
    }
    if (!convertedFetched.consultants || convertedFetched.consultants.length !== 1) {
      throw new Error('Project consultants mismatch during conversion!');
    }

    console.log('Lead conversion mappings verified successfully.');

    // 5. Test cascade delete
    console.log('\nTesting DB cascade deletes...');
    await pool.query('DELETE FROM projects WHERE id = $1', [project.id]);
    
    const countVendors = await pool.query('SELECT COUNT(*)::int FROM project_vendors WHERE project_id = $1', [project.id]);
    const countConsultants = await pool.query('SELECT COUNT(*)::int FROM project_consultants WHERE project_id = $1', [project.id]);
    
    console.log(`Remaining vendors for deleted project: ${countVendors.rows[0].count}`);
    console.log(`Remaining consultants for deleted project: ${countConsultants.rows[0].count}`);

    if (countVendors.rows[0].count !== 0 || countConsultants.rows[0].count !== 0) {
      throw new Error('Cascade delete failed to clean up project child rows!');
    }
    console.log('Cascade deletion verified successfully.');

    // Cleanup converted project
    await pool.query('DELETE FROM projects WHERE id = $1', [convertedProject.id]);
    await pool.query('DELETE FROM leads WHERE id = $1', [lead.id]);

    console.log('\nALL VENDOR & CONSULTANT TESTS PASSED SUCCESSFULLY! 🎉');

  } catch (err) {
    console.error('Test failed with error:', err);
  } finally {
    await pool.end();
  }
}

runTests();
