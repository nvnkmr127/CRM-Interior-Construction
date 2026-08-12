const pool = require('./server/src/db/pool'); 
const fs = require('fs');
async function checkUsers() {
  try {
    const users = await pool.query('SELECT u.email, u.name, t.slug as tenant_slug FROM users u JOIN tenants t ON u.tenant_id = t.id');
    fs.writeFileSync('users_db.json', JSON.stringify(users.rows, null, 2));
    console.log('Done');
    process.exit(0);
  } catch (err) {
    fs.writeFileSync('users_db_err.json', JSON.stringify({ error: err.message, stack: err.stack }, null, 2));
    process.exit(1);
  }
}
checkUsers();
