const logger = require('../utils/logger');
const pool = require('../config/db');
const { success, fail } = require('../utils/response');

const isUserAdmin = (user) => {
  if (!user) return false;
  const role = (user.role?.name || user.role || '').toLowerCase().trim();
  const perms = Array.isArray(user.permissions) ? user.permissions : (Array.isArray(user.role?.permissions) ? user.role.permissions : []);
  return role === 'admin' || role === 'superadmin' || role === 'owner' || role === 'super admin' || perms.includes('*') || perms.includes('*:*') || perms.includes('admin');
};

// GET /api/leaves
exports.getLeaves = async (req, res) => {
  try {
    const tenantId = req.tenantId || (req.user && (req.user.tenantId || req.user.tenant_id));
    const userId = req.user?.id || req.user?.userId;
    const isAdmin = isUserAdmin(req.user);
    if (!tenantId) return success(res, []);

    let query = `
      SELECT ul.id, ul.start_date, ul.end_date, ul.reason, ul.status, ul.created_at,
             COALESCE(ul.leave_type, 'Annual Leave') as leave_type,
             u.id as user_id, u.name as user_name, r.name as role_name,
             COALESCE(
               (
                 SELECT json_agg(json_build_object(
                   'project_id', pc.project_id,
                   'project_name', p.name,
                   'client_name', p.client_name,
                   'covering_user_id', pc.covering_user_id,
                   'covering_user_name', cu.name,
                   'covering_user_role', cur.name,
                   'handover_notes', pc.handover_notes,
                   'client_notified', pc.client_notified
                 ))
                 FROM project_coverages pc
                 JOIN projects p ON pc.project_id = p.id
                 LEFT JOIN users cu ON pc.covering_user_id = cu.id
                 LEFT JOIN roles cur ON cu.role_id = cur.id
                 WHERE pc.leave_id = ul.id AND pc.tenant_id = ul.tenant_id
               ),
               '[]'::json
             ) as coverages
      FROM user_leaves ul
      JOIN users u ON ul.user_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE ul.tenant_id = $1
    `;
    const params = [tenantId];

    if (req.query.userId) {
      // If filtering by specific employee (allowed for admins, or team member viewing themselves)
      if (!isAdmin && String(req.query.userId) !== String(userId)) {
        return fail(res, 'FORBIDDEN', 'Access denied to view leaves for another user', 403);
      }
      params.push(req.query.userId);
      query += ` AND ul.user_id = $${params.length}`;
    } else if (!isAdmin || req.query.myLeaves === 'true') {
      // Non-admin team members or admin requesting their own personal leaves
      params.push(userId);
      query += ` AND ul.user_id = $${params.length}`;
    }

    if (req.query.status && req.query.status !== 'all') {
      params.push(req.query.status);
      query += ` AND ul.status = $${params.length}`;
    }

    query += ` ORDER BY ul.start_date DESC`;

    const result = await pool.query(query, params);
    return success(res, result.rows);
  } catch (error) {
    logger.error('getLeaves error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch leaves', 500);
  }
};

