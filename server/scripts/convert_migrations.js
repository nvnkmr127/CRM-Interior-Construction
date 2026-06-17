const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, '../migrations');
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));

for (const file of files) {
  const filePath = path.join(migrationsDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');

  // Replace UUID generation
  content = content.replace(
    /id TEXT PRIMARY KEY DEFAULT \(lower\(hex\(randomblob\(4\)\)\) \|\| '-' \|\| lower\(hex\(randomblob\(2\)\)\) \|\| '-4' \|\| substr\(lower\(hex\(randomblob\(2\)\)\),2\) \|\| '-' \|\| substr\('89ab',abs\(random\(\)\) % 4 \+ 1, 1\) \|\| substr\(lower\(hex\(randomblob\(2\)\)\),2\) \|\| '-' \|\| lower\(hex\(randomblob\(6\)\)\)\)/g,
    'id UUID PRIMARY KEY DEFAULT gen_random_uuid()'
  );

  // Replace TEXT DEFAULT CURRENT_TIMESTAMP
  content = content.replace(/TEXT DEFAULT CURRENT_TIMESTAMP/g, 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');

  // Replace foreign keys defined as TEXT with UUID
  content = content.replace(/(\w+_id)\s+TEXT/g, '$1 UUID');
  content = content.replace(/(\w+_by)\s+TEXT/g, '$1 UUID');
  content = content.replace(/(assigned_to)\s+TEXT/g, '$1 UUID');

  // Replace BOOLEAN fields that might have been defined as INTEGER DEFAULT 0/1 in SQLite
  content = content.replace(/INTEGER DEFAULT 0/g, 'BOOLEAN DEFAULT FALSE');
  content = content.replace(/INTEGER DEFAULT 1/g, 'BOOLEAN DEFAULT TRUE');

  // Some tables had BOOLEAN DEFAULT 0
  content = content.replace(/BOOLEAN DEFAULT 0/g, 'BOOLEAN DEFAULT FALSE');
  content = content.replace(/BOOLEAN DEFAULT 1/g, 'BOOLEAN DEFAULT TRUE');

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`Converted ${file}`);
}
