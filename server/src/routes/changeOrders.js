const express = require('express');
const { z } = require('zod');
const { success, fail } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const pool = require('../config/db');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

const changeOrderSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  amount: z.number().nonnegative('Amount must be a non-negative number'),
  status: z.enum(['pending', 'approved', 'rejected']).optional()
});

const updateChangeOrderSchema = changeOrderSchema.partial();

// GET /api/projects/:projectId/change-orders
router.get('/', authorize('projects:read'), async (req, res) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;

    const { rows } = await pool.query(
      `SELECT * FROM project_change_orders 
       WHERE project_id = $1 AND tenant_id = $2 
       ORDER BY created_at DESC`,
      [projectId, tenantId]
    );

    return success(res, rows);
  } catch (err) {
    console.error('[ChangeOrders Router] List error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch change orders.', 500);
  }
});

// POST /api/projects/:projectId/change-orders
router.post('/', authorize('projects:update'), async (req, res) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;
    const data = changeOrderSchema.parse(req.body);

    const { rows } = await pool.query(
      `INSERT INTO project_change_orders (tenant_id, project_id, title, description, amount, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        tenantId,
        projectId,
        data.title,
        data.description || null,
        data.amount,
        data.status || 'pending'
      ]
    );

    return success(res, rows[0], {}, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    }
    console.error('[ChangeOrders Router] Create error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to create change order.', 500);
  }
});

// PATCH /api/projects/:projectId/change-orders/:id
router.patch('/:id', authorize('projects:update'), async (req, res) => {
  try {
    const { projectId, id } = req.params;
    const tenantId = req.tenantId;
    const data = updateChangeOrderSchema.parse(req.body);

    const fields = [];
    const values = [tenantId, projectId, id];
    let idx = 4;

    for (const [key, value] of Object.entries(data)) {
      fields.push(`${key} = $${idx}`);
      values.push(value);
      idx++;
    }

    if (fields.length === 0) {
      const { rows: current } = await pool.query(
        `SELECT * FROM project_change_orders WHERE tenant_id = $1 AND project_id = $2 AND id = $3`,
        [tenantId, projectId, id]
      );
      return success(res, current[0]);
    }

    fields.push(`updated_at = NOW()`);

    const query = `
      UPDATE project_change_orders
      SET ${fields.join(', ')}
      WHERE tenant_id = $1 AND project_id = $2 AND id = $3
      RETURNING *
    `;

    const { rows } = await pool.query(query, values);
    if (rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Change order not found.', 404);
    }

    return success(res, rows[0]);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    }
    console.error('[ChangeOrders Router] Update error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to update change order.', 500);
  }
});

// DELETE /api/projects/:projectId/change-orders/:id
router.delete('/:id', authorize('projects:update'), async (req, res) => {
  try {
    const { projectId, id } = req.params;
    const tenantId = req.tenantId;

    const { rows } = await pool.query(
      `DELETE FROM project_change_orders 
       WHERE tenant_id = $1 AND project_id = $2 AND id = $3
       RETURNING id`,
      [tenantId, projectId, id]
    );

    if (rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Change order not found.', 404);
    }

    return success(res, { id: rows[0].id, message: 'Change order deleted successfully.' });
  } catch (err) {
    console.error('[ChangeOrders Router] Delete error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to delete change order.', 500);
  }
});

module.exports = router;
