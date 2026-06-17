const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, '../migrations');
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));

for (const file of files) {
  const filePath = path.join(migrationsDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;

  if (content.includes('sort_order BOOLEAN DEFAULT FALSE')) {
    content = content.replace(/sort_order BOOLEAN DEFAULT FALSE/g, 'sort_order INTEGER DEFAULT 0');
    changed = true;
  }
  if (content.includes('score BOOLEAN DEFAULT FALSE')) {
    content = content.replace(/score BOOLEAN DEFAULT FALSE/g, 'score INTEGER DEFAULT 0');
    changed = true;
  }
  if (content.includes('run_count BOOLEAN DEFAULT FALSE')) {
    content = content.replace(/run_count BOOLEAN DEFAULT FALSE/g, 'run_count INTEGER DEFAULT 0');
    changed = true;
  }
  if (content.includes('INSERT OR IGNORE INTO lead_stages')) {
    content = content.replace(/INSERT OR IGNORE INTO lead_stages \((.*)\) VALUES\s*([\s\S]*?);/m, (match, p1, p2) => {
      return `INSERT INTO lead_stages (${p1}) VALUES\n${p2}\nON CONFLICT DO NOTHING;`;
    });
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Fixed ${file}`);
  }
}
