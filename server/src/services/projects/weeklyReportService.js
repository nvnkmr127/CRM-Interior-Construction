const { pool } = require('../../config/db');
const { notifyUser } = require('../notifications/notificationService');

class WeeklyReportService {
  /**
   * Generates a weekly progress report for a specific project.
   * Compiles data from tasks, milestones, and DSRs over the past 7 days.
   */
  async generateReport(tenantId, projectId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Fetch completed tasks in the last 7 days
      const tasksRes = await client.query(`
        SELECT id, title, description, updated_at
        FROM tasks
        WHERE project_id = $1 AND tenant_id = $2
          AND status IN ('done', 'completed')
          AND updated_at >= NOW() - INTERVAL '7 days'
      `, [projectId, tenantId]);
      const tasksCompleted = tasksRes.rows;

      // 2. Fetch completed milestones in the last 7 days
      const milestonesRes = await client.query(`
        SELECT id, name, completion_date
        FROM milestones
        WHERE project_id = $1 AND tenant_id = $2
          AND status = 'completed'
          AND completion_date >= NOW() - INTERVAL '7 days'
      `, [projectId, tenantId]);
      const milestonesReached = milestonesRes.rows;

      // 3. Fetch photos from Daily Site Reports in the last 7 days
      const dsrRes = await client.query(`
        SELECT id, report_date, photos
        FROM daily_site_reports
        WHERE project_id = $1 AND tenant_id = $2
          AND report_date >= NOW() - INTERVAL '7 days'
      `, [projectId, tenantId]);
      
      const photos = [];
      dsrRes.rows.forEach(report => {
        if (report.photos && Array.isArray(report.photos)) {
          report.photos.forEach(photo => {
            photos.push({
              dsr_id: report.id,
              date: report.report_date,
              url: typeof photo === 'string' ? photo : photo.url || photo.path,
              caption: photo.caption || ''
            });
          });
        }
      });

      // 4. Fetch upcoming tasks for the next 7 days
      const upcomingTasksRes = await client.query(`
        SELECT id, title, due_date
        FROM tasks
        WHERE project_id = $1 AND tenant_id = $2
          AND status NOT IN ('done', 'completed')
          AND due_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
      `, [projectId, tenantId]);
      const nextWeekPlan = upcomingTasksRes.rows;

      // 5. Save the report to the database
      const reportDate = new Date();
      const insertRes = await client.query(`
        INSERT INTO project_weekly_reports (
          tenant_id, project_id, report_date, 
          tasks_completed_json, milestones_reached_json, 
          photos_json, next_week_plan_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        tenantId, projectId, reportDate,
        JSON.stringify(tasksCompleted),
        JSON.stringify(milestonesReached),
        JSON.stringify(photos),
        JSON.stringify(nextWeekPlan)
      ]);

      const report = insertRes.rows[0];

      // 6. Notify Client via Portal/Email
      // Fetch client user(s) associated with this project if any (assuming project has a client_id or we just notify PM for now to forward, 
      // but requirement says share with client via portal and email)
      const projectRes = await client.query(`SELECT client_id, name FROM projects WHERE id = $1`, [projectId]);
      const clientId = projectRes.rows[0]?.client_id;
      const projectName = projectRes.rows[0]?.name || 'Project';

      if (clientId) {
        // Send a portal notification
        notifyUser({
          tenantId,
          userId: clientId,
          type: 'WEEKLY_REPORT',
          message: `Your weekly progress report for ${projectName} is ready.`,
          referenceUrl: `/portal/projects/${projectId}/weekly-reports`
        });
        
        // Simulating Email dispatch here. 
        // In a real system, this would call emailService.sendWeeklyReport(email, data)
        console.log(`[Email Service Stub] Sending Weekly Report email to client ${clientId} for project ${projectId}`);
      }

      await client.query('COMMIT');
      return report;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[WeeklyReportService] Error generating report:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Fetch all weekly reports for a project
   */
  async getReportsByProject(tenantId, projectId) {
    const res = await pool.query(`
      SELECT * FROM project_weekly_reports
      WHERE project_id = $1 AND tenant_id = $2
      ORDER BY report_date DESC
    `, [projectId, tenantId]);
    return res.rows;
  }
}

module.exports = new WeeklyReportService();
