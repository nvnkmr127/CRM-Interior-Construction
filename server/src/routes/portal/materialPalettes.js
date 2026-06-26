const express = require('express');
const router = express.Router();
const pool = require('../../db/pool');
const authenticatePortal = require('../../middleware/authenticatePortal');

router.use(authenticatePortal);

// GET /api/portal/material-palettes
router.get('/', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;

    const query = `
      SELECT id, tenant_id, project_id, room_name, item_name, brand, shade_code, finish, 
             image_url, status, client_feedback, client_approved_at, created_at, updated_at
      FROM project_material_palettes
      WHERE project_id = $1 AND tenant_id = $2
      ORDER BY room_name ASC, created_at DESC
    `;

    const { rows } = await pool.query(query, [projectId, tenantId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/portal/material-palettes/:id/approve
router.post('/:id/approve', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;
    const { id } = req.params;

    const query = `
      UPDATE project_material_palettes
      SET status = 'approved', client_approved_at = NOW(), client_feedback = NULL, updated_at = NOW()
      WHERE id = $1 AND project_id = $2 AND tenant_id = $3
      RETURNING *
    `;

    const { rows } = await pool.query(query, [id, projectId, tenantId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Material item not found' });
    }

    res.json({ success: true, data: rows[0], message: 'Material item approved successfully.' });
  } catch (error) {
    next(error);
  }
});

// POST /api/portal/material-palettes/:id/revision
router.post('/:id/revision', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;
    const { id } = req.params;
    const { feedback } = req.body;

    if (!feedback || !feedback.trim()) {
      return res.status(400).json({ success: false, message: 'Revision feedback is required' });
    }

    const query = `
      UPDATE project_material_palettes
      SET status = 'revision_requested', client_feedback = $4, updated_at = NOW()
      WHERE id = $1 AND project_id = $2 AND tenant_id = $3
      RETURNING *
    `;

    const { rows } = await pool.query(query, [id, projectId, tenantId, feedback.trim()]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Material item not found' });
    }

    res.json({ success: true, data: rows[0], message: 'Revision requested successfully.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
