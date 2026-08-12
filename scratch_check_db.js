const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'server', 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    return;
  }
  console.log('Connected to database:', dbPath);
});

db.all('SELECT id, name, tenant_id FROM roles', [], (err, rows) => {
  if (err) {
    console.error('Error querying roles:', err);
    return;
  }
  console.log('Current Roles in DB:', rows);
  db.close();
});
