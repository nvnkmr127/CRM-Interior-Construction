const http = require('http');

const options = {
  host: 'localhost',
  port: 5173,
  path: '/api/dashboard/stats',
  method: 'GET',
  headers: {
    'User-Agent': 'Mozilla/5.0',
    'Accept': 'application/json',
  }
};

async function test() {
  const start = Date.now();
  const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const duration = Date.now() - start;
      console.log(`Response received in ${duration}ms`);
      console.log(`First 200 chars of body: ${data.slice(0, 200)}`);
      
      // Let's do it again to check caching!
      const start2 = Date.now();
      const req2 = http.request(options, (res2) => {
        let data2 = '';
        res2.on('data', chunk => data2 += chunk);
        res2.on('end', () => {
          const duration2 = Date.now() - start2;
          console.log(`Cached response received in ${duration2}ms`);
          process.exit(0);
        });
      });
      req2.end();
    });
  });
  req.end();
}

test();
