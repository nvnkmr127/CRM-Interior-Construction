const pool = require('../../config/db');
const phaseRepository = require('../../repositories/phaseRepository');
const milestoneRepository = require('../../repositories/milestoneRepository');
const { dispatchEvent } = require('../webhooks/webhookDispatcher');
const { logAction } = require('../auditLog');
const { notifyUser } = require('../notificationService');

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

  // 2.5 Stage Gate: check if there are pending QC stages for this phase
  const pendingQcRes = await pool.query(
    `SELECT stage_name FROM project_qc_stages 
     WHERE phase_id = $1 AND tenant_id = $2 AND status != 'completed'`,
    [phaseId, tenantId]
  );
  if (pendingQcRes.rows.length > 0) {
    const error = new Error('QC_STAGES_INCOMPLETE');
    error.status = 400;
    error.details = pendingQcRes.rows.map(r => r.stage_name);
    throw error;
  }

  // 3. Complete the phase
  await phaseRepository.signOffPhase(phaseId, userId, tenantId);

  // 4. Try to find and auto-start the next phase based on sequential sort_order
  const nextSortOrder = phase.sort_order + 1;
  const nextPhaseRes = await pool.query(
    'SELECT * FROM project_phases WHERE project_id = $1 AND tenant_id = $2 AND sort_order = $3',
    [phase.project_id, tenantId, nextSortOrder]
  );
  if (nextPhaseRes.rows.length > 0) {
    const nextPhase = nextPhaseRes.rows[0];
    await checkScopeLock(tenantId, phase.project_id, nextPhase.id);

    await pool.query(`
      UPDATE project_phases
      SET status = 'in_progress', updated_at = NOW()
      WHERE id = $1
    `, [nextPhase.id]);
  }

  // Refetch the signed off phase to return the latest state
  const updatedPhaseRes = await pool.query('SELECT * FROM project_phases WHERE id = $1 AND tenant_id = $2', [phaseId, tenantId]);
  const updatedPhase = updatedPhaseRes.rows[0];

  // Fetch parent project to attach to webhook payload
  const projectRes = await pool.query('SELECT * FROM projects WHERE id = $1 AND tenant_id = $2', [phase.project_id, tenantId]);
  const project = projectRes.rows[0];

  // Notify PM: 'Phase X signed off on Project Y'
  if (project.pm_id) {
    notifyUser({
      tenantId,
      userId: project.pm_id,
      type: 'project.phase_completed',
      message: `Phase '${phase.name}' signed off on '${project.name}'`,
      referenceUrl: `/projects/${project.id}`,
      actorId: userId,
    });
  }

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

async function checkScopeLock(tenantId, projectId, phaseId) {
  const phaseRes = await pool.query(
    'SELECT * FROM project_phases WHERE id = $1 AND tenant_id = $2',
    [phaseId, tenantId]
  );
  if (phaseRes.rows.length === 0) return;
  const phase = phaseRes.rows[0];

  if (phase.is_execution) {
    const projectRes = await pool.query(
      'SELECT is_scope_locked FROM projects WHERE id = $1 AND tenant_id = $2',
      [projectId, tenantId]
    );
    if (projectRes.rows.length === 0) return;
    const project = projectRes.rows[0];

    const commCheck = await pool.query(
      'SELECT id FROM project_commercial_approvals WHERE project_id = $1 AND tenant_id = $2 LIMIT 1',
      [projectId, tenantId]
    );

    if (commCheck.rows.length === 0) {
      const error = new Error('Cannot start execution phase: Commercial approval has not been completed.');
      error.code = 'COMMERCIAL_APPROVAL_REQUIRED';
      error.status = 400;
      throw error;
    }

    const docRes = await pool.query(
      "SELECT id FROM documents WHERE project_id = $1 AND tenant_id = $2 AND doc_type = 'contract' AND status = 'approved' LIMIT 1",
      [projectId, tenantId]
    );

    if (!project.is_scope_locked || docRes.rows.length === 0) {
      const error = new Error('SCOPE_LOCK_REQUIRED');
      error.status = 400;
      error.message = 'Cannot start execution phase: Design scope must be locked and contract document approved.';
      throw error;
    }

    // Site readiness validation
    // Ensure checklist is seeded
    const siteReadinessRepository = require('../../repositories/siteReadinessRepository');
    const checklist = await siteReadinessRepository.findChecklist(tenantId, projectId);

    const incomplete = checklist.filter(item => !item.is_completed);
    if (incomplete.length > 0) {
      const error = new Error('SITE_READINESS_REQUIRED');
      error.status = 400;
      error.message = `Cannot start execution phase: Site readiness checklist is incomplete. Pending items: ${incomplete.map(i => i.label).join(', ')}`;
      throw error;
    }
  }
}

module.exports = { completePhase, checkScopeLock };
