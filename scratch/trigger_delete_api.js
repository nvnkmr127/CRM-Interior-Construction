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
    console.log("Found user for token generation:", user);

    // Create a mock lead to delete
    const leadInsert = await pool.query(`
      INSERT INTO leads (tenant_id, name, phone, status)
      VALUES ($1, 'Temp Lead To Delete', '+919999999999', 'active')
      RETURNING id
    `, [user.tenant_id]);
    const leadId = leadInsert.rows[0].id;
    console.log("Created temp lead ID:", leadId);

    const jwtSecret = process.env.JWT_SECRET || 'supersecret123supersecret123supersecret123';
    const payload = {
      userId: user.id,
      tenantId: user.tenant_id,
      role: 'superadmin',
      permissions: ['*'],
      sessionId: '00000000-0000-0000-0000-000000000000' // mock session
    };
    
    // Let's create a mock session in DB to passZero Zero Trust validation
    await pool.query(`
      INSERT INTO sessions (id, tenant_id, user_id, ip_address, expires_at, token_hash)
      VALUES ('00000000-0000-0000-0000-000000000000', $1, $2, '127.0.0.1', NOW() + INTERVAL '1 hour', 'dummy_hash')
      ON CONFLICT (id) DO UPDATE SET expires_at = NOW() + INTERVAL '1 hour'
    `, [user.tenant_id, user.id]);

    const token = jwt.sign(payload, jwtSecret, { expiresIn: '1h' });
    console.log("Generated Token:", token);

    // Call DELETE API
    const port = process.env.PORT || 5000;
    const url = `http://localhost:${port}/api/leads/${leadId}`;
    console.log(`Sending DELETE request to ${url}...`);
    try {
      const response = await axios.delete(url, {
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
