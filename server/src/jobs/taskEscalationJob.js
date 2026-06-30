const pool = require('../../config/db');
const eventBus = require('../../utils/eventBus');

class TaskEscalationJob {
  async start() {
    console.log('[Jobs] TaskEscalationJob started.');
    try {
      await this.processEscalations();
    } catch (err) {
      console.error('[Jobs] TaskEscalationJob error:', err);
    }
  }

  async processEscalations() {
    const query = `
      SELECT t.*, p.manager_id, p.name as project_name, u.name as assignee_name
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.status = 'blocked'
        AND t.deleted_at IS NULL
        AND t.blocked_at IS NOT NULL
        AND (
          (t.escalation_level = 0 AND EXTRACT(EPOCH FROM (NOW() - t.blocked_at))/3600 >= 24) OR
          (t.escalation_level = 1 AND EXTRACT(EPOCH FROM (NOW() - t.blocked_at))/3600 >= 48) OR
          (t.escalation_level = 2 AND EXTRACT(EPOCH FROM (NOW() - t.blocked_at))/3600 >= 72)
        )
    `;

    const { rows: blockedTasks } = await pool.query(query);

    for (const task of blockedTasks) {
      const hoursBlocked = Math.floor((new Date() - new Date(task.blocked_at)) / (1000 * 60 * 60));
      let targetLevel = 0;
      let targetRole = null;
      let delayAssessment = '';

      if (hoursBlocked >= 72 && task.escalation_level < 3) {
        targetLevel = 3;
        targetRole = 'business_head';
        // Generate delay assessment based on downstream blocked subtasks or logic
        delayAssessment = `This task has been blocked for over 72 hours. This critical delay poses a severe risk to the project timeline. Immediate intervention is required to prevent a schedule overrun on the project.`;
      } else if (hoursBlocked >= 48 && task.escalation_level < 2) {
        targetLevel = 2;
        targetRole = 'operations_head';
      } else if (hoursBlocked >= 24 && task.escalation_level < 1) {
        targetLevel = 1;
        targetRole = 'project_manager';
      }

      if (targetLevel > 0) {
        // Resolve Target User ID
        let targetUserId = null;
        if (targetRole === 'project_manager') {
          targetUserId = task.manager_id;
        } else {
          // Find operations head or business head
          let roleSearchTerm = targetRole === 'operations_head' ? '%operations%' : '%business%';
          const userQuery = `
            SELECT u.id 
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.tenant_id = $1 AND (r.name ILIKE $2 OR r.name ILIKE '%director%')
            LIMIT 1
          `;
          let { rows: users } = await pool.query(userQuery, [task.tenant_id, roleSearchTerm]);
          
          if (users.length > 0) {
            targetUserId = users[0].id;
          } else {
            // Fallback to superadmin
            const fallbackQuery = `
              SELECT u.id 
              FROM users u
              JOIN roles r ON u.role_id = r.id
              WHERE u.tenant_id = $1 AND r.is_system = true
              LIMIT 1
            `;
            const fallbackUsers = await pool.query(fallbackQuery, [task.tenant_id]);
            if (fallbackUsers.rows.length > 0) {
              targetUserId = fallbackUsers.rows[0].id;
            }
          }
        }

        // Update Escalation Level
        await pool.query(
          `UPDATE tasks SET escalation_level = $1 WHERE id = $2 AND tenant_id = $3`,
          [targetLevel, task.id, task.tenant_id]
        );

        if (targetUserId) {
          eventBus.emit('task.escalated', {
            tenantId: task.tenant_id,
            task: task,
            targetUserId: targetUserId,
            targetLevel: targetLevel,
            hoursBlocked: hoursBlocked,
            pmId: task.manager_id,
            delayAssessment: delayAssessment
          });
        }
      }
    }
  }
}

module.exports = new TaskEscalationJob();
