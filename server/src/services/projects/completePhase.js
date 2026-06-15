const pool = require('../../config/db');
const phaseRepository = require('../../repositories/phaseRepository');
const milestoneRepository = require('../../repositories/milestoneRepository');
const { dispatchEvent } = require('../webhooks/webhookDispatcher');
const { logAction } = require('../auditLog');

async function completePhase({ tenantId, userId, phaseId }) {
  // 1. Fetch phase to validate
  const phaseRes = await pool.query('SELECT * FROM project_phases WHERE id = $1 AND tenant_id = $2', [phaseId, tenantId]);
  if (phaseRes.rows.length === 0) {
    const error = new Error('NOT_FOUND');
    error.status = 404;
    throw error;
  }
  
  const phase = phaseRes.rows[0];

  if (phase.status === 'completed') {
    const error = new Error('PHASE_ALREADY_COMPLETED');
    error.status = 400;
    throw error;
  }

  // 2. Fetch all milestones for this phase and validate completion
  const milestones = await milestoneRepository.findMilestonesByPhase(phaseId, tenantId);
  const incompleteMilestones = milestones.filter(m => m.status !== 'completed');
  
  if (incompleteMilestones.length > 0) {
    const error = new Error('MILESTONES_INCOMPLETE');
    error.status = 400;
    error.details = incompleteMilestones.map(m => m.name);
    throw error;
  }

  // 3. Complete the phase
  await phaseRepository.signOffPhase(phaseId, userId, tenantId);

  // 4. Try to find and auto-start the next phase based on sequential sort_order
  await pool.query(`
    UPDATE project_phases
    SET status = 'in_progress', updated_at = NOW()
    WHERE project_id = $1 AND tenant_id = $2 AND sort_order = $3
  `, [phase.project_id, tenantId, phase.sort_order + 1]);

  // Refetch the signed off phase to return the latest state
  const updatedPhaseRes = await pool.query('SELECT * FROM project_phases WHERE id = $1 AND tenant_id = $2', [phaseId, tenantId]);
  const updatedPhase = updatedPhaseRes.rows[0];

  // Fetch parent project to attach to webhook payload
  const projectRes = await pool.query('SELECT * FROM projects WHERE id = $1 AND tenant_id = $2', [phase.project_id, tenantId]);
  const project = projectRes.rows[0];

  // 5. Audit Logging
  await logAction({
    tenantId,
    userId,
    action: 'project.phase_completed',
    entity: 'project',
    entityId: project.id,
    details: { phase_id: phase.id, phase_name: phase.name }
  });

  // 6. Non-blocking Webhook dispatch
  dispatchEvent(tenantId, 'project.phase_completed', { 
    phase: updatedPhase, 
    project 
  }).catch(e => console.error('[Webhook Dispatch Error] phase_completed:', e));

  // 7. Return completed phase object
  return updatedPhase;
}

module.exports = { completePhase };
