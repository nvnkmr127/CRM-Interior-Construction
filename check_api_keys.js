const { Pool } = require("pg");
const fs = require("fs");
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_K0JQzHbZVyU3@ep-noisy-smoke-aw8j01pj-pooler.c-12.us-east-1.aws.neon.tech/neondb?sslmode=require"
});

async function check() {
  try {
    const sql = fs.readFileSync("server/migrations/014_api_integration.sql", "utf8");
    await pool.query(sql);
    console.log("Migration 014 applied!");
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
check();
