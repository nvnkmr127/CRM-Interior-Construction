const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, '../migrations');
const files = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql') && f !== 'all.sql')
  .sort();

let allSql = '';
for (const file of files) {
  allSql += `\n\n-- Migration: ${file}\n\n`;
  allSql += fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
}

fs.writeFileSync(path.join(migrationsDir, 'all.sql'), allSql);
console.log('Concatenated', files.length, 'files into all.sql');