// GET /api/leaves/covering - Returns projects delegated to the current user as covering colleague
exports.getCoveringLeaves = async (req, res) => {
  try {
    const tenantId = req.tenantId || (req.user && (req.user.tenantId || req.user.tenant_id));
    const userId = req.user?.id || req.user?.userId;

    let query = `
      SELECT pc.id as coverage_id, pc.handover_notes, pc.client_notified, pc.created_at,
             ul.id as leave_id, ul.start_date, ul.end_date, ul.reason, ul.status as leave_status,
             COALESCE(ul.leave_type, 'Annual Leave') as leave_type,
             p.id as project_id, p.name as project_name, p.client_name,
             u.id as requester_id, u.name as requester_name, r.name as requester_role
      FROM project_coverages pc
      JOIN user_leaves ul ON pc.leave_id = ul.id
      JOIN projects p ON pc.project_id = p.id
      JOIN users u ON ul.user_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE pc.covering_user_id = $1
    `;
    const params = [userId];

    if (tenantId) {
      params.push(tenantId);
      query += ` AND pc.tenant_id = $${params.length}`;
    }

    query += ` ORDER BY ul.start_date DESC`;
    const result = await pool.query(query, params);

    // Backfill any missing notifications for these coverages so Kalyan / covering colleagues never miss past handovers
    try {
      const { notifyUser } = require('../integrations/notificationService');
      for (const row of result.rows) {
        const notifCheck = await pool.query(
          `SELECT id FROM notifications 
           WHERE user_id = $1 AND type = 'leave_handover' AND reference_url = $2`,
          [userId, `/projects/${row.project_id}`]
        );
        if (notifCheck.rowCount === 0) {
          const startDateStr = new Date(row.start_date).toLocaleDateString();
          const endDateStr = new Date(row.end_date).toLocaleDateString();
          await notifyUser(tenantId, userId, {
            title: '🌴 Project Handover Delegated to You',
            message: `${row.requester_name} requested leave (${startDateStr} – ${endDateStr}) and designated you to cover "${row.project_name}". Handover Notes: "${row.handover_notes || 'No notes specified'}"`,
            type: 'leave_handover',
            reference_url: `/projects/${row.project_id}`,
            actor_id: row.requester_id,
            actor_name: row.requester_name
          });
        }
      }
    } catch (backfillErr) {
      logger.warn('Backfill notification notice:', backfillErr.message);
    }

    return success(res, result.rows);
  } catch (error) {
    logger.error('getCoveringLeaves error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch covering leaves', 500);
  }
};

// GET /api/leaves/project/:projectId - Returns active/planned coverages for a project
exports.getProjectCoverages = async (req, res) => {
  try {
    const tenantId = req.tenantId || (req.user && (req.user.tenantId || req.user.tenant_id));
    const { projectId } = req.params;

    const query = `
      SELECT pc.id, pc.handover_notes, pc.client_notified,
             ul.id as leave_id, ul.start_date, ul.end_date, ul.status as leave_status,
             u.id as on_leave_user_id, u.name as on_leave_user_name, r.name as on_leave_role,
             cu.id as covering_user_id, cu.name as covering_user_name, cur.name as covering_role
      FROM project_coverages pc
      JOIN user_leaves ul ON pc.leave_id = ul.id
      JOIN users u ON ul.user_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN users cu ON pc.covering_user_id = cu.id
      LEFT JOIN roles cur ON cu.role_id = cur.id
      WHERE pc.tenant_id = $1 AND pc.project_id = $2 AND ul.status != 'rejected'
      ORDER BY ul.start_date DESC
    `;
    const result = await pool.query(query, [tenantId, projectId]);
    return success(res, result.rows);
  } catch (error) {
    logger.error('getProjectCoverages error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch project coverages', 500);
  }
};

