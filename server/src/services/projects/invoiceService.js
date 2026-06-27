const pool = require('../../db/pool');
const { logAction } = require('../auditLog');
const storage = require('../../utils/storage');
const PDFDocument = require('pdfkit');

async function getInvoiceByMilestone(tenantId, milestoneId) {
  const query = `SELECT * FROM invoices WHERE tenant_id = $1 AND payment_milestone_id = $2`;
  const { rows } = await pool.query(query, [tenantId, milestoneId]);
  return rows[0] || null;
}

async function getInvoiceById(tenantId, invoiceId) {
  const query = `SELECT * FROM invoices WHERE tenant_id = $1 AND id = $2`;
  const { rows } = await pool.query(query, [tenantId, invoiceId]);
  return rows[0] || null;
}

async function generateInvoiceNumber(tenantId) {
  const year = new Date().getFullYear();
  const pattern = `INV-${year}-%`;
  
  const query = `
    SELECT invoice_number FROM invoices 
    WHERE tenant_id = $1 AND invoice_number LIKE $2 
    ORDER BY invoice_number DESC LIMIT 1
  `;
  const result = await pool.query(query, [tenantId, pattern]);
  
  let nextSeq = 1;
  if (result.rows.length > 0) {
    const lastNum = result.rows[0].invoice_number;
    const parts = lastNum.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }
  
  return `INV-${year}-${String(nextSeq).padStart(4, '0')}`;
}

