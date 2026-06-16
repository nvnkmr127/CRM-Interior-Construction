// Simple stub PDF worker — processes automation_jobs with action='generate_handover_pdf'
// Real PDF generation (puppeteer/pdfkit) can be added in Phase 2

const { pool } = require('../db/pool')

async function processPdfJobs() {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM automation_jobs
       WHERE status='pending' AND entity='generate_handover_pdf'
       ORDER BY created_at ASC LIMIT 5`,
    )
    for (const job of rows) {
      try {
        // STUB: log what would be generated
        const rec = JSON.parse(job.record || '{}')
        console.log(`[pdfWorker] Would generate handover PDF for checklist ${rec.checklistId}`)

        // Mark as completed
        await pool.query(
          `UPDATE automation_jobs SET status='completed', processed_at=NOW() WHERE id=$1`,
          [job.id]
        )
      } catch(err) {
        console.error('[pdfWorker] job failed:', err.message)
        await pool.query(
          `UPDATE automation_jobs SET status='failed', error=$1 WHERE id=$2`,
          [err.message, job.id]
        )
      }
    }
  } catch (err) {
    console.error('[pdfWorker] queue poll failed:', err.message)
  }
}

// Start polling — runs every 30 seconds (PDF jobs are not urgent)
function startPdfWorker() {
  console.log('[pdfWorker] started')
  setInterval(processPdfJobs, 30000)
}

module.exports = { startPdfWorker }
