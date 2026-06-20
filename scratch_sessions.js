require('dotenv').config({ path: '.env' });
const pool = require('./server/src/config/db');
pool.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'sessions'")
  .then(res => { console.log(res.rows); process.exit(0); })
  .catch(console.error);
