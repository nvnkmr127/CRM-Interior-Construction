const { Client } = require('pg');

async function test(url, name) {
  console.log('Testing:', name);
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const res = await client.query('SELECT NOW()');
    console.log(name, 'Success!', res.rows[0]);
    await client.end();
  } catch (err) {
    console.error(name, 'Failed:', err.message);
  }
}

async function run() {
  await test('postgresql://postgres.brjoyeoyohdfnnfgtqrp:3C36dlthA8gtGJcx@aws-0-ap-south-1.pooler.supabase.com:6543/postgres', 'Pooler 6543');
  await test('postgresql://postgres.brjoyeoyohdfnnfgtqrp:3C36dlthA8gtGJcx@aws-0-ap-south-1.pooler.supabase.com:5432/postgres', 'Pooler 5432');
  await test('postgresql://postgres:3C36dlthA8gtGJcx@aws-0-ap-south-1.pooler.supabase.com:5432/postgres', 'Pooler No Ref 5432');
  await test('postgresql://postgres:3C36dlthA8gtGJcx@aws-0-ap-south-1.pooler.supabase.com:6543/postgres', 'Pooler No Ref 6543');
}
run();
