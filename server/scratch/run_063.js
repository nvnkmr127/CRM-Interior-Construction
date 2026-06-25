const pool = require('../src/db/pool');
async function run() {
  try {
    await pool.query('ALTER TABLE projects ADD COLUMN booking_amount DECIMAL(12,2) DEFAULT 0.00;');
    console.log("Migration 063 ran successfully");
  } catch (err) {
    console.error("Migration 063 failed:", err.message);
  } finally {
    process.exit(0);
  }
}
run();
