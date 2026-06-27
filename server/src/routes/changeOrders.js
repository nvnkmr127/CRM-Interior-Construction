const express = require('express');
const { z } = require('zod');
const { success, fail } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const pool = require('../config/db');
const quotationService = require('../services/projects/quotationService');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

const changeOrderSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
  amount: z.number().nonnegative('Amount must be a non-negative number'),
  timeline_impact_days: z.number({ required_error: 'Timeline impact in days is required.' }).int('Timeline impact must be an integer.'),
  status: z.enum(['draft', 'submitted', 'approved', 'rejected']).optional(),
  client_signature: z.string().optional().nullable(),
  client_signed_at: z.string().optional().nullable()
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

    // Fetch linked items (BOQ Delta) for these change orders
    if (rows.length > 0) {
      const coIds = rows.map(co => co.id);
      const { rows: items } = await pool.query(
        `SELECT qi.*, q.quotation_number 
         FROM quotation_items qi
         JOIN quotations q ON qi.quotation_id = q.id
         WHERE qi.change_order_id = ANY($1) AND qi.tenant_id = $2
         ORDER BY qi.sort_order ASC, qi.created_at ASC`,
        [coIds, tenantId]
      );

      // Group items by change_order_id
      rows.forEach(co => {
        co.items = items.filter(item => item.change_order_id === co.id);
      });
    }

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
      `INSERT INTO project_change_orders 
       (tenant_id, project_id, title, description, reason, amount, timeline_impact_days, status, client_signature, client_signed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        tenantId,
        projectId,
        data.title,
        data.description || null,
        data.reason || null,
        data.amount,
        data.timeline_impact_days || 0,
        data.status || 'draft',
        data.client_signature || null,
        data.client_signed_at ? new Date(data.client_signed_at) : null
      ]
    );

    // Trigger update of quotation totals if approved
    if (rows[0].status === 'approved') {
      const quoteRes = await pool.query(
        `SELECT id FROM quotations WHERE project_id = $1 AND tenant_id = $2 ORDER BY version DESC, created_at DESC LIMIT 1`,
        [projectId, tenantId]
      );
      if (quoteRes.rows.length > 0) {
        await quotationService.updateQuotationTotals(tenantId, quoteRes.rows[0].id);
      }
    }

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
      if (key === 'client_signed_at' && value) {
        values.push(new Date(value));
      } else {
        values.push(value);
      }
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

    // Recalculate quotation totals after any change order update
    const quoteRes = await pool.query(
      `SELECT id FROM quotations WHERE project_id = $1 AND tenant_id = $2 ORDER BY version DESC, created_at DESC LIMIT 1`,
      [projectId, tenantId]
    );
    if (quoteRes.rows.length > 0) {
      await quotationService.updateQuotationTotals(tenantId, quoteRes.rows[0].id);
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

    // Recalculate quotation totals after deletion to ensure any linked items' totals are updated
    const quoteRes = await pool.query(
      `SELECT id FROM quotations WHERE project_id = $1 AND tenant_id = $2 ORDER BY version DESC, created_at DESC LIMIT 1`,
      [projectId, tenantId]
    );
    if (quoteRes.rows.length > 0) {
      await quotationService.updateQuotationTotals(tenantId, quoteRes.rows[0].id);
    }

    return success(res, { id: rows[0].id, message: 'Change order deleted successfully.' });
  } catch (err) {
    console.error('[ChangeOrders Router] Delete error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to delete change order.', 500);
  }
});

module.exports = router;
