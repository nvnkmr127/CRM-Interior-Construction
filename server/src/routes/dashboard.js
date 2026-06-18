const express = require('express');
const authenticate = require('../middleware/authenticate');
const { success, fail } = require('../utils/response');
const pool = require('../config/db'); // or '../db/pool' depending on what's available

const router = express.Router();

router.use(authenticate);

router.get('/stats', async (req, res) => {
  const tenantId = req.tenantId; // or req.user.tenantId depending on how authenticate works
  const userId = req.user.id;

  try {
    const [
      activeLeadsRes,
      wonThisMonthRes,
      projectsRes,
      tasksRes,
      prevWeekLeadsRes
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM leads WHERE tenant_id=$1 AND status='active' AND deleted_at IS NULL`, [tenantId]),
      pool.query(`
        SELECT COUNT(*), COALESCE(SUM(l.contract_value),0) as won_value
        FROM leads l
        JOIN lead_stages ls ON ls.id = l.stage_id
        WHERE l.tenant_id=$1 AND ls.is_won=true
        AND l.updated_at >= date_trunc('month', NOW())
      `, [tenantId]),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status='active') as active,
          COUNT(*) FILTER (WHERE status='active' AND target_date < NOW()) as overdue
        FROM projects WHERE tenant_id=$1 AND deleted_at IS NULL
      `, [tenantId]),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE due_date=CURRENT_DATE) as due_today,
          COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status!='done') as overdue
        FROM tasks
        WHERE tenant_id=$1 AND assignee_id=$2 AND deleted_at IS NULL AND status!='done'
      `, [tenantId, userId]),
      pool.query(`
        SELECT COUNT(*) FROM leads
        WHERE tenant_id=$1 AND status='active' AND deleted_at IS NULL
        AND created_at >= NOW() - INTERVAL '14 days'
        AND created_at < NOW() - INTERVAL '7 days'
      `, [tenantId])
    ]);

    const activeCount = parseInt(activeLeadsRes.rows[0].count, 10);
    const prevWeekCount = parseInt(prevWeekLeadsRes.rows[0].count, 10);
    const trendDiff = activeCount - prevWeekCount;
    const trend = trendDiff > 0 ? `+${trendDiff}` : `${trendDiff}`;

    const data = {
      activeLeads: {
        count: activeCount,
        prevWeekCount,
        trend
      },
      wonThisMonth: {
        count: parseInt(wonThisMonthRes.rows[0].count, 10),
        value: parseFloat(wonThisMonthRes.rows[0].won_value)
      },
      activeProjects: {
        count: parseInt(projectsRes.rows[0].active, 10) || 0,
        overdueCount: parseInt(projectsRes.rows[0].overdue, 10) || 0
      },
      tasksDueToday: {
        count: parseInt(tasksRes.rows[0].due_today, 10) || 0,
        overdueCount: parseInt(tasksRes.rows[0].overdue, 10) || 0
      }
    };

    return success(res, data);
  } catch (error) {
    res.status(500).json(fail('Dashboard stats failed'));
  }
});

router.get('/activity', async (req, res) => {
  const tenantId = req.tenantId;
  const limit = parseInt(req.query.limit, 10) || 10;

  try {
    const { rows } = await pool.query(`
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

router.get('/pipeline', async (req, res) => {
  const tenantId = req.tenantId;

  try {
    const { rows } = await pool.query(`
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
    const { rows } = await pool.query(`
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

module.exports = router;
