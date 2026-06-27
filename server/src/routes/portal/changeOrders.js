const express = require('express');
const router = express.Router();
const pool = require('../../config/db');
const authenticatePortal = require('../../middleware/authenticatePortal');
const quotationService = require('../../services/projects/quotationService');

router.use(authenticatePortal);

// GET /api/portal/change-orders
router.get('/', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;

    const { rows } = await pool.query(
      `SELECT id, tenant_id, project_id, title, description, reason, amount, timeline_impact_days, status, client_signature, client_signed_at, created_at, updated_at
       FROM project_change_orders
       WHERE project_id = $1 AND tenant_id = $2 AND status != 'draft'
       ORDER BY created_at DESC`,
      [projectId, tenantId]
    );

    // Fetch linked items for these change orders
    if (rows.length > 0) {
      const coIds = rows.map(co => co.id);
      const { rows: items } = await pool.query(
        `SELECT qi.*, q.quotation_number 
         FROM quotation_items qi
         JOIN quotations q ON qi.quotation_id = q.id
         WHERE qi.change_order_id = ANY($1) AND qi.tenant_id = $2
         ORDER BY qi.sort_order ASC, qi.created_at ASC`,
        [coIds, tenantId]
      );

      // Group items by change_order_id
      rows.forEach(co => {
        co.items = items.filter(item => item.change_order_id === co.id);
      });
    }

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
    const { signature } = req.body;

    if (!signature || !signature.trim()) {
      return res.status(400).json({ success: false, message: 'Client approval signature is required.' });
    }

    const { rows } = await pool.query(
      `UPDATE project_change_orders
       SET status = 'approved', client_signature = $1, client_signed_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND project_id = $3 AND tenant_id = $4
       RETURNING *`,
      [signature.trim(), id, projectId, tenantId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Change order not found' });
    }

    // Trigger update of quotation totals upon approval to update contract value
    const quoteRes = await pool.query(
      `SELECT id FROM quotations WHERE project_id = $1 AND tenant_id = $2 ORDER BY version DESC, created_at DESC LIMIT 1`,
      [projectId, tenantId]
    );
    if (quoteRes.rows.length > 0) {
      await quotationService.updateQuotationTotals(tenantId, quoteRes.rows[0].id);
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

    // Trigger update of quotation totals to revert any previously approved items if they exist
    const quoteRes = await pool.query(
      `SELECT id FROM quotations WHERE project_id = $1 AND tenant_id = $2 ORDER BY version DESC, created_at DESC LIMIT 1`,
      [projectId, tenantId]
    );
    if (quoteRes.rows.length > 0) {
      await quotationService.updateQuotationTotals(tenantId, quoteRes.rows[0].id);
    }

    res.json({ success: true, data: rows[0], message: 'Change order rejected.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
