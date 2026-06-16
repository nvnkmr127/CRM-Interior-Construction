const request = require('supertest');
const app = require('./src/app');

async function run() {
  console.log('Sending login request...');
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email:'admin@demo.com', password:'Admin@123', tenantSlug:'demo' });
  console.log('Status:', res.status);
  console.log('Body:', res.body);
  console.log('Error:', res.error ? res.error.text : null);
}
run();
