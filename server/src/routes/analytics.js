const express = require('express');
const authenticate = require('../middleware/authenticate');
const pool = require('../config/db');

const router = express.Router();

// Require authentication for all analytics routes
router.use(authenticate);

/**
 * GET /api/analytics/leads
 * Returns analytics data for leads.
 * Query params: from (ISO date), to (ISO date)
 */
router.get('/leads', async (req, res) => {
  try {
    const { from, to } = req.query;
    const tenantId = req.tenantId;

    let dateFilter = '';
    const values = [tenantId];
    
    if (from && to) {
      dateFilter = ' AND l.created_at BETWEEN $2 AND $3 ';
      values.push(from, to);
    } else if (from) {
      dateFilter = ' AND l.created_at >= $2 ';
      values.push(from);
    } else if (to) {
      dateFilter = ' AND l.created_at <= $2 ';
      values.push(to);
    }

    // 1. Stage distribution
    const stageQuery = `
      SELECT s.id as "stageId", s.name as "stageName", COUNT(l.id) as count
      FROM lead_stages s
      LEFT JOIN leads l ON l.stage_id = s.id AND l.tenant_id = $1 ${dateFilter}
      WHERE s.tenant_id = $1
      GROUP BY s.id, s.name, s.order_index
      ORDER BY s.order_index ASC
    `;
    const stageRes = await pool.query(stageQuery, values);

    // 2. Source breakdown
    const sourceQuery = `
      SELECT COALESCE(l.source, 'Unknown') as source, 
             COUNT(l.id) as count, 
             COUNT(CASE WHEN l.status = 'won' THEN 1 END) as "wonCount"
      FROM leads l
      WHERE l.tenant_id = $1 ${dateFilter}
      GROUP BY COALESCE(l.source, 'Unknown')
      ORDER BY count DESC
    `;
    const sourceRes = await pool.query(sourceQuery, values);

    // 3. Team performance
    const teamQuery = `
      SELECT u.id as "userId", u.name, 
             COUNT(l.id) as "totalLeads", 
             COUNT(CASE WHEN l.status = 'won' THEN 1 END) as "wonLeads", 
             ROUND(AVG(COALESCE(l.score, 0)), 1) as "avgScore"
      FROM users u
      LEFT JOIN leads l ON l.assignee_id = u.id AND l.tenant_id = $1 ${dateFilter}
      WHERE u.tenant_id = $1 AND u.role IN ('admin', 'manager', 'user')
      GROUP BY u.id, u.name
      ORDER BY "totalLeads" DESC
    `;
    const teamRes = await pool.query(teamQuery, values);

    // 4. Time series (leads created per week for the last 12 weeks - or based on from/to)
    // If no from/to provided, default to last 12 weeks for the time series
    let timeSeriesQuery = '';
    let timeSeriesValues = [];
    
    if (from && to) {
      timeSeriesQuery = `
        SELECT date_trunc('week', l.created_at) as week, 
               COUNT(l.id) as count, 
               COUNT(CASE WHEN l.status = 'won' THEN 1 END) as "wonCount"
        FROM leads l
        WHERE l.tenant_id = $1 ${dateFilter}
        GROUP BY week
        ORDER BY week ASC
      `;
      timeSeriesValues = [...values];
    } else {
      timeSeriesQuery = `
        SELECT date_trunc('week', l.created_at) as week, 
               COUNT(l.id) as count, 
               COUNT(CASE WHEN l.status = 'won' THEN 1 END) as "wonCount"
        FROM leads l
        WHERE l.tenant_id = $1 AND l.created_at >= NOW() - INTERVAL '12 weeks'
        GROUP BY week
        ORDER BY week ASC
      `;
      timeSeriesValues = [tenantId];
    }
    const timeRes = await pool.query(timeSeriesQuery, timeSeriesValues);

    res.json({
      success: true,
      data: {
        stageDistribution: stageRes.rows.map(row => ({
          ...row,
          count: parseInt(row.count, 10)
        })),
        sourceBreakdown: sourceRes.rows.map(row => ({
          ...row,
          count: parseInt(row.count, 10),
          wonCount: parseInt(row.wonCount, 10)
        })),
        teamPerformance: teamRes.rows.map(row => ({
          ...row,
          totalLeads: parseInt(row.totalLeads, 10),
          wonLeads: parseInt(row.wonLeads, 10),
          avgScore: parseFloat(row.avgScore) || 0
        })),
        timeSeries: timeRes.rows.map(row => ({
          ...row,
          count: parseInt(row.count, 10),
          wonCount: parseInt(row.wonCount, 10)
        }))
      }
    });
  } catch (err) {
    console.error('Lead Analytics Error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch analytics data' });
  }
});

