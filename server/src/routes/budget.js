const express = require('express');
const { z } = require('zod');
const pool = require('../config/db');
const { success, fail } = require('../utils/response');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');

const router = express.Router({ mergeParams: true });

const budgetAllocationSchema = z.object({
  category: z.enum(['labour', 'material', 'vendor', 'overhead', 'civil', 'electrical', 'plumbing', 'carpentry']),
  budgetedCost: z.number().nonnegative('Budgeted cost must be a non-negative number')
});

const expenseSchema = z.object({
  category: z.enum(['labour', 'material', 'vendor', 'overhead', 'civil', 'electrical', 'plumbing', 'carpentry']),
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
        UNION ALL SELECT 'material'
        UNION ALL SELECT 'vendor'
        UNION ALL SELECT 'overhead'
        UNION ALL SELECT 'civil'
        UNION ALL SELECT 'electrical'
        UNION ALL SELECT 'plumbing'
        UNION ALL SELECT 'carpentry'
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
router.post('/', authorize('projects:update'), validate(budgetAllocationSchema), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;
    const { category, budgetedCost }  = req.body;

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
router.post('/expenses', authorize('projects:update'), validate(expenseSchema), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;
    const data  = req.body;

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

    await checkBudgetThresholds(tenantId, projectId);

    return success(res, rows[0], {}, 201);
  } catch (err) {
    
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

    await checkBudgetThresholds(tenantId, projectId);

    return success(res, { message: 'Cost item deleted' });
  } catch (err) {
    console.error('[Budget Router] Delete expense error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to delete cost item.', 500);
  }
});

async function checkBudgetThresholds(tenantId, projectId) {
  try {
    // 1. Fetch project details
    const projRes = await pool.query(
      'SELECT id, name, pm_id, contract_value, alert_80_sent, alert_90_sent, alert_100_sent FROM projects WHERE id = $1 AND tenant_id = $2',
      [projectId, tenantId]
    );
    if (projRes.rows.length === 0) return;
    const project = projRes.rows[0];
    const contractValue = parseFloat(project.contract_value || 0);
    if (contractValue <= 0) return;

    // 2. Fetch total actual costs
    const costRes = await pool.query(
      "SELECT COALESCE(SUM(amount), 0)::numeric as total_actual FROM project_expenses WHERE project_id = $1 AND tenant_id = $2 AND type = 'actual'",
      [projectId, tenantId]
    );
    const totalActual = parseFloat(costRes.rows[0].total_actual);
    const ratio = totalActual / contractValue;

    // 3. Determine threshold crossings
    let alert80 = project.alert_80_sent;
    let alert90 = project.alert_90_sent;
    let alert100 = project.alert_100_sent;

    const triggeredThresholds = [];

    // Check 100% threshold
    if (ratio >= 1.0) {
      if (!alert100) {
        alert100 = true;
        triggeredThresholds.push(100);
      }
      alert90 = true;
      alert80 = true;
    } 
    // Check 90% threshold
    else if (ratio >= 0.9) {
      if (!alert90) {
        alert90 = true;
        triggeredThresholds.push(90);
      }
      alert80 = true;
      alert100 = false; // Reset if dropped below
    } 
    // Check 80% threshold
    else if (ratio >= 0.8) {
      if (!alert80) {
        alert80 = true;
        triggeredThresholds.push(80);
      }
      alert90 = false;
      alert100 = false; // Reset if dropped below
    } 
    // Below 80% - reset all flags
    else {
      alert80 = false;
      alert90 = false;
      alert100 = false;
    }

    // 4. Update project alert flags in database if changed
    if (alert80 !== project.alert_80_sent || alert90 !== project.alert_90_sent || alert100 !== project.alert_100_sent) {
      await pool.query(
        `UPDATE projects 
         SET alert_80_sent = $1, alert_90_sent = $2, alert_100_sent = $3, updated_at = NOW() 
         WHERE id = $4 AND tenant_id = $5`,
        [alert80, alert90, alert100, projectId, tenantId]
      );
    }

    // 5. Send notifications for any newly triggered thresholds
    if (triggeredThresholds.length > 0) {
      const notifyUsers = [];
      if (project.pm_id) {
        notifyUsers.push(project.pm_id);
      }

      // Notify superadmins/admins/finance
      const adminUsersRes = await pool.query(
        `SELECT u.id FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.tenant_id = $1 AND (r.name IN ('superadmin', 'admin', 'finance'))`,
        [tenantId]
      );
      adminUsersRes.rows.forEach(row => {
        if (!notifyUsers.includes(row.id)) notifyUsers.push(row.id);
      });

      const { logAction } = require('../services/auditLog');

      for (const threshold of triggeredThresholds) {
        const message = `Warning: Project '${project.name}' costs have reached ${threshold}% of contract value (Cost: ${totalActual.toFixed(2)}, Contract Value: ${contractValue.toFixed(2)}).`;
        
        for (const recipientId of notifyUsers) {
          await pool.query(
            `INSERT INTO notifications (tenant_id, user_id, type, message, reference_url)
             VALUES ($1, $2, 'budget_warning', $3, $4)`,
            [
              tenantId,
              recipientId,
              message,
              `/projects/${projectId}/budget`
            ]
          );
        }

        // Log audit event
        await logAction({
          tenantId,
          userId: null,
          action: threshold === 100 ? 'project.budget_overrun' : 'project.budget_warning',
          entity: 'project',
          entityId: projectId,
          newValue: { cost: totalActual, contractValue, threshold }
        });
      }
    }
  } catch (err) {
    console.error('[Budget Check] Failed to verify budget thresholds:', err.message);
  }
}

module.exports = router;

