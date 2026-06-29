process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = require('./server/src/db/pool');

async function inspect() {
  try {
    const table_cols = {};
    for (const table of ['quotations', 'quotation_items']) {
      const res = await pool.query(
        "SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE table_name = $1",
        [table]
      );
      table_cols[table] = res.rows;
    }
    console.log(JSON.stringify(table_cols, null, 2));
  } catch (err) {
    console.error('Inspect failed:', err);
  } finally {
    process.exit(0);
  }
}
inspect();
