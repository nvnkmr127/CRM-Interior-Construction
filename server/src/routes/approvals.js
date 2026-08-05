/* eslint-disable no-unused-vars */
const logger = require('../utils/logger');
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authorize } = require('../middleware/authorize');
// Helper to determine table based on module
const getTableForModule = (module) => {
  const map = {
    'quotations': 'quotations',
    'purchase_orders': 'purchase_orders',
    'invoices': 'invoices',
    'vendor_bills': 'vendor_bills',
    'payments': 'payments',
    'vendors': 'vendors',
    'material_requests': 'material_requests',
    'change_orders': 'change_orders',
    'design_reviews': 'design_reviews',
    'discounts': 'discount_approvals',
  };
  return map[module];
};

// Generic Approve/Reject Endpoint
// The authorize middleware will dynamically check if user has <module>:approve permission
// Example: POST /api/approvals/quotations/123-uuid/approve
router.post('/:module/:id/:action', async (req, res, next) => {
  const { module, id, action } = req.params;
  const { comments } = req.body;
  const tenantId = req.user.tenant_id;
  const userId = req.user.id;

  // action can be 'approve' or 'reject'
  if (!['approve', 'reject', 'request'].includes(action)) {
    return res.status(400).json({ success: false, message: 'Invalid action' });
  }

  const table = getTableForModule(module);
  if (!table) {
    return res.status(400).json({ success: false, message: 'Invalid module for approval' });
  }

  const statusMap = {
    'approve': 'approved',
    'reject': 'rejected',
    'request': 'pending'
  };
  const newStatus = statusMap[action];

  try {
    // 1. Manually check permission since authorize middleware might be tricky with dynamic route param
    // Wait, we can just check req.user.permissions here or use the middleware in the app.js.
    // For safety, we verify here:
    const hasPermission = req.user.role?.name === 'superadmin' || 
                          (req.user.permissions && (req.user.permissions.includes('*') || req.user.permissions.includes(`${module}:approve`)));
    
    if (!hasPermission && action !== 'request') {
      return res.status(403).json({ success: false, message: 'Access denied: You do not have approval rights for this module.' });
    }

    await pool.query('BEGIN');

    // 2. Update Entity Status
    const updateQuery = `
      UPDATE ${table} 
      SET approval_status = $1 
      WHERE id = $2 AND tenant_id = $3 
      RETURNING id
    `;
    const updateRes = await pool.query(updateQuery, [newStatus, id, tenantId]);

    if (updateRes.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    // 3. Log into approval_logs
    const logQuery = `
      INSERT INTO approval_logs (tenant_id, entity_type, entity_id, action, actor_id, comments)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    await pool.query(logQuery, [tenantId, module, id, newStatus, userId, comments || null]);

    await pool.query('COMMIT');
    res.json({ success: true, message: `Successfully ${newStatus}`, data: { status: newStatus } });

  } catch (error) {
    await pool.query('ROLLBACK');
    logger.error('Approval Error:', error);
    return next(error);
  }
});

// Get Approval History for an Entity
router.get('/:module/:id/history', async (req, res, next) => {
  const { module, id } = req.params;
  const tenantId = req.user.tenant_id;

  try {
    const query = `
      SELECT a.*, u.name as actor_name, u.email as actor_email
      FROM approval_logs a
      LEFT JOIN users u ON a.actor_id = u.id
      WHERE a.entity_type = $1 AND a.entity_id = $2 AND a.tenant_id = $3
      ORDER BY a.created_at DESC
    `;
    const { rows } = await pool.query(query, [module, id, tenantId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error('Approval History Error:', error);
    return next(error);
  }
});

module.exports = router;
