const pool = require('../../db/pool');
const { getTenantThreshold, isUserSuperadmin } = require('../../utils/finance');
const { buildApprovalChain } = require('../../utils/ApprovalChainBuilder');
const { logAction } = require('../auditLog');

function extractStageNumber(str) {
  if (!str) return null;
  const match = str.match(/stage\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

async function syncScheduleToPaymentMilestones({ tenantId, projectId }) {
  try {
    // 1. Fetch site checkpoints that trigger payments
    const siteMilestonesRes = await pool.query(`
      SELECT m.id, m.name, m.due_date, m.status, m.phase_id, pp.name as phase_name, pp.sort_order as phase_order
      FROM milestones m
      JOIN project_phases pp ON m.phase_id = pp.id
      WHERE m.project_id = $1 AND m.tenant_id = $2 AND m.triggers_payment = true
      ORDER BY pp.sort_order ASC, m.sort_order ASC, m.created_at ASC
    `, [projectId, tenantId]);
    let siteMilestones = siteMilestonesRes.rows;

    // 2. Fetch all payment milestones for this project
    const pmRes = await pool.query(`
      SELECT * FROM payment_milestones
      WHERE tenant_id = $1 AND project_id = $2
      ORDER BY due_date ASC, created_at ASC
    `, [tenantId, projectId]);
    let paymentMilestones = pmRes.rows;

    if (paymentMilestones.length === 0) return paymentMilestones;

    // 3. Deduplicate multiple site milestones sharing the same stage number
    const siteStageGroups = {};
    for (const sm of siteMilestones) {
      const stageNum = extractStageNumber(sm.name);
      if (stageNum !== null) {
        if (!siteStageGroups[stageNum]) siteStageGroups[stageNum] = [];
        siteStageGroups[stageNum].push(sm);
      }
    }

    const removedSiteMilestoneIds = new Set();
    for (const [stageNum, sms] of Object.entries(siteStageGroups)) {
      if (sms.length > 1) {
        // Keep the first one as the official payment trigger
        // Unset triggers_payment on the duplicate ones in milestones table
        const duplicateSms = sms.slice(1);
        for (const dup of duplicateSms) {
          await pool.query(
            `UPDATE milestones SET triggers_payment = false WHERE id = $1 AND tenant_id = $2`,
            [dup.id, tenantId]
          ).catch(() => {});
          removedSiteMilestoneIds.add(dup.id);
        }
      }
    }
    siteMilestones = siteMilestones.filter(sm => !removedSiteMilestoneIds.has(sm.id));

    // 4. Deduplicate payment milestones sharing the same stage number
    const stageGroups = {};
    for (const pm of paymentMilestones) {
      const stageNum = extractStageNumber(pm.name);
      if (stageNum !== null) {
        if (!stageGroups[stageNum]) stageGroups[stageNum] = [];
        stageGroups[stageNum].push(pm);
      }
    }

    for (const [stageNum, group] of Object.entries(stageGroups)) {
      if (group.length > 1) {
        // Find which one has activity (status != 'scheduled' or has entries or in approvals)
        const approvalsRes = await pool.query(
          `SELECT target_id FROM financial_approvals WHERE tenant_id = $1 AND target_id = ANY($2::text[])`,
          [tenantId, group.map(g => g.id.toString())]
        ).catch(() => ({ rows: [] }));
        const activeTargetIds = new Set(approvalsRes.rows.map(r => r.target_id));

        const keepCandidate = group.find(g => 
          g.status === 'pending_approval' || 
          g.status === 'paid' || 
          Number(g.paid_amount || 0) > 0 ||
          activeTargetIds.has(g.id.toString()) || 
          (Array.isArray(g.payment_entries) && g.payment_entries.length > 0)
        ) || group[0];

        // Redundant duplicates: any duplicate with NO paid amount and NO pending approval requests
        const redundantCandidates = group.filter(g => 
          g.id !== keepCandidate.id &&
          g.status !== 'paid' &&
          g.status !== 'pending_approval' &&
          Number(g.paid_amount || 0) === 0 &&
          !activeTargetIds.has(g.id.toString()) &&
          (!Array.isArray(g.payment_entries) || g.payment_entries.length === 0)
        );

        for (const red of redundantCandidates) {
          await pool.query(`DELETE FROM payment_milestones WHERE id = $1 AND tenant_id = $2`, [red.id, tenantId]).catch(() => {});
          paymentMilestones = paymentMilestones.filter(p => p.id !== red.id);
        }
      }
    }

    // 5. Link & Synchronize site milestones to payment milestones
    for (const sm of siteMilestones) {
      const smStage = extractStageNumber(sm.name);
      
      // Check if already linked
      let linkedPm = paymentMilestones.find(p => p.milestone_id === sm.id);

      // If not linked, find an unlinked payment milestone matching stage
      if (!linkedPm && smStage !== null) {
        linkedPm = paymentMilestones.find(p => (!p.milestone_id || removedSiteMilestoneIds.has(p.milestone_id)) && extractStageNumber(p.name) === smStage);
      }

      if (linkedPm) {
        // Sync name and due date directly from site schedule
        await pool.query(`
          UPDATE payment_milestones
          SET milestone_id = $1, name = $2, due_date = COALESCE($3, due_date), updated_at = NOW()
          WHERE id = $4 AND tenant_id = $5
        `, [sm.id, sm.name, sm.due_date, linkedPm.id, tenantId]).catch(() => {});
        
        linkedPm.milestone_id = sm.id;
        linkedPm.name = sm.name;
        if (sm.due_date) linkedPm.due_date = sm.due_date;
      }
    }
  } catch (err) {
    console.warn('[PaymentMilestoneService] Sync error:', err.message);
  }
}

async function getPaymentMilestones({ tenantId, projectId }) {
  const query = `
    SELECT pm.*, COALESCE(m.name, pm.name) as display_name, m.name as linked_milestone_name
    FROM payment_milestones pm
    LEFT JOIN milestones m ON pm.milestone_id = m.id
    WHERE pm.tenant_id = $1 AND pm.project_id = $2
    ORDER BY pm.due_date ASC, pm.created_at ASC
  `;
  const result = await pool.query(query, [tenantId, projectId]);
  return result.rows;
}

async function createPaymentMilestone({ tenantId, userId, data, bypassApproval = false }) {
  const { projectId, name, amount, percentage, dueDate, milestoneId, notes, tdsRate, tdsAmount } = data;
  
  const projCheck = await pool.query(
    'SELECT id FROM projects WHERE id = $1 AND tenant_id = $2',
    [projectId, tenantId]
  );
  if (projCheck.rows.length === 0) {
    throw new Error('PROJECT_NOT_FOUND');
  }

  // Prevent duplicate: check if already linked to this milestoneId
  if (milestoneId) {
    const existing = await pool.query(
      'SELECT id FROM payment_milestones WHERE tenant_id = $1 AND project_id = $2 AND milestone_id = $3',
      [tenantId, projectId, milestoneId]
    );
    if (existing.rows.length > 0) {
      return await updatePaymentMilestone({
        tenantId,
        userId,
        milestoneId: existing.rows[0].id,
        data: { name, amount, percentage, due_date: dueDate },
        bypassApproval: true
      });
    }
  }

  // Prevent duplicate: check if an unlinked scheduled payment milestone exists with same stage
  const stageNum = extractStageNumber(name);
  if (stageNum !== null) {
    const unlinked = await pool.query(
      `SELECT id, name FROM payment_milestones 
       WHERE tenant_id = $1 AND project_id = $2 AND milestone_id IS NULL AND status = 'scheduled'`,
      [tenantId, projectId]
    );
    const matchedUnlinked = unlinked.rows.find(r => extractStageNumber(r.name) === stageNum);
    if (matchedUnlinked) {
      return await updatePaymentMilestone({
        tenantId,
        userId,
        milestoneId: matchedUnlinked.id,
        data: { 
          name, 
          amount: amount || undefined, 
          percentage: percentage || undefined, 
          due_date: dueDate || undefined,
          milestone_id: milestoneId || null 
        },
        bypassApproval: true
      });
    }
  }

  const threshold = await getTenantThreshold(tenantId, 'finance_payment_threshold', 100000.00);
  const isSuperadmin = await isUserSuperadmin(userId);
  const requiresApproval = !bypassApproval && !isSuperadmin && amount && amount > threshold;
  const initialStatus = requiresApproval ? 'pending_approval' : 'scheduled';

  const query = `
    INSERT INTO payment_milestones (tenant_id, project_id, name, amount, percentage, due_date, milestone_id, notes, status, tds_rate, tds_amount)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
  `;
  const values = [tenantId, projectId, name, amount || null, percentage || null, dueDate || null, milestoneId || null, notes || null, initialStatus, tdsRate || 0.00, tdsAmount || 0.00];
  
  const result = await pool.query(query, values);
  const milestone = result.rows[0];

  if (requiresApproval) {
    const { current_stage, total_stages, approval_chain } = await buildApprovalChain(tenantId, 'payment', amount);
    await pool.query(
      `INSERT INTO financial_approvals (
         tenant_id, transaction_type, target_id, amount, requested_by, requested_changes, status, threshold_limit,
         current_stage, total_stages, approval_chain
       ) VALUES ($1, 'payment', $2, $3, $4, $5, 'pending', $6, $7, $8, $9)`,
      [tenantId, milestone.id, amount, userId, JSON.stringify({ type: 'create', data }), threshold, current_stage, total_stages, JSON.stringify(approval_chain)]
    );
  }

  await logAction({
    tenantId,
    userId,
    action: 'create_payment_milestone',
    entity: 'payment_milestone',
    entityId: milestone.id,
    newValue: { name, amount, percentage, dueDate, tdsRate, tdsAmount, requiresApproval }
  });

  return milestone;
}

async function updatePaymentMilestone({ tenantId, userId, milestoneId, data, bypassApproval = false }) {
  const { title, name, amount, due_date, proof_document, status, invoice_reference, paid_at, paid_amount, tds_rate, tds_amount, is_deferred, deferral_reference, milestone_id, milestoneId: linkedMilestoneId, percentage, percent } = data;

  // Retrieve current to check transition
  const currentResult = await pool.query(`SELECT * FROM payment_milestones WHERE id = $1 AND tenant_id = $2`, [milestoneId, tenantId]);
  if (currentResult.rowCount === 0) throw new Error('NOT_FOUND');
  const current = currentResult.rows[0];

  const threshold = await getTenantThreshold(tenantId, 'finance_payment_threshold', 100000.00);
  const isSuperadmin = await isUserSuperadmin(userId);
  const targetAmount = paid_amount !== undefined ? paid_amount : (current.amount || 0);
  const isUpdatingPaidAmount = paid_amount !== undefined && Number(paid_amount) !== Number(current.paid_amount);
  const isMarkingPaid = status === 'paid' && current.status !== 'paid';

  const requiresApproval = !bypassApproval && !isSuperadmin && (
    (isUpdatingPaidAmount && Number(paid_amount) > threshold) ||
    (isMarkingPaid && Number(targetAmount) > threshold)
  );

  if (requiresApproval) {
    // Keep it as pending_approval but do not apply the updates yet
    const updateRes = await pool.query(
      `UPDATE payment_milestones SET status = 'pending_approval' WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [milestoneId, tenantId]
    );
    const updated = updateRes.rows[0];

    const { current_stage, total_stages, approval_chain } = await buildApprovalChain(tenantId, 'payment_update', targetAmount);
    await pool.query(
      `INSERT INTO financial_approvals (
         tenant_id, transaction_type, target_id, amount, requested_by, requested_changes, status, threshold_limit,
         current_stage, total_stages, approval_chain
       ) VALUES ($1, 'payment_update', $2, $3, $4, $5, 'pending', $6, $7, $8, $9)`,
      [tenantId, milestoneId, targetAmount, userId, JSON.stringify({ type: 'update', original_status: current.status, data }), threshold, current_stage, total_stages, JSON.stringify(approval_chain)]
    );

    await logAction({
      tenantId,
      userId,
      action: 'update_payment_milestone',
      entity: 'payment_milestone',
      entityId: milestoneId,
      newValue: { status: 'pending_approval' },
      oldValue: current
    });

    return updated;
  }

  // Ensure proof_document column exists on table if updating proof_document
  if (proof_document !== undefined) {
    try {
      await pool.query(`ALTER TABLE payment_milestones ADD COLUMN IF NOT EXISTS proof_document JSONB;`);
    } catch (e) {
      /* ignore */
    }
  }

  let updateFields = [];
  let values = [];
  let paramIdx = 1;

  if (title !== undefined || name !== undefined) {
    updateFields.push(`name = $${paramIdx++}`);
    values.push(title || name);
  }
  if (amount !== undefined && amount !== current.amount) {
    updateFields.push(`amount = $${paramIdx++}`);
    values.push(amount);
  }
  if (due_date !== undefined) {
    updateFields.push(`due_date = $${paramIdx++}`);
    values.push(due_date);
  }
  if (proof_document !== undefined) {
    updateFields.push(`proof_document = $${paramIdx++}`);
    values.push(proof_document ? (typeof proof_document === 'object' ? JSON.stringify(proof_document) : proof_document) : null);
  }
  if (status) {
    updateFields.push(`status = $${paramIdx++}`);
    values.push(status);
  }
  if (invoice_reference !== undefined) {
    updateFields.push(`invoice_reference = $${paramIdx++}`);
    values.push(invoice_reference);
  }
  if (paid_at !== undefined) {
    updateFields.push(`paid_at = $${paramIdx++}`);
    values.push(paid_at);
  }
  if (paid_amount !== undefined) {
    updateFields.push(`paid_amount = $${paramIdx++}`);
    values.push(paid_amount);
  }
  if (tds_rate !== undefined) {
    updateFields.push(`tds_rate = $${paramIdx++}`);
    values.push(tds_rate);
  }
  if (tds_amount !== undefined) {
    updateFields.push(`tds_amount = $${paramIdx++}`);
    values.push(tds_amount);
  }
  if (is_deferred !== undefined) {
    updateFields.push(`is_deferred = $${paramIdx++}`);
    values.push(is_deferred);
  }
  if (deferral_reference !== undefined) {
    updateFields.push(`deferral_reference = $${paramIdx++}`);
    values.push(deferral_reference);
  }
  const targetMilestoneId = milestone_id !== undefined ? milestone_id : linkedMilestoneId;
  if (targetMilestoneId !== undefined) {
    updateFields.push(`milestone_id = $${paramIdx++}`);
    values.push(targetMilestoneId);
  }
  const targetPct = percentage !== undefined ? percentage : percent;
  if (targetPct !== undefined) {
    updateFields.push(`percentage = $${paramIdx++}`);
    values.push(targetPct);
  }

  if (updateFields.length === 0) return current;

  const tenantIdx = paramIdx++;
  const idIdx = paramIdx;
  values.push(tenantId, milestoneId);
  const updateQuery = `
    UPDATE payment_milestones
    SET ${updateFields.join(', ')}
    WHERE tenant_id = $${tenantIdx} AND id = $${idIdx}
    RETURNING *
  `;

  const result = await pool.query(updateQuery, values);
  const updated = result.rows[0];

  // Auto-activate project on booking advance payment confirmation
  const isAdvanceMilestone = /booking|advance|token/i.test(current.name || '') || /booking|advance/i.test(updated?.name || '');
  const isNowPaid = status === 'paid' || (data.paid_amount !== undefined && Number(data.paid_amount) > 0) || updated?.status === 'paid';
  if (isNowPaid && isAdvanceMilestone) {
    const projCheck = await pool.query(
      "SELECT id, status FROM projects WHERE id = $1 AND tenant_id = $2",
      [current.project_id, tenantId]
    );
    if (projCheck.rows.length > 0 && ['pending_booking', 'pending_payment'].includes(projCheck.rows[0].status)) {
      const advancePaid = Number(updated?.paid_amount || updated?.amount || current.paid_amount || current.amount || 0);
      await pool.query(
        "UPDATE projects SET status = 'active', booking_amount = COALESCE(NULLIF(booking_amount, 0), $1), updated_at = NOW() WHERE id = $2 AND tenant_id = $3",
        [advancePaid, current.project_id, tenantId]
      );
      
      const { clearCachePrefix } = require('../../utils/cache');
      clearCachePrefix(current.project_id).catch(() => {});

      // Log audit action for project status change
      await logAction({
        tenantId,
        userId,
        action: 'project.updated',
        entity: 'project',
        entityId: current.project_id,
        oldValue: { status: projCheck.rows[0].status },
        newValue: { status: 'active' }
      });
    }
  }

  await logAction({
    tenantId,
    userId,
    action: 'update_payment_milestone',
    entity: 'payment_milestone',
    entityId: milestoneId,
    newValue: data,
    oldValue: current
  });

  return updated;
}

module.exports = {
  getPaymentMilestones,
  createPaymentMilestone,
  updatePaymentMilestone,
  syncScheduleToPaymentMilestones
};