/**
 * GET /api/analytics/projects
 * Returns analytics data for projects.
 * Query params: from (ISO date), to (ISO date)
 */
router.get('/projects', async (req, res) => {
  try {
    const { from, to } = req.query;
    const tenantId = req.tenantId;

    let dateFilter = '';
    const values = [tenantId];

    if (from && to) {
      dateFilter = ' AND p.created_at BETWEEN $2 AND $3 ';
      values.push(from, to);
    } else if (from) {
      dateFilter = ' AND p.created_at >= $2 ';
      values.push(from);
    } else if (to) {
      dateFilter = ' AND p.created_at <= $2 ';
      values.push(to);
    }

    // 1. Status distribution
    const statusQuery = `
      SELECT p.status, COUNT(p.id) as count
      FROM projects p
      WHERE p.tenant_id = $1 ${dateFilter}
      GROUP BY p.status
      ORDER BY count DESC
    `;
    const statusRes = await pool.query(statusQuery, values);

    // 2. Revenue: planned vs collected per month (last 12 months)
    const revenueQuery = `
      SELECT
        TO_CHAR(DATE_TRUNC('month', pm.due_date), 'Mon') as month,
        SUM(pm.amount) as planned,
        SUM(CASE WHEN pm.status = 'paid' THEN pm.amount ELSE 0 END) as collected
      FROM payment_milestones pm
      JOIN projects p ON p.id = pm.project_id AND p.tenant_id = $1
      WHERE pm.due_date >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', pm.due_date)
      ORDER BY DATE_TRUNC('month', pm.due_date) ASC
    `;
    const revenueRes = await pool.query(revenueQuery, [tenantId]);

    // 3. Delayed projects (past target date, not completed)
    const delayedQuery = `
      SELECT p.id, p.name, p.target_date, p.status,
             u.name as pm_name,
             CURRENT_DATE - p.target_date::date as days_delayed
      FROM projects p
      LEFT JOIN users u ON u.id = p.pm_id AND u.tenant_id = $1
      WHERE p.tenant_id = $1
        AND p.target_date < CURRENT_DATE
        AND p.status NOT IN ('completed', 'cancelled')
      ORDER BY days_delayed DESC
      LIMIT 10
    `;
    const delayedRes = await pool.query(delayedQuery, [tenantId]);

    // 4. Top projects by value
    const topProjectsQuery = `
      SELECT p.id, p.name, p.value, p.status
      FROM projects p
      WHERE p.tenant_id = $1 ${dateFilter}
        AND p.value IS NOT NULL
      ORDER BY p.value DESC
      LIMIT 5
    `;
    const topRes = await pool.query(topProjectsQuery, values);

    res.json({
      success: true,
      data: {
        statusDistribution: statusRes.rows.map(r => ({ ...r, count: parseInt(r.count, 10) })),
        revenueTimeline: revenueRes.rows.map(r => ({
          month: r.month,
          planned: parseFloat(r.planned) || 0,
          collected: parseFloat(r.collected) || 0,
        })),
        delayedProjects: delayedRes.rows.map(r => ({
          ...r,
          days_delayed: parseInt(r.days_delayed, 10) || 0,
        })),
        topProjects: topRes.rows.map(r => ({
          ...r,
          value: parseFloat(r.value) || 0,
        })),
      }
    });
  } catch (err) {
    console.error('Project Analytics Error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch project analytics data' });
  }
});

module.exports = router;
