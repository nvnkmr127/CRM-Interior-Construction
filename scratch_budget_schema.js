require('dotenv').config({ path: '.env' });
const pool = require('./server/src/config/db');
pool.query("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE column_name LIKE '%budget%' OR column_name LIKE '%value%' OR column_name LIKE '%revenue%'")
  .then(res => { console.log(res.rows); process.exit(0); })
  .catch(console.error);
