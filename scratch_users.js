const pool = require('./server/src/db/pool');
async function checkSessions() {
  try {
    const sessions = await pool.query('SELECT s.*, u.email, u.name FROM sessions s JOIN users u ON s.user_id = u.id ORDER BY s.expires_at DESC LIMIT 5');
    console.log('Sessions:', sessions.rows);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}
checkSessions();
