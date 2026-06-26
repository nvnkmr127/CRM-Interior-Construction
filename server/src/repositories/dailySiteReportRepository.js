const pool = require('../config/db');

class DailySiteReportRepository {
  async createReport(tenantId, userId, data) {
    const {
      project_id,
      report_date,
      work_done,
      manpower = [],
      materials = [],
      issues_encountered = null,
      photos = []
    } = data;

    const query = `
      INSERT INTO daily_site_reports (
        tenant_id, project_id, report_date, work_done, manpower, materials, issues_encountered, photos, submitted_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      tenantId,
      project_id,
      report_date || new Date().toISOString().split('T')[0],
      work_done,
      JSON.stringify(manpower),
      JSON.stringify(materials),
      issues_encountered,
      JSON.stringify(photos),
      userId
    ];

    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  async findReportsByProject(tenantId, projectId) {
    const query = `
      SELECT r.*, u.name as submitted_by_name
      FROM daily_site_reports r
      LEFT JOIN users u ON r.submitted_by = u.id
      WHERE r.tenant_id = $1 AND r.project_id = $2
      ORDER BY r.report_date DESC, r.created_at DESC
    `;
    const { rows } = await pool.query(query, [tenantId, projectId]);
    return rows;
  }

  async findReportById(tenantId, id) {
    const query = `
      SELECT r.*, u.name as submitted_by_name
      FROM daily_site_reports r
      LEFT JOIN users u ON r.submitted_by = u.id
      WHERE r.tenant_id = $1 AND r.id = $2
    `;
    const { rows } = await pool.query(query, [tenantId, id]);
    if (rows.length === 0) return null;
    return rows[0];
  }
}

module.exports = new DailySiteReportRepository();
