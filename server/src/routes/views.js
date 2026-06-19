const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const pool = require('../db/pool');
const { success, fail } = require('../utils/response');

// Get all saved views for the current user
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.user.tenantId;
    const userId = req.user.userId;

    const query = `
      SELECT * FROM saved_views 
      WHERE tenant_id = $1 AND user_id = $2
      ORDER BY created_at ASC
    `;
    const result = await pool.query(query, [tenantId, userId]);
    return success(res, result.rows);
  } catch (error) {
    next(error);
  }
});

// Create a new saved view
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.user.tenantId;
    const userId = req.user.userId;
    const { name, entity_type, filters, sort_by, sort_direction, is_default } = req.body;

    const query = `
      INSERT INTO saved_views (tenant_id, user_id, name, entity_type, filters, sort_by, sort_direction, is_default)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const result = await pool.query(query, [
      tenantId, userId, name, entity_type || 'lead', JSON.stringify(filters || {}), sort_by, sort_direction || 'DESC', is_default || false
    ]);
    return success(res, result.rows[0], {}, 201);
  } catch (error) {
    next(error);
  }
});

// Update a saved view
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.user.tenantId;
    const userId = req.user.userId;
    const { id } = req.params;
    const { name, filters, sort_by, sort_direction, is_default } = req.body;

    const query = `
      UPDATE saved_views 
      SET name = $1, filters = $2, sort_by = $3, sort_direction = $4, is_default = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 AND tenant_id = $7 AND user_id = $8
      RETURNING *
    `;
    const result = await pool.query(query, [
      name, JSON.stringify(filters || {}), sort_by, sort_direction, is_default, id, tenantId, userId
    ]);

    if (result.rowCount === 0) return fail(res, 'View not found or unauthorized', 404);
    return success(res, result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Delete a saved view
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.user.tenantId;
    const userId = req.user.userId;
    const { id } = req.params;

    const query = `DELETE FROM saved_views WHERE id = $1 AND tenant_id = $2 AND user_id = $3`;
    const result = await pool.query(query, [id, tenantId, userId]);

    if (result.rowCount === 0) return fail(res, 'View not found or unauthorized', 404);
    return success(res, null, 'View deleted');
  } catch (error) {
    next(error);
  }
});

module.exports = router;
