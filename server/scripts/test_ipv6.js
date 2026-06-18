const { Client } = require('pg');
const dns = require('dns');

// Try setting default result order to favor IPv6 if available in Node 18+
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv6first');
}

async function test() {
  const connectionString = 'postgresql://postgres:3C36dlthA8gtGJcx@db.brjoyeoyohdfnnfgtqrp.supabase.co:5432/postgres';
  console.log('Connecting with connectionString:', connectionString);
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('Connected successfully!');
    const res = await client.query('SELECT NOW()');
    console.log('Time:', res.rows[0]);
    await client.end();
  } catch (err) {
    console.error('Connection failed:', err);
  }
}
test();
