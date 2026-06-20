const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') }); // It is 3 levels up from server/src/db/pool.js: 1(db)->2(src)->3(server)->root

const useSSL = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') && !process.env.DATABASE_URL.includes('127.0.0.1');

if (useSSL) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const cleanUrl = process.env.DATABASE_URL ? process.env.DATABASE_URL.replace('?sslmode=require', '') : '';

const pool = new Pool({
  connectionString: cleanUrl,
  ssl: useSSL ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle DB client — connection will be replaced by the pool', err);
});

const readUrl = process.env.READ_DATABASE_URL ? process.env.READ_DATABASE_URL.replace('?sslmode=require', '') : cleanUrl;
const useReadSSL = process.env.READ_DATABASE_URL && !process.env.READ_DATABASE_URL.includes('localhost') && !process.env.READ_DATABASE_URL.includes('127.0.0.1');

const readPool = new Pool({
  connectionString: readUrl,
  ssl: useReadSSL ? { rejectUnauthorized: false } : (useSSL ? { rejectUnauthorized: false } : false)
});

readPool.on('error', (err) => {
  console.error('Unexpected error on idle DB READ client', err);
});

// Attach readPool to the primary pool so old requires still work but have access to readPool
pool.readPool = readPool;
// Also support `const { pool, readPool } = require('./pool');`
pool.pool = pool;

module.exports = pool;


