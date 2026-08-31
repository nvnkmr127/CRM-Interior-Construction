const pool = require('../server/src/config/db');

async function run() {
  try {
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP');
    console.log("Migration successful: added deleted_at to users table!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

run();
