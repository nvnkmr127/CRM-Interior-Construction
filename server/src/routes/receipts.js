const express = require('express');
const { success, fail } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const pool = require('../db/pool');

const router = express.Router();

router.use(authenticate);

// GET /api/receipts
router.get('/', authorize('projects:read'), async (req, res, next) => {
  try {
    const { projectId } = req.query;
    let query;
    let params = [req.tenantId];

    if (projectId) {
      query = `
        SELECT r.*, p.name as project_name 
        FROM receipts r
        LEFT JOIN projects p ON p.id = r.project_id
        WHERE r.tenant_id = $1 AND r.project_id = $2
        ORDER BY r.created_at DESC
      `;
      params.push(projectId);
    } else {
      query = `
        SELECT r.*, p.name as project_name 
        FROM receipts r
        LEFT JOIN projects p ON p.id = r.project_id
        WHERE r.tenant_id = $1
        ORDER BY r.created_at DESC
      `;
    }

    // We wrap this in a try-catch because the receipts table might not exist
    // If it doesn't exist, we just return an empty array to prevent 500s.
    try {
      const { rows } = await pool.query(query, params);
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
