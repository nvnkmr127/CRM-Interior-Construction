const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const authenticatePortal = require('../../middleware/authenticatePortal');

router.use(authenticatePortal);

// GET /api/portal/change-orders
router.get('/', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;

    const { rows } = await pool.query(
      `SELECT id, tenant_id, project_id, title, description, amount, status, created_at, updated_at
       FROM project_change_orders
       WHERE project_id = $1 AND tenant_id = $2
       ORDER BY created_at DESC`,
      [projectId, tenantId]
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/portal/change-orders/:id/approve
router.post('/:id/approve', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;
    const { id } = req.params;

    const { rows } = await pool.query(
      `UPDATE project_change_orders
       SET status = 'approved', updated_at = NOW()
       WHERE id = $1 AND project_id = $2 AND tenant_id = $3
       RETURNING *`,
      [id, projectId, tenantId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Change order not found' });
    }

    res.json({ success: true, data: rows[0], message: 'Change order approved successfully.' });
  } catch (error) {
    next(error);
  }
});

// POST /api/portal/change-orders/:id/reject
router.post('/:id/reject', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;
    const { id } = req.params;

    const { rows } = await pool.query(
      `UPDATE project_change_orders
       SET status = 'rejected', updated_at = NOW()
       WHERE id = $1 AND project_id = $2 AND tenant_id = $3
       RETURNING *`,
      [id, projectId, tenantId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Change order not found' });
    }

    res.json({ success: true, data: rows[0], message: 'Change order rejected.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
