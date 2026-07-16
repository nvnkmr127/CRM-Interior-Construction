require('dotenv').config({ path: '.env' });
const pool = require('./server/src/config/db');
pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'leads'")
  .then(res => { console.log(res.rows); process.exit(0); })
  .catch(console.error);
