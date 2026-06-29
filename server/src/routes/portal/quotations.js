const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const authenticatePortal = require('../../middleware/authenticatePortal');
const quotationService = require('../../services/projects/quotationService');

router.use(authenticatePortal);

// GET /api/portal/quotations
router.get('/', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;

    const query = `
      SELECT q.id, q.lead_id, q.project_id, q.quotation_number, q.version, q.status, q.notes, q.terms_conditions, q.valid_until, q.total_amount, q.change_reason, q.created_at, q.updated_at, u.name as creator_name 
      FROM quotations q
      LEFT JOIN users u ON q.created_by = u.id
      WHERE q.project_id = $1 AND q.tenant_id = $2 AND q.status != 'draft'
      ORDER BY q.version DESC, q.created_at DESC
    `;
    const result = await pool.query(query, [projectId, tenantId]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/portal/quotations/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;
    const { id } = req.params;

    // Validate that the quotation belongs to the client's project
    const checkRes = await pool.query(
      'SELECT id, status FROM quotations WHERE id = $1 AND project_id = $2 AND tenant_id = $3',
      [id, projectId, tenantId]
    );

    if (checkRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    if (checkRes.rows[0].status === 'draft') {
      return res.status(403).json({ success: false, message: 'Access denied to draft quotation' });
    }

    const quotation = await quotationService.getQuotationWithItems(tenantId, id);
    res.json({ success: true, data: quotation });
  } catch (error) {
    next(error);
  }
});

// GET /api/portal/quotations/:id/compare/:targetId
router.get('/:id/compare/:targetId', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;
    const { id, targetId } = req.params;

    // Verify both quotations belong to the client's project and are not draft
    const verifyRes = await pool.query(
      `SELECT id, status FROM quotations 
       WHERE id IN ($1, $2) AND project_id = $3 AND tenant_id = $4`,
      [id, targetId, projectId, tenantId]
    );

    const hasDraft = verifyRes.rows.some(q => q.status === 'draft');
    if (hasDraft) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (id === targetId) {
      if (verifyRes.rows.length !== 1) {
        return res.status(404).json({ success: false, message: 'Quotation not found' });
      }
    } else {
      if (verifyRes.rows.length < 2) {
        return res.status(404).json({ success: false, message: 'One or both quotations not found' });
      }
    }

    const comparison = await quotationService.compareQuotations(tenantId, id, targetId);
    res.json({ success: true, data: comparison });
  } catch (error) {
    next(error);
  }
});

// POST /api/portal/quotations/:id/accept
router.post('/:id/accept', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;
    const { id } = req.params;

    // Validate that the quotation belongs to the client's project and is in 'sent' status
    const checkRes = await pool.query(
      `SELECT id, status 
       FROM quotations 
       WHERE id = $1 AND project_id = $2 AND tenant_id = $3`,
      [id, projectId, tenantId]
    );

    if (checkRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    if (checkRes.rows[0].status !== 'sent') {
      return res.status(400).json({ success: false, message: 'Only sent quotations can be accepted' });
    }

    const accepted = await quotationService.acceptQuotation(tenantId, id);
    res.json({ success: true, data: accepted, message: 'Quotation accepted successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/portal/quotations/:id/reject
router.post('/:id/reject', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;
    const { id } = req.params;

    // Validate that the quotation belongs to the client's project and is in 'sent' status
    const checkRes = await pool.query(
      `SELECT id, status 
       FROM quotations 
       WHERE id = $1 AND project_id = $2 AND tenant_id = $3`,
      [id, projectId, tenantId]
    );

    if (checkRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    if (checkRes.rows[0].status !== 'sent') {
      return res.status(400).json({ success: false, message: 'Only sent quotations can be rejected' });
    }

    const rejected = await quotationService.rejectQuotation(tenantId, id);
    res.json({ success: true, data: rejected, message: 'Quotation rejected successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
