const { loginUser } = require('./services/auth/login');
const pool = require('./db/pool');

async function testLogin() {
  try {
    const tenantResult = await pool.query("SELECT id FROM tenants WHERE slug='demo'");
    const tenantId = tenantResult.rows[0].id;
    console.log('Tenant ID:', tenantId);
    
    const res = await loginUser({
      email: 'admin@demo.com',
      password: 'Demo@123',
      tenantId: tenantId,
      ip: '127.0.0.1',
      userAgent: 'Mozilla/5.0'
    });
    console.log('Login successful:', res);
  } catch (error) {
    console.error('Login failed with error message:', error.message);
  } finally {
    process.exit(0);
  }
}

testLogin();
