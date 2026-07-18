const pool = require('./src/db/pool');

afterAll(async () => {
  // Close database pools
  try {
    if (pool && typeof pool.end === 'function') {
      await pool.end();
    }
    if (pool.readPool && typeof pool.readPool.end === 'function') {
      await pool.readPool.end();
    }
  } catch (err) {
    // ignore
  }
});
