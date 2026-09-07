const { pool } = require('../config/db');
const { createInvoice } = require('../services/projects/invoiceService');

async function testInvoiceCreation() {
  try {
    const projRes = await pool.query('SELECT id, tenant_id FROM projects LIMIT 1');
    if (projRes.rowCount === 0) {
      console.log('No project found in database.');
      process.exit(0);
    }
    const project = projRes.rows[0];
    console.log('Found test project:', project);

    const invoice = await createInvoice({
      tenantId: project.tenant_id,
      userId: '00000000-0000-0000-0000-000000000001',
      projectId: project.id,
      milestoneId: null,
      data: {
        type: 'TAX_INVOICE',
        amount: 5000,
        gstRate: 18,
        gstType: 'CGST_SGST',
        invoiceDate: '2026-09-07'
      }
    });

    console.log('Invoice created successfully:', invoice);
  } catch (err) {
    console.error('Invoice creation test failed with error:', err);
  } finally {
    await pool.end();
  }
}

testInvoiceCreation();
