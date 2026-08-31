const axios = require('axios');

async function run() {
  const instance = axios.create({
    baseURL: 'http://localhost:5173/api',
    withCredentials: true
  });

  try {
    console.log("Logging in...");
    const loginRes = await instance.post('/auth/login', {
      email: 'admin@demo.com',
      password: 'Demo@123',
      tenantSlug: 'demo'
    });

    // Extract cookie
    const cookie = loginRes.headers['set-cookie'];
    if (cookie) {
      instance.defaults.headers.Cookie = cookie.map(c => c.split(';')[0]).join('; ');
    }

    console.log("Fetching dashboard stats (First request - hits DB)...");
    const start1 = Date.now();
    const statsRes1 = await instance.get('/dashboard/stats');
    const end1 = Date.now() - start1;
    console.log(`First request took: ${end1}ms`);

    console.log("Fetching dashboard stats (Second request - hits Cache)...");
    const start2 = Date.now();
    const statsRes2 = await instance.get('/dashboard/stats');
    const end2 = Date.now() - start2;
    console.log(`Second request took: ${end2}ms`);

    console.log("Stats sample:", JSON.stringify(statsRes2.data.data).slice(0, 150));
    process.exit(0);
  } catch (error) {
    console.error("Test failed:", error.response ? error.response.data : error.message);
    process.exit(1);
  }
}

run();
