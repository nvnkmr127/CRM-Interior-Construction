const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const pool = require('../db/pool');
const { success, fail } = require('../utils/response');

// Ensure table exists on startup
const ensureTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        color VARCHAR(50) DEFAULT '#9ca3af',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tenant_id, name)
      );
    `);
  } catch (error) {
    console.error('[Tags] Error ensuring table:', error.message);
  }
};
ensureTable();

// GET /api/tags
router.get('/', authenticate, async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const { rows } = await pool.query('SELECT * FROM tags WHERE tenant_id = $1 ORDER BY name ASC', [tenantId]);
    return success(res, rows);
  } catch (error) {
    next(error);
  }
});

// POST /api/tags
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { name, color } = req.body;
    if (!name) return fail(res, 'BAD_REQUEST', 'Tag name is required', 400);

    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const { rows } = await pool.query(
      'INSERT INTO tags (tenant_id, name, color) VALUES ($1, $2, $3) RETURNING *',
      [tenantId, name, color || '#9ca3af']
    );
    return success(res, rows[0], {}, 201);
  } catch (error) {
    if (error.code === '23505') { // unique violation
      return fail(res, 'CONFLICT', 'Tag with this name already exists', 409);
    }
    next(error);
  }
});

// PATCH /api/tags/:id
router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    
    const { rows } = await pool.query(
      'UPDATE tags SET name = COALESCE($1, name), color = COALESCE($2, color) WHERE id = $3 AND tenant_id = $4 RETURNING *',
      [name, color, id, tenantId]
    );

    if (rows.length === 0) return fail(res, 'NOT_FOUND', 'Tag not found', 404);
    return success(res, rows[0]);
  } catch (error) {
    if (error.code === '23505') return fail(res, 'CONFLICT', 'Tag with this name already exists', 409);
    next(error);
  }
});

// DELETE /api/tags/:id
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    
    const { rowCount } = await pool.query('DELETE FROM tags WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    
    if (rowCount === 0) return fail(res, 'NOT_FOUND', 'Tag not found', 404);
    return success(res, null, 'Tag deleted');
  } catch (error) {
    next(error);
  }
});

module.exports = router;
