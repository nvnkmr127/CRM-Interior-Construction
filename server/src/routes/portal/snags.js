const express = require('express');
const router = express.Router();
const snagService = require('../../services/postSale/snagService');
const authenticatePortal = require('../../middleware/authenticatePortal');

router.use(authenticatePortal);

// GET /api/portal/snags
router.get('/', async (req, res, next) => {
  try {
    const { tenantId, projectId } = req.portalUser;

    const allSnags = await snagService.getSnags({ tenantId, projectId });
    
    // Return public fields only
    const snags = allSnags.map(s => ({
      id: s.id,
      title: s.title,
      category: s.category,
      status: s.status,
      created_at: s.created_at,
      resolved_at: s.resolved_at
    }));

    res.json({ success: true, data: snags });
  } catch (error) {
    next(error);
  }
});

// POST /api/portal/snags
router.post('/', async (req, res, next) => {
  try {
    const { tenantId, projectId } = req.portalUser;
    const { title, description, category, photoKeys } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    const snag = await snagService.createSnag({
      tenantId,
      projectId,
      raisedBy: null,
      raisedByClient: true,
      title,
      description,
      photoKeys: photoKeys || [],
      category
    });

    // Notify staff members in CRM
    const pool = require('../../config/db');
    await pool.query(
      `INSERT INTO notifications (tenant_id, user_id, title, message, type, link)
       SELECT $1, id, 'New Snag Reported by Client', $2, 'snag', $3
       FROM users WHERE tenant_id = $1 AND status = 'active'`,
      [tenantId, `Client reported a new ${category || 'site'} snag: ${title}`, `/projects/${projectId}/snags`]
    ).catch(err => console.error('Notification error:', err));

    res.status(201).json({ success: true, data: snag });
  } catch (error) {
    next(error);
  }
});

// POST /api/portal/snags/:id/verify
router.post('/:id/verify', async (req, res, next) => {
  try {
    const { tenantId, id: clientPortalUserId } = req.portalUser;
    const { id: snagId } = req.params;

    const snag = await snagService.clientVerifySnag({
      tenantId,
      snagId,
      clientPortalUserId
    });

    res.json({ success: true, data: snag });
  } catch (error) {
    if (error.message === 'Snag not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    next(error);
  }
});

module.exports = router;
