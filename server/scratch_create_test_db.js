const { Client } = require('pg');

require('dotenv').config();
async function createTestDb() {
  const connectionString = process.env.DATABASE_URL || 'postgres://localhost:5432/defaultdb';
  const client = new Client({ connectionString });
  try {
    await client.connect();
    // Check if test db exists
    const res = await client.query(`SELECT datname FROM pg_catalog.pg_database WHERE datname = 'crm_test_db'`);
    if (res.rowCount === 0) {
      await client.query('CREATE DATABASE crm_test_db');
      console.log('Database crm_test_db created successfully.');
    } else {
      console.log('Database crm_test_db already exists.');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

createTestDb();
