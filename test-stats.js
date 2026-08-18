const pool = require('./server/src/db/pool');

async function test() {
  const tenantId = '00000000-0000-0000-0000-000000000000';

  try {
    console.log("Q7");
    await pool.readPool.query(`
      SELECT 
        TO_CHAR(date_trunc('week', pm.paid_at::timestamp), 'IYYY-"W"IW') as week,
        COALESCE(SUM(pm.paid_amount), 0)::float as amt
      FROM payment_milestones pm
      JOIN projects p ON pm.project_id = p.id
      WHERE p.tenant_id = $1 AND pm.status = 'paid' AND pm.paid_at IS NOT NULL AND pm.paid_at != '' AND pm.paid_at::timestamp >= NOW() - INTERVAL '12 weeks'
      GROUP BY date_trunc('week', pm.paid_at::timestamp)
      ORDER BY date_trunc('week', pm.paid_at::timestamp) ASC
    `, [tenantId]);
    console.log("Q7 success");
  } catch(e) { console.error("Q7 fail:", e.message) }

  process.exit();
}

test();
