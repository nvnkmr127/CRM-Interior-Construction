require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const pool = require('../src/db/pool');

async function runMigrations() {
  try {
    const migrationsDir = path.join(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Sort alphanumerically to run in order

    for (const file of files) {
      console.log(`Running migration: ${file}`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');
      
      await pool.query(sql);
      console.log(`Successfully completed migration: ${file}`);
    }

    console.log('All migrations completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
