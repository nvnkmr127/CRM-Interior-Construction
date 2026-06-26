const express = require('express');
const { z } = require('zod');
const pool = require('../config/db');
const { success, fail } = require('../utils/response');
const authorize = require('../middleware/authorize');

const router = express.Router({ mergeParams: true });

const budgetAllocationSchema = z.object({
  category: z.enum(['labour', 'material', 'vendor']),
  budgetedCost: z.number().nonnegative('Budgeted cost must be a non-negative number')
});

const expenseSchema = z.object({
  category: z.enum(['labour', 'material', 'vendor']),
  type: z.enum(['committed', 'actual']),
  description: z.string().min(1, 'Description is required'),
  amount: z.number().positive('Amount must be a positive number'),
  incurredDate: z.string().optional().nullable()
});

// GET /api/projects/:projectId/budget
router.get('/', authorize('projects:read'), async (req, res) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;

    const query = `
      SELECT 
        c.category,
        COALESCE(pb.budgeted_cost, 0.00) as budgeted_cost,
        COALESCE(pe.committed_cost, 0.00) as committed_cost,
        COALESCE(pe.actual_cost, 0.00) as actual_cost
      FROM (
        SELECT 'labour'::varchar as category
        UNION ALL
        SELECT 'material'
        UNION ALL
        SELECT 'vendor'
      ) c
      LEFT JOIN project_budgets pb ON pb.category = c.category AND pb.project_id = $1 AND pb.tenant_id = $2
      LEFT JOIN (
        SELECT 
          category,
          SUM(CASE WHEN type = 'committed' THEN amount ELSE 0.00 END) as committed_cost,
          SUM(CASE WHEN type = 'actual' THEN amount ELSE 0.00 END) as actual_cost
        FROM project_expenses
        WHERE project_id = $1 AND tenant_id = $2
        GROUP BY category
      ) pe ON pe.category = c.category;
    `;

    const { rows } = await pool.query(query, [projectId, tenantId]);

    const categories = rows.map(r => {
      const budgeted = parseFloat(r.budgeted_cost);
      const committed = parseFloat(r.committed_cost);
      const actual = parseFloat(r.actual_cost);
      return {
        category: r.category,
        budgeted,
        committed,
        actual,
        variance: budgeted - actual
      };
    });

    const totals = categories.reduce((acc, curr) => {
      acc.budgeted += curr.budgeted;
      acc.committed += curr.committed;
      acc.actual += curr.actual;
      acc.variance += curr.variance;
      return acc;
    }, { budgeted: 0, committed: 0, actual: 0, variance: 0 });

    return success(res, { categories, totals });
  } catch (err) {
    console.error('[Budget Router] Summary fetch error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch budget summary.', 500);
  }
});

// POST /api/projects/:projectId/budget
// Sets or updates a category budget allocation
router.post('/', authorize('projects:update'), async (req, res) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;
    const { category, budgetedCost } = budgetAllocationSchema.parse(req.body);

    const query = `
      INSERT INTO project_budgets (tenant_id, project_id, category, budgeted_cost, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (project_id, category, tenant_id)
      DO UPDATE SET budgeted_cost = EXCLUDED.budgeted_cost, updated_at = NOW()
      RETURNING *
    `;

    const { rows } = await pool.query(query, [tenantId, projectId, category, budgetedCost]);
    return success(res, rows[0]);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    }
    console.error('[Budget Router] Allocation error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to set budget allocation.', 500);
  }
});

// GET /api/projects/:projectId/budget/expenses
router.get('/expenses', authorize('projects:read'), async (req, res) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;

    const { rows } = await pool.query(
      `SELECT * FROM project_expenses 
       WHERE project_id = $1 AND tenant_id = $2
       ORDER BY incurred_date DESC, created_at DESC`,
      [projectId, tenantId]
    );

    return success(res, rows);
  } catch (err) {
    console.error('[Budget Router] Fetch expenses error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch expenses.', 500);
  }
});

// POST /api/projects/:projectId/budget/expenses
router.post('/expenses', authorize('projects:update'), async (req, res) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;
    const data = expenseSchema.parse(req.body);

    const query = `
      INSERT INTO project_expenses (tenant_id, project_id, category, type, description, amount, incurred_date)
      VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, CURRENT_DATE))
      RETURNING *
    `;

    const { rows } = await pool.query(query, [
      tenantId,
      projectId,
      data.category,
      data.type,
      data.description,
      data.amount,
      data.incurredDate || null
    ]);

    return success(res, rows[0], {}, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    }
    console.error('[Budget Router] Log expense error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to log cost item.', 500);
  }
});

// DELETE /api/projects/:projectId/budget/expenses/:expenseId
router.delete('/expenses/:expenseId', authorize('projects:update'), async (req, res) => {
  try {
    const { projectId, expenseId } = req.params;
    const tenantId = req.tenantId;

    const { rowCount } = await pool.query(
      `DELETE FROM project_expenses 
       WHERE id = $1 AND project_id = $2 AND tenant_id = $3`,
      [expenseId, projectId, tenantId]
    );

    if (rowCount === 0) {
      return fail(res, 'NOT_FOUND', 'Cost item not found or does not belong to this project.', 404);
    }

    return success(res, { message: 'Cost item deleted' });
  } catch (err) {
    console.error('[Budget Router] Delete expense error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to delete cost item.', 500);
  }
});

module.exports = router;
