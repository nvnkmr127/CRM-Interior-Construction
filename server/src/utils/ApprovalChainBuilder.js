const pool = require('../db/pool');

/**
 * Utility to build configurable multi-level approval chains
 * based on transaction types and amounts dynamically from the database.
 */

async function buildApprovalChain(tenantId, transactionType, amountOrPercentage, context = {}) {
  try {
    const { department, branch, priority } = context;
    
    // Query the database for active rules matching the criteria
    let query = `
      SELECT * FROM approval_matrix 
      WHERE tenant_id = $1 
      AND transaction_type = $2 
      AND is_active = true
      AND min_amount <= $3
      AND (max_amount IS NULL OR max_amount >= $3)
    `;
    const values = [tenantId, transactionType, amountOrPercentage];
    let paramIndex = 4;

    if (department) {
      query += ` AND (department IS NULL OR department = $${paramIndex})`;
      values.push(department);
      paramIndex++;
    }
    if (branch) {
      query += ` AND (branch IS NULL OR branch = $${paramIndex})`;
      values.push(branch);
      paramIndex++;
    }
    if (priority) {
      query += ` AND (priority IS NULL OR priority = $${paramIndex})`;
      values.push(priority);
      paramIndex++;
    }

    // Check effective/expiry dates
    query += ` AND (effective_date IS NULL OR effective_date <= NOW())`;
    query += ` AND (expiry_date IS NULL OR expiry_date >= NOW())`;

    // Order by min_amount DESC to get the highest applicable threshold rule first
    query += ` ORDER BY min_amount DESC LIMIT 1`;

    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return { current_stage: 1, total_stages: 1, approval_chain: [] };
    }

    const rule = result.rows[0];
    const roles = rule.required_roles || [];
    
    if (roles.length === 0) {
      return { current_stage: 1, total_stages: 1, approval_chain: [] };
    }

    const chain = roles.map((role, index) => ({
      stage: index + 1,
      role: role,
      status: 'pending',
      approved_by: null,
      approved_at: null
    }));

    return {
      current_stage: 1,
      total_stages: roles.length,
      approval_chain: chain
    };
  } catch (err) {
    console.error('Error building approval chain:', err);
    // Fallback to empty chain if DB query fails
    return { current_stage: 1, total_stages: 1, approval_chain: [] };
  }
}

module.exports = { buildApprovalChain };
