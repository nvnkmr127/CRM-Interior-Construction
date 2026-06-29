const pool = require('../../config/db');
const { notificationQueue } = require('../../queues/queueSetup');

const VALID_STAGES = [
  'Requirement Gathering',
  'Concept Presentation',
  'Concept Approval',
  'Detailed Design',
  'Client Review',
  'Revision Rounds',
  'Design Freeze'
];

async function incrementProjectStageRevision(projectId, tenantId, dbClient = pool) {
  // Fetch project details
  const { rows } = await dbClient.query(
    `SELECT id, name, pm_id, designer_id, design_stage, allowed_design_revisions, stage_revision_limits, stage_revision_counts
     FROM projects
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [projectId, tenantId]
  );

  if (rows.length === 0) return null;
  const project = rows[0];

  const stage = project.design_stage || 'Requirement Gathering';
  const globalAllowed = project.allowed_design_revisions !== null ? project.allowed_design_revisions : 3;

  // Initialize limits and counts if empty
  const limits = project.stage_revision_limits ? { ...project.stage_revision_limits } : {};
  const counts = project.stage_revision_counts ? { ...project.stage_revision_counts } : {};

  VALID_STAGES.forEach(s => {
    if (limits[s] === undefined || limits[s] === null) {
      limits[s] = globalAllowed;
    }
    if (counts[s] === undefined || counts[s] === null) {
      counts[s] = 0;
    }
  });

  // Increment current stage count
  counts[stage] = (counts[stage] || 0) + 1;

  // Update projects table
  await dbClient.query(
    `UPDATE projects
     SET stage_revision_limits = $1,
         stage_revision_counts = $2,
         current_design_revisions = current_design_revisions + 1,
         updated_at = NOW()
     WHERE id = $3 AND tenant_id = $4`,
    [JSON.stringify(limits), JSON.stringify(counts), projectId, tenantId]
  );

  const count = counts[stage];
  const limit = limits[stage];

  // 1. Alert PM and Designer if limit is approaching (count === limit - 1 and limit > 1)
  if (limit > 1 && count === limit - 1) {
    const alertMessage = `Revision limit warning: Project '${project.name}' stage '${stage}' has used ${count} of ${limit} permitted revision rounds. Only 1 revision remains.`;
    
    if (project.pm_id) {
      await notificationQueue.add('revisionLimitNotification', {
        type: 'in-app',
        recipientId: project.pm_id,
        message: alertMessage
      });
    }
    if (project.designer_id && project.designer_id !== project.pm_id) {
      await notificationQueue.add('revisionLimitNotification', {
        type: 'in-app',
        recipientId: project.designer_id,
        message: alertMessage
      });
    }
    console.log(`[RevisionTracker] Warning alert queued for project: ${project.name}, stage: ${stage}`);
  }

  // 2. Alert and generate Change Order if limit is exceeded (count > limit)
  if (count > limit) {
    // Generate Change Order request
    const title = `Excess Revision Fee - ${stage}`;
    const description = `Auto-generated change order request: Stage '${stage}' has exceeded the limit of ${limit} revisions. Current revision count is ${count}. Detail: Design revision limit exceeded during stage: ${stage}`;
    const reason = 'client-requested';
    const amount = 10000.00; // default ₹10,000
    const timelineImpactDays = 3; // timeline cascade buffer
    const status = 'draft';

    const coQuery = `
      INSERT INTO project_change_orders 
        (tenant_id, project_id, title, description, reason, amount, timeline_impact_days, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    await dbClient.query(coQuery, [
      tenantId,
      projectId,
      title,
      description,
      reason,
      amount,
      timelineImpactDays,
      status
    ]);

    const alertMessage = `Revision limit exceeded: Project '${project.name}' stage '${stage}' has exceeded its revision limit (${limit}). Auto-generated a change order request.`;

    if (project.pm_id) {
      await notificationQueue.add('revisionLimitNotification', {
        type: 'in-app',
        recipientId: project.pm_id,
        message: alertMessage
      });
    }
    if (project.designer_id && project.designer_id !== project.pm_id) {
      await notificationQueue.add('revisionLimitNotification', {
        type: 'in-app',
        recipientId: project.designer_id,
        message: alertMessage
      });
    }
    console.log(`[RevisionTracker] Exceeded alert & draft change order queued for project: ${project.name}, stage: ${stage}`);
  }

  return { limits, counts, stage, count, limit };
}

module.exports = {
  incrementProjectStageRevision,
  VALID_STAGES
};
