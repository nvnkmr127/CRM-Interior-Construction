const PDFDocument = require('pdfkit');
const pool = require('../../db/pool');
const storage = require('../../utils/storage');
const fs = require('fs');
const path = require('path');
const { GetObjectCommand } = require('@aws-sdk/client-s3');

async function getImageBuffer(key) {
  try {
    const isLocal = process.env.STORAGE_PROVIDER === 'local' || !process.env.STORAGE_PROVIDER;
    if (isLocal) {
      const filePath = path.resolve(__dirname, '../../../../uploads', key);
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath);
      }
      const altPath = path.resolve(__dirname, '../../../uploads', key);
      if (fs.existsSync(altPath)) {
        return fs.readFileSync(altPath);
      }
    } else if (storage.s3Client) {
      const command = new GetObjectCommand({
        Bucket: storage.bucket,
        Key: key
      });
      const response = await storage.s3Client.send(command);
      const chunks = [];
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    }
  } catch (err) {
    console.error(`[DSR PDF Service] Failed to get image buffer for ${key}:`, err.message);
  }
  return null;
}

async function archiveDailySiteReport(tenantId, reportId, userId) {
  // 1. Fetch report details
  const reportQuery = `
    SELECT r.*, u.name as submitted_by_name
    FROM daily_site_reports r
    LEFT JOIN users u ON r.submitted_by = u.id
    WHERE r.tenant_id = $1 AND r.id = $2
  `;
  const { rows: reportRows } = await pool.query(reportQuery, [tenantId, reportId]);
  if (reportRows.length === 0) {
    throw new Error('Report not found');
  }
  const report = reportRows[0];

  // 2. Fetch project and tenant details
  const projectQuery = `
    SELECT p.name as project_name, p.site_address, p.project_type, t.name as tenant_name
    FROM projects p
    JOIN tenants t ON p.tenant_id = t.id
    WHERE p.id = $1 AND p.tenant_id = $2
  `;
  const { rows: projectRows } = await pool.query(projectQuery, [report.project_id, tenantId]);
  if (projectRows.length === 0) {
    throw new Error('Project not found');
  }
  const project = projectRows[0];

  // 3. Generate PDF
  const pdfBuffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', err => reject(err));

    // Styling
    const primaryColor = '#1e293b'; // Slate 800
    const secondaryColor = '#475569'; // Slate 600
    const accentColor = '#0f766e'; // Teal 700
    const borderColor = '#cbd5e1'; // Slate 300
    const lightBg = '#f8fafc'; // Slate 50
    const textMuted = '#94a3b8'; // Slate 400

    // Header Title
    doc.fillColor(accentColor)
       .fontSize(18)
       .font('Helvetica-Bold')
       .text('DAILY SITE PROGRESS REPORT', { align: 'left' });
    
    doc.fillColor(secondaryColor)
       .fontSize(9)
       .font('Helvetica')
       .text(project.tenant_name || 'CRM Construction Portal', { align: 'left' });
    
    doc.moveDown(1);

    // Separator
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(accentColor).lineWidth(1.5).stroke();
    doc.moveDown(1.5);

    // 2-Column Info Grid
    const infoY = doc.y;
    
    // Left: Project Info
    doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryColor).text('PROJECT DETAILS', 50, infoY);
    doc.fontSize(9).font('Helvetica').fillColor(secondaryColor);
    doc.text(`Project Name: ${project.project_name}`, 50, doc.y + 4);
    if (project.project_type) {
      doc.text(`Project Type: ${project.project_type.replace(/_/g, ' ').toUpperCase()}`, 50, doc.y + 2);
    }
    if (project.site_address) {
      doc.text(`Site Address: ${project.site_address}`, 50, doc.y + 2, { width: 220 });
    }

    // Right: Report Details
    const rightColX = 320;
    doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryColor).text('REPORT DETAILS', rightColX, infoY);
    doc.fontSize(9).font('Helvetica').fillColor(secondaryColor);
    doc.text(`Report Date: ${new Date(report.report_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`, rightColX, doc.y + 4);
    doc.text(`Submitted By: ${report.submitted_by_name || 'Site Supervisor'}`, rightColX, doc.y + 2);
    doc.text(`Submission Time: ${new Date(report.created_at).toLocaleString('en-IN')}`, rightColX, doc.y + 2);

    doc.moveDown(3.5);

    // Render horizontal separator
    const midSepY = doc.y;
    doc.moveTo(50, midSepY).lineTo(545, midSepY).strokeColor(borderColor).lineWidth(1).stroke();
    doc.y = midSepY + 15;

    // 1. Work Completed Section
    doc.fontSize(11).font('Helvetica-Bold').fillColor(accentColor).text('1. WORK COMPLETED TODAY');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').fillColor(primaryColor).text(report.work_done, { lineGap: 4, width: 495 });
    doc.moveDown(2);

    // 2. Issues & Blockers Section (if any)
    if (report.issues_encountered) {
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#b91c1c').text('2. ISSUES & BLOCKERS ENCOUNTERED');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').fillColor(primaryColor).text(report.issues_encountered, { lineGap: 4, width: 495 });
      doc.moveDown(2);
    }

    // 3. Manpower Deployed Section
    doc.fontSize(11).font('Helvetica-Bold').fillColor(accentColor).text('3. MANPOWER DEPLOYED');
    doc.moveDown(0.5);
    if (report.manpower && report.manpower.length > 0) {
      const tableHeaderY = doc.y;
      doc.rect(50, tableHeaderY, 495, 18).fill(primaryColor);
      doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
      doc.text('Trade / Work Type', 60, tableHeaderY + 5);
      doc.text('Count', 450, tableHeaderY + 5, { align: 'right', width: 80 });
      
      let curY = tableHeaderY + 18;
      report.manpower.forEach((m, index) => {
        doc.rect(50, curY, 495, 18).fill(index % 2 === 0 ? lightBg : '#ffffff');
        doc.fillColor(primaryColor).fontSize(9).font('Helvetica');
        const tradeLabel = m.trade.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        doc.text(tradeLabel, 60, curY + 5);
        doc.text(String(m.count), 450, curY + 5, { align: 'right', width: 80 });
        curY += 18;
      });
      doc.y = curY;
    } else {
      doc.fontSize(9).font('Helvetica-Oblique').fillColor(secondaryColor).text('No manpower recorded today.');
    }
    doc.moveDown(2);

    // 4. Materials Consumed Section
    doc.fontSize(11).font('Helvetica-Bold').fillColor(accentColor).text('4. MATERIALS CONSUMED');
    doc.moveDown(0.5);
    if (report.materials && report.materials.length > 0) {
      const tableHeaderY = doc.y;
      doc.rect(50, tableHeaderY, 495, 18).fill(primaryColor);
      doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
      doc.text('Material Description', 60, tableHeaderY + 5);
      doc.text('Quantity', 450, tableHeaderY + 5, { align: 'right', width: 80 });
      
      let curY = tableHeaderY + 18;
      report.materials.forEach((m, index) => {
        doc.rect(50, curY, 495, 18).fill(index % 2 === 0 ? lightBg : '#ffffff');
        doc.fillColor(primaryColor).fontSize(9).font('Helvetica');
        doc.text(m.material, 60, curY + 5);
        doc.text(m.quantity, 450, curY + 5, { align: 'right', width: 80 });
        curY += 18;
      });
      doc.y = curY;
    } else {
      doc.fontSize(9).font('Helvetica-Oblique').fillColor(secondaryColor).text('No materials consumed today.');
    }
    doc.moveDown(2);

    // 5. Photos Section
    resolvePhotos(doc, report.photos, accentColor, borderColor, textMuted).then(() => {
      doc.end();
    }).catch(err => {
      console.error('[DSR PDF Service] Photos resolution error:', err);
      doc.end();
    });
  });

  // 4. Upload to S3/local storage
  const reportDateStr = new Date(report.report_date).toISOString().split('T')[0];
  const storageKey = `${tenantId}/projects/${report.project_id}/dsr/DSR_${reportDateStr}_${report.id}.pdf`;
  
  await storage.uploadBuffer(storageKey, pdfBuffer, 'application/pdf');

  // 5. Register in documents table
  const docQuery = `
    INSERT INTO documents (
      tenant_id, project_id, name, doc_type, version, storage_key, file_size_bytes, mime_type, uploaded_by, status, is_visible_to_client
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
  `;
  const docValues = [
    tenantId,
    report.project_id,
    `Daily Site Report - ${new Date(report.report_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    'daily_site_report',
    1,
    storageKey,
    pdfBuffer.length,
    'application/pdf',
    userId || null,
    'approved',
    true
  ];

  await pool.query(docQuery, docValues);
}

async function resolvePhotos(doc, photos, accentColor, borderColor, textMuted) {
  if (!photos || photos.length === 0) return;

  if (doc.y > 600) {
    doc.addPage();
  } else {
    doc.moveDown(2);
  }

  doc.fontSize(11).font('Helvetica-Bold').fillColor(accentColor).text('5. PROGRESS PHOTOS');
  doc.moveDown(0.5);

  const startY = doc.y;
  let currentX = 50;
  let currentY = startY;
  const colWidth = 235;
  const spacing = 25;
  const imgHeight = 150;

  for (let i = 0; i < photos.length; i++) {
    const key = photos[i];
    
    if (currentY + imgHeight > 780) {
      doc.addPage();
      currentY = 50;
      currentX = 50;
    }

    const imageBuffer = await getImageBuffer(key);

    if (imageBuffer) {
      try {
        doc.image(imageBuffer, currentX, currentY, { width: colWidth, height: imgHeight, fit: [colWidth, imgHeight] });
      } catch (err) {
        drawPlaceholder(doc, currentX, currentY, colWidth, imgHeight, `Failed to render image: ${path.basename(key)}`, borderColor, textMuted);
      }
    } else {
      drawPlaceholder(doc, currentX, currentY, colWidth, imgHeight, `Image: ${path.basename(key)}`, borderColor, textMuted);
    }

    if (i % 2 === 0 && i < photos.length - 1) {
      currentX += colWidth + spacing;
    } else {
      currentX = 50;
      currentY += imgHeight + spacing;
    }
  }
}

function drawPlaceholder(doc, x, y, width, height, label, borderColor, textMuted) {
  doc.rect(x, y, width, height).strokeColor(borderColor).lineWidth(1).dash(4, { space: 4 }).stroke();
  doc.undash();
  doc.fillColor(textMuted).fontSize(8).font('Helvetica-Oblique').text(label, x + 10, y + (height / 2) - 10, { width: width - 20, align: 'center' });
}

module.exports = {
  archiveDailySiteReport
};
