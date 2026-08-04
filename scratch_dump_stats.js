const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config({ path: 'server/.env' });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function run() {
  try {
    const res2 = await pool.query("SELECT id, name FROM tenants LIMIT 1");
    const tenantId = res2.rows[0]?.id;
    
    const res3 = await pool.query(`
      SELECT
        COUNT(*) AS total_leads,
        COUNT(*) FILTER (
          WHERE s.is_won = true 
          AND (l.updated_at >= date_trunc('month', CURRENT_DATE) OR l.created_at >= date_trunc('month', CURRENT_DATE))
        ) AS won_this_month,
        COUNT(*) FILTER (WHERE s.is_won = true) AS total_won,
        AVG(NULLIF(l.score, 0)) AS avg_score
      FROM leads l
      LEFT JOIN lead_stages s ON l.stage_id = s.id
      WHERE l.tenant_id = $1 AND l.deleted_at IS NULL
    `, [tenantId]);
    
    fs.writeFileSync('scratch_stats_out.txt', JSON.stringify(res3.rows[0], null, 2));
  } catch(e) {
    fs.writeFileSync('scratch_stats_out.txt', e.toString());
  }
  process.exit(0);
}
run();
