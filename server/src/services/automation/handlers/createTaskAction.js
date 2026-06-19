const pool = require('../../../db/pool');

/**
 * Task Creation Action Handler
 * Inserts a new task associated with the triggering record natively into the database.
 */
async function handle(config, context) {
  const { title, assigneeField, dueDaysFromNow, dueInHours, assignToRole, milestoneId } = config;
  const { tenantId, record } = context;

  // Resolve the dynamic assignee from the record payload
  let assigneeId = assigneeField ? record[assigneeField] : (record.assigned_rep_id || null);
  
  if (!assigneeId && assignToRole) {
    const roleRes = await pool.query(`SELECT id FROM users WHERE tenant_id = $1 AND role = $2 LIMIT 1`, [tenantId, assignToRole]);
    if (roleRes.rows.length > 0) {
      assigneeId = roleRes.rows[0].id;
    }
  }

  // Dynamically calculate the strict due date
  let dueDate = null;
  if (dueDaysFromNow) {
    dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + Number(dueDaysFromNow));
  } else if (dueInHours) {
    dueDate = new Date();
    dueDate.setHours(dueDate.getHours() + Number(dueInHours));
  }

  // Attempt to contextually resolve parent relations
  const projectId = record.project_id || (record._entity === 'project' ? record.id : null);
  const leadId = record.lead_id || (record._entity === 'lead' ? record.id : null);

  const query = `
    INSERT INTO tasks (tenant_id, title, assignee_id, due_date, project_id, lead_id, milestone_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `;

  await pool.query(query, [
    tenantId,
    title || 'Automated Action Task',
    assigneeId,
    dueDate,
    projectId,
    leadId,
    milestoneId || null
  ]);
  
  console.log(`[Automation] Created task '${title}' for ${leadId ? 'lead '+leadId : 'project '+projectId}`);
}

module.exports = { handle };
