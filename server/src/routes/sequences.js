const express = require('express');
const authenticate = require('../middleware/authenticate');
const { success, fail } = require('../utils/response');
const pool = require('../config/db');

const router = express.Router();

router.use(authenticate);

// Get sequences for a lead
router.get('/lead/:leadId', async (req, res, next) => {
  try {
    const { leadId } = req.params;
    const tenantId = req.tenantId || req.user.tenantId;

    const { rows } = await pool.query(
      'SELECT * FROM automated_sequences WHERE lead_id = $1 AND tenant_id = $2 ORDER BY created_at DESC',
      [leadId, tenantId]
    );

    return success(res, rows);
  } catch (error) {
    next(error);
  }
});

// Start a sequence
router.post('/lead/:leadId', async (req, res, next) => {
  try {
    const { leadId } = req.params;
    const tenantId = req.tenantId || req.user.tenantId;
    const { trigger_event } = req.body;

    const result = await pool.query(
      `INSERT INTO automated_sequences (tenant_id, lead_id, trigger_event, status, next_run_at)
       VALUES ($1, $2, $3, 'active', NOW() + INTERVAL '1 hour')
       RETURNING *`,
      [tenantId, leadId, trigger_event || 'manual_start']
    );

    return success(res, result.rows[0], {}, 201);
  } catch (error) {
    next(error);
  }
});

// Stop a sequence
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId || req.user.tenantId;

    await pool.query(
      `UPDATE automated_sequences SET status = 'paused' WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    return success(res, { message: 'Sequence paused' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
