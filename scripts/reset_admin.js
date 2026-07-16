const bcrypt = require('bcryptjs');
const pool = require('./server/src/db/pool');

async function test() {
  const hash = await bcrypt.hash('password123', 10);
  await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, 'admin@demo.com']);
  console.log('Password reset to password123 for admin@demo.com');
  process.exit(0);
}
test();
