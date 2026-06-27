const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const authenticatePortal = require('../../middleware/authenticatePortal');
const materialSubstitutionService = require('../../services/projects/materialSubstitutionService');

router.use(authenticatePortal);

// GET /api/portal/material-substitutions
router.get('/', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;

    const query = `
      SELECT ms.*, 
             qi.item_name as original_item_name, 
             qi.room_or_area as original_room_or_area, 
             qi.unit_price as original_unit_price, 
             qi.brand as original_brand, 
             qi.material_specifications as original_material_specifications,
             q.quotation_number,
             q.version as quotation_version
      FROM material_substitutions ms
      JOIN quotation_items qi ON ms.boq_item_id = qi.id
      JOIN quotations q ON qi.quotation_id = q.id
      WHERE ms.project_id = $1 AND ms.tenant_id = $2
      ORDER BY ms.created_at DESC
    `;
    const { rows } = await pool.query(query, [projectId, tenantId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/portal/material-substitutions/:id/respond
router.post('/:id/respond', async (req, res, next) => {
  try {
    const { projectId, tenantId, id: userId } = req.portalUser;
    const { id } = req.params;
    const { status, feedback, signatureName, signatureData } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid response status. Must be approved or rejected.' });
    }

    if (status === 'approved' && (!signatureName || !signatureName.trim())) {
      return res.status(400).json({ success: false, message: 'Client approval signature name is required.' });
    }

    const updatedSub = await materialSubstitutionService.respondToSubstitution(tenantId, userId, projectId, id, {
      clientApprovalStatus: status,
      clientFeedback: feedback,
      clientSignoffName: signatureName ? signatureName.trim() : null,
      clientSignatureData: signatureData || null
    });

    res.json({ success: true, data: updatedSub, message: `Material substitution ${status} successfully.` });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
