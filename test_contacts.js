const http = require('http');

http.get('http://localhost:5000/api/leads', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const leads = JSON.parse(data).data;
      if (leads && leads.length > 0) {
        const firstLeadId = leads[0].id;
        console.log('First lead ID:', firstLeadId);
        
        http.get(`http://localhost:5000/api/leads/${firstLeadId}/contacts`, (cRes) => {
          let cData = '';
          cRes.on('data', chunk => cData += chunk);
          cRes.on('end', () => {
            console.log('Contacts for lead 1:', cData);
          });
        });

        if (leads.length > 1) {
          const secondLeadId = leads[1].id;
          http.get(`http://localhost:5000/api/leads/${secondLeadId}/contacts`, (cRes) => {
            let cData = '';
            cRes.on('data', chunk => cData += chunk);
            cRes.on('end', () => {
              console.log('Contacts for lead 2:', cData);
            });
          });
        }
      }
    } catch (e) {
      console.log('Error parsing response:', e.message);
    }
  });
}).on('error', (err) => {
  console.log('Error:', err.message);
});
