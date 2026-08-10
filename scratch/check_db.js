const pool = require('./server/src/db/pool');

async function test() {
  try {
    const act = await pool.query('SELECT * FROM activities ORDER BY created_at DESC LIMIT 5');
    console.log('--- RECENT ACTIVITIES ---');
    console.log(act.rows);

    const tl = await pool.query('SELECT * FROM lead_timeline ORDER BY created_at DESC LIMIT 5');
    console.log('--- RECENT TIMELINE ---');
    console.log(tl.rows);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

test();
