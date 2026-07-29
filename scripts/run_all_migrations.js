const fs = require('fs');
const path = require('path');
const pool = require('../server/src/db/pool');

async function runAllMigrations() {
  const migrationsDir = path.join(__dirname, '../server/migrations');
  console.log('Reading migration files from:', migrationsDir);

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files.`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    console.log(`Running migration: ${file}...`);
    const sql = fs.readFileSync(filePath, 'utf8');

    try {
      await pool.query(sql);
      console.log(`✓ ${file} applied successfully.`);
    } catch (err) {
      console.error(`✗ Error applying ${file}:`, err.message);
    }
  }

  console.log('All migrations completed.');
  await pool.end();
  process.exit(0);
}

runAllMigrations().catch(err => {
  console.error('Fatal error running migrations:', err);
  process.exit(1);
});
