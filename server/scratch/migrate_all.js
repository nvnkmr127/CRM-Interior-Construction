const fs = require('fs');
const path = require('path');
const pool = require('../src/config/db');

async function runAllMigrations() {
  const migrationsDir = path.join(__dirname, '../migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  
  for (const file of files) {
    if (file === '001_baseline_schema.sql') continue; // baseline is already run
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    
    // Attempt to run each file
    try {
      await pool.query(sql);
      console.log(`✅ ${file} applied successfully.`);
    } catch (e) {
      console.log(`⚠️ ${file} failed (possibly already applied or constraint error): ${e.message.split('\\n')[0]}`);
    }
  }
  
  console.log('Finished applying all migrations.');
  process.exit(0);
}

runAllMigrations();
