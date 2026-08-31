const http = require('http');

// Helper to do POST /api/auth/login
function login(callback) {
  const data = JSON.stringify({
    email: 'admin@demo.com',
    password: 'Demo@123',
    tenantSlug: 'demo'
  });

  const options = {
    host: 'localhost',
    port: 5173,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const req = http.request(options, (res) => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
      const parsed = JSON.parse(body);
      const token = parsed.data.accessToken;
      const cookies = res.headers['set-cookie'];
      callback(token, cookies);
    });
  });

  req.on('error', (e) => console.error(e));
  req.write(data);
  req.end();
}

login((token, cookies) => {
  const options = {
    host: 'localhost',
    port: 5173,
    path: '/api/notifications/unread-count',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };
  
  if (cookies) {
    options.headers['Cookie'] = cookies.map(c => c.split(';')[0]).join('; ');
  }

  const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    let body = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
      console.log(`BODY: ${body}`);
    });
  });

  req.on('error', (e) => console.error(e));
  req.end();
});
