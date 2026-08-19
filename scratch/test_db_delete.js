const pool = require('../server/src/db/pool');
async function run() {
  try {
    // Get one active lead
    const leadRes = await pool.query("SELECT id, tenant_id FROM leads WHERE deleted_at IS NULL LIMIT 1");
    if (leadRes.rows.length === 0) {
      console.log("No active leads found!");
      return;
    }
    const lead = leadRes.rows[0];
    console.log("Found lead:", lead);

    // Let's run softDeleteLead logic
    const query = `
      UPDATE leads
      SET deleted_at = NOW()
      WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
    `;
    console.log("Executing soft delete query...");
    const res = await pool.query(query, [lead.tenant_id, lead.id]);
    console.log("Query result:", res);
  } catch (err) {
    console.error("SQL Error during soft delete:", err);
  } finally {
    await pool.end();
  }
}
run();
