const axios = require('axios');

async function testApiInvoice() {
  try {
    // 1. Login to get token
    const loginRes = await axios.post('http://localhost:4000/api/auth/login', {
      email: 'admin@demo.com',
      password: 'password123'
    });

    const token = loginRes.data?.data?.token || loginRes.data?.token;
    console.log('Login successful. Token obtained:', token ? 'YES' : 'NO');

    // 2. Fetch projects
    const projRes = await axios.get('http://localhost:4000/api/projects', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const projects = projRes.data?.data || projRes.data || [];
    if (projects.length === 0) {
      console.log('No projects found');
      return;
    }
    const project = projects[0];
    console.log('Selected project:', project.id, project.name);

    // 3. Post invoice
    const invPayload = {
      projectId: project.id,
      milestoneId: null,
      type: 'TAX_INVOICE',
      amount: 15000,
      cgstAmount: 1350,
      sgstAmount: 1350,
      igstAmount: 0,
      exactTotal: 17700,
      grandTotal: 17700,
      roundOffAmount: 0,
      gstRate: 18,
      gstType: 'CGST_SGST',
      hsnSac: '9954',
      customerGst: '29ABCDE1234F1Z5',
      invoiceDate: '2026-09-07'
    };

    const invRes = await axios.post('http://localhost:4000/api/invoices', invPayload, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('Invoice API Creation Result status:', invRes.status);
    console.log('Invoice Data:', invRes.data);

  } catch (err) {
    if (err.response) {
      console.error('API Error Response status:', err.response.status, err.response.data);
    } else {
      console.error('API Test Error:', err.message);
    }
  }
}

testApiInvoice();
