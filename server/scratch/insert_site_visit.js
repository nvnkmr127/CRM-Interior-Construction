const pool = require('../src/db/pool');
const { readPool } = pool;

async function run() {
  try {
    // 1. Get a user
    const userRes = await readPool.query(`SELECT id, tenant_id FROM users LIMIT 1`);
    if (userRes.rows.length === 0) {
      console.log("No users found.");
      return;
    }
    const user = userRes.rows[0];
    console.log("Found User:", user);

    // 2. Get a lead
    const leadRes = await readPool.query(`SELECT id FROM leads WHERE tenant_id = $1 LIMIT 1`, [user.tenant_id]);
    if (leadRes.rows.length === 0) {
      console.log("No leads found for tenant:", user.tenant_id);
      return;
    }
    const lead = leadRes.rows[0];
    console.log("Found Lead:", lead);

    // 3. Insert a site visit for TODAY
    const scheduledTime = new Date().toISOString(); // Current time is today!
    
    const insertRes = await readPool.query(`
      INSERT INTO site_visits (
        tenant_id,
        lead_id,
        assignee_id,
        scheduled_at,
        status,
        notes,
        checklist
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      user.tenant_id,
      lead.id,
      user.id,
      scheduledTime,
      'scheduled',
      'Test site visit created via scratch script',
      JSON.stringify(['Confirm Address', 'Measure Kitchen', 'Check Plumbing'])
    ]);

    console.log("Successfully inserted site visit:", insertRes.rows[0]);

  } catch (error) {
    console.error("Error inserting site visit:", error);
  } finally {
    await pool.end();
  }
}

run();
