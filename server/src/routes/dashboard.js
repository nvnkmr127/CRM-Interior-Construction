const logger = require('../utils/logger');
const express = require('express');
const authenticate = require('../middleware/authenticate');
const { success, fail } = require('../utils/response');
const pool = require('../db/pool');
const { readPool } = pool;
const analyticsService = require('../services/analytics/analyticsService');
const { cacheResponse } = require('../middleware/cache');
const router = express.Router();

router.use(authenticate);

// Cache stats for 5 minutes
router.get('/stats', cacheResponse(300), async (req, res) => {
  const tenantId = req.tenantId || (req.user && req.user.tenantId);
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    const data = await analyticsService.getGlobalStats(tenantId, userId, req.user);

    return success(res, data);
  } catch (error) {
    logger.error('Dashboard stats error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Dashboard stats failed', 500);
  }
});

router.get('/activity', cacheResponse(60), async (req, res) => {
  const tenantId = req.tenantId;
  const limit = parseInt(req.query.limit, 10) || 10;

  try {
    const { rows } = await readPool.query(`
      SELECT al.*, u.name as user_name, u.avatar_url,
             l.name as lead_name,
             p.name as project_name
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      LEFT JOIN leads l ON (al.entity = 'lead' AND al.entity_id = l.id)
      LEFT JOIN projects p ON (al.entity = 'project' AND al.entity_id = p.id)
      WHERE al.tenant_id=$1 AND (
        al.action ILIKE 'lead.%' OR 
        al.action ILIKE 'task.%' OR 
        al.action ILIKE 'project.%' OR 
        al.action ILIKE 'user.%'
      )
      ORDER BY al.created_at DESC LIMIT $2
    `, [tenantId, limit]);

    return success(res, rows.map(row => {
      let parsedNew = row.new_value;
      let parsedOld = row.old_value;
      if (typeof parsedNew === 'string') {
        try { parsedNew = JSON.parse(parsedNew); } catch(e) {}
      }
      if (typeof parsedOld === 'string') {
        try { parsedOld = JSON.parse(parsedOld); } catch(e) {}
      }
      return {
        id: row.id,
        action: row.action,
        entity: row.entity,
        entity_id: row.entity_id,
        user_name: row.user_name,
        avatar_url: row.avatar_url,
        created_at: row.created_at,
        new_value: parsedNew,
        old_value: parsedOld,
        ip_address: row.ip_address,
        browser: row.browser,
        device: row.device,
        location: row.location,
        reason: row.reason,
        lead_name: row.lead_name,
        project_name: row.project_name
      };
    }));
  } catch (error) {
    logger.error('Activity fetch error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Activity fetch failed', 500);
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
    logger.error('Pipeline fetch error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Pipeline fetch failed', 500);
  }
});

router.get('/my-tasks', async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;
  const limit = parseInt(req.query.limit, 10) || 7;

  try {
    const { rows } = await readPool.query(`
      SELECT t.*, 
             p.name as project_name, p.id as project_id,
             l.name as lead_name, l.id as lead_id
      FROM tasks t
      LEFT JOIN projects p ON p.id=t.project_id
      LEFT JOIN leads l ON l.id=t.lead_id
      WHERE t.tenant_id=$1 AND t.assignee_id=$2
      AND t.status!='done' AND t.deleted_at IS NULL
      ORDER BY t.due_date ASC NULLS LAST LIMIT $3
    `, [tenantId, userId, limit]);

    return success(res, rows);
  } catch (error) {
    logger.error('My tasks fetch error:', error);
    return fail(res, 'INTERNAL_ERROR', 'My tasks fetch failed', 500);
  }
});

router.get('/payments-due', async (req, res) => {
  const tenantId = req.tenantId;
  const limit = parseInt(req.query.limit, 10) || 5;

  try {
    const { rows } = await readPool.query(`
      SELECT pm.*, p.name as project_name, m.name as title
      FROM payment_milestones pm
      JOIN projects p ON p.id=pm.project_id
      LEFT JOIN milestones m ON m.id=pm.milestone_id
      WHERE pm.tenant_id=$1 AND pm.status!='paid'
      ORDER BY pm.due_date ASC NULLS LAST LIMIT $2
    `, [tenantId, limit]);

    return success(res, rows);
  } catch (error) {
    logger.error('Payments due fetch error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Payments due fetch failed', 500);
  }
});

// Phase 1: Role-Specific Dashboards
router.get('/sales', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const userId = req.user && (req.user.id || req.user.userId);
    
    // Aggregate everything for a sales rep in one request
    const data = await analyticsService.getSalesDashboard(tenantId, userId, req.user);
    
    // Using responseFormatter via throwing to res.json directly
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/manager', cacheResponse(300), async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    
    // Aggregate everything for a manager in one request
    const data = await analyticsService.getManagerDashboard(tenantId, req.user);
    
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/ceo', cacheResponse(300), async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const data = await analyticsService.getCeoDashboard(tenantId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/designer', cacheResponse(300), async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const userId = req.user && (req.user.id || req.user.userId);
    const data = await analyticsService.getDesignerDashboard(tenantId, userId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/marketing', cacheResponse(300), async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const data = await analyticsService.getMarketingDashboard(tenantId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/operations', cacheResponse(300), async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const data = await analyticsService.getOperationsDashboard(tenantId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/finance', cacheResponse(300), async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const data = await analyticsService.getFinanceDashboard(tenantId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/field-ops', cacheResponse(300), async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const userId = req.user && (req.user.id || req.user.userId);
    const data = await analyticsService.getFieldOperationsDashboard(tenantId, userId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/procurement', cacheResponse(300), async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const data = await analyticsService.getProcurementDashboard(tenantId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
