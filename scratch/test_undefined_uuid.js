const pool = require('../server/src/db/pool');
const jwt = require('jsonwebtoken');
const axios = require('axios');

async function run() {
  try {
    const leadId = 'undefined';
    const tenantId = '5842ee7b-e84b-481e-bb3d-e4418919d050';
    const userId = 'd9744063-9d2c-40a9-8988-f763e54a0156';
    const sessionId = 'e6a1e5a4-f298-40d6-b507-6ddf15d06252';

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

    // Call GET files API on Vite port 5173
    const url = `http://localhost:5173/api/leads/${leadId}/files`;
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
  } catch (err) {
    console.error("Error Caught:", err);
  } finally {
    await pool.end();
  }
}
run();
