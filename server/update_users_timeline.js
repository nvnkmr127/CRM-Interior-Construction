const fs = require('fs');

let content = fs.readFileSync('src/routes/users.js', 'utf8');

const timelineRoute = `
// Get User Timeline (Aggregated Events)
router.get('/:id/timeline', async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.params.id;
  try {
    const { rows } = await pool.query(\`
      -- 1. Audit Logs where user is the subject (entity = 'user', entity_id = $2)
      SELECT 
        id::text, 
        action as type,
        action as title,
        CASE 
          WHEN old_value IS NOT NULL AND new_value IS NOT NULL THEN CONCAT('Changed from ', old_value, ' to ', new_value)
          ELSE 'Event logged'
        END as description,
        created_at as timestamp,
        (SELECT name FROM users WHERE id = audit_logs.user_id) as actor_name,
        'log' as source
      FROM audit_logs
      WHERE tenant_id = $1 AND entity = 'user' AND entity_id = $2

      UNION ALL

      -- 2. Project Assignments (where user is pm or designer)
      SELECT 
        p.id::text,
        'project.assigned' as type,
        'Project Assigned' as title,
        CONCAT('Assigned to project: ', p.name) as description,
        p.created_at as timestamp,
        'System' as actor_name,
        'project' as source
      FROM projects p
      WHERE p.tenant_id = $1 AND (p.pm_id = $2 OR p.designer_id = $2)

      UNION ALL

      -- 3. Task Assignments
      SELECT
        t.id::text,
        'task.assigned' as type,
        'Task Assigned' as title,
        CONCAT('Assigned task: ', t.title) as description,
        t.created_at as timestamp,
        'System' as actor_name,
        'task' as source
      FROM tasks t
      WHERE t.tenant_id = $1 AND t.assignee_id = $2

      UNION ALL

      -- 4. Status History
      SELECT
        h.id::text,
        'status.changed' as type,
        'Status Changed' as title,
        CONCAT('Status changed from ', h.old_status, ' to ', h.new_status, CASE WHEN h.reason IS NOT NULL THEN CONCAT(' (', h.reason, ')') ELSE '' END) as description,
        h.created_at as timestamp,
        u.name as actor_name,
        'status_history' as source
      FROM user_status_history h
      LEFT JOIN users u ON u.id = h.changed_by
      WHERE h.tenant_id = $1 AND h.user_id = $2

      ORDER BY timestamp DESC
      LIMIT 100
    \`, [tenantId, userId]);

    // Format events for frontend
    const events = rows.map(r => {
      let icon = '🔄';
      let title = r.title;
      
      // Parse specific audit actions
      if (r.type === 'employee.created' || r.type === 'user.created') { icon = '➕'; title = 'Employee Created'; }
      if (r.type === 'employee.approved') { icon = '✅'; title = 'Employee Approved'; }
      if (r.type === 'employee.rejected') { icon = '❌'; title = 'Employee Rejected'; }
      if (r.type === 'employee.role_changed' || r.type === 'user.role_changed') { icon = '🎭'; title = 'Role Changed'; }
      if (r.type === 'employee.permissions_updated') { icon = '🔐'; title = 'Permissions Updated'; }
      if (r.type === 'employee.suspended' || r.type === 'user.suspended') { icon = '⏸️'; title = 'Account Suspended'; }
      if (r.type === 'employee.activated' || r.type === 'user.activated') { icon = '▶️'; title = 'Account Activated'; }
      if (r.type === 'employee.deactivated' || r.type === 'user.deactivated') { icon = '⏹️'; title = 'Account Deactivated'; }
      if (r.type === 'employee.deleted' || r.type === 'user.deleted') { icon = '🗑️'; title = 'Account Deleted'; }
      if (r.type === 'employee.password_reset' || r.type === 'user.password_reset') { icon = '🔑'; title = 'Password Reset'; }
      if (r.type === 'employee.login' || r.type === 'user.login') { icon = '🖥️'; title = 'Logged In'; }
      if (r.type === 'employee.logout' || r.type === 'user.logout') { icon = '🚪'; title = 'Logged Out'; }
      
      if (r.type === 'project.assigned') { icon = '📁'; title = r.title; }
      if (r.type === 'task.assigned') { icon = '☑️'; title = r.title; }
      if (r.type === 'status.changed') { icon = '🚦'; title = r.title; }

      return {
        id: r.id + '-' + r.source,
        type: r.type,
        title: title,
        description: r.description,
        actor_name: r.actor_name || 'System',
        timestamp: r.timestamp,
        icon: icon
      };
    });

    return success(res, events);
  } catch(error) {
    console.error('Timeline fetch error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch user timeline', 500);
  }
});
`;

content = content.replace(/\/\/ Get User Audit Logs/, timelineRoute + '\n// Get User Audit Logs');

fs.writeFileSync('src/routes/users.js', content);
console.log('Done');
