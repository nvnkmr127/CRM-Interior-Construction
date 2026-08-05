const logger = require('../../../utils/logger');
const pool = require('../../../db/pool');
/**
 * Automates the conversion of a lead to a project (error.g. on Advance Received)
 */
async function handle(config, context) {
  const { record, tenantId, userId } = context;
  
  if (!record || !record.id) return;
  logger.info(`[Automation] Creating Project from Lead ${record.id}`);

  try {
    // Basic mock implementation of project creation from a lead
    // A real system would use a full project service
    const projectName = record.name ? `${record.name} - Project` : `Project for Lead ${record.id}`;
    
    // Check if project already exists for this lead
    const existCheck = await pool.query(`SELECT id FROM projects WHERE lead_id = $1`, [record.id]);
    if (existCheck.rows.length > 0) {
      logger.info(`[Automation] Project already exists for Lead ${record.id}`);
      return;
    }

    const res = await pool.query(`
      INSERT INTO projects (tenant_id, lead_id, name, status, created_by)
      VALUES ($1, $2, $3, 'design', $4)
      RETURNING id
    `, [tenantId, record.id, projectName, userId || 'system']);

    const projectId = res.rows[0].id;
    logger.info(`[Automation] Created Project ${projectId} from Lead ${record.id}`);

    // Create handover task
    await pool.query(`
      INSERT INTO tasks (tenant_id, entity_type, entity_id, title, status, assigned_to)
      VALUES ($1, 'project', $2, 'Complete Project Handover & Kickoff', 'pending', $3)
    `, [tenantId, projectId, record.assigned_rep_id]);

  } catch (error) {
    logger.error(`[Automation] Failed to create project for lead ${record.id}:`, error);
  }
}

module.exports = { handle };
