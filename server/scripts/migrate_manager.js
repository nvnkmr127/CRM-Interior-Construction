const db = require('better-sqlite3')('../database.sqlite');

try {
  console.log('Creating discount_approvals table...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS discount_approvals (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      tenant_id TEXT NOT NULL,
      lead_id TEXT NOT NULL,
      rep_id TEXT NOT NULL,
      original_amount REAL,
      discount_percent REAL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('Migration successful!');
} catch (e) {
  console.error('Migration failed:', e);
} finally {
  db.close();
}
