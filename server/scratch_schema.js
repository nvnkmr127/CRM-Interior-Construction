const pool = require('./src/config/db');

async function run() {
  try {
    let res = await pool.query(`SELECT DISTINCT status FROM tasks`);
    console.log("Tasks statuses:");
    console.log(res.rows);
    
    res = await pool.query(`SELECT DISTINCT status FROM milestones`);
    console.log("Milestones statuses:");
    console.log(res.rows);
  } finally {
    pool.end();
  }
}
run();
