const pool = require('../server/src/db/pool');

async function run() {
  try {
    const leadId = 'e2a26824-9efe-4aa5-bf99-72f11f39eeaa';
    console.log("Querying lead_timeline for lead:", leadId);
    const res = await pool.query("SELECT id, event_type, entity, entity_id, summary FROM lead_timeline WHERE lead_id = $1", [leadId]);
    console.log("lead_timeline rows count:", res.rows.length);
    res.rows.forEach(r => {
      console.log(`id: ${r.id}, event_type: ${r.event_type}, entity: ${r.entity}, entity_id: ${r.entity_id}`);
    });

    console.log("\nQuerying automation_events for lead:", leadId);
    const autoRes = await pool.query("SELECT id, workflow, action_type FROM automation_events WHERE lead_id = $1", [leadId]);
    console.log("automation_events count:", autoRes.rows.length);
    autoRes.rows.forEach(r => {
      console.log(`id: ${r.id}, workflow: ${r.workflow}, action_type: ${r.action_type}`);
    });
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}
run();
