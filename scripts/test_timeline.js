process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const pool = require('./server/src/db/pool');
const { logActivity } = require('./server/src/services/activities/activityService');

async function testTimeline() {
  const tenants = await pool.query('SELECT id FROM tenants LIMIT 1');
  const tenantId = tenants.rows[0].id;
  
  const leads = await pool.query('SELECT id FROM leads LIMIT 1');
  const leadId = leads.rows[0].id;

  const users = await pool.query('SELECT id FROM users LIMIT 1');
  const userId = users.rows[0].id;

  try {
    console.log('Logging an activity to test timeline...');
    await logActivity({
      tenantId,
      userId,
      leadId,
      type: 'call',
      title: 'Initial Discovery Call',
      notes: 'Client wants modern minimalist interior.'
    });

    console.log('Fetching lead timeline...');
    const timeline = await pool.query('SELECT * FROM lead_timeline WHERE lead_id = $1 ORDER BY created_at DESC', [leadId]);
    console.log('Timeline Events:', timeline.rows);

  } catch(err) {
    console.error('Test failed:', err);
  } finally {
    process.exit(0);
  }
}

testTimeline();
