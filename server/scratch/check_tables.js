require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const pool = require('../src/config/db');

async function check() {
  try {
    const projCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'projects'");
    console.log('projects columns:', projCols.rows.map(r => r.column_name).join(', '));

    const contactCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'project_contacts'");
    console.log('project_contacts columns:', contactCols.rows.map(r => r.column_name).join(', '));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
check();
