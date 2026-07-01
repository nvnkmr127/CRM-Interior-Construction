const { db } = require('../../config/db');

class ProjectProfitabilityService {
  static async getProjectProfitability(tenantId, projectId) {
    const result = await db.query(
      `SELECT * FROM project_profitability_view 
       WHERE tenant_id = $1 AND project_id = $2`,
      [tenantId, projectId]
    );
    return result.rows[0];
  }

  static async getProjectLedger(tenantId, projectId) {
    const result = await db.query(
      `SELECT * FROM project_cost_ledger_view 
       WHERE tenant_id = $1 AND project_id = $2
       ORDER BY incurred_date DESC`,
      [tenantId, projectId]
    );
    return result.rows;
  }
}

module.exports = ProjectProfitabilityService;
