const pool = require('../server/src/db/pool');
const jwt = require('jsonwebtoken');
const axios = require('axios');

async function run() {
  try {
    const leadId = '9523029d-a3b2-4b53-9f4a-f7bd8c103280';
    const tenantId = '5842ee7b-e84b-481e-bb3d-e4418919d050';
    const userId = 'd9744063-9d2c-40a9-8988-f763e54a0156';
    const sessionId = 'e6a1e5a4-f298-40d6-b507-6ddf15d06252';

    // Let's insert a mock file
    await pool.query(`
      INSERT INTO lead_files (tenant_id, lead_id, file_name, file_size, mime_type, storage_key, uploaded_by)
      VALUES ($1, $2, 'test_doc.pdf', 12345, 'application/pdf', 'mock_key_123', $3)
      ON CONFLICT DO NOTHING
    `, [tenantId, leadId, userId]);

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || 'supersecret123supersecret123supersecret123';
    const payload = {
      userId: userId,
      tenantId: tenantId,
      role: 'superadmin',
      permissions: ['*'],
      sessionId: sessionId
    };
    const token = jwt.sign(payload, jwtSecret, { expiresIn: '1h' });

    // Call GET files API
    const port = process.env.PORT || 4000;
    const url = `http://localhost:${port}/api/leads/${leadId}/files`;
    console.log(`Sending GET request to ${url}...`);
    try {
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      console.log("Success! Status:", response.status, "Data:", response.data);
    } catch (apiErr) {
      console.error("API Error Status:", apiErr.response?.status);
      console.error("API Error Data:", JSON.stringify(apiErr.response?.data, null, 2));
    }

    // Clean up mock file
    await pool.query("DELETE FROM lead_files WHERE lead_id = $1 AND storage_key = 'mock_key_123'", [leadId]);

  } catch (err) {
    console.error("Error Caught:", err);
  } finally {
    await pool.end();
  }
}
run();
