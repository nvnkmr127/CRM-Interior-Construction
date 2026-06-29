const PDFDocument = require('pdfkit');
const pool = require('../../db/pool');
const storage = require('../../utils/storage');

async function generatePurchaseOrderPDF(tenantId, projectId, poId, userId) {
  // 1. Fetch PO details
  const poQuery = `
    SELECT po.*, v.vendor_name, v.payment_terms as vendor_payment_terms, p.name as project_name, p.site_address as project_site_address
    FROM purchase_orders po
    LEFT JOIN project_vendors v ON po.vendor_id = v.id
    JOIN projects p ON po.project_id = p.id
    WHERE po.tenant_id = $1 AND po.id = $2
  `;
  const poRes = await pool.query(poQuery, [tenantId, poId]);
  if (poRes.rows.length === 0) throw new Error('Purchase Order not found');
  const po = poRes.rows[0];

  // Fetch PO items
  const itemsQuery = `
    SELECT * FROM purchase_order_items WHERE purchase_order_id = $1 AND tenant_id = $2 ORDER BY created_at ASC
  `;
  const itemsRes = await pool.query(itemsQuery, [poId, tenantId]);
  const items = itemsRes.rows;

  // 2. Build PDF Document
  const pdfBuffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', err => reject(err));

    // Colors
    const primaryColor = '#1e3a8a'; // Deep Navy
    const secondaryColor = '#475569';
    const borderColor = '#e2e8f0';

    // Header Title
    doc.fillColor(primaryColor)
       .fontSize(20)
       .font('Helvetica-Bold')
       .text('PURCHASE ORDER', { align: 'right' });
    
    doc.fillColor(secondaryColor)
       .fontSize(10)
       .font('Helvetica')
       .text(`PO Number: ${po.po_number}`, { align: 'right' })
       .text(`Date: ${new Date(po.created_at).toLocaleDateString('en-IN')}`, { align: 'right' });
    
    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(primaryColor).lineWidth(2).stroke();
    doc.moveDown(1.5);

    const startY = doc.y;
    // 2 Column details
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(11).text('PO Details:', 50, startY);
    doc.fillColor('#000000').font('Helvetica').fontSize(9)
       .text(`Project: ${po.project_name}`)
       .text(`Expected Delivery: ${po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString('en-IN') : 'N/A'}`)
       .text(`Delivery Address: ${po.delivery_address || po.project_site_address || 'Project Site'}`);

    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(11).text('Vendor Details:', 320, startY);
    doc.fillColor('#000000').font('Helvetica').fontSize(9)
       .text(`Vendor: ${po.vendor_name || 'Unassigned'}`)
       .text(`Payment Terms: ${po.terms_conditions || po.vendor_payment_terms || 'Standard'}`);
    
    doc.moveDown(2.5);

    // Table Header
    const tableHeaderY = doc.y;
    doc.rect(50, tableHeaderY, 495, 20).fill('#f1f5f9');
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(9)
       .text('Item Name / Specification', 60, tableHeaderY + 6, { width: 200 })
       .text('Brand', 260, tableHeaderY + 6, { width: 80 })
       .text('Qty', 350, tableHeaderY + 6, { width: 40, align: 'right' })
       .text('Price', 400, tableHeaderY + 6, { width: 60, align: 'right' })
       .text('Total', 470, tableHeaderY + 6, { width: 65, align: 'right' });

    let currentY = tableHeaderY + 20;
    doc.fillColor('#000000').font('Helvetica').fontSize(9);

    for (const item of items) {
      // Draw border line
      doc.moveTo(50, currentY).lineTo(545, currentY).strokeColor(borderColor).lineWidth(0.5).stroke();
      
      const itemText = `${item.item_name}\n${item.material_specifications || ''}`.trim();
      const height = Math.max(doc.heightOfString(itemText, { width: 190 }), 20);

      doc.text(itemText, 60, currentY + 6, { width: 190 })
         .text(item.brand || '—', 260, currentY + 6, { width: 80 })
         .text(String(item.quantity), 350, currentY + 6, { width: 40, align: 'right' })
         .text(new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(item.unit_price), 400, currentY + 6, { width: 60, align: 'right' })
         .text(new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(item.quantity * item.unit_price), 470, currentY + 6, { width: 65, align: 'right' });
      
      currentY += height + 12;
    }

    doc.moveTo(50, currentY).lineTo(545, currentY).strokeColor(primaryColor).lineWidth(1).stroke();
    currentY += 10;

    // Grand Total
    doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(11)
       .text('Grand Total:', 350, currentY, { width: 110, align: 'right' })
       .text(new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(po.total_amount), 470, currentY, { width: 65, align: 'right' });

    doc.end();
  });

  // 3. Upload to Storage
  const storageKey = `${tenantId}/projects/${projectId}/po/PO_${po.po_number}.pdf`;
  await storage.uploadBuffer(storageKey, pdfBuffer, 'application/pdf');

  // 4. Save to Documents Table if not exists
  const docCheck = await pool.query(
    'SELECT id FROM documents WHERE tenant_id = $1 AND storage_key = $2',
    [tenantId, storageKey]
  );
  if (docCheck.rows.length === 0) {
    const docQuery = `
      INSERT INTO documents (
        tenant_id, project_id, name, doc_type, storage_key, file_size_bytes, mime_type, uploaded_by, status, is_visible_to_client
      ) VALUES ($1, $2, $3, 'contract', $4, $5, 'application/pdf', $6, 'approved', false)
    `;
    await pool.query(docQuery, [tenantId, projectId, `Purchase Order - ${po.po_number}`, storageKey, pdfBuffer.length, userId || null]);
  }

  return storageKey;
}

module.exports = {
  generatePurchaseOrderPDF
};
