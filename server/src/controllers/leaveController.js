const pool = require('../config/db');
const { success, fail } = require('../utils/response');

// GET /api/leaves
exports.getLeaves = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    
    const query = `
      SELECT ul.id, ul.start_date, ul.end_date, ul.reason, ul.status, ul.created_at,
             u.name as user_name, r.name as role_name
      FROM user_leaves ul
      JOIN users u ON ul.user_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE ul.tenant_id = $1
      ORDER BY ul.start_date DESC
    `;
    const result = await pool.query(query, [tenantId]);
    return success(res, result.rows);
  } catch (error) {
    console.error('getLeaves error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch leaves', 500);
  }
};

// GET /api/leaves/impact/:userId
exports.getLeaveImpact = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { userId } = req.params;

    const query = `
      SELECT p.id, p.name as project_name, p.status,
             c.name as client_name
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.id
      WHERE p.tenant_id = $1 AND p.status = 'active' AND p.deleted_at IS NULL
        AND (p.pm_id = $2 OR p.designer_id = $2 OR p.site_engineer_id = $2)
    `;
    const projectsRes = await pool.query(query, [tenantId, userId]);

    // Fetch potential covering users (users in the same role, basically anyone active)
    const usersQuery = `
      SELECT u.id, u.name, r.name as role_name 
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.tenant_id = $1 AND u.status = 'active' AND u.id != $2
    `;
    const usersRes = await pool.query(usersQuery, [tenantId, userId]);

    return success(res, {
      affectedProjects: projectsRes.rows,
      availableCoveringUsers: usersRes.rows
    });
  } catch (error) {
    console.error('getLeaveImpact error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch leave impact', 500);
  }
};

// POST /api/leaves
exports.createLeave = async (req, res) => {
  const client = await pool.connect();
  try {
    const tenantId = req.tenantId;
    const { userId, startDate, endDate, reason, coverages } = req.body;

    await client.query('BEGIN');

    // 1. Create user leave record
    const leaveQuery = `
      INSERT INTO user_leaves (tenant_id, user_id, start_date, end_date, reason, status)
      VALUES ($1, $2, $3, $4, $5, 'planned')
      RETURNING *
    `;
    const leaveRes = await client.query(leaveQuery, [tenantId, userId, startDate, endDate, reason]);
    const leaveId = leaveRes.rows[0].id;

    // 2. Create project coverages
    if (coverages && coverages.length > 0) {
      for (const cov of coverages) {
        if (!cov.coveringUserId) continue; // Skip if no cover assigned
        const covQuery = `
          INSERT INTO project_coverages (tenant_id, leave_id, project_id, covering_user_id, handover_notes, client_notified)
          VALUES ($1, $2, $3, $4, $5, $6)
        `;
        await client.query(covQuery, [tenantId, leaveId, cov.projectId, cov.coveringUserId, cov.handoverNotes, cov.clientNotified]);
        
        if (cov.clientNotified) {
           console.log(`[Notification] Would notify client for project ${cov.projectId} about handover to user ${cov.coveringUserId}`);
        }
      }
    }

    await client.query('COMMIT');
    return success(res, leaveRes.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('createLeave error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to create leave', 500);
  } finally {
    client.release();
  }
};
