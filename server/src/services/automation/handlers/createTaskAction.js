const pool = require('../../../../db/pool');

/**
 * Task Creation Action Handler
 * Inserts a new task associated with the triggering record natively into the database.
 */
async function handle(config, context) {
  const { title, assigneeField, dueDaysFromNow, milestoneId } = config;
  const { tenantId, record } = context;

  // Resolve the dynamic assignee from the record payload
  const assigneeId = record[assigneeField] || null;
  
  // Dynamically calculate the strict due date
  let dueDate = null;
  if (dueDaysFromNow) {
    dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + Number(dueDaysFromNow));
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
}

module.exports = { handle };
