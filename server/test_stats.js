const { Pool } = require('pg');
require('dotenv').config();

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/crm' });
  
  // Find tenant and user
  const tenantRes = await pool.query("SELECT id FROM tenants LIMIT 1");
  const tenantId = tenantRes.rows[0].id;
  
  const usersRes = await pool.query("SELECT id, name, role FROM users WHERE name ILIKE '%Ananya%'");
  console.log("Users:", usersRes.rows);
  const userId = usersRes.rows[0].id;

  // Let's manually run the query
  // Assume team scope
  const scopeFilter = `l.assignee_id IN (SELECT id FROM users WHERE manager_id = (SELECT manager_id FROM users WHERE id = '${userId}') OR id = '${userId}')`;
  
  const query = `
    SELECT
      COUNT(*) AS total_leads,
      COUNT(*) FILTER (WHERE s.is_won = true) AS total_won
    FROM leads l
    LEFT JOIN lead_stages s ON l.stage_id = s.id
    WHERE l.tenant_id = $1 AND l.deleted_at IS NULL AND (${scopeFilter})
  `;
  
  const res1 = await pool.query(query, [tenantId]);
  console.log("getLeadStats query result:", res1.rows);
  
  const query2 = `
    SELECT COUNT(*) as find_leads_count
    FROM leads l
    LEFT JOIN lead_stages s ON l.stage_id = s.id
    WHERE l.tenant_id = $1 AND l.deleted_at IS NULL AND (${scopeFilter})
  `;
  const res2 = await pool.query(query2, [tenantId]);
  console.log("findLeads query result:", res2.rows);

  // See if assigneeId was hardcoded anywhere
  const query3 = `
    SELECT COUNT(*) as direct_assigned
    FROM leads l
    WHERE l.tenant_id = $1 AND l.deleted_at IS NULL AND l.assignee_id = $2
  `;
  const res3 = await pool.query(query3, [tenantId, userId]);
  console.log("Directly assigned leads:", res3.rows);

  await pool.end();
}

run().catch(console.error);
