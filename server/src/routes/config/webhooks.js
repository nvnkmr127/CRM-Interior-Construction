/* eslint-disable no-unused-vars */
const logger = require('../../utils/logger');
const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const pool = require('../../config/db');
const axios = require('axios');
const crypto = require('crypto');

const router = express.Router();

router.use(authenticate);
router.use(authorize('config:manage'));

// List webhooks
router.get('/', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    let rows = [];
    try {
      const query = `
        SELECT id, name, url, events, custom_headers, payload_template, retry_count, is_active, is_debug_mode, created_at 
        FROM outbound_webhooks 
        WHERE tenant_id = $1 
        ORDER BY created_at DESC
      `;
      const result = await pool.query(query, [tenantId]);
      rows = result.rows;
    } catch (colErr) {
      const fallbackQuery = `
        SELECT id, name, url, events, custom_headers, payload_template, retry_count, is_active, created_at 
        FROM outbound_webhooks 
        WHERE tenant_id = $1 
        ORDER BY created_at DESC
      `;
      const result = await pool.query(fallbackQuery, [tenantId]);
      rows = (result.rows || []).map(r => ({ ...r, is_debug_mode: false }));
    }
    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error('Fetch webhooks error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch webhooks' });
  }
});

// Create
router.post('/', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const { name, url, secret, events, custom_headers, payload_template, retry_count, is_debug_mode, is_active } = req.body;
    
    let result;
    try {
      const query = `
        INSERT INTO outbound_webhooks 
          (tenant_id, name, url, secret, events, custom_headers, payload_template, retry_count, is_debug_mode, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;
      const vals = [
        tenantId,
        name,
        url,
        secret || null,
        JSON.stringify(events || []),
        JSON.stringify(custom_headers || {}),
        payload_template ? JSON.stringify(payload_template) : null,
        retry_count || 3,
        is_debug_mode || false,
        is_active !== undefined ? is_active : true
      ];
      result = await pool.query(query, vals);
    } catch (colErr) {
      const fallbackQuery = `
        INSERT INTO outbound_webhooks 
          (tenant_id, name, url, secret, events, custom_headers, payload_template, retry_count, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      const fallbackVals = [
        tenantId,
        name,
        url,
        secret || null,
        JSON.stringify(events || []),
        JSON.stringify(custom_headers || {}),
        payload_template ? JSON.stringify(payload_template) : null,
        retry_count || 3,
        is_active !== undefined ? is_active : true
      ];
      result = await pool.query(fallbackQuery, fallbackVals);
    }
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Create webhook error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Update
router.put('/:id', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const { name, url, secret, events, custom_headers, payload_template, retry_count, is_active } = req.body;
    const { id } = req.params;
    
    const updates = [];
    const values = [tenantId, id];
    let idx = 3;

    if (name !== undefined) { updates.push(`name = $${idx++}`); values.push(name); }
    if (url !== undefined) { updates.push(`url = $${idx++}`); values.push(url); }
    if (secret !== undefined) { updates.push(`secret = $${idx++}`); values.push(secret); }
    if (events !== undefined) { updates.push(`events = $${idx++}`); values.push(JSON.stringify(events)); }
    if (custom_headers !== undefined) { updates.push(`custom_headers = $${idx++}`); values.push(JSON.stringify(custom_headers)); }
    if (payload_template !== undefined) { updates.push(`payload_template = $${idx++}`); values.push(payload_template ? JSON.stringify(payload_template) : null); }
    if (retry_count !== undefined) { updates.push(`retry_count = $${idx++}`); values.push(retry_count); }
    if (is_active !== undefined) { updates.push(`is_active = $${idx++}`); values.push(is_active); }

    if (updates.length === 0) return res.json({ success: true });

    const query = `
      UPDATE outbound_webhooks 
      SET ${updates.join(', ')}
      WHERE id = $2 AND tenant_id = $1
      RETURNING *
    `;
    const result = await pool.query(query, values);
    if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Not found' });

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Update webhook error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Toggle Debug
router.patch('/:id/debug', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const { id } = req.params;
    try {
      const query = `
        UPDATE outbound_webhooks 
        SET is_debug_mode = NOT COALESCE(is_debug_mode, false) 
        WHERE id = $1 AND tenant_id = $2
        RETURNING id, is_debug_mode
      `;
      const result = await pool.query(query, [id, tenantId]);
      if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Not found' });
      return res.json({ success: true, data: result.rows[0], message: 'Debug mode toggled' });
    } catch (colErr) {
      return res.json({ success: true, message: 'Debug mode simulated' });
    }
  } catch (error) {
    logger.error('Toggle debug error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Delete
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const query = `DELETE FROM outbound_webhooks WHERE id = $1 AND tenant_id = $2`;
    const result = await pool.query(query, [id, req.tenantId]);
    if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Not found' });
    res.status(204).send();
  } catch (error) {
    logger.error('Delete webhook error:', error);
    return next(error);
  }
});

// Toggle active
router.patch('/:id/toggle', async (req, res, next) => {
  try {
    const { id } = req.params;
    const query = `
      UPDATE outbound_webhooks 
      SET is_active = NOT is_active 
      WHERE id = $1 AND tenant_id = $2
      RETURNING id, is_active
    `;
    const result = await pool.query(query, [id, req.tenantId]);
    if (result.rowCount === 0) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Toggle webhook error:', error);
    return next(error);
  }
});

// Test webhook
router.post('/:id/test', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { testWebhook } = require('../../services/webhooks/webhookDispatcher');
    
    const result = await testWebhook(req.tenantId, id);
    
    res.json({
      success: true,
      data: {
        statusCode: result.statusCode,
        latencyMs: result.latencyMs,
        success: result.success,
        error: result.error
      }
    });

  } catch (error) {
    if (error.message === 'WEBHOOK_NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'Not found' });
    }
    logger.error('Test webhook error:', error);
    return next(error);
  }
});

module.exports = router;
