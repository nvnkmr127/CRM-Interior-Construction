const pool = require('../src/db/pool');

async function run() {
  try {
    const leadsRes = await pool.query('SELECT id, name FROM leads LIMIT 15');
    console.log('--- LEADS ---');
    console.log(leadsRes.rows);

    const contactsRes = await pool.query('SELECT id, lead_id, name, phone, email, role FROM lead_contacts LIMIT 15');
    console.log('--- CONTACTS ---');
    console.log(contactsRes.rows);
  } catch (error) {
    console.error('Error querying database:', error);
  } finally {
    await pool.end();
  }
}

run();
