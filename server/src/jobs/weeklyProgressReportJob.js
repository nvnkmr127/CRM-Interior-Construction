const pool = require('../db/pool');
const weeklyReportService = require('../services/projects/weeklyReportService');

async function runWeeklyReports() {
  console.log('[weeklyProgressReportJob] Starting weekly report generation...');
  const client = await pool.connect();
  try {
    // Fetch all active projects
    const res = await client.query(`
      SELECT id, tenant_id FROM projects
      WHERE status NOT IN ('archived', 'cancelled', 'completed')
    `);
    
    const projects = res.rows;
    console.log(`[weeklyProgressReportJob] Found ${projects.length} active projects.`);

    for (const project of projects) {
      try {
        await weeklyReportService.generateReport(project.tenant_id, project.id);
        console.log(`[weeklyProgressReportJob] Successfully generated report for project ${project.id}`);
      } catch (err) {
        console.error(`[weeklyProgressReportJob] Failed to generate report for project ${project.id}:`, err.message);
      }
    }
  } catch (error) {
    console.error('[weeklyProgressReportJob] Error fetching active projects:', error);
  } finally {
    client.release();
  }
}

module.exports = {
  run: runWeeklyReports
};
