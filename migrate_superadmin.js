require('dotenv').config({ path: 'server/.env' });
const pool = require('./server/src/db/pool');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function migrate() {
  let client;
  for (let i = 0; i < 5; i++) {
    try {
      client = await pool.connect();
      break;
    } catch (err) {
      console.log('Connection failed, retrying...', err.message);
      await sleep(2000);
    }
  }

  if (!client) {
    console.error('Could not connect to DB after 5 retries.');
    process.exit(1);
  }

  try {
    console.log('Connected to DB. Running Super Admin migrations...');
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS token_version INT DEFAULT 1,
      ADD COLUMN IF NOT EXISTS force_password_reset BOOLEAN DEFAULT false;
    `);
    console.log('Updated users table');

    await client.query(`
      ALTER TABLE tenants 
      ADD COLUMN IF NOT EXISTS license_seats INT DEFAULT 50,
      ADD COLUMN IF NOT EXISTS sso_config JSONB DEFAULT '{}'::jsonb;
    `);
    console.log('Updated tenants table');

    await client.query(`
      CREATE TABLE IF NOT EXISTS api_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        last_used_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('Created api_tokens table');

    await client.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'info',
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('Created announcements table');

    await client.query('COMMIT');
    console.log('Migration successful');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();
