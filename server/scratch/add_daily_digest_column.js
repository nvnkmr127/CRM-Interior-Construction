const pool = require('../src/db/pool');

async function migrate() {
  try {
    console.log('Adding email_daily_digest column to user_preferences...');
    await pool.query(`
      ALTER TABLE user_preferences 
      ADD COLUMN IF NOT EXISTS email_daily_digest BOOLEAN DEFAULT true;
    `);
    console.log('Successfully added email_daily_digest column.');
  } catch (err) {
    console.error('Error adding column:', err);
  } finally {
    pool.end();
  }
}

migrate();
