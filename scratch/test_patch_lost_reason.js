const pool = require('../server/src/db/pool');
const { updateLead } = require('../server/src/repositories/leadRepository');

async function run() {
  try {
    // Let's create a temp lead
    const leadInsert = await pool.query(`
      INSERT INTO leads (tenant_id, name, phone, status)
      VALUES ('fefd62a3-c984-4d90-b390-6163b65d3f94', 'Temp Lost Lead', '+919999999990', 'active')
      RETURNING id
    `);
    const leadId = leadInsert.rows[0].id;
    console.log("Created lead ID:", leadId);

    // Update with lost_reason
    console.log("Calling updateLead with lost_reason...");
    const updated = await updateLead('fefd62a3-c984-4d90-b390-6163b65d3f94', leadId, {
      lost_reason: 'Too expensive/out of budget'
    });

    // Check custom_fields in DB
    const res = await pool.query("SELECT custom_fields FROM leads WHERE id = $1", [leadId]);
    console.log("Updated custom_fields in DB:", res.rows[0].custom_fields);

    // Clean up
    await pool.query("DELETE FROM leads WHERE id = $1", [leadId]);
    console.log("Cleaned up successfully.");
  } catch (err) {
    console.error("Error during test:", err);
  } finally {
    await pool.end();
  }
}
run();
