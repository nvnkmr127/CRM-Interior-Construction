require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const request = require('supertest');
const app = require('../src/app');

async function run() {
  try {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    console.log('Status:', loginRes.status);
    console.log('Body:', loginRes.body);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
