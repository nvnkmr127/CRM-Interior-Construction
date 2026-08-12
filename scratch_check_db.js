const { pool } = require('./server/src/config/db');
const fs = require('fs');
const path = require('path');

async function check() {
  const result = {};
  try {
    // 1. Leads
    const leadsStat = await pool.query('SELECT status, COUNT(*), COUNT(deleted_at) as deleted_count FROM leads GROUP BY status');
    result.leads = leadsStat.rows;

    // 2. Lead stages
    const stages = await pool.query('SELECT id, name, is_won FROM lead_stages');
    result.lead_stages = stages.rows;

    // 3. Projects
    const projectsStat = await pool.query('SELECT status, COUNT(*), COUNT(deleted_at) as deleted_count FROM projects GROUP BY status');
    result.projects = projectsStat.rows;

    // 4. Tasks
    const tasksStat = await pool.query('SELECT status, COUNT(*), COUNT(deleted_at) as deleted_count FROM tasks GROUP BY status');
    result.tasks = tasksStat.rows;

    // 5. Total counts of active things
    const activeLeads = await pool.query("SELECT COUNT(*) FROM leads WHERE status='active' AND deleted_at IS NULL");
    result.activeLeadsQuery = activeLeads.rows[0].count;

    const allLeads = await pool.query("SELECT COUNT(*) FROM leads WHERE deleted_at IS NULL");
    result.allLeadsCount = allLeads.rows[0].count;

    const projectActive = await pool.query("SELECT COUNT(*) FROM projects WHERE status='active' AND deleted_at IS NULL");
    result.activeProjectsCount = projectActive.rows[0].count;

    const allProjects = await pool.query("SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL");
    result.allProjectsCount = allProjects.rows[0].count;

    // 6. Users and Tenants
    const users = await pool.query("SELECT id, name, email, role, tenant_id FROM users");
    result.users = users.rows;

    const tenants = await pool.query("SELECT id, name FROM tenants");
    result.tenants = tenants.rows;

  } catch (err) {
    result.error = err.message;
    result.stack = err.stack;
  } finally {
    fs.writeFileSync(path.join(__dirname, 'scratch_db_output.json'), JSON.stringify(result, null, 2));
    pool.end();
  }
}

check();
