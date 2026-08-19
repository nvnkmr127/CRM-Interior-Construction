const pool = require('../server/src/db/pool');
async function run() {
  try {
    const res = await pool.query(`
      UPDATE leads 
      SET deleted_at = NOW() 
      WHERE id = '9523029d-a3b2-4b53-9f4a-f7bd8c103280'
    `);
    console.log('Result:', res);
  } catch (err) {
    console.error('Error occurred:', err);
  } finally {
    await pool.end();
  }
}
run();
