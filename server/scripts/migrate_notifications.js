const db = require('better-sqlite3')('../database.sqlite');

try {
  console.log('Migrating Notifications & Preferences tables...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      tenant_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      actor_id TEXT,
      title TEXT NOT NULL,
      body TEXT,
      type TEXT NOT NULL,
      lead_id TEXT,
      is_read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      email_sla_breaches BOOLEAN DEFAULT 1,
      push_score_changes BOOLEAN DEFAULT 1,
      dnd_start_time TEXT DEFAULT '22:00',
      dnd_end_time TEXT DEFAULT '08:00',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('Migration successful!');
} catch (e) {
  console.error('Migration failed:', e);
} finally {
  db.close();
}
