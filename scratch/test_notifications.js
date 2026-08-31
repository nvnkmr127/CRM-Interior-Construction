const pool = require('../server/src/config/db');

pool.query('SELECT * FROM notifications LIMIT 1').then(res => {
  console.log("Success! Columns in notifications:", res.fields.map(f => f.name));
  process.exit(0);
}).catch(e => {
  console.error("ERROR querying notifications:", e);
  process.exit(1);
});