// GET /api/leaves/impact/:userId
exports.getLeaveImpact = async (req, res) => {
  try {
    const tenantId = req.tenantId || (req.user && (req.user.tenantId || req.user.tenant_id));
    const { userId } = req.params;

    // Check target user's role to determine executive oversight vs team assignment
    const userRes = await pool.query(`
      SELECT u.id, u.name, LOWER(COALESCE(r.name, '')) as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1
    `, [userId]);
    const userRole = userRes.rows[0]?.role_name || '';
    const isExecutive = ['admin', 'superadmin', 'owner', 'super admin'].includes(userRole);

    let query = `
      SELECT p.id, p.name as project_name, p.status,
             p.client_name
      FROM projects p
      WHERE p.tenant_id = $1
        AND p.status NOT IN ('completed', 'cancelled', 'deleted', 'archived')
        AND p.deleted_at IS NULL
    `;
    const params = [tenantId];

    if (!isExecutive) {
      query += `
        AND (
          p.pm_id = $2 
          OR p.designer_id = $2 
          OR p.site_engineer_id = $2 
          OR p.created_by = $2
          OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $2)
          OR EXISTS (SELECT 1 FROM tasks t WHERE t.project_id = p.id AND t.assignee_id = $2 AND t.status != 'completed')
        )
        ORDER BY p.name ASC
      `;
      params.push(userId);
    } else {
      // For company executives, order projects where they are specifically assigned/creator first, followed by others
      query += `
        ORDER BY 
          CASE WHEN p.created_by = $2 OR p.pm_id = $2 OR p.designer_id = $2 OR p.site_engineer_id = $2 THEN 0 ELSE 1 END,
          p.name ASC
      `;
      params.push(userId);
    }

    const projectsRes = await pool.query(query, params);

    // Fetch potential covering users (users in the tenant, excluding current user)
    const usersQuery = `
      SELECT u.id, u.name, r.name as role_name 
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.tenant_id = $1
        AND (u.status = 'active' OR u.status IS NULL)
        AND u.id != $2
      ORDER BY u.name ASC
    `;
    const usersRes = await pool.query(usersQuery, [tenantId, userId]);

    return success(res, {
      affectedProjects: projectsRes.rows,
      availableCoveringUsers: usersRes.rows
    });
  } catch (error) {
    logger.error('getLeaveImpact error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch leave impact', 500);
  }
};

