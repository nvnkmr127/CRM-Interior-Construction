const express = require('express');
const router = express.Router();
const pool = require('../../db/pool');
const { incrementProjectStageRevision } = require('../../services/projects/revisionTracker');
const authenticatePortal = require('../../middleware/authenticatePortal');

router.use(authenticatePortal);

// GET /api/portal/design-assets
router.get('/', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;

    const { rows: assets } = await pool.query(
      `SELECT id, tenant_id, project_id, title, description, asset_type, status, 
              client_approved_at, client_feedback, created_at, updated_at
       FROM design_assets
       WHERE project_id = $1 AND tenant_id = $2 AND is_visible_to_client = true AND status != 'draft'
       ORDER BY created_at DESC`,
      [projectId, tenantId]
    );

    if (assets.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const assetIds = assets.map(a => a.id);
    const { rows: items } = await pool.query(
      `SELECT * FROM design_asset_items WHERE tenant_id = $1 AND design_asset_id = ANY($2)`,
      [tenantId, assetIds]
    );

    const itemsByAssetId = items.reduce((acc, item) => {
      if (!acc[item.design_asset_id]) {
        acc[item.design_asset_id] = [];
      }
      acc[item.design_asset_id].push(item);
      return acc;
    }, {});

    const result = assets.map(asset => ({
      ...asset,
      items: itemsByAssetId[asset.id] || []
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// GET /api/portal/design-assets/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;
    const { id } = req.params;

    const { rows: assets } = await pool.query(
      `SELECT * FROM design_assets 
       WHERE id = $1 AND project_id = $2 AND tenant_id = $3 AND is_visible_to_client = true AND status != 'draft'`,
      [id, projectId, tenantId]
    );

    if (assets.length === 0) {
      return res.status(404).json({ success: false, message: 'Design asset not found' });
    }

    const { rows: items } = await pool.query(
      `SELECT * FROM design_asset_items WHERE tenant_id = $1 AND design_asset_id = $2`,
      [tenantId, id]
    );

    const asset = assets[0];
    asset.items = items;

    res.json({ success: true, data: asset });
  } catch (error) {
    next(error);
  }
});

// POST /api/portal/design-assets/:id/approve
router.post('/:id/approve', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;
    const { id } = req.params;

    const { rows: existCheck } = await pool.query(
      `SELECT id FROM design_assets 
       WHERE id = $1 AND project_id = $2 AND tenant_id = $3 AND is_visible_to_client = true AND status != 'draft'`,
      [id, projectId, tenantId]
    );

    if (existCheck.length === 0) {
      return res.status(404).json({ success: false, message: 'Design asset not found' });
    }

    const query = `
      UPDATE design_assets 
      SET status = 'approved', client_approved_at = NOW(), client_feedback = NULL, updated_at = NOW()
      WHERE id = $1 AND project_id = $2 AND tenant_id = $3
      RETURNING *
    `;

    const { rows } = await pool.query(query, [id, projectId, tenantId]);
    res.json({ success: true, data: rows[0], message: 'Design asset approved successfully.' });
  } catch (error) {
    next(error);
  }
});

// POST /api/portal/design-assets/:id/revision
router.post('/:id/revision', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;
    const { id } = req.params;
    const { feedback } = req.body;

    if (!feedback || !feedback.trim()) {
      return res.status(400).json({ success: false, message: 'Feedback/revision request is required' });
    }

    const { rows: existCheck } = await pool.query(
      `SELECT id FROM design_assets 
       WHERE id = $1 AND project_id = $2 AND tenant_id = $3 AND is_visible_to_client = true AND status != 'draft'`,
      [id, projectId, tenantId]
    );

    if (existCheck.length === 0) {
      return res.status(404).json({ success: false, message: 'Design asset not found' });
    }

    // Begin a transaction or perform both updates
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const updateAssetQuery = `
        UPDATE design_assets 
        SET status = 'revision_requested', client_feedback = $4, updated_at = NOW()
        WHERE id = $1 AND project_id = $2 AND tenant_id = $3
        RETURNING *
      `;
      const { rows } = await client.query(updateAssetQuery, [id, projectId, tenantId, feedback.trim()]);

      await incrementProjectStageRevision(projectId, tenantId, client);

      await client.query('COMMIT');
      res.json({ success: true, data: rows[0], message: 'Revision requested successfully.' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
