const pool = require('./server/src/config/db');
pool.query('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false')
  .then(() => { console.log('success'); process.exit(0); })
  .catch(err => { console.error(err); process.exit(1); });
