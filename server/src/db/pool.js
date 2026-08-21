const { Pool, types } = require('pg');
const path = require('path');
const logger = require('../utils/logger');

// Force PostgreSQL OID 1114 (TIMESTAMP WITHOUT TIME ZONE) to parse as UTC instead of local system time
types.setTypeParser(1114, function(stringValue) {
  return stringValue ? new Date(stringValue.replace(' ', 'T') + 'Z') : null;
});
const dns = require('dns');

if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

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
  } catch (error) {
    return urlStr.replace(/[?&](sslmode|channel_binding)=[^&]+/g, '');
  }
};

const fallbackUrl = 'postgresql://neondb_owner:npg_K0JQzHbZVyU3@ep-noisy-smoke-aw8j01pj-pooler.c-12.us-east-1.aws.neon.tech/neondb';
let rawUrl = process.env.DATABASE_URL || fallbackUrl;
if (rawUrl.includes('aivencloud.com')) {
  rawUrl = fallbackUrl;
}
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

pool.on('error', (error) => {
  logger.error('Unexpected error on idle DB client — connection will be replaced by the pool', error);
});

let rawReadUrl = process.env.READ_DATABASE_URL || rawUrl;
if (rawReadUrl.includes('aivencloud.com')) {
  rawReadUrl = fallbackUrl;
}
const readUrl = sanitizeDbUrl(rawReadUrl);
const useReadSSL = rawReadUrl && !rawReadUrl.includes('localhost') && !rawReadUrl.includes('127.0.0.1');

const readPool = new Pool({
  connectionString: readUrl,
  ssl: useReadSSL ? { rejectUnauthorized: false } : (useSSL ? { rejectUnauthorized: false } : false),
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10
});

readPool.on('error', (error) => {
  logger.error('Unexpected error on idle DB READ client', error);
});

// Attach readPool to the primary pool so old requires still work but have access to readPool
pool.readPool = readPool;
// Also support `const { pool, readPool } = require('./pool');`
pool.pool = pool;

module.exports = pool;


