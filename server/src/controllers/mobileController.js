const pool = require('../db/pool');

exports.getMobileDashboard = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const userId = req.user && (req.user.id || req.user.userId);

    // Get "Today's Work" in a single optimized query set
    const [tasksRes, followupsRes, visitsRes] = await Promise.all([
      pool.query(`
        SELECT id, title, priority, due_date
        FROM tasks 
        WHERE tenant_id = $1 AND assignee_id = $2 
          AND status != 'done' AND deleted_at IS NULL
          AND due_date <= CURRENT_DATE
        ORDER BY due_date ASC LIMIT 10
      `, [tenantId, userId]),
      
      pool.query(`
        SELECT f.id, f.title as notes, f.created_at, l.id as lead_id, l.name as lead_name 
        FROM lead_followups f
        JOIN leads l ON f.lead_id = l.id
        WHERE f.tenant_id = $1 AND l.assigned_rep_id = $2
          AND f.created_at >= CURRENT_DATE
        ORDER BY f.created_at DESC LIMIT 10
      `, [tenantId, userId]),
      
      pool.query(`
        SELECT v.id, v.scheduled_date, v.status, l.id as lead_id, l.name as lead_name, l.address
        FROM site_visits v
        JOIN leads l ON v.lead_id = l.id
        WHERE v.tenant_id = $1 AND l.assigned_rep_id = $2
          AND v.scheduled_date >= CURRENT_DATE AND v.scheduled_date < CURRENT_DATE + INTERVAL '1 day'
          AND v.status != 'completed' AND v.status != 'cancelled'
        ORDER BY v.scheduled_date ASC LIMIT 10
      `, [tenantId, userId])
    ]);

    res.json({
      success: true,
      data: {
        tasks: tasksRes.rows,
        followups: followupsRes.rows,
        visits: visitsRes.rows
      }
    });
  } catch (error) {
    next(error);
  }
};
