const express = require('express');
const router = express.Router({ mergeParams: true });
const { success } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const pool = require('../db/pool');

router.use(authenticate);

// GET /api/projects/:projectId/payment-escalations
router.get('/', authorize('projects:read'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    
    // As an initial implementation, we check the payment_milestones table
    // for overdue milestones, or return an empty array if the table structure is missing
    const query = `
      SELECT pm.*, m.name as milestone_name, p.name as project_name
      FROM payment_milestones pm
      LEFT JOIN milestones m ON m.id = pm.milestone_id
      LEFT JOIN projects p ON p.id = pm.project_id
      WHERE pm.tenant_id = $1 AND pm.project_id = $2
        AND pm.status = 'overdue'
      ORDER BY pm.due_date ASC
    `;
    
    try {
      const { rows } = await pool.query(query, [req.tenantId, projectId]);
      return success(res, rows);
    } catch (dbError) {
      if (dbError.code === '42P01') { // undefined_table
        return success(res, []);
      }
      throw dbError;
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
