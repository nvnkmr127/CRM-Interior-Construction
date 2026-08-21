const pool = require('../src/db/pool');
const { readPool } = pool;
const { types } = require('pg');

// Register global parser for TIMESTAMP (OID 1114)
types.setTypeParser(1114, function(stringValue) {
  return stringValue ? new Date(stringValue.replace(' ', 'T') + 'Z') : null;
});

async function run() {
  try {
    const visits = await readPool.query(`
      SELECT 
        id, 
        scheduled_at::text as raw_text, 
        scheduled_at
      FROM site_visits
      ORDER BY created_at DESC
      LIMIT 3
    `);
    visits.rows.forEach(v => {
      console.log(`Visit ID: ${v.id}`);
      console.log(`  Raw Text: ${v.raw_text}`);
      console.log(`  Parsed with Custom Parser: ${v.scheduled_at}`);
    });
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

run();
