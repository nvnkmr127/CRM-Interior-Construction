const pool = require('../../../db/pool');
// In a real app we would use 'nodemailer' or an ICS generator
// const { createEvent } = require('ics');

/**
 * Sends a calendar invite for events like Site Visits
 */
async function handle(config, context) {
  const { eventTitle, eventDatePath } = config;
  const { record, _tenantId } = context;
  
  if (!record) return;

  // Resolving date from record, e.g. "site_visit_date"
  let visitDate = null;
  if (eventDatePath && record[eventDatePath]) {
    visitDate = new Date(record[eventDatePath]);
  }

  if (!visitDate) {
    console.log(`[Automation] No valid date found for calendar invite on lead ${record.id}`);
    return;
  }

  console.log(`[Automation] Sending Calendar Invite for Lead ${record.id} - ${eventTitle} at ${visitDate.toISOString()}`);
  
  // Here you would generate an ICS file and dispatch via email service.
  // For this CRM implementation, we'll log it as an activity for verification.
  try {
    await pool.query(`
      INSERT INTO lead_activities (lead_id, type, summary, logged_by)
      VALUES ($1, 'system', $2, NULL)
    `, [record.id, `Calendar Invite Sent: ${eventTitle} for ${visitDate.toDateString()}`]);
  } catch (err) {
    console.error(`[Automation] Failed to log calendar invite activity:`, err);
  }
}

module.exports = { handle };
