const pool = require('../server/src/config/db');

pool.query('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false').then(() => {
  console.log("Migration successful: added is_archived to notifications!");
  process.exit(0);
}).catch(e => {
  console.error("Migration failed:", e);
  process.exit(1);
});