// POST /api/leaves
exports.createLeave = async (req, res) => {
  const client = await pool.connect();
  try {
    const tenantId = req.tenantId || (req.user && (req.user.tenantId || req.user.tenant_id));
    const requesterId = req.user?.id || req.user?.userId;
    const isAdmin = isUserAdmin(req.user);

    const { userId, startDate, endDate, leaveType, reason, coverages } = req.body;
    // Team members can only submit leave requests for themselves; only admins can specify other user IDs
    const targetUserId = (!isAdmin || !userId) ? requesterId : userId;

    await client.query('BEGIN');

    // Fetch requester and target user info for notification dispatch and role check
    const reqUserRes = await client.query(`
      SELECT u.name, LOWER(COALESCE(r.name, '')) as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1
    `, [targetUserId]);
    const requesterName = reqUserRes.rows[0]?.name || 'A team member';
    const targetRole = reqUserRes.rows[0]?.role_name || '';

    // Status Resolution:
    // If status is explicitly provided (e.g. 'planned' for review, or 'approved' for confirmed absence), respect it.
    // If scheduling for another staff member (e.g. from Finance, Design, Engineering), default to 'planned' unless explicitly marked approved.
    const isTargetExecutive = ['admin', 'superadmin', 'owner', 'super admin'].includes(targetRole);
    let initialStatus = 'planned';
    if (req.body.status && ['planned', 'approved'].includes(req.body.status)) {
      initialStatus = req.body.status;
    } else if (isTargetExecutive && (!userId || String(targetUserId) === String(requesterId))) {
      initialStatus = 'approved';
    }

    // 1. Create user leave record
    const leaveQuery = `
      INSERT INTO user_leaves (tenant_id, user_id, start_date, end_date, leave_type, reason, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const leaveRes = await client.query(leaveQuery, [tenantId, targetUserId, startDate, endDate, leaveType || 'Casual Leave', reason, initialStatus]);
    const leaveId = leaveRes.rows[0].id;

    // 2. Create project coverages & send notifications to covering colleagues
    const { notifyUser } = require('../integrations/notificationService');

    if (coverages && coverages.length > 0) {
      for (const cov of coverages) {
        if (!cov.coveringUserId) continue; // Skip if no cover assigned
        const covQuery = `
          INSERT INTO project_coverages (tenant_id, leave_id, project_id, covering_user_id, handover_notes, client_notified)
          VALUES ($1, $2, $3, $4, $5, $6)
        `;
        await client.query(covQuery, [tenantId, leaveId, cov.projectId, cov.coveringUserId, cov.handoverNotes, cov.clientNotified]);
        
        // Fetch project name
        const projRes = await client.query('SELECT name FROM projects WHERE id = $1 AND tenant_id = $2', [cov.projectId, tenantId]);
        const projectName = projRes.rows[0]?.name || 'a project';

        // Dispatch instant in-app notification to covering colleague (e.g. Kalyan)
        const notifTitle = isTargetExecutive
          ? '🌴 Project Handover Delegated to You (Confirmed)'
          : '🌴 Project Handover Delegated to You';
        const notifMessage = isTargetExecutive
          ? `${requesterName} (Management) scheduled absence (${new Date(startDate).toLocaleDateString()} – ${new Date(endDate).toLocaleDateString()}) and designated you to cover "${projectName}". Handover Notes: "${cov.handoverNotes || 'No notes specified'}"`
          : `${requesterName} requested leave (${new Date(startDate).toLocaleDateString()} – ${new Date(endDate).toLocaleDateString()}) and designated you to cover "${projectName}". Handover Notes: "${cov.handoverNotes || 'No notes specified'}"`;

        try {
          await notifyUser(tenantId, cov.coveringUserId, {
            title: notifTitle,
            message: notifMessage,
            type: 'leave_handover',
            reference_url: `/projects/${cov.projectId}`,
            actor_id: targetUserId,
            actor_name: requesterName
          });
        } catch (notifErr) {
          logger.warn('Failed to dispatch handover notification via notificationService, falling back to standard sendNotification:', notifErr.message);
          try {
            const { sendNotification } = require('../utils/notifications');
            await sendNotification(
              tenantId,
              cov.coveringUserId,
              'leave_handover',
              notifMessage,
              `/projects/${cov.projectId}`,
              targetUserId
            );
          } catch (fallbackErr) {
            logger.error('Fallback notification also failed:', fallbackErr.message);
          }
        }

        if (cov.clientNotified) {
           logger.info(`[Notification] Would notify client for project ${cov.projectId} about handover to user ${cov.coveringUserId}`);
        }
      }
    }

    // 3. If a regular team member requested leave ('planned'), notify administrators for review
    if (initialStatus === 'planned') {
      try {
        const adminUsers = await client.query(`
          SELECT u.id
          FROM users u
          JOIN roles r ON u.role_id = r.id
          WHERE u.tenant_id = $1
            AND LOWER(r.name) IN ('admin', 'superadmin', 'owner', 'super admin')
            AND u.id != $2
        `, [tenantId, targetUserId]);

        for (const admin of adminUsers.rows) {
          await notifyUser(tenantId, admin.id, {
            title: '⏳ New Staff Leave Request',
            message: `${requesterName} requested ${leaveType || 'Leave'} (${new Date(startDate).toLocaleDateString()} – ${new Date(endDate).toLocaleDateString()}). Awaiting your review.`,
            type: 'leave_approval',
            reference_url: '/projects/absences',
            actor_id: targetUserId,
            actor_name: requesterName
          }).catch(e => logger.warn('Admin leave notification notice:', e.message));
        }
      } catch (adminNotifErr) {
        logger.warn('Failed to notify admins of new leave request:', adminNotifErr.message);
      }
    }

    await client.query('COMMIT');
    return success(res, leaveRes.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('createLeave error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to create leave', 500);
  } finally {
    client.release();
  }
};

// PATCH /api/leaves/:id/status
exports.updateLeaveStatus = async (req, res) => {
  try {
    const tenantId = req.tenantId || (req.user && (req.user.tenantId || req.user.tenant_id));
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['planned', 'approved', 'rejected'];
    if (!status || !validStatuses.includes(status)) {
      return fail(res, 'VALIDATION_ERROR', `Status must be one of: ${validStatuses.join(', ')}`, 400);
    }

    const query = `
      UPDATE user_leaves
      SET status = $1, updated_at = NOW()
      WHERE id = $2 AND tenant_id = $3
      RETURNING *
    `;
    const result = await pool.query(query, [status, id, tenantId]);

    if (result.rowCount === 0) {
      return fail(res, 'NOT_FOUND', 'Leave record not found', 404);
    }

    const updatedLeave = result.rows[0];

    // Dispatch status update notifications to requester & covering colleagues
    try {
      const { notifyUser } = require('../integrations/notificationService');

      // Fetch requester name
      const userRes = await pool.query('SELECT name FROM users WHERE id = $1 AND tenant_id = $2', [updatedLeave.user_id, tenantId]);
      const requesterName = userRes.rows[0]?.name || 'Team member';
      const startDateStr = new Date(updatedLeave.start_date).toLocaleDateString();
      const endDateStr = new Date(updatedLeave.end_date).toLocaleDateString();

      // 1. Notify the requester
      await notifyUser(tenantId, updatedLeave.user_id, {
        title: status === 'approved' ? '✅ Leave Request Approved' : '❌ Leave Request Rejected',
        message: `Your leave request for ${startDateStr} – ${endDateStr} was ${status.toUpperCase()} by management.`,
        type: 'leave_status',
        reference_url: '/projects/absences'
      });

      // 2. Notify any covering colleagues
      const covRes = await pool.query(`
        SELECT pc.covering_user_id, p.name as project_name
        FROM project_coverages pc
        JOIN projects p ON pc.project_id = p.id
        WHERE pc.leave_id = $1
      `, [id]);

      for (const cov of covRes.rows) {
        if (!cov.covering_user_id) continue;
        await notifyUser(tenantId, cov.covering_user_id, {
          title: status === 'approved' ? '📋 Colleague Coverage Confirmed' : 'ℹ️ Colleague Coverage Cancelled',
          message: status === 'approved'
            ? `Management approved ${requesterName}'s leave (${startDateStr} – ${endDateStr}). Your coverage for "${cov.project_name}" is active as scheduled.`
            : `${requesterName}'s leave request was rejected. Coverage for "${cov.project_name}" is no longer required.`,
          type: 'leave_handover',
          reference_url: '/projects/absences'
        });
      }
    } catch (notifErr) {
      logger.warn('Failed to dispatch leave status notifications:', notifErr.message);
    }

    return success(res, updatedLeave);
  } catch (error) {
    logger.error('updateLeaveStatus error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to update leave status', 500);
  }
};

