const EventEmitter = require('events');

class EventBus extends EventEmitter {}

// Create a singleton instance
const eventBus = new EventBus();

eventBus.on('RESOURCE_ASSIGNED_TO_PROJECT', async (payload) => {
    console.log('[EventBus] RESOURCE_ASSIGNED_TO_PROJECT', payload);
    const { pool } = require('../config/db');
    try {
        await pool.query(
            `INSERT INTO notifications (id, tenant_id, user_id, type, title, message, reference_id, reference_type, created_at)
             VALUES (gen_random_uuid(), $1, $2, 'assignment', 'Project Assigned', $3, $4, 'project', NOW())`,
            [payload.tenantId, payload.userId, `You have been assigned to project: ${payload.projectName}`, payload.projectId]
        );
    } catch (err) {
        console.error('[EventBus] Error handling RESOURCE_ASSIGNED_TO_PROJECT', err);
    }
});

eventBus.on('RESOURCE_UNAVAILABLE', async (payload) => {
    console.log('[EventBus] RESOURCE_UNAVAILABLE', payload);
    const { pool } = require('../config/db');
    try {
        // Find tasks assigned to this user that are pending, and notify the PM of the project
        const { rows: tasks } = await pool.query(
            `SELECT t.id, t.title, p.pm_id, p.name as project_name 
             FROM tasks t 
             JOIN projects p ON t.project_id = p.id
             WHERE t.assigned_to = $1 AND t.status != 'completed' AND t.status != 'cancelled'`,
            [payload.userId]
        );
        for (const task of tasks) {
            if (task.pm_id) {
                await pool.query(
                    `INSERT INTO notifications (id, tenant_id, user_id, type, title, message, reference_id, reference_type, created_at)
                     VALUES (gen_random_uuid(), $1, $2, 'warning', 'Resource on Leave', $3, $4, 'task', NOW())`,
                    [payload.tenantId, task.pm_id, `Warning: ${payload.userName} went on leave. Task "${task.title}" in project "${task.project_name}" may be blocked.`, task.id]
                );
            }
        }
    } catch (err) {
        console.error('[EventBus] Error handling RESOURCE_UNAVAILABLE', err);
    }
});

module.exports = eventBus;
