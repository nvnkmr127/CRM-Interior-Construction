const Database = require('better-sqlite3');
const path = require('path');

// Determine database path
const dbPath = path.resolve(__dirname, '../../database.sqlite');
const db = new Database(dbPath, {
  // verbose: console.log // uncomment to debug queries
});

// Enable SQLite Foreign Keys
db.pragma('foreign_keys = ON');

// Adapter to mimic pg's pool interface
const pool = {
  query: async (text, params = []) => {
    try {
      // Basic conversion of Postgres $1, $2 variables to SQLite ? variables
      let sqliteText = text;
      // Replace only $n that are likely parameters (avoids JSONPath like $.[0])
      sqliteText = sqliteText.replace(/\$(\d+)\b/g, '?');

      // Convert ILIKE to LIKE for basic SQLite
      sqliteText = sqliteText.replace(/\bILIKE\b/gi, 'LIKE');

      // SQLite driver behaves differently for SELECT vs INSERT/UPDATE/DELETE
      const isSelect = sqliteText.trim().match(/^(SELECT|PRAGMA|EXPLAIN|WITH)/i);
      const isReturning = sqliteText.match(/\bRETURNING\b/i);

      const stmt = db.prepare(sqliteText);

      if (isSelect || isReturning) {
        const rows = stmt.all(...params);
        return { rows, rowCount: rows.length };
      } else {
        const info = stmt.run(...params);
        return { rows: [], rowCount: info.changes, lastInsertRowid: info.lastInsertRowid };
      }
    } catch (error) {
      console.error('[SQLite Query Error]', error.message);
      console.error('Query:', text);
      console.error('Params:', params);
      throw error;
    }
  },

  // Mock pool client for transactions
  connect: async () => {
    return {
      query: async (text, params = []) => pool.query(text, params),
      release: () => {}
    };
  },
  
  on: (event, handler) => {
    // Mock event emitter
  },
  
  db // Export the better-sqlite3 instance
};

module.exports = pool;
