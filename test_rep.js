const pool = require('./server/src/db/pool');
async function test() {
  try {
    const from = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const to = new Date();
    const query = `
      SELECT 
        u.id as rep_id, 
        u.name as rep_name,
        u.avatar_url,
        COUNT(l.id) as leads_assigned,
        COUNT(l.id) FILTER (WHERE ls.is_won = true) as won,
        0 as contacted_within_sla
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN leads l ON l.assignee_id = u.id AND l.created_at BETWEEN $1 AND $2
      LEFT JOIN lead_stages ls ON l.stage_id = ls.id
      WHERE r.name = 'sales_executive' OR r.name = 'sales_rep'
      GROUP BY u.id
      ORDER BY won DESC
    `;
    const res = await pool.query(query, [from.toISOString(), to.toISOString()]);
    console.log(res.rows);
  } catch (err) {
    console.error('ERROR:', err.message);
  }
  process.exit(0);
}
test();
