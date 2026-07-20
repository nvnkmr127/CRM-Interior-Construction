const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const authenticate = require('../middleware/authenticate');
const { fail, success } = require('../utils/response');

router.use(authenticate);

// Get all approval matrix rules
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM approval_matrix 
       WHERE tenant_id = $1 
       ORDER BY transaction_type ASC, min_amount ASC`,
      [req.user.tenant_id]
    );
    success(res, 'Rules fetched successfully', result.rows);
  } catch (err) {
    console.error(err);
    fail(res, 'SERVER_ERROR', 'Failed to fetch rules', 500);
  }
});

// Create a new rule
router.post('/', async (req, res) => {
  const {
    transaction_type,
    min_amount,
    max_amount,
    department,
    branch,
    required_roles,
    priority,
    effective_date,
    expiry_date,
    validation_rules,
    is_active
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO approval_matrix (
        tenant_id, transaction_type, min_amount, max_amount, 
        department, branch, required_roles, priority, 
        effective_date, expiry_date, validation_rules, is_active, created_by, approval_levels
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        req.user.tenant_id,
        transaction_type,
        min_amount || 0,
        max_amount || null,
        department || null,
        branch || null,
        JSON.stringify(required_roles || []),
        priority || null,
        effective_date || null,
        expiry_date || null,
        validation_rules ? JSON.stringify(validation_rules) : null,
        is_active !== undefined ? is_active : true,
        req.user.id,
        (required_roles || []).length
      ]
    );

    success(res, 'Rule created successfully', result.rows[0], 201);
  } catch (err) {
    console.error(err);
    fail(res, 'SERVER_ERROR', 'Failed to create rule', 500);
  }
});

// Update an existing rule
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    transaction_type,
    min_amount,
    max_amount,
    department,
    branch,
    required_roles,
    priority,
    effective_date,
    expiry_date,
    validation_rules,
    is_active
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE approval_matrix SET
        transaction_type = COALESCE($1, transaction_type),
        min_amount = COALESCE($2, min_amount),
        max_amount = $3,
        department = $4,
        branch = $5,
        required_roles = COALESCE($6, required_roles),
        priority = $7,
        effective_date = $8,
        expiry_date = $9,
        validation_rules = $10,
        is_active = COALESCE($11, is_active),
        approval_levels = COALESCE($12, approval_levels),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $13 AND tenant_id = $14
      RETURNING *`,
      [
        transaction_type,
        min_amount,
        max_amount,
        department,
        branch,
        required_roles ? JSON.stringify(required_roles) : null,
        priority,
        effective_date,
        expiry_date,
        validation_rules ? JSON.stringify(validation_rules) : null,
        is_active,
        required_roles ? required_roles.length : null,
        id,
        req.user.tenant_id
      ]
    );

    if (result.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Rule not found', 404);
    }

    success(res, 'Rule updated successfully', result.rows[0]);
  } catch (err) {
    console.error(err);
    fail(res, 'SERVER_ERROR', 'Failed to update rule', 500);
  }
});

// Delete a rule
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `DELETE FROM approval_matrix WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [id, req.user.tenant_id]
    );

    if (result.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Rule not found', 404);
    }

    success(res, 'Rule deleted successfully');
  } catch (err) {
    console.error(err);
    fail(res, 'SERVER_ERROR', 'Failed to delete rule', 500);
  }
});

module.exports = router;
