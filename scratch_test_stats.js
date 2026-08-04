const pool = require('./server/src/db/pool');
async function run() {
  const res = await pool.query("SELECT COUNT(*) FROM leads WHERE deleted_at IS NULL");
  console.log("Total non-deleted leads in DB:", res.rows[0].count);
  
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
  
  console.log("Stats query result for tenant", tenantId, ":", res3.rows[0]);
  process.exit(0);
}
run();
