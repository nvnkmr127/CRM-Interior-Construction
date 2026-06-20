const pool = require('../../db/pool');

exports.applyTemplate = async (projectId, templateId, tenantId) => {
  try {
    const { rows } = await pool.query(
      'SELECT actions FROM automation_templates WHERE id = $1',
      [templateId]
    );

    if (rows.length === 0) {
      console.warn(`Template ${templateId} not found`);
      return;
    }

    const actions = rows[0].actions;
    for (const action of actions) {
      if (action.type === 'create_task') {
        await pool.query(
          `INSERT INTO tasks (tenant_id, title, project_id, status, priority, due_date)
           VALUES ($1, $2, $3, 'todo', 'medium', CURRENT_DATE + INTERVAL '7 days')`,
          [tenantId, action.title, projectId]
        );
      } else if (action.type === 'notify') {
        // Find project manager
        const pmRes = await pool.query(`SELECT project_manager_id FROM projects WHERE id = $1`, [projectId]);
        if (pmRes.rows.length > 0 && pmRes.rows[0].project_manager_id) {
          const pmId = pmRes.rows[0].project_manager_id;
          const notificationQuery = `
            INSERT INTO notifications (tenant_id, user_id, type, message, reference_type, reference_id)
            VALUES ($1, $2, 'workflow', $3, 'project', $4)
          `;
          await pool.query(notificationQuery, [tenantId, pmId, action.message, projectId]).catch(e => console.warn('Could not insert notification', e.message));
        }
      }
    }
  } catch (error) {
    console.error('Error applying template:', error);
  }
};
