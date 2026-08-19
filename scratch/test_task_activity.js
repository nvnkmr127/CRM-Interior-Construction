const pool = require('../server/src/db/pool');
const jwt = require('jsonwebtoken');
const axios = require('axios');

async function run() {
  try {
    // Get any active user and their tenant_id
    const userRes = await pool.query(`
      SELECT u.id, u.tenant_id, u.email, r.name as role_name
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.status = 'active'
      LIMIT 1
    `);
    
    if (userRes.rows.length === 0) {
      console.log("No active user found!");
      return;
    }
    const user = userRes.rows[0];
    
    // Get a lead
    const leadRes = await pool.query("SELECT id FROM leads WHERE tenant_id = $1 AND deleted_at IS NULL LIMIT 1", [user.tenant_id]);
    if (leadRes.rows.length === 0) {
      console.log("No active leads found!");
      return;
    }
    const leadId = leadRes.rows[0].id;

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || 'supersecret123supersecret123supersecret123';
    const payload = {
      userId: user.id,
      tenantId: user.tenant_id,
      role: 'superadmin',
      permissions: ['*'],
      sessionId: '00000000-0000-0000-0000-000000000000'
    };
    
    const token = jwt.sign(payload, jwtSecret, { expiresIn: '1h' });

    // Call POST Activity API
    const port = process.env.PORT || 4000;
    const url = `http://localhost:${port}/api/leads/${leadId}/activities`;
    console.log(`Sending POST request to ${url}...`);
    try {
      const response = await axios.post(url, {
        type: 'task',
        notes: 'Scheduled task: test task due on 2026-08-25'
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      console.log("Success! Status:", response.status, "Data:", response.data);
    } catch (apiErr) {
      console.error("API Error Status:", apiErr.response?.status);
      console.error("API Error Data:", JSON.stringify(apiErr.response?.data, null, 2));
    }
  } catch (err) {
    console.error("Script Error:", err);
  } finally {
    await pool.end();
  }
}
run();
