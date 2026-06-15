const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const pool = require('../config/db');
const { retryLog } = require('../services/webhooks/webhookDispatcher');
const { success, fail, paginate } = require('../utils/response');

const router = express.Router();

router.use(authenticate);

// GET /api/logs/webhook-events
router.get('/webhook-events', authorize('logs:read'), async (req, res) => {
  try {
    const { webhookId, status, event, from, to, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    
    let query = `SELECT * FROM webhook_logs WHERE tenant_id = $1`;
    const values = [req.tenantId];
    let countQuery = `SELECT COUNT(*) FROM webhook_logs WHERE tenant_id = $1`;
    let idx = 2;

    if (webhookId) {
      query += ` AND webhook_id = $${idx}`;
      countQuery += ` AND webhook_id = $${idx}`;
      values.push(webhookId);
      idx++;
    }
    if (status) {
      if (status === 'success') {
        query += ` AND status_code >= 200 AND status_code < 300`;
        countQuery += ` AND status_code >= 200 AND status_code < 300`;
      } else if (status === 'error') {
        query += ` AND (status_code < 200 OR status_code >= 300)`;
        countQuery += ` AND (status_code < 200 OR status_code >= 300)`;
      }
    }
    if (event) {
      query += ` AND event = $${idx}`;
      countQuery += ` AND event = $${idx}`;
      values.push(event);
      idx++;
    }
    if (from) {
      query += ` AND created_at >= $${idx}`;
      countQuery += ` AND created_at >= $${idx}`;
      values.push(from);
      idx++;
    }
    if (to) {
      query += ` AND created_at <= $${idx}`;
      countQuery += ` AND created_at <= $${idx}`;
      values.push(to);
      idx++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
    const result = await pool.query(query, [...values, parseInt(limit, 10), offset]);
    const countResult = await pool.query(countQuery, values);
    
    const total = parseInt(countResult.rows[0].count, 10);
    
    return paginate(res, result.rows, total, parseInt(page, 10), parseInt(limit, 10));
  } catch (error) {
    console.error('Webhook logs error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch logs', 500);
  }
});

// GET /api/logs/inbound
router.get('/inbound', authorize('logs:read'), async (req, res) => {
  try {
    const { sourceKey, status, from, to, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    let query = `SELECT * FROM inbound_webhook_logs WHERE tenant_id = $1`;
    const values = [req.tenantId];
    let countQuery = `SELECT COUNT(*) FROM inbound_webhook_logs WHERE tenant_id = $1`;
    let idx = 2;

    if (sourceKey) {
      query += ` AND source_key = $${idx}`;
      countQuery += ` AND source_key = $${idx}`;
      values.push(sourceKey);
      idx++;
    }
    if (status) {
      query += ` AND status = $${idx}`;
      countQuery += ` AND status = $${idx}`;
      values.push(status);
      idx++;
    }
    if (from) {
      query += ` AND created_at >= $${idx}`;
      countQuery += ` AND created_at >= $${idx}`;
      values.push(from);
      idx++;
    }
    if (to) {
      query += ` AND created_at <= $${idx}`;
      countQuery += ` AND created_at <= $${idx}`;
      values.push(to);
      idx++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
    const result = await pool.query(query, [...values, parseInt(limit, 10), offset]);
    const countResult = await pool.query(countQuery, values);
    
    const total = parseInt(countResult.rows[0].count, 10);
    
    return paginate(res, result.rows, total, parseInt(page, 10), parseInt(limit, 10));
  } catch (error) {
    console.error('Inbound logs error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch inbound logs', 500);
  }
});

// POST /api/logs/webhook-events/:id/retry
router.post('/webhook-events/:id/retry', authorize('config:manage'), async (req, res) => {
  try {
    const { id } = req.params;
    const { success: retrySuccess, statusCode } = await retryLog(req.tenantId, id);
    
    return success(res, { success: retrySuccess, statusCode });
  } catch (error) {
    if (error.message === 'NOT_FOUND' || error.message === 'WEBHOOK_NOT_FOUND') {
      return fail(res, 'NOT_FOUND', error.message, 404);
    }
    console.error('Webhook retry error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to retry webhook', 500);
  }
});

module.exports = router;
