const pool = require('../../db/pool');

/**
 * Safely delete test projects and all their cascaded dependencies
 * so that automated test runs never leave orphaned test projects in the CRM.
 */
async function cleanupProject(projectId, client = pool) {
  if (!projectId) return;
  const pIds = Array.isArray(projectId) ? projectId.filter(Boolean) : [projectId];
  if (pIds.length === 0) return;

  try {
    await client.query(`DELETE FROM tasks WHERE project_id = ANY($1::uuid[])`, [pIds]);
    await client.query(`DELETE FROM milestones WHERE phase_id IN (SELECT id FROM project_phases WHERE project_id = ANY($1::uuid[]))`, [pIds]);
    await client.query(`DELETE FROM project_phases WHERE project_id = ANY($1::uuid[])`, [pIds]);
    await client.query(`DELETE FROM documents WHERE project_id = ANY($1::uuid[])`, [pIds]);
    await client.query(`DELETE FROM project_vendors WHERE project_id = ANY($1::uuid[])`, [pIds]);
    await client.query(`DELETE FROM project_expenses WHERE project_id = ANY($1::uuid[])`, [pIds]);
    await client.query(`DELETE FROM project_compliance_checklists WHERE project_id = ANY($1::uuid[])`, [pIds]);
    await client.query(`DELETE FROM project_mep_checklists WHERE project_id = ANY($1::uuid[])`, [pIds]);
    await client.query(`DELETE FROM material_substitutions WHERE project_id = ANY($1::uuid[])`, [pIds]);
    await client.query(`DELETE FROM client_portal_users WHERE project_id = ANY($1::uuid[])`, [pIds]);
    await client.query(`DELETE FROM quotation_items WHERE quotation_id IN (SELECT id FROM quotations WHERE project_id = ANY($1::uuid[]))`, [pIds]);
    await client.query(`DELETE FROM quotations WHERE project_id = ANY($1::uuid[])`, [pIds]);
    await client.query(`DELETE FROM payment_milestones WHERE project_id = ANY($1::uuid[])`, [pIds]);
    await client.query(`DELETE FROM project_bookings WHERE project_id = ANY($1::uuid[])`, [pIds]);
    await client.query(`DELETE FROM project_site_team WHERE project_id = ANY($1::uuid[])`, [pIds]);
    await client.query(`DELETE FROM project_site_readiness WHERE project_id = ANY($1::uuid[])`, [pIds]);
    await client.query(`DELETE FROM daily_site_reports WHERE project_id = ANY($1::uuid[])`, [pIds]);
    await client.query(`DELETE FROM notifications WHERE reference_id = ANY($1::uuid[])`, [pIds]);
    await client.query(`DELETE FROM projects WHERE id = ANY($1::uuid[])`, [pIds]);
  } catch (err) {
    console.error('Error cleaning up test project:', err.message);
  }
}

/**
 * Safely delete test leads and all their cascaded dependencies
 * so that automated test runs never leave orphaned test leads in the CRM.
 */
async function cleanupLead(leadId, client = pool) {
  if (!leadId) return;
  const lIds = Array.isArray(leadId) ? leadId.filter(Boolean) : [leadId];
  if (lIds.length === 0) return;

  try {
    const leadChildTables = [
      'activities', 'lead_objections', 'lead_measurements', 'inbound_webhook_logs',
      'lead_files', 'lead_followups', 'site_visits', 'communications',
      'automated_sequences', 'lead_estimates', 'lead_contacts', 'lead_proposals',
      'lead_inspirations', 'lead_properties', 'lead_preferences', 'lead_requirements',
      'tasks', 'documents', 'lead_scores_history', 'lead_ai_insights',
      'lead_competitors', 'lead_timeline', 'automation_events', 'quotations',
      'lead_sentiment_history', 'lead_form_submissions'
    ];

    for (const t of leadChildTables) {
      await client.query(`DELETE FROM "${t}" WHERE lead_id = ANY($1::uuid[])`, [lIds]);
    }
    await client.query(`DELETE FROM referrals WHERE referrer_lead_id = ANY($1::uuid[]) OR referred_lead_id = ANY($1::uuid[])`, [lIds]);
    await client.query(`DELETE FROM notifications WHERE lead_id = ANY($1::uuid[]) OR reference_id = ANY($1::uuid[])`, [lIds]);
    await client.query(`DELETE FROM leads WHERE id = ANY($1::uuid[])`, [lIds]);
  } catch (err) {
    console.error('Error cleaning up test lead:', err.message);
  }
}

module.exports = {
  cleanupProject,
  cleanupLead
};
