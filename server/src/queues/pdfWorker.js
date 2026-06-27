// PDF worker — processes automation_jobs with event_type='generate_handover_pdf'
const { pool } = require('../db/pool');
const { generateCompletionCertificate } = require('../services/postSale/completionCertificatePdfService');

async function processPdfJobs() {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM automation_jobs
       WHERE status='pending' AND event_type='generate_handover_pdf'
       ORDER BY created_at ASC LIMIT 5`,
    );
    for (const job of rows) {
      try {
        const rec = JSON.parse(job.record || '{}');
        console.log(`[pdfWorker] Generating handover PDF for checklist ${rec.checklistId}`);

        await generateCompletionCertificate(job.tenant_id, rec.checklistId);

        // Mark as completed
        await pool.query(
          `UPDATE automation_jobs SET status='completed', processed_at=NOW() WHERE id=$1`,
          [job.id]
        );
      } catch(err) {
        console.error('[pdfWorker] job failed:', err.message);
        await pool.query(
          `UPDATE automation_jobs SET status='failed', error=$1 WHERE id=$2`,
          [err.message, job.id]
        );
      }
    }
  } catch (err) {
    console.error('[pdfWorker] queue poll failed:', err.message);
  }
}

// Start polling — runs every 30 seconds (PDF jobs are not urgent)
function startPdfWorker() {
  console.log('[pdfWorker] started');
  // Run immediately once on startup, then every 30 seconds
  processPdfJobs();
  setInterval(processPdfJobs, 30000);
}

module.exports = { startPdfWorker };
