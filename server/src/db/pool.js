const { Pool } = require('pg');
const path = require('path');
if (process.env.NODE_ENV === 'test') {
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env.test'), override: true });
} else {
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
  if (!process.env.DATABASE_URL) {
    require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
  }
}

const sanitizeDbUrl = (urlStr) => {
  if (!urlStr) return '';
  try {
    const u = new URL(urlStr);
    u.searchParams.delete('sslmode');
    u.searchParams.delete('channel_binding');
    return u.toString();
  } catch (e) {
    return urlStr.replace(/[?&](sslmode|channel_binding)=[^&]+/g, '');
  }
};

const rawUrl = process.env.DATABASE_URL || '';
const useSSL = rawUrl && !rawUrl.includes('localhost') && !rawUrl.includes('127.0.0.1');

if (useSSL) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const cleanUrl = sanitizeDbUrl(rawUrl);

const pool = new Pool({
  connectionString: cleanUrl,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle DB client — connection will be replaced by the pool', err);
});

const rawReadUrl = process.env.READ_DATABASE_URL || rawUrl;
const readUrl = sanitizeDbUrl(rawReadUrl);
const useReadSSL = rawReadUrl && !rawReadUrl.includes('localhost') && !rawReadUrl.includes('127.0.0.1');

const readPool = new Pool({
  connectionString: readUrl,
  ssl: useReadSSL ? { rejectUnauthorized: false } : (useSSL ? { rejectUnauthorized: false } : false),
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10
});

readPool.on('error', (err) => {
  console.error('Unexpected error on idle DB READ client', err);
});

// Attach readPool to the primary pool so old requires still work but have access to readPool
pool.readPool = readPool;
// Also support `const { pool, readPool } = require('./pool');`
pool.pool = pool;

module.exports = pool;


