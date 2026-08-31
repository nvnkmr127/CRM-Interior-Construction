const pool = require('../server/src/config/db');

pool.query('SELECT id, name, email, role_id, status FROM users').then(res => {
  console.log(res.rows);
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