// GET /api/leaves/schedule - Returns team absence roster & calendar data for all members
exports.getTeamSchedule = async (req, res) => {
  try {
    const tenantId = req.tenantId || (req.user && (req.user.tenantId || req.user.tenant_id));
    let query = `
      SELECT ul.id, ul.start_date, ul.end_date, ul.status,
             COALESCE(ul.leave_type, 'Annual Leave') as leave_type,
             u.id as user_id, u.name as user_name, r.name as role_name,
             COALESCE(
               (
                 SELECT json_agg(json_build_object(
                   'project_id', pc.project_id,
                   'project_name', p.name,
                   'covering_user_name', cu.name
                 ))
                 FROM project_coverages pc
                 JOIN projects p ON pc.project_id = p.id
                 LEFT JOIN users cu ON pc.covering_user_id = cu.id
                 WHERE pc.leave_id = ul.id
               ),
               '[]'::json
             ) as coverages
      FROM user_leaves ul
      JOIN users u ON ul.user_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE ul.status != 'rejected'
    `;
    const params = [];

    if (tenantId) {
      params.push(tenantId);
      query += ` AND ul.tenant_id = $${params.length}`;
    }

    query += ` ORDER BY ul.start_date ASC`;
    const result = await pool.query(query, params);
    return success(res, result.rows);
  } catch (error) {
    logger.error('getTeamSchedule error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch team schedule', 500);
  }
};

