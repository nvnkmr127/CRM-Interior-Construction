const pool = require('../config/db');

class SiteExpenseRepository {
  async submitExpense(tenantId, projectId, userId, data) {
    const {
      phase_id,
      expense_type,
      amount,
      description,
      receipt_photo_url
    } = data;

    const query = `
      INSERT INTO site_expenses (
        tenant_id, project_id, phase_id, expense_type, amount, description, receipt_photo_url, submitted_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      tenantId,
      projectId,
      phase_id || null,
      expense_type,
      amount,
      description,
      receipt_photo_url,
      userId
    ];

    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  async updateExpenseStatus(tenantId, expenseId, status, approverId) {
    const query = `
      UPDATE site_expenses
      SET status = $1, approved_by = $2, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND tenant_id = $4
      RETURNING *
    `;
    const { rows } = await pool.query(query, [status, approverId, expenseId, tenantId]);
    return rows[0];
  }

  async markReimbursed(tenantId, expenseId) {
    const query = `
      UPDATE site_expenses
      SET is_reimbursed = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND tenant_id = $2 AND status = 'approved'
      RETURNING *
    `;
    const { rows } = await pool.query(query, [expenseId, tenantId]);
    return rows[0];
  }

  async findExpensesByProject(tenantId, projectId) {
    const query = `
      SELECT e.*, s.name as submitted_by_name, a.name as approved_by_name
      FROM site_expenses e
      LEFT JOIN users s ON e.submitted_by = s.id
      LEFT JOIN users a ON e.approved_by = a.id
      WHERE e.tenant_id = $1 AND e.project_id = $2
      ORDER BY e.submitted_at DESC
    `;
    const { rows } = await pool.query(query, [tenantId, projectId]);
    return rows;
  }
}

module.exports = new SiteExpenseRepository();