async function getInvoiceDraftDetails(tenantId, milestoneId) {
  // Fetch milestone
  const msQuery = `
    SELECT pm.*, m.name as linked_milestone_name 
    FROM payment_milestones pm
    LEFT JOIN milestones m ON m.id = pm.milestone_id
    WHERE pm.id = $1 AND pm.tenant_id = $2
  `;
  const msRes = await pool.query(msQuery, [milestoneId, tenantId]);
  if (msRes.rowCount === 0) throw new Error('MILESTONE_NOT_FOUND');
  const milestone = msRes.rows[0];

  // Fetch project
  const projQuery = `
    SELECT p.*, t.name as tenant_name 
    FROM projects p
    JOIN tenants t ON t.id = p.tenant_id
    WHERE p.id = $1 AND p.tenant_id = $2
  `;
  const projRes = await pool.query(projQuery, [milestone.project_id, tenantId]);
  if (projRes.rowCount === 0) throw new Error('PROJECT_NOT_FOUND');
  const project = projRes.rows[0];

  return {
    billingName: project.client_name,
    billingAddress: project.site_address || '',
    billingGstin: '',
    companyName: project.tenant_name || 'Demo Company',
    companyAddress: '',
    companyGstin: '',
    gstType: 'cgst_sgst',
    gstRate: 18.00,
    paymentTerms: project.payment_terms || 'Net 15',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: milestone.due_date ? new Date(milestone.due_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    amount: Number(milestone.amount || 0)
  };
}

async function createInvoice({ tenantId, userId, milestoneId, data }) {
  // Check if invoice already exists
  const existing = await getInvoiceByMilestone(tenantId, milestoneId);
  if (existing) {
    throw new Error('INVOICE_ALREADY_EXISTS');
  }

  // Fetch milestone
  const msRes = await pool.query(
    `SELECT pm.*, m.name as linked_milestone_name 
     FROM payment_milestones pm 
     LEFT JOIN milestones m ON m.id = pm.milestone_id 
     WHERE pm.id = $1 AND pm.tenant_id = $2`,
    [milestoneId, tenantId]
  );
  if (msRes.rowCount === 0) throw new Error('MILESTONE_NOT_FOUND');
  const milestone = msRes.rows[0];

  // Fetch project
  const projRes = await pool.query(
    `SELECT * FROM projects WHERE id = $1 AND tenant_id = $2`,
    [milestone.project_id, tenantId]
  );
  if (projRes.rowCount === 0) throw new Error('PROJECT_NOT_FOUND');
  const project = projRes.rows[0];

  const subtotal = Number(milestone.amount || 0);
  const gstRate = Number(data.gstRate !== undefined ? data.gstRate : 18.00);
  const gstType = data.gstType || 'cgst_sgst';
  const paymentTerms = data.paymentTerms || project.payment_terms || 'Net 15';
  
  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (gstType === 'cgst_sgst') {
    cgst = Number(((subtotal * (gstRate / 2)) / 100).toFixed(2));
    sgst = Number(((subtotal * (gstRate / 2)) / 100).toFixed(2));
  } else {
    igst = Number(((subtotal * gstRate) / 100).toFixed(2));
  }
  
  const totalAmount = Number((subtotal + cgst + sgst + igst).toFixed(2));

  // Generate unique invoice number
  const invoiceNumber = await generateInvoiceNumber(tenantId);

  // Billing and company info
  const companyName = data.companyName || 'Demo Company';
  const companyAddress = data.companyAddress || '';
  const companyGstin = data.companyGstin || '';
  const billingName = data.billingName || project.client_name;
  const billingAddress = data.billingAddress || project.site_address || '';
  const billingGstin = data.billingGstin || '';
  
  const invoiceDate = data.invoiceDate || new Date().toISOString().split('T')[0];
  const dueDate = data.dueDate || milestone.due_date;

  // Insert into DB
  const insertQuery = `
    INSERT INTO invoices (
      tenant_id, project_id, payment_milestone_id, invoice_number, invoice_date, due_date,
      billing_name, billing_address, billing_gstin,
      company_name, company_address, company_gstin,
      subtotal, gst_type, gst_rate, cgst_amount, sgst_amount, igst_amount, total_amount,
      payment_terms, status, created_by
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 'sent', $21
    ) RETURNING *
  `;
  const insertValues = [
    tenantId, milestone.project_id, milestoneId, invoiceNumber, invoiceDate, dueDate,
    billingName, billingAddress, billingGstin,
    companyName, companyAddress, companyGstin,
    subtotal, gstType, gstRate, cgst, sgst, igst, totalAmount,
    paymentTerms, userId
  ];

  const { rows } = await pool.query(insertQuery, insertValues);
  const invoice = rows[0];

  // Generate PDF Buffer
  const pdfBuffer = await generatePdfBuffer(invoice, milestone, project);
  
  // Upload to Storage
  const storageKey = `tenants/${tenantId}/invoices/${invoice.id}.pdf`;
  await storage.uploadBuffer(storageKey, pdfBuffer, 'application/pdf');

  // Update Invoice PDF Key
  await pool.query(
    `UPDATE invoices SET pdf_storage_key = $1 WHERE id = $2 AND tenant_id = $3`,
    [storageKey, invoice.id, tenantId]
  );
  invoice.pdf_storage_key = storageKey;

  // Update Milestone Status
  await pool.query(
    `UPDATE payment_milestones 
     SET invoice_reference = $1, status = 'invoice_raised' 
     WHERE id = $2 AND tenant_id = $3`,
    [invoiceNumber, milestoneId, tenantId]
  );

  // Log action
  await logAction({
    tenantId,
    userId,
    action: 'generate_invoice',
    entity: 'invoice',
    entityId: invoice.id,
    newValue: { invoiceNumber, milestoneId, totalAmount }
  });

  return invoice;
}

function generatePdfBuffer(invoice, milestone, project) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', err => reject(err));

    // Colors
    const primaryColor = '#1e293b'; // Slate 800
    const secondaryColor = '#475569'; // Slate 600
    const accentColor = '#0f766e'; // Teal 700
    const borderColor = '#cbd5e1'; // Slate 300
    const lightBg = '#f8fafc'; // Slate 50

    // Header Title
    doc.fillColor(primaryColor)
       .fontSize(22)
       .font('Helvetica-Bold')
       .text('TAX INVOICE', { align: 'right' });
       
    doc.moveDown(1);

    // Metadata & Seller Info Columns
    const topY = doc.y;
    
    // Left: Seller Info (Company)
    doc.fontSize(12).font('Helvetica-Bold').fillColor(primaryColor).text(invoice.company_name, 50, topY);
    doc.fontSize(9).font('Helvetica').fillColor(secondaryColor);
    if (invoice.company_address) {
      doc.text(invoice.company_address, 50, doc.y + 3, { width: 230 });
    }
    if (invoice.company_gstin) {
      doc.text(`GSTIN: ${invoice.company_gstin}`, 50, doc.y + 3);
    }

    // Right: Invoice Info
    const rightX = 350;
    doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryColor).text(`Invoice Number:`, rightX, topY);
    doc.font('Helvetica').text(invoice.invoice_number, rightX + 100, topY, { align: 'right', width: 110 });
    
    doc.font('Helvetica-Bold').text(`Invoice Date:`, rightX, doc.y + 4);
    doc.font('Helvetica').text(new Date(invoice.invoice_date).toLocaleDateString('en-IN'), rightX + 100, doc.y - 12, { align: 'right', width: 110 });
    
    if (invoice.due_date) {
      doc.font('Helvetica-Bold').text(`Due Date:`, rightX, doc.y + 4);
      doc.font('Helvetica').text(new Date(invoice.due_date).toLocaleDateString('en-IN'), rightX + 100, doc.y - 12, { align: 'right', width: 110 });
    }
    if (invoice.payment_terms) {
      doc.font('Helvetica-Bold').text(`Payment Terms:`, rightX, doc.y + 4);
      doc.font('Helvetica').text(invoice.payment_terms, rightX + 100, doc.y - 12, { align: 'right', width: 110 });
    }

    doc.moveDown(3);
    
    // Horizontal separator
    const sepY = Math.max(doc.y, 160);
    doc.moveTo(50, sepY).lineTo(550, sepY).strokeColor(borderColor).lineWidth(1).stroke();
    
    doc.y = sepY + 15;
    const buyerY = doc.y;

    // Buyer Info (Bill To)
    doc.fontSize(10).font('Helvetica-Bold').fillColor(accentColor).text('BILL TO:', 50, buyerY);
    doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryColor).text(invoice.billing_name, 50, doc.y + 4);
    doc.fontSize(9).font('Helvetica').fillColor(secondaryColor);
    if (invoice.billing_address) {
      doc.text(invoice.billing_address, 50, doc.y + 3, { width: 250 });
    }
    if (invoice.billing_gstin) {
      doc.text(`GSTIN: ${invoice.billing_gstin}`, 50, doc.y + 3);
    }

    // Project reference
    doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryColor).text('PROJECT:', rightX, buyerY);
    doc.fontSize(9).font('Helvetica').fillColor(secondaryColor).text(project.name || 'N/A', rightX, doc.y + 4);
    if (project.project_type) {
      doc.text(`Type: ${project.project_type}`, rightX, doc.y + 3);
    }

    doc.moveDown(3);

    // Table of Items
    const tableTop = Math.max(doc.y, 280);
    
    // Draw Header Background
    doc.rect(50, tableTop, 500, 20).fill(primaryColor);
    
    // Header labels
    doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
    doc.text('Description', 60, tableTop + 6, { width: 200 });
    doc.text('Tax Rate', 270, tableTop + 6, { width: 50, align: 'right' });
    doc.text('Subtotal (INR)', 330, tableTop + 6, { width: 70, align: 'right' });
    doc.text('Tax Amount (INR)', 410, tableTop + 6, { width: 70, align: 'right' });
    doc.text('Total (INR)', 490, tableTop + 6, { width: 50, align: 'right' });

    // Table Content Row
    const rowTop = tableTop + 20;
    
    // Row background (shaded alternating color)
    doc.rect(50, rowTop, 500, 35).fill(lightBg);
    
    doc.fillColor(primaryColor).fontSize(9).font('Helvetica');
    const milestoneName = milestone.linked_milestone_name || milestone.name || 'Payment Milestone';
    doc.text(milestoneName, 60, rowTop + 10, { width: 200 });
    doc.text(`${Number(invoice.gst_rate).toFixed(2)}%`, 270, rowTop + 10, { width: 50, align: 'right' });
    doc.text(Number(invoice.subtotal).toFixed(2), 330, rowTop + 10, { width: 70, align: 'right' });

    // Tax description
    let taxBreakdown = '';
    let taxSum = 0;
    if (invoice.gst_type === 'cgst_sgst') {
      taxBreakdown = `CGST: ${Number(invoice.cgst_amount).toFixed(2)}\nSGST: ${Number(invoice.sgst_amount).toFixed(2)}`;
      taxSum = Number(invoice.cgst_amount) + Number(invoice.sgst_amount);
    } else {
      taxBreakdown = `IGST: ${Number(invoice.igst_amount).toFixed(2)}`;
      taxSum = Number(invoice.igst_amount);
    }
    
    doc.text(taxBreakdown, 410, rowTop + 6, { width: 70, align: 'right' });
    doc.font('Helvetica-Bold').text(Number(invoice.total_amount).toFixed(2), 490, rowTop + 10, { width: 50, align: 'right' });

    // Summary Box Right Side
    const summaryTop = rowTop + 55;
    
    doc.fillColor(primaryColor).fontSize(9).font('Helvetica');
    doc.text(`Subtotal:`, 350, summaryTop, { width: 90, align: 'right' });
    doc.text(`INR ${Number(invoice.subtotal).toFixed(2)}`, 450, summaryTop, { width: 90, align: 'right' });

    let summaryTaxLabel = '';
    let summaryTaxVal = '';
    if (invoice.gst_type === 'cgst_sgst') {
      summaryTaxLabel = `CGST (${(invoice.gst_rate / 2).toFixed(2)}%):\nSGST (${(invoice.gst_rate / 2).toFixed(2)}%):`;
      summaryTaxVal = `INR ${Number(invoice.cgst_amount).toFixed(2)}\nINR ${Number(invoice.sgst_amount).toFixed(2)}`;
    } else {
      summaryTaxLabel = `IGST (${invoice.gst_rate.toFixed(2)}%):`;
      summaryTaxVal = `INR ${Number(invoice.igst_amount).toFixed(2)}`;
    }

    doc.text(summaryTaxLabel, 350, doc.y + 6, { width: 90, align: 'right' });
    doc.text(summaryTaxVal, 450, doc.y - 12, { width: 90, align: 'right' });

    // Draw a small line under the calculations
    const doubleLineY = doc.y + 12;
    doc.moveTo(350, doubleLineY).lineTo(540, doubleLineY).strokeColor(borderColor).stroke();

    doc.fillColor(accentColor).fontSize(11).font('Helvetica-Bold');
    doc.text(`Total Amount:`, 330, doubleLineY + 8, { width: 110, align: 'right' });
    doc.text(`INR ${Number(invoice.total_amount).toFixed(2)}`, 450, doubleLineY + 8, { width: 90, align: 'right' });

    // Terms & Bank Details (Bottom Left)
    const termsY = summaryTop + 10;
    doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text('Terms & Conditions:', 50, termsY);
    doc.fillColor(secondaryColor).fontSize(8).font('Helvetica');
    doc.text('1. Invoice is generated automatically from CRM milestone sign-off.', 50, doc.y + 4, { width: 270 });
    doc.text('2. Please complete payment as per agreed payment terms.', 50, doc.y + 3, { width: 270 });
    doc.text(`3. Quote Invoice reference "${invoice.invoice_number}" in transfer notes.`, 50, doc.y + 3, { width: 270 });

    doc.end();
  });
}

module.exports = {
  getInvoiceByMilestone,
  getInvoiceById,
  getInvoiceDraftDetails,
  createInvoice
};
