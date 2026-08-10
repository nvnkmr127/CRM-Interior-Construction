const axios = require('axios');
const pool = require('./server/src/db/pool');

async function testUpdate() {
  try {
    // 1. Get a lead and user from DB
    const userRes = await pool.query('SELECT * FROM users LIMIT 1');
    const user = userRes.rows[0];
    const leadRes = await pool.query('SELECT * FROM leads LIMIT 1');
    const lead = leadRes.rows[0];

    // 2. Generate a token
    const { generateToken } = require('./server/src/utils/token');
    const token = generateToken(user); // assuming such a util exists, or we just call the service

    // Instead of full API call, let's just test the service directly!
    const { updateLead } = require('./server/src/services/leads/updateLead');
    console.log('Testing updateLead directly...');
    const result = await updateLead({
      tenantId: lead.tenant_id,
      userId: user.id,
      leadId: lead.id,
      data: { assignee_id: user.id }
    });
    console.log('updateLead SUCCESS:', result.id);
  } catch(e) {
    console.error('updateLead FAILED:', e);
  } finally {
    process.exit(0);
  }
}
testUpdate();
