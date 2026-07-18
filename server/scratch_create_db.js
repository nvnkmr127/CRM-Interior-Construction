const { Client } = require('pg');

async function run() {
  require('dotenv').config();
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/defaultdb'
  });

  try {
    await client.connect();
    console.log("Connected to defaultdb.");
    // check if crm_db_test exists
    const res = await client.query("SELECT datname FROM pg_database WHERE datname = 'crm_db_test'");
    if (res.rows.length === 0) {
      console.log("Creating crm_db_test...");
      await client.query("CREATE DATABASE crm_db_test");
      console.log("Database created.");
    } else {
      console.log("Database crm_db_test already exists.");
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

run();
