const pool = require('../../db/pool');
const storage = require('../../utils/storage');
const PDFDocument = require('pdfkit');

async function generateCompletionCertificate(tenantId, checklistId) {
  // 1. Fetch checklist details
  const checklistResult = await pool.query(
    `SELECT * FROM handover_checklists WHERE tenant_id = $1 AND id = $2`,
    [tenantId, checklistId]
  );
  const checklist = checklistResult.rows[0];
  if (!checklist) {
    throw new Error('Checklist not found');
  }

  // 2. Fetch project details
  const projectResult = await pool.query(
    `SELECT p.*, t.name as tenant_name, u.name as pm_name, u.email as pm_email
     FROM projects p
     JOIN tenants t ON p.tenant_id = t.id
     LEFT JOIN users u ON p.pm_id = u.id
     WHERE p.id = $1 AND p.tenant_id = $2`,
    [checklist.project_id, tenantId]
  );
  const project = projectResult.rows[0];
  if (!project) {
    throw new Error('Project not found');
  }

  // 3. Fetch checklist items
  const itemsResult = await pool.query(
    `SELECT * FROM handover_items WHERE checklist_id = $1 ORDER BY room, description`,
    [checklist.id]
  );
  const items = itemsResult.rows;

  // 4. Generate PDF buffer
  const pdfBuffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', err => reject(err));

    // Styling
    const primaryColor = '#1f2937'; // Gray 800
    const secondaryColor = '#4b5563'; // Gray 600
    const accentColor = '#1e3a8a'; // Navy 900 (Formal & Trustworthy)
    const goldColor = '#b45309'; // Amber 700 (Elegant accent)
    const borderColor = '#d1d5db'; // Gray 300
    const lightBg = '#f9fafb'; // Gray 50

    // Draw Elegant Certificate Border
    // Outer border
    doc.rect(20, 20, 555, 802).strokeColor(accentColor).lineWidth(2).stroke();
    // Inner thin border
    doc.rect(25, 25, 545, 792).strokeColor(goldColor).lineWidth(1).stroke();

    doc.y = 50;

    // Header Title
    doc.fillColor(accentColor)
       .fontSize(22)
       .font('Helvetica-Bold')
       .text('PROJECT COMPLETION CERTIFICATE', { align: 'center' });
    
    doc.moveDown(0.2);
    
    doc.fillColor(goldColor)
       .fontSize(10)
       .font('Helvetica-Bold')
       .text('PRACTICAL COMPLETION & HANDOVER', { align: 'center', characterSpacing: 1.5 });
    
    doc.moveDown(1.5);

    // Statement of Completion
    const statementY = doc.y;
    doc.fillColor(secondaryColor)
       .fontSize(10)
       .font('Helvetica-Oblique')
       .text('This is to formally certify that the interior fit-out and construction works for the project detailed below have been completed, inspected, and verified. Handover of the site has been executed to the client\'s complete satisfaction in accordance with the contract guidelines and design specifications.', 50, statementY, { align: 'center', width: 495, lineGap: 3 });
    
    doc.moveDown(2);

    // Project Details Grid (2-columns)
    const infoY = doc.y;
    doc.rect(50, infoY, 495, 110).fill(lightBg);
    doc.rect(50, infoY, 495, 110).strokeColor(borderColor).lineWidth(0.5).stroke();

    // Left Column: Project Summary
    doc.fontSize(10).font('Helvetica-Bold').fillColor(accentColor).text('PROJECT SUMMARY', 65, infoY + 12);
    
    doc.fontSize(9).font('Helvetica').fillColor(primaryColor);
    doc.text(`Project Name: ${project.name}`, 65, doc.y + 6);
    doc.text(`Project Type: ${project.project_type ? project.project_type.replace(/_/g, ' ').toUpperCase() : 'N/A'}`, 65, doc.y + 4);
    doc.text(`Site Address: ${project.site_address || 'N/A'}`, 65, doc.y + 4, { width: 220 });

    // Right Column: Client & Contract Details
    const rightColX = 310;
    doc.fontSize(10).font('Helvetica-Bold').fillColor(accentColor).text('CONTRACT DETAILS', rightColX, infoY + 12);
    
    doc.fontSize(9).font('Helvetica').fillColor(primaryColor);
    doc.text(`Client Name: ${checklist.client_name || project.client_name || 'N/A'}`, rightColX, doc.y + 6);
    doc.text(`Contract Value: INR ${(Number(project.contract_value || 0)).toLocaleString('en-IN')}`, rightColX, doc.y + 4);
    
    const signOffDate = checklist.signed_by_client_at ? new Date(checklist.signed_by_client_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.text(`Sign-off Date: ${signOffDate}`, rightColX, doc.y + 4);

    doc.y = infoY + 130;

    // Split items into inspection, document, and key_access categories
    const inspectionItems = items.filter(item => item.item_type !== 'document' && item.item_type !== 'key_access');
    const documentItems = items.filter(item => item.item_type === 'document');
    const keyItems = items.filter(item => item.item_type === 'key_access');

    // 1. Completed Scope Section (Inspection Items)
    doc.fontSize(11).font('Helvetica-Bold').fillColor(accentColor).text('COMPLETED SCOPE OF WORKS (ROOM-WISE)');
    doc.moveDown(0.5);

    const tableHeaderY = doc.y;
    doc.rect(50, tableHeaderY, 495, 18).fill(accentColor);
    doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
    doc.text('Room / Area', 60, tableHeaderY + 5);
    doc.text('Completed Item Description', 180, tableHeaderY + 5);
    doc.text('Verification Status', 450, tableHeaderY + 5, { align: 'right', width: 80 });

    let curY = tableHeaderY + 18;
    inspectionItems.forEach((item, index) => {
      if (curY > 640) {
        doc.addPage();
        doc.rect(20, 20, 555, 802).strokeColor(accentColor).lineWidth(2).stroke();
        doc.rect(25, 25, 545, 792).strokeColor(goldColor).lineWidth(1).stroke();
        curY = 50;
      }

      doc.rect(50, curY, 495, 18).fill(index % 2 === 0 ? lightBg : '#ffffff');
      doc.fillColor(primaryColor).fontSize(8.5).font('Helvetica');
      doc.text(item.room, 60, curY + 5);
      doc.text(item.description, 180, curY + 5, { width: 260 });
      doc.fillColor(goldColor).font('Helvetica-Bold').text('VERIFIED', 450, curY + 5, { align: 'right', width: 80 });
      curY += 18;
    });

    // 2. Product Documentation & Warranties Handover Section
    if (documentItems.length > 0) {
      curY += 20;
      if (curY > 640) {
        doc.addPage();
        doc.rect(20, 20, 555, 802).strokeColor(accentColor).lineWidth(2).stroke();
        doc.rect(25, 25, 545, 792).strokeColor(goldColor).lineWidth(1).stroke();
        curY = 50;
      }

      doc.fontSize(11).font('Helvetica-Bold').fillColor(accentColor).text('PRODUCT DOCUMENTATION & WARRANTIES HANDOVER');
      doc.moveDown(0.5);

      const docHeaderY = doc.y;
      doc.rect(50, docHeaderY, 495, 18).fill(accentColor);
      doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
      doc.text('Product / Appliance', 60, docHeaderY + 5);
      doc.text('Serial Number', 210, docHeaderY + 5);
      doc.text('Warranty Expiry', 315, docHeaderY + 5);
      doc.text('Manual', 415, docHeaderY + 5);
      doc.text('Warranty Card', 475, docHeaderY + 5);

      curY = docHeaderY + 18;
      documentItems.forEach((item, index) => {
        if (curY > 640) {
          doc.addPage();
          doc.rect(20, 20, 555, 802).strokeColor(accentColor).lineWidth(2).stroke();
          doc.rect(25, 25, 545, 792).strokeColor(goldColor).lineWidth(1).stroke();
          curY = 50;
        }

        doc.rect(50, curY, 495, 18).fill(index % 2 === 0 ? lightBg : '#ffffff');
        doc.fillColor(primaryColor).fontSize(8.5).font('Helvetica');
        doc.text(item.description, 60, curY + 5, { width: 145 });
        doc.text(item.serial_number || 'N/A', 210, curY + 5, { width: 100 });
        
        const expiryStr = item.warranty_expiry_date ? new Date(item.warranty_expiry_date).toLocaleDateString('en-IN') : 'N/A';
        doc.text(expiryStr, 315, curY + 5, { width: 90 });
        
        doc.text(item.has_manual ? 'Yes' : 'No', 415, curY + 5);
        doc.text(item.has_warranty_card ? 'Yes' : 'No', 475, curY + 5);
        curY += 18;
      });
    }

    // 3. Keys & Access Control Section
    if (keyItems.length > 0) {
      curY += 20;
      if (curY > 640) {
        doc.addPage();
        doc.rect(20, 20, 555, 802).strokeColor(accentColor).lineWidth(2).stroke();
        doc.rect(25, 25, 545, 792).strokeColor(goldColor).lineWidth(1).stroke();
        curY = 50;
      }

      doc.fontSize(11).font('Helvetica-Bold').fillColor(accentColor).text('KEYS & ACCESS CONTROL CREDENTIALS HANDOVER');
      doc.moveDown(0.5);

      const keyHeaderY = doc.y;
      doc.rect(50, keyHeaderY, 495, 18).fill(accentColor);
      doc.fillColor('#ffffff').fontSize(8.5).font('Helvetica-Bold');
      doc.text('Access Item Description', 60, keyHeaderY + 5);
      doc.text('Handover Details / Quantities', 250, keyHeaderY + 5);
      doc.text('Client Acknowledgment', 430, keyHeaderY + 5, { align: 'right', width: 100 });

      curY = keyHeaderY + 18;
      keyItems.forEach((item, index) => {
        if (curY > 640) {
          doc.addPage();
          doc.rect(20, 20, 555, 802).strokeColor(accentColor).lineWidth(2).stroke();
          doc.rect(25, 25, 545, 792).strokeColor(goldColor).lineWidth(1).stroke();
          curY = 50;
        }

        doc.rect(50, curY, 495, 18).fill(index % 2 === 0 ? lightBg : '#ffffff');
        doc.fillColor(primaryColor).fontSize(8.5).font('Helvetica');
        doc.text(item.description, 60, curY + 5, { width: 180 });
        doc.text(item.key_details || 'Pending Details', 250, curY + 5, { width: 170 });
        doc.fillColor(goldColor).font('Helvetica-Bold').text('ACKNOWLEDGED', 430, curY + 5, { align: 'right', width: 100 });
        curY += 18;
      });
    }

    doc.y = curY + 25;

    // Ensure signature block is not cut off
    if (doc.y > 600) {
      doc.addPage();
      doc.rect(20, 20, 555, 802).strokeColor(accentColor).lineWidth(2).stroke();
      doc.rect(25, 25, 545, 792).strokeColor(goldColor).lineWidth(1).stroke();
      doc.y = 80;
    }

    const signY = doc.y;

    // Draw separator line
    doc.moveTo(50, signY).lineTo(545, signY).strokeColor(borderColor).lineWidth(1).stroke();
    
    // Position signature sections side-by-side
    const leftSigX = 50;
    const rightSigX = 320;
    
    doc.fontSize(10).font('Helvetica-Bold').fillColor(accentColor).text('CLIENT SIGN-OFF', leftSigX, signY + 15);
    doc.fontSize(9).font('Helvetica').fillColor(primaryColor);
    doc.text(`Client Name: ${checklist.client_name || project.client_name}`, leftSigX, doc.y + 6);
    doc.text(`Status: Verified via OTP`, leftSigX, doc.y + 4);
    if (checklist.signed_by_client_at) {
      doc.text(`Timestamp: ${new Date(checklist.signed_by_client_at).toLocaleString('en-IN')}`, leftSigX, doc.y + 4);
    }
    doc.font('Helvetica-Oblique').fillColor(goldColor).text('[Digitally Authenticated]', leftSigX, doc.y + 8);

    doc.fontSize(10).font('Helvetica-Bold').fillColor(accentColor).text('COMPANY REPRESENTATIVE', rightSigX, signY + 15);
    doc.fontSize(9).font('Helvetica').fillColor(primaryColor);
    doc.text(`Name: ${project.pm_name || 'Project Manager'}`, rightSigX, doc.y + 6);
    doc.text(`Email: ${project.pm_email || 'N/A'}`, rightSigX, doc.y + 4);
    doc.text(`Role: Project Manager`, rightSigX, doc.y + 4);
    doc.font('Helvetica-Oblique').fillColor(goldColor).text(`For ${project.tenant_name}`, rightSigX, doc.y + 8);

    doc.end();
  });

  // 5. Upload PDF buffer to storage
  const storageKey = `tenants/${tenantId}/handovers/${checklistId}_completion_certificate.pdf`;
  await storage.uploadBuffer(storageKey, pdfBuffer, 'application/pdf');

  // 6. Register document in 'documents' table
  const docQuery = `
    INSERT INTO documents (
      tenant_id, project_id, name, doc_type, version, storage_key, file_size_bytes, mime_type, status, is_visible_to_client
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `;
  const docValues = [
    tenantId,
    checklist.project_id,
    `Completion Certificate - ${project.name}`,
    'completion_certificate',
    true,
    storageKey,
    pdfBuffer.length,
    'application/pdf',
    'approved',
    true
  ];
  await pool.query(docQuery, docValues);

  // 7. Update handover_checklists
  await pool.query(
    `UPDATE handover_checklists SET pdf_key = $1 WHERE id = $2 AND tenant_id = $3`,
    [storageKey, checklistId, tenantId]
  );

  return storageKey;
}

module.exports = {
  generateCompletionCertificate
};
