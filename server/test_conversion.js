const pool = require('./src/db/pool');
const { createLead } = require('./src/services/leads/createLead');
const { createProject } = require('./src/services/projects/createProject');
const leadRepo = require('./src/repositories/leadRepository');
const tenantId = '00000000-0000-0000-0000-000000000001';
const userId = '00000000-0000-0000-0000-000000000001';

async function run() {
  try {
    console.log('--- Starting Test ---');
    // Ensure tenant exists
    await pool.query('INSERT INTO tenants (id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING', [tenantId, 'Test Tenant']);
    await pool.query('INSERT INTO users (id, tenant_id, name, email, role) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING', [userId, tenantId, 'Test User', 'test@test.com', 'admin']);

    const leadData = {
      name: 'Integration Test Lead',
      phone: '9999999999',
      budget_max: 1500000,
      locality: 'Test Locality',
      notes: 'Some initial notes for the lead.'
    };
    const lead = await createLead({ tenantId, userId, data: leadData });
    console.log('Lead created:', lead.id);

    await pool.query(
      `INSERT INTO lead_files (tenant_id, lead_id, file_name, storage_key, mime_type) VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, lead.id, 'test.pdf', 'path/to/test.pdf', 'application/pdf']
    );

    await pool.query(
      `INSERT INTO lead_followups (tenant_id, lead_id, title, due_at) VALUES ($1, $2, $3, NOW() + interval '1 day')`,
      [tenantId, lead.id, 'Call client back']
    );

    const projectData = {
      client_name: lead.name,
      name: 'Test Project from Lead',
      contract_file_key: 'contract.pdf',
      contract_file_name: 'contract.pdf',
      contract_file_size: 1000,
      contract_file_mime: 'application/pdf',
      lead_id: lead.id
    };

    console.log('Creating Project...');
    const project = await createProject({ tenantId, userId, data: projectData });
    console.log('Project created:', project.id);

    console.log('Executing completeLeadConversion...');
    await leadRepo.completeLeadConversion(tenantId, userId, lead.id, project.id, project.name);

    console.log('Verifying data transfer...');
    const docs = await pool.query('SELECT * FROM documents WHERE project_id = $1', [project.id]);
    console.log('Documents transferred:', docs.rows.length, '(expected 1)');

    const tasks = await pool.query('SELECT * FROM tasks WHERE project_id = $1', [project.id]);
    console.log('Tasks transferred:', tasks.rows.length, '(expected 1)');

    const acts = await pool.query('SELECT * FROM activities WHERE project_id = $1', [project.id]);
    console.log('Activities transferred:', acts.rows.length, '(expected 1 or more from notes)');

    console.log('--- Test Complete ---');
  } catch (err) {
    console.error('Test Failed:', err);
  } finally {
    process.exit();
  }
}

run();
