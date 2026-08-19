const dns = require('dns');
const { Client } = require('pg');

dns.lookup('ep-noisy-smoke-aw8j01pj-pooler.c-12.us-east-1.aws.neon.tech', { family: 4 }, async (err, address, family) => {
  if (err) {
    console.error('IPv4 Lookup failed for Neon:', err);
    return;
  }
  console.log('IPv4 Lookup successful for Neon. Address:', address);
  
  // Try connecting using pg
  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_K0JQzHbZVyU3@ep-noisy-smoke-aw8j01pj-pooler.c-12.us-east-1.aws.neon.tech/neondb',
    ssl: { rejectUnauthorized: false }
  });
  
  console.log('Connecting...');
  try {
    await client.connect();
    console.log('Connected successfully!');
    const res = await client.query('SELECT NOW()');
    console.log('Query result:', res.rows[0]);
    await client.end();
  } catch (err) {
    console.error('Connection failed:', err);
  }
});
