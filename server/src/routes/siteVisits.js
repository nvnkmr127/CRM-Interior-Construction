const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const pool = require('../db/pool');
const { success, fail } = require('../utils/response');

// Get all site visits for a lead
router.get('/lead/:leadId', authenticate, async (req, res, next) => {
  try {
    const { leadId } = req.params;
    const tenantId = req.tenantId || req.user.tenantId;

    const query = `
      SELECT sv.*, u.name as assignee_name
      FROM site_visits sv
      LEFT JOIN users u ON sv.assignee_id = u.id
      WHERE sv.tenant_id = $1 AND sv.lead_id = $2
      ORDER BY sv.scheduled_at DESC
    `;
    const result = await pool.query(query, [tenantId, leadId]);
    
    // For simplicity, returning empty array if no visits
    return success(res, result.rows);
  } catch (error) {
    next(error);
  }
});

// Create a new site visit
router.post('/lead/:leadId', authenticate, async (req, res, next) => {
  try {
    const { leadId } = req.params;
    const tenantId = req.tenantId || req.user.tenantId;
    const { scheduled_at, assignee_id, notes, checklist } = req.body;

    const query = `
      INSERT INTO site_visits (tenant_id, lead_id, assignee_id, scheduled_at, notes, checklist)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await pool.query(query, [
      tenantId, leadId, assignee_id || req.user.userId, scheduled_at, notes, JSON.stringify(checklist || [])
    ]);

    return success(res, result.rows[0], {}, 201);
  } catch (error) {
    next(error);
  }
});

// Update a site visit (Check-in, complete, add measurements)
router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId || req.user.tenantId;
    const { status, gps_coordinates, measurements, notes, completed_at, customer_signature_url } = req.body;

    const query = `
      UPDATE site_visits 
      SET status = COALESCE($1, status),
          gps_coordinates = COALESCE($2, gps_coordinates),
          measurements = COALESCE($3, measurements),
          notes = COALESCE($4, notes),
          completed_at = COALESCE($5, completed_at),
          customer_signature_url = COALESCE($6, customer_signature_url),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 AND tenant_id = $8
      RETURNING *
    `;
    const result = await pool.query(query, [
      status, 
      gps_coordinates ? JSON.stringify(gps_coordinates) : null,
      measurements ? JSON.stringify(measurements) : null,
      notes, 
      completed_at, 
      customer_signature_url,
      id, tenantId
    ]);

    if (result.rows.length === 0) return fail(res, 'NOT_FOUND', 'Site visit not found', 404);
    
    return success(res, result.rows[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
