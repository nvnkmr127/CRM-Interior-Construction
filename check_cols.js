process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = require('./server/src/db/pool');
pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'leads'")
  .then(res => { console.log(res.rows.map(r => r.column_name).join(', ')); process.exit(0); });
