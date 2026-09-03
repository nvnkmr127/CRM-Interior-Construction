const pool = require('../config/db');
const logger = require('./logger');

async function notifyMeetingAssigned({
  tenantId,
  leadId = null,
  projectId = null,
  type = 'meeting',
  title = 'Scheduled Meeting',
  notes = '',
  scheduledAt = null,
  assigneeId = null,
  assigneeName = null,
  attendees = [],
  actorId = null,
  actorName = null,
  referenceUrl = null
}) {
  try {
    if (!tenantId) return;
    const targetUserIds = new Set();

    // 1. Direct assignee ID if provided
    if (assigneeId) {
      targetUserIds.add(assigneeId);
    }

    // 2. Fetch Lead assignee if leadId provided
    if (leadId) {
      const leadRes = await pool.query(
        'SELECT assigned_to, name FROM leads WHERE id = $1 AND tenant_id = $2',
        [leadId, tenantId]
      );
      if (leadRes.rows.length > 0 && leadRes.rows[0].assigned_to) {
        targetUserIds.add(leadRes.rows[0].assigned_to);
      }
    }

    // 3. Fetch Project assigned users if projectId provided
    if (projectId) {
      const projRes = await pool.query(
        'SELECT pm_id, assigned_to FROM projects WHERE id = $1 AND tenant_id = $2',
        [projectId, tenantId]
      );
      if (projRes.rows.length > 0) {
        if (projRes.rows[0].pm_id) targetUserIds.add(projRes.rows[0].pm_id);
        if (projRes.rows[0].assigned_to) targetUserIds.add(projRes.rows[0].assigned_to);
      }

      // Also check project_members table if present
      const membersRes = await pool.query(
        'SELECT user_id FROM project_members WHERE project_id = $1 AND tenant_id = $2',
        [projectId, tenantId]
      ).catch(() => ({ rows: [] }));
      membersRes.rows.forEach(m => {
        if (m.user_id) targetUserIds.add(m.user_id);
      });
    }

    // 4. Resolve attendee names/emails or assigneeName if passed as strings (e.g. "pavan", "Pavan Kalyan")
    const nameList = [];
    if (assigneeName && typeof assigneeName === 'string') nameList.push(assigneeName);
    if (Array.isArray(attendees)) {
      attendees.forEach(a => {
        if (typeof a === 'string') nameList.push(a);
        else if (a && a.name) nameList.push(a.name);
        else if (a && a.id) targetUserIds.add(a.id);
      });
    }

    if (nameList.length > 0) {
      for (const nameStr of nameList) {
        const cleanName = nameStr.trim().toLowerCase();
        if (!cleanName) continue;
        const userMatch = await pool.query(
          `SELECT id FROM users 
           WHERE tenant_id = $1 
             AND (LOWER(name) LIKE $2 OR LOWER(email) LIKE $2)`,
          [tenantId, `%${cleanName}%`]
        );
        userMatch.rows.forEach(u => targetUserIds.add(u.id));
      }
    }

    // If no specific target user resolved, notify all active team members in this tenant
    if (targetUserIds.size === 0) {
      const allUsers = await pool.query(
        `SELECT id FROM users WHERE tenant_id = $1 AND status = 'active'`,
        [tenantId]
      );
      allUsers.rows.forEach(u => targetUserIds.add(u.id));
    }

    // Construct notification content
    let meetingTimeStr = '';
    if (scheduledAt) {
      try {
        meetingTimeStr = ` on ${new Date(scheduledAt).toLocaleString()}`;
      } catch (e) {
        meetingTimeStr = ` on ${scheduledAt}`;
      }
    }
    const notifTitle = `Upcoming Scheduled Meeting: ${title || 'Meeting'}`;
    const notifMsg = `Meeting scheduled${meetingTimeStr}. ${notes ? `Details: ${notes}` : ''}`.trim();
    let defaultTab = 'meeting-schedule';
    if (type === 'site_visit') defaultTab = 'site-visits';
    else if (type === 'task') defaultTab = 'tasks';

    const finalUrl = referenceUrl || (leadId ? `/leads?id=${leadId}&tab=${defaultTab}` : (projectId ? `/projects/${projectId}?tab=Meeting Notes` : '/dashboard/sales'));

    for (const targetId of targetUserIds) {
      if (!targetId) continue;
      await pool.query(
        `INSERT INTO notifications (id, tenant_id, user_id, type, title, message, reference_url, actor_id, actor_name, created_at, is_read, is_archived)
         VALUES (gen_random_uuid(), $1, $2, 'meeting', $3, $4, $5, $6, $7, NOW(), false, false)`,
        [tenantId, targetId, notifTitle, notifMsg, finalUrl, actorId || null, actorName || null]
      );
    }
    logger.info(`[notifyMeetingAssigned] Inserted meeting notifications for ${targetUserIds.size} user(s)`);
  } catch (err) {
    logger.error('[notifyMeetingAssigned] Failed to create meeting notification:', err);
  }
}

module.exports = { notifyMeetingAssigned };
