const axios = require('axios');

async function test() {
  const api = axios.create({
    baseURL: 'http://localhost:4000/api',
    withCredentials: true,
  });

  try {
    console.log('Logging in...');
    const loginRes = await api.post('/auth/login', {
      email: 'admin@mock.com',
      password: 'password',
      tenantSlug: 'mock-tenant'
    });
    
    console.log('Login success:', loginRes.data.success);
    
    const cookies = loginRes.headers['set-cookie'];
    console.log('Cookies received:', cookies);

    // Try to hit /auth/me
    console.log('Fetching /auth/me...');
    const meRes = await api.get('/auth/me', {
      headers: {
        Cookie: cookies.join('; ')
      }
    });
    console.log('Me success:', meRes.data.success);
    
  } catch (error) {
    if (error.response) {
      console.log('Error Status:', error.response.status);
      console.log('Error Data:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
  }
}

test();
