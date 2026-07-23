const express = require('express');
const authenticate = require('../middleware/authenticate');
const { success, fail } = require('../utils/response');
const pool = require('../config/db');
const { queueEmail } = require('../services/emailService');

const router = express.Router();
router.use(authenticate);

// Get all offboarding records
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT o.*, u.first_name, u.last_name, u.email, u.status as user_status
      FROM employee_offboarding o
      JOIN users u ON u.id = o.user_id
      WHERE o.tenant_id = $1
      ORDER BY o.created_at DESC
    `, [req.tenantId]);
    return success(res, rows);
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch offboarding records', 500);
  }
});

// Initiate offboarding
router.post('/initiate', async (req, res) => {
  const { user_id, resignation_date, last_working_day } = req.body;
  
  if (!user_id || !resignation_date || !last_working_day) {
    return fail(res, 'BAD_REQUEST', 'Missing required fields', 400);
  }

  try {
    // Check if already offboarding
    const existing = await pool.query('SELECT id FROM employee_offboarding WHERE user_id = $1 AND tenant_id = $2', [user_id, req.tenantId]);
    if (existing.rows.length > 0) {
      return fail(res, 'CONFLICT', 'Employee is already in offboarding process', 409);
    }

    const { rows } = await pool.query(`
      INSERT INTO employee_offboarding (tenant_id, user_id, resignation_date, last_working_day, status)
      VALUES ($1, $2, $3, $4, 'pending_manager')
      RETURNING *
    `, [req.tenantId, user_id, resignation_date, last_working_day]);

    return success(res, rows[0]);
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', 'Failed to initiate offboarding', 500);
  }
});

// Manager Approve
router.put('/:id/manager-approve', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      UPDATE employee_offboarding
      SET manager_approved_at = CURRENT_TIMESTAMP, status = 'pending_hr', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `, [req.params.id, req.tenantId]);
    if (!rows.length) return fail(res, 'NOT_FOUND', 'Record not found', 404);
    return success(res, rows[0]);
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', 'Failed to update', 500);
  }
});

// HR Approve
router.put('/:id/hr-approve', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      UPDATE employee_offboarding
      SET hr_approved_at = CURRENT_TIMESTAMP, status = 'active_transfer', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `, [req.params.id, req.tenantId]);
    if (!rows.length) return fail(res, 'NOT_FOUND', 'Record not found', 404);
    return success(res, rows[0]);
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', 'Failed to update', 500);
  }
});

// Update Checklist Step
router.put('/:id/step', async (req, res) => {
  const { knowledge_transfer_done, project_transfer_done, task_transfer_done, assets_returned } = req.body;
  try {
    const current = await pool.query('SELECT * FROM employee_offboarding WHERE id=$1 AND tenant_id=$2', [req.params.id, req.tenantId]);
    if (!current.rows.length) return fail(res, 'NOT_FOUND', 'Record not found', 404);
    
    let nextStatus = current.rows[0].status;
    const kt = knowledge_transfer_done ?? current.rows[0].knowledge_transfer_done;
    const pt = project_transfer_done ?? current.rows[0].project_transfer_done;
    const tt = task_transfer_done ?? current.rows[0].task_transfer_done;
    const ar = assets_returned ?? current.rows[0].assets_returned;

    if (kt && pt && tt) {
      if (ar) {
        nextStatus = 'completed';
      } else {
        nextStatus = 'pending_asset_return';
      }
    } else {
      nextStatus = 'active_transfer';
    }

    const { rows } = await pool.query(`
      UPDATE employee_offboarding
      SET knowledge_transfer_done = $1, project_transfer_done = $2, task_transfer_done = $3, assets_returned = $4, status = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 AND tenant_id = $7
      RETURNING *
    `, [kt, pt, tt, ar, nextStatus, req.params.id, req.tenantId]);

    return success(res, rows[0]);
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', 'Failed to update step', 500);
  }
});

// Finalize (Disable Account & Archive)
router.post('/:id/finalize', async (req, res) => {
  try {
    await pool.query('BEGIN');
    
    const off = await pool.query('SELECT user_id FROM employee_offboarding WHERE id=$1 AND tenant_id=$2', [req.params.id, req.tenantId]);
    if (!off.rows.length) throw new Error('NOT_FOUND');

    // Archive employee in users table (status = inactive)
    await pool.query(`UPDATE users SET status = 'inactive', is_locked = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2`, [off.rows[0].user_id, req.tenantId]);
    
    const { rows } = await pool.query(`
      UPDATE employee_offboarding
      SET status = 'archived', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `, [req.params.id, req.tenantId]);
    
    await pool.query('COMMIT');
    return success(res, rows[0]);
  } catch (error) {
    await pool.query('ROLLBACK');
    if (error.message === 'NOT_FOUND') return fail(res, 'NOT_FOUND', 'Record not found', 404);
    return fail(res, 'INTERNAL_ERROR', 'Failed to finalize', 500);
  }
});

module.exports = router;
