const pool = require('../server/src/db/pool');

async function run() {
  try {
    const totalCountRes = await pool.query('SELECT COUNT(*) FROM leads');
    console.log('Total leads in database:', totalCountRes.rows[0].count);

    const deletedCountRes = await pool.query('SELECT COUNT(*) FROM leads WHERE deleted_at IS NOT NULL');
    console.log('Soft-deleted leads in database:', deletedCountRes.rows[0].count);

    const activeCountRes = await pool.query('SELECT COUNT(*) FROM leads WHERE deleted_at IS NULL');
    console.log('Active (non-deleted) leads in database:', activeCountRes.rows[0].count);

    const sampleLeads = await pool.query('SELECT id, name, tenant_id, deleted_at FROM leads LIMIT 5');
    console.log('Sample leads:', sampleLeads.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
