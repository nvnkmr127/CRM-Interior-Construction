const { pool } = require('./server/src/config/db');
const fs = require('fs');
const path = require('path');

async function test() {
  try {
    const res = await pool.query(`SELECT * FROM resource_allocations`);
    fs.writeFileSync(path.join(__dirname, 'scratch_output.json'), JSON.stringify(res.rows, null, 2));
  } catch (err) {
    fs.writeFileSync(path.join(__dirname, 'scratch_output.json'), JSON.stringify({error: err.message}));
  } finally {
    pool.end();
  }
}
test();
