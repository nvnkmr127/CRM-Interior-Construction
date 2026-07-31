const { generateAccessToken } = require('./server/src/services/auth/tokens');
const pool = require('./server/src/db/pool');

async function test() {
  try {
    const user = await pool.query('SELECT * FROM users LIMIT 1');
    if (user.rowCount === 0) {
      console.log('No users found');
      process.exit(1);
    }
    const u = user.rows[0];
    const token = generateAccessToken(u);
    console.log(token);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
test();