// DELETE /api/leaves/:id - Allows cancelling an upcoming planned leave request
exports.deleteLeave = async (req, res) => {
  const client = await pool.connect();
  try {
    const tenantId = req.tenantId || (req.user && (req.user.tenantId || req.user.tenant_id));
    const { id } = req.params;
    const userId = req.user?.id || req.user?.userId;
    const isAdmin = isUserAdmin(req.user);

    const checkRes = await client.query(
      'SELECT * FROM user_leaves WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (checkRes.rowCount === 0) {
      return fail(res, 'NOT_FOUND', 'Leave request not found', 404);
    }
    const leave = checkRes.rows[0];

    // Non-admin can only cancel their own leave if it is in 'planned' status
    if (!isAdmin && (String(leave.user_id) !== String(userId) || leave.status !== 'planned')) {
      return fail(res, 'FORBIDDEN', 'You can only cancel your own pending leave requests', 403);
    }

    const cancellationReason = (req.body?.cancellationReason || req.body?.reason || req.query?.reason || '').trim();

    // Fetch covering colleagues before deleting to notify them that coverage is cancelled
    const covRes = await client.query(`
      SELECT pc.covering_user_id, p.name as project_name
      FROM project_coverages pc
      JOIN projects p ON pc.project_id = p.id
      WHERE pc.leave_id = $1
    `, [id]);

    await client.query('BEGIN');
    await client.query('DELETE FROM project_coverages WHERE leave_id = $1 AND tenant_id = $2', [id, tenantId]);
    await client.query('DELETE FROM user_leaves WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    await client.query('COMMIT');

    // Notify covering colleagues if any that coverage was cancelled
    try {
      const { notifyUser } = require('../integrations/notificationService');
      const userRes = await pool.query('SELECT name FROM users WHERE id = $1 AND tenant_id = $2', [leave.user_id, tenantId]);
      const requesterName = userRes.rows[0]?.name || 'Colleague';
      const reasonSuffix = cancellationReason ? ` Reason: "${cancellationReason}".` : '';

      for (const cov of covRes.rows) {
        if (!cov.covering_user_id) continue;
        await notifyUser(tenantId, cov.covering_user_id, {
          title: 'ℹ️ Colleague Coverage Cancelled',
          message: `${requesterName}'s scheduled absence was cancelled.${reasonSuffix} Your coverage for "${cov.project_name}" is no longer required.`,
          type: 'leave_handover',
          reference_url: '/projects/absences'
        });
      }

      // If user is non-admin cancelling their own leave, notify management/admins
      if (!isAdmin) {
        const adminRes = await pool.query(`
          SELECT u.id FROM users u
          JOIN roles r ON u.role_id = r.id
          WHERE u.tenant_id = $1
            AND LOWER(r.name) IN ('admin', 'superadmin', 'owner', 'super admin')
        `, [tenantId]);
        for (const adm of adminRes.rows) {
          await notifyUser(tenantId, adm.id, {
            title: 'ℹ️ Leave Request Cancelled',
            message: `${requesterName} cancelled their ${leave.leave_type || 'leave'} request (${new Date(leave.start_date).toLocaleDateString()} – ${new Date(leave.end_date).toLocaleDateString()}).${reasonSuffix}`,
            type: 'leave_status',
            reference_url: '/projects/absences'
          });
        }
      }
    } catch (notifErr) {
      logger.warn('Failed to dispatch cancellation notifications:', notifErr.message);
    }

    try {
      const { logActivity } = require('../utils/activityLogger');
      await logActivity(req, 'user_leave', id, 'Cancelled', leave, null, cancellationReason || 'Cancelled by applicant');
    } catch (logErr) {
      // ignore logging errors
    }

    return success(res, { message: 'Leave request cancelled successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('deleteLeave error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to cancel leave', 500);
  } finally {
    client.release();
  }
};
