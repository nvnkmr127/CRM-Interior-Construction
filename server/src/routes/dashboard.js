const express = require('express');
const authenticate = require('../middleware/authenticate');
const { success, fail } = require('../utils/response');
const db = require('../config/db');
const readPool = db.readPool || db;
const analyticsService = require('../services/analytics/analyticsService');
const { cacheResponse } = require('../middleware/cache');

const router = express.Router();

router.use(authenticate);

// Cache stats for 5 minutes
router.get('/stats', cacheResponse(300), async (req, res) => {
  const tenantId = req.tenantId; // or req.user.tenantId depending on how authenticate works
  const userId = req.user.id;

  try {
    const data = await analyticsService.getGlobalStats(tenantId, userId);


    return success(res, data);
  } catch (error) {
    res.status(500).json(fail('Dashboard stats failed'));
  }
});

router.get('/activity', async (req, res) => {
  const tenantId = req.tenantId;
  const limit = parseInt(req.query.limit, 10) || 10;

  try {
    const { rows } = await readPool.query(`
      SELECT al.*, u.name as user_name, u.avatar_url
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.tenant_id=$1
      ORDER BY al.created_at DESC LIMIT $2
    `, [tenantId, limit]);

    return success(res, rows.map(row => ({
      id: row.id,
      action: row.action,
      entity: row.entity,
      entity_id: row.entity_id,
      user_name: row.user_name,
      avatar_url: row.avatar_url,
      created_at: row.created_at,
      new_value: row.new_value
    })));
  } catch (error) {
    res.status(500).json(fail('Activity fetch failed'));
  }
});

// Cache pipeline for 10 minutes
router.get('/pipeline', cacheResponse(600), async (req, res) => {
  const tenantId = req.tenantId;

  try {
    const { rows } = await readPool.query(`
      SELECT ls.id, ls.name, ls.color, ls.sort_order, COUNT(l.id) as count
      FROM lead_stages ls
      LEFT JOIN leads l ON l.stage_id=ls.id AND l.deleted_at IS NULL AND l.tenant_id=$1
      WHERE ls.tenant_id=$1
      GROUP BY ls.id ORDER BY ls.sort_order
    `, [tenantId]);

    return success(res, rows);
  } catch (error) {
    res.status(500).json(fail('Pipeline fetch failed'));
  }
});

router.get('/my-tasks', async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;
  const limit = parseInt(req.query.limit, 10) || 7;

  try {
    const { rows } = await readPool.query(`
      SELECT t.*, p.name as project_name, p.id as project_id
      FROM tasks t
      JOIN projects p ON p.id=t.project_id
      WHERE t.tenant_id=$1 AND t.assignee_id=$2
      AND t.status!='done' AND t.deleted_at IS NULL
      ORDER BY t.due_date ASC NULLS LAST LIMIT $3
    `, [tenantId, userId, limit]);

    return success(res, rows);
  } catch (error) {
    res.status(500).json(fail('My tasks fetch failed'));
  }
});

// Phase 1: Role-Specific Dashboards
router.get('/sales', cacheResponse(300), async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const userId = req.user && (req.user.id || req.user.userId);
    
    // Aggregate everything for a sales rep in one request
    const data = await analyticsService.getSalesDashboard(tenantId, userId);
    
    // Using responseFormatter via throwing to res.json directly
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/manager', cacheResponse(300), async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    
    // Aggregate everything for a manager in one request
    const data = await analyticsService.getManagerDashboard(tenantId);
    
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/ceo', cacheResponse(300), async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const data = await analyticsService.getCeoDashboard(tenantId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/designer', cacheResponse(300), async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const userId = req.user && (req.user.id || req.user.userId);
    const data = await analyticsService.getDesignerDashboard(tenantId, userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/marketing', cacheResponse(300), async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const data = await analyticsService.getMarketingDashboard(tenantId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/operations', cacheResponse(300), async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const data = await analyticsService.getOperationsDashboard(tenantId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
