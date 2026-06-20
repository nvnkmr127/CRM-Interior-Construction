const pool = require('../src/db/pool');

async function backfillTimeline() {
  console.log('Starting Timeline Backfill...');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Backfill Activities
    console.log('Backfilling activities...');
    await client.query(`
      INSERT INTO lead_timeline (tenant_id, lead_id, event_type, entity, entity_id, summary, user_id, created_at)
      SELECT tenant_id, lead_id, 'activity.' || type, 'activity', id, notes, user_id, created_at
      FROM activities
      WHERE lead_id IS NOT NULL
      ON CONFLICT DO NOTHING
    `);

    // 2. Backfill Audit Logs
    console.log('Backfilling audit_logs...');
    await client.query(`
      INSERT INTO lead_timeline (tenant_id, lead_id, event_type, entity, entity_id, summary, user_id, created_at)
      SELECT tenant_id, entity_id, 'audit.' || action, 'audit', id, new_value::text, user_id, created_at
      FROM audit_logs
      WHERE entity = 'lead'
      ON CONFLICT DO NOTHING
    `);

    await client.query('COMMIT');
    console.log('Timeline backfill completed successfully.');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during timeline backfill:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

backfillTimeline();
