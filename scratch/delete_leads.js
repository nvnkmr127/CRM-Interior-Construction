const pool = require('../server/src/db/pool');

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch all current lead IDs
    const { rows: leads } = await client.query('SELECT id, name FROM leads');
    const leadIds = leads.map(l => l.id);

    console.log(`Found ${leadIds.length} leads in the database to delete.`);

    if (leadIds.length === 0) {
      console.log('No leads found to delete.');
      await client.query('ROLLBACK');
      return;
    }

    // 2. Set self-referencing foreign key to null first
    await client.query('UPDATE leads SET referred_by_lead_id = NULL');

    // 3. Define all referencing tables and their foreign key column (usually lead_id)
    const referencingTables = [
      { name: 'activities', column: 'lead_id' },
      { name: 'lead_objections', column: 'lead_id' },
      { name: 'lead_measurements', column: 'lead_id' },
      { name: 'inbound_webhook_logs', column: 'lead_id' },
      { name: 'lead_files', column: 'lead_id' },
      { name: 'lead_followups', column: 'lead_id' },
      { name: 'site_visits', column: 'lead_id' },
      { name: 'communications', column: 'lead_id' },
      { name: 'automated_sequences', column: 'lead_id' },
      { name: 'lead_estimates', column: 'lead_id' },
      { name: 'lead_contacts', column: 'lead_id' },
      { name: 'lead_proposals', column: 'lead_id' },
      { name: 'lead_inspirations', column: 'lead_id' },
      { name: 'lead_properties', column: 'lead_id' },
      { name: 'lead_preferences', column: 'lead_id' },
      { name: 'lead_requirements', column: 'lead_id' },
      { name: 'tasks', column: 'lead_id' },
      { name: 'documents', column: 'lead_id' },
      { name: 'lead_scores_history', column: 'lead_id' },
      { name: 'lead_ai_insights', column: 'lead_id' },
      { name: 'lead_competitors', column: 'lead_id' },
      { name: 'lead_timeline', column: 'lead_id' },
      { name: 'automation_events', column: 'lead_id' },
      { name: 'referrals', column: 'referrer_lead_id' },
      { name: 'referrals', column: 'referred_lead_id' },
      { name: 'quotations', column: 'lead_id' },
      { name: 'lead_sentiment_history', column: 'lead_id' },
      { name: 'lead_form_submissions', column: 'lead_id' }
    ];

    // 4. Delete from each referencing table
    for (const table of referencingTables) {
      const deleteQuery = `DELETE FROM ${table.name} WHERE ${table.column} = ANY($1::uuid[])`;
      const result = await client.query(deleteQuery, [leadIds]);
      if (result.rowCount > 0) {
        console.log(`Deleted ${result.rowCount} rows from ${table.name} (column: ${table.column}).`);
      }
    }

    // 5. Delete from the main leads table
    const deleteLeadsResult = await client.query('DELETE FROM leads WHERE id = ANY($1::uuid[])', [leadIds]);
    console.log(`Successfully deleted ${deleteLeadsResult.rowCount} leads from the leads table.`);

    await client.query('COMMIT');
    console.log('Transaction committed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error occurred during lead deletion, rolled back transaction:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
