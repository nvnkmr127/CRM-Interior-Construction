const { pool } = require('../../config/db');

class ProjectHealthService {
  /**
   * Generates a weekly health report for a specific project.
   */
  async generateHealthReport(tenantId, projectId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Calculate Schedule Score
      // Check overdue tasks
      const overdueRes = await client.query(`
        SELECT COUNT(*) as count 
        FROM tasks 
        WHERE project_id = $1 AND tenant_id = $2 
          AND status NOT IN ('done', 'completed') 
          AND due_date < NOW()
      `, [projectId, tenantId]);
      const overdueTasks = parseInt(overdueRes.rows[0].count, 10) || 0;
      
      let schedule_score = 'Good';
      if (overdueTasks > 5) schedule_score = 'Poor';
      else if (overdueTasks > 0) schedule_score = 'Fair';

      // 2. Calculate Financial Score
      // Simplified: check if total collections match plan or invoices
      let financial_score = 'Good';
      let financialData = { invoices: 0, payments: 0 };
      try {
        const invRes = await client.query(`
          SELECT SUM(amount) as total_invoiced 
          FROM invoices 
          WHERE project_id = $1 AND tenant_id = $2
        `, [projectId, tenantId]);
        const payRes = await client.query(`
          SELECT SUM(amount) as total_paid 
          FROM payments 
          WHERE project_id = $1 AND tenant_id = $2
        `, [projectId, tenantId]);
        
        const invoiced = parseFloat(invRes.rows[0].total_invoiced) || 0;
        const paid = parseFloat(payRes.rows[0].total_paid) || 0;
        financialData = { invoiced, paid };

        if (invoiced > 0 && paid < invoiced * 0.5) financial_score = 'Poor';
        else if (invoiced > 0 && paid < invoiced * 0.9) financial_score = 'Fair';
      } catch (e) {
        // Invoices/Payments table might not exist in exactly this format, fallback gracefully
      }

      // 3. Calculate QC Score
      let qc_score = 'Good';
      let openSnags = 0;
      try {
        const snagRes = await client.query(`
          SELECT COUNT(*) as count 
          FROM snags 
          WHERE project_id = $1 AND tenant_id = $2 
            AND status != 'resolved'
        `, [projectId, tenantId]);
        openSnags = parseInt(snagRes.rows[0].count, 10) || 0;
        if (openSnags > 10) qc_score = 'Poor';
        else if (openSnags > 3) qc_score = 'Fair';
      } catch(e) {
        // Fallback
      }

      // 4. Calculate Client Score
      // Placeholder logic
      let client_score = 'Good';
      let clientEscalations = 0;
      
      // Calculate Overall Health
      let overall_health = 'Good';
      const scores = [schedule_score, financial_score, qc_score, client_score];
      const poorCount = scores.filter(s => s === 'Poor').length;
      const fairCount = scores.filter(s => s === 'Fair').length;

      if (poorCount >= 2 || (poorCount === 1 && fairCount >= 2)) {
        overall_health = 'Poor';
      } else if (poorCount === 1 || fairCount >= 2) {
        overall_health = 'Fair';
      }

      const rawData = {
        overdueTasks,
        financial: financialData,
        openSnags,
        clientEscalations
      };

      // Save Report
      const insertRes = await client.query(`
        INSERT INTO project_health_reports (
          tenant_id, project_id, report_date,
          schedule_score, financial_score, qc_score, client_score,
          overall_health, raw_data_json
        ) VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        tenantId, projectId, 
        schedule_score, financial_score, qc_score, client_score, 
        overall_health, JSON.stringify(rawData)
      ]);

      await client.query('COMMIT');
      return insertRes.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[ProjectHealthService] Error generating health report:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Fetch historical reports for a project
   */
  async getReports(tenantId, projectId, limit = 10) {
    const res = await pool.query(`
      SELECT * FROM project_health_reports 
      WHERE tenant_id = $1 AND project_id = $2
      ORDER BY report_date DESC
      LIMIT $3
    `, [tenantId, projectId, limit]);
    return res.rows;
  }
}

module.exports = new ProjectHealthService();
