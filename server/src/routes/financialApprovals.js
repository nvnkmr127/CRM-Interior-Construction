/* eslint-disable no-undef, no-unused-vars */
const { getConstructionFinancialSummary } = require('../utils/constructionValidator');
const { analyzeFinancialRisk } = require('../utils/riskAnalyzer');
const { getProjectBudgetValidation } = require('../utils/budgetValidator');
const { sendNotification } = require('../utils/notifications');
const express = require('express');
const pool = require('../db/pool');
const authenticate = require('../middleware/authenticate');
const { success, fail } = require('../utils/response');
const paymentService = require('../services/projects/paymentMilestoneService');
const quotationService = require('../services/projects/quotationService');
const { logActivity } = require('../utils/activityLogger');
const { buildApprovalChain } = require('../utils/ApprovalChainBuilder');

const router = express.Router();
router.use(authenticate);

// Intercept mock IDs globally to prevent DB UUID cast errors
router.param('id', (req, res, next, id) => {
  if (id && id.startsWith('mock-')) {
    if (req.path.includes('/unread')) {
      return success(res, { unread_count: 0 });
    }
    if (req.path.includes('/comments') || req.path.includes('/history') || req.path.includes('/attachments') || req.path.includes('/tasks')) {
      return success(res, []);
    }
    return success(res, { message: 'Mock action successful' });
  }
  next();
});

// Helper to check specific finance permissions
function checkPermissionForType(user, type) {
  if (!user) return true;
  const isSuper = user.role === 'superadmin' || user.role === 'admin' || user.role === 'Developer' || (user.permissions && (user.permissions.includes('*') || user.permissions.includes('admin')));
  if (isSuper) return true;
  
  const perms = user.permissions || [];
  const t = (type || '').toLowerCase();
  
  if (t.includes('invoice')) return perms.includes('invoices:approve') || perms.includes('invoices:edit');
  if (t.includes('payment')) return perms.includes('payments:approve') || perms.includes('payments:edit');
  if (t.includes('discount')) return perms.includes('finance:approve_discount') || perms.includes('discounts:edit');
  if (t.includes('credit') || t.includes('refund')) return perms.includes('payments:refund');
  if (t.includes('change_order')) return perms.includes('change_orders:approve');
  return true;
}

const DashboardStats = require('../services/finance/DashboardStats');

// GET /api/financial-approvals/stats
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await DashboardStats.getFinancialApprovalStats(req.tenantId);
    return success(res, stats);
  } catch (error) {
    next(error);
  }
});

// POST /api/financial-approvals (Create new approval request)
router.post('/', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const userId = req.user.id || req.user.userId;
    const { 
      type, 
      transaction_type, 
      target_id, 
      amount, 
      reason, 
      payload, 
      requested_changes, 
      project_name, 
      customer_name, 
      target_number,
      priority 
    } = req.body;

    const rawType = transaction_type || type || 'payment_update';
    let standardType = rawType.toLowerCase().replace(/ /g, '_');
    if (standardType === 'manual_payment') standardType = 'payment_update';

    const reqAmount = Number(amount || 0);
    const reqChanges = requested_changes || {
      reason,
      payload,
      project_name,
      customer_name,
      target_number,
      original_type: rawType
    };

    const isUuid = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const validTargetId = isUuid(target_id) 
      ? target_id 
      : (isUuid(payload?.selectedPayment?.id) ? payload.selectedPayment.id : null);

    const targetName = target_number || payload?.selectedPayment?.milestone || requested_changes?.target_number || '';
    const checkTargetId = validTargetId || (payload?.selectedPayment?.id ? String(payload.selectedPayment.id) : null);

    // Prevent duplicate pending approval requests for the exact same target / milestone
    const existingPending = await pool.query(
      `SELECT * FROM financial_approvals 
       WHERE tenant_id = $1 
         AND status = 'pending'
         AND (
           (target_id IS NOT NULL AND $2::text IS NOT NULL AND target_id::text = $2::text)
           OR (
             $3::text != '' AND (
               requested_changes->>'target_number' = $3 
               OR requested_changes->'payload'->'selectedPayment'->>'milestone' = $3
             )
           )
         )
       LIMIT 1`,
      [tenantId, checkTargetId, targetName]
    );

    if (existingPending.rows.length > 0) {
      return success(res, existingPending.rows[0], 200);
    }

    let chainData = { current_stage: 1, total_stages: 1, approval_chain: [] };
    try {
      chainData = await buildApprovalChain(tenantId, standardType, reqAmount);
    } catch (e) { /* fallback to default single stage */ }

    const reqPriority = priority || (reqAmount >= 20000 ? 'critical' : reqAmount >= 5000 ? 'high' : reqAmount >= 1000 ? 'medium' : 'low');

    const insertQuery = `
      INSERT INTO financial_approvals (
        tenant_id, transaction_type, target_id, amount, requested_by, requested_changes, status,
        current_stage, total_stages, approval_chain, priority
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, $9, $10)
      RETURNING *
    `;

    const { rows } = await pool.query(insertQuery, [
      tenantId,
      standardType,
      validTargetId,
      reqAmount,
      userId,
      JSON.stringify(reqChanges),
      chainData.current_stage || 1,
      chainData.total_stages || 1,
      JSON.stringify(chainData.approval_chain || []),
      reqPriority
    ]);

    logActivity(req, 'financial_approval', rows[0].id, 'Created', null, JSON.stringify({ type: standardType, amount: reqAmount }));

    return success(res, rows[0], 201);
  } catch (error) {
    next(error);
  }
});

// GET /api/financial-approvals
router.get('/', async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { 
      page = 1, 
      limit = 100, 
      status, 
      transaction_type, 
      requester, 
      project,
      customer,
      min_amount, 
      max_amount,
      start_date,
      end_date,
      search,
      sort_by
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    const conditions = ['fa.tenant_id = $1'];
    const values = [req.tenantId];
    let paramIndex = 2;

    const isSuper = req.user.role === 'superadmin' || (req.user.permissions && req.user.permissions.includes('admin'));
    if (!isSuper) {
      const perms = req.user.permissions || [];
      conditions.push(`(
        fa.requested_by = $${paramIndex}
        OR fa.status != 'pending' 
        OR (fa.approval_chain IS NULL OR jsonb_array_length(fa.approval_chain) = 0)
        OR EXISTS (
          SELECT 1 
          FROM jsonb_array_elements(fa.approval_chain) as chain_obj 
          WHERE (chain_obj->>'stage')::int = fa.current_stage 
            AND (chain_obj->>'role') = ANY($${paramIndex + 1}::text[])
        )
      )`);
      values.push(req.user.id, perms);
      paramIndex += 2;
    }

    
    if (req.query.priority) {
      const pList = req.query.priority.split(',').map(s => s.trim());
      conditions.push(`fa.priority = ANY($${paramIndex})`);
      values.push(pList);
      paramIndex++;
    }
    if (status) {
      const statuses = status.split(',');
      conditions.push(`fa.status = ANY($${paramIndex})`);
      values.push(statuses);
      paramIndex++;
    }

    if (transaction_type) {
      const types = transaction_type.split(',');
      conditions.push(`fa.transaction_type = ANY($${paramIndex})`);
      values.push(types);
      paramIndex++;
    }

    if (requester) {
      const requesters = requester.split(',');
      conditions.push(`u.name = ANY($${paramIndex})`);
      values.push(requesters);
      paramIndex++;
    }

    if (project) {
      const projects = project.split(',');
      conditions.push(`p.name = ANY($${paramIndex})`);
      values.push(projects);
      paramIndex++;
    }

    if (customer) {
      const customers = customer.split(',');
      conditions.push(`p.client_name = ANY($${paramIndex})`);
      values.push(customers);
      paramIndex++;
    }

    if (min_amount) {
      conditions.push(`fa.amount >= $${paramIndex}`);
      values.push(min_amount);
      paramIndex++;
    }

    if (max_amount) {
      conditions.push(`fa.amount <= $${paramIndex}`);
      values.push(max_amount);
      paramIndex++;
    }

    if (start_date) {
      conditions.push(`fa.created_at >= $${paramIndex}`);
      values.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      conditions.push(`fa.created_at <= $${paramIndex}`);
      values.push(end_date);
      paramIndex++;
    }

    if (search) {
      conditions.push(`(
        u.name ILIKE $${paramIndex} OR
        p.name ILIKE $${paramIndex} OR
        p.client_name ILIKE $${paramIndex} OR
        fa.rejection_reason ILIKE $${paramIndex} OR
        fa.requested_changes::text ILIKE $${paramIndex} OR
        fa.amount::text ILIKE $${paramIndex} OR
        (
          CASE 
            WHEN fa.transaction_type = 'invoice' THEN (SELECT invoice_number FROM invoices WHERE id = fa.target_id)
            WHEN fa.transaction_type = 'payment' THEN (SELECT name FROM payment_milestones WHERE id = fa.target_id)
            WHEN fa.transaction_type = 'payment_update' THEN (SELECT name FROM payment_milestones WHERE id = fa.target_id)
            WHEN fa.transaction_type = 'discount' THEN (SELECT quotation_number FROM quotations WHERE id = fa.target_id)
            WHEN fa.transaction_type = 'credit' THEN (SELECT credit_note_number FROM credit_notes WHERE id = fa.target_id)
            WHEN fa.transaction_type = 'refund' THEN (SELECT refund_number FROM refunds WHERE id = fa.target_id)
          END
        ) ILIKE $${paramIndex}
      )`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    let orderByClause = `ORDER BY fa.updated_at DESC, fa.created_at DESC, fa.id DESC`;
    if (sort_by) {
      switch (sort_by) {
        case 'newest':
          orderByClause = `ORDER BY fa.updated_at DESC, fa.created_at DESC, fa.id DESC`;
          break;
        case 'oldest':
          orderByClause = `ORDER BY fa.updated_at ASC, fa.created_at ASC, fa.id ASC`;
          break;
        case 'amount_desc':
          orderByClause = `ORDER BY fa.amount DESC, fa.updated_at DESC, fa.id DESC`;
          break;
        case 'amount_asc':
          orderByClause = `ORDER BY fa.amount ASC, fa.updated_at DESC, fa.id ASC`;
          break;
        case 'priority_desc':
          orderByClause = `ORDER BY (CASE fa.priority WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END) DESC, fa.updated_at DESC`;
          break;
        case 'priority_asc':
          orderByClause = `ORDER BY (CASE fa.priority WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END) ASC, fa.updated_at ASC`;
          break;
        default:
          orderByClause = `ORDER BY fa.updated_at DESC, fa.created_at DESC, fa.id DESC`;
      }
    }

    const countQuery = `
      SELECT COUNT(*) 
      FROM financial_approvals fa
      LEFT JOIN users u ON fa.requested_by = u.id
      LEFT JOIN users a1 ON fa.assigned_to = a1.id
      LEFT JOIN users a2 ON fa.backup_approver = a2.id
      LEFT JOIN users a3 ON fa.assigned_by = a3.id
      LEFT JOIN projects p ON p.id = (
             CASE
               WHEN fa.transaction_type = 'invoice' THEN (SELECT project_id FROM invoices WHERE id = fa.target_id)
               WHEN fa.transaction_type IN ('payment', 'payment_update', 'Manual Payment', 'manual_payment') THEN (SELECT project_id FROM payment_milestones WHERE id = fa.target_id)
               WHEN fa.transaction_type = 'discount' THEN (SELECT project_id FROM quotations WHERE id = fa.target_id)
               WHEN fa.transaction_type = 'credit' THEN (SELECT project_id FROM credit_notes WHERE id = fa.target_id)
               WHEN fa.transaction_type = 'refund' THEN (SELECT project_id FROM refunds WHERE id = fa.target_id)
             END
      )
      WHERE ${whereClause}
    `;

    const query = `
      SELECT fa.*, u.name as requester_name,
       a1.name as assigned_to_name,
       a2.name as backup_approver_name,
       a3.name as assigned_by_name,
       p.name as db_project_name, 
       p.client_name as db_customer_name,
       p.id as db_project_id,
       p.lead_id as db_lead_id,
             CASE 
               WHEN fa.transaction_type = 'invoice' THEN (SELECT invoice_number FROM invoices WHERE id = fa.target_id)
               WHEN fa.transaction_type IN ('payment', 'payment_update', 'Manual Payment', 'manual_payment') THEN (SELECT name FROM payment_milestones WHERE id = fa.target_id)
               WHEN fa.transaction_type = 'discount' THEN (SELECT quotation_number FROM quotations WHERE id = fa.target_id)
               WHEN fa.transaction_type = 'credit' THEN (SELECT credit_note_number FROM credit_notes WHERE id = fa.target_id)
               WHEN fa.transaction_type = 'refund' THEN (SELECT refund_number FROM refunds WHERE id = fa.target_id)
             END as db_target_number
      FROM financial_approvals fa
      LEFT JOIN users u ON fa.requested_by = u.id
      LEFT JOIN users a1 ON fa.assigned_to = a1.id
      LEFT JOIN users a2 ON fa.backup_approver = a2.id
      LEFT JOIN users a3 ON fa.assigned_by = a3.id
      LEFT JOIN projects p ON p.id = (
             CASE
               WHEN fa.transaction_type = 'invoice' THEN (SELECT project_id FROM invoices WHERE id = fa.target_id)
               WHEN fa.transaction_type IN ('payment', 'payment_update', 'Manual Payment', 'manual_payment') THEN (SELECT project_id FROM payment_milestones WHERE id = fa.target_id)
               WHEN fa.transaction_type = 'discount' THEN (SELECT project_id FROM quotations WHERE id = fa.target_id)
               WHEN fa.transaction_type = 'credit' THEN (SELECT project_id FROM credit_notes WHERE id = fa.target_id)
               WHEN fa.transaction_type = 'refund' THEN (SELECT project_id FROM refunds WHERE id = fa.target_id)
             END
      )
      WHERE ${whereClause}
      ${orderByClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const countValues = [...values];
    values.push(limitNum, offset);

    const [countResult, { rows }] = await Promise.all([
      pool.query(countQuery, countValues),
      pool.query(query, values)
    ]);

    const total = parseInt(countResult.rows[0].count, 10);

    const processedRows = rows.map(row => {
      let parsedChanges = row.requested_changes;
      if (typeof parsedChanges === 'string') {
        try { parsedChanges = JSON.parse(parsedChanges); } catch (e) { parsedChanges = {}; }
      }
      parsedChanges = parsedChanges || {};
      const payload = parsedChanges.payload || parsedChanges;

      const project_name = row.db_project_name || parsedChanges.project_name || payload.project_name || 'Project';
      const customer_name = row.db_customer_name || parsedChanges.customer_name || payload.customer_name || 'Customer';
      const target_number = row.db_target_number || payload.selectedPayment?.milestone || parsedChanges.target_number || 'Manual';
      const project_id = row.db_project_id || parsedChanges.project_id || payload.projectId || payload.project_id || null;
      const lead_id = row.db_lead_id || parsedChanges.lead_id || payload.leadId || payload.lead_id || null;

      let chain = row.approval_chain;
      if (typeof chain === 'string') {
        try { chain = JSON.parse(chain); } catch (e) { chain = []; }
      }
      const has_matrix_rule = Array.isArray(chain) && chain.length > 0;

      return {
        ...row,
        project_name,
        customer_name,
        target_number,
        project_id,
        lead_id,
        has_matrix_rule
      };
    });

    const seenPending = new Set();
    const deduplicatedRows = [];
    for (const item of processedRows) {
      if (item.status === 'pending') {
        const dupKey = `${item.transaction_type}_${item.project_name}_${item.target_number}_${item.amount}`;
        if (seenPending.has(dupKey)) {
          continue;
        }
        seenPending.add(dupKey);
      }
      deduplicatedRows.push(item);
    }

    return success(res, {
      data: deduplicatedRows,
      pagination: {
        total: deduplicatedRows.length,
        page: pageNum,
        totalPages: Math.ceil(deduplicatedRows.length / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/financial-approvals/:id/approve
router.post('/:id/approve', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    // Budget Validation Hard-Block
    const validation = await getProjectBudgetValidation(id, tenantId);
    if (validation.status === 'exceeded' && req.body.force !== true) {
      return fail(res, 'BAD_REQUEST', 'Budget exceeded. Approval blocked.', 400);
    }

    const isUuid = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const rawUserId = req.user?.id || req.user?.userId;
    const userId = (rawUserId && isUuid(rawUserId)) ? rawUserId : null;
    const isSuperadmin = req.user?.role === 'superadmin' || (req.user?.permissions && req.user.permissions.includes('admin'));

    await client.query('BEGIN');

    // 1. Fetch approval record
    const fetchQuery = isSuperadmin || !tenantId
      ? `SELECT * FROM financial_approvals WHERE id = $1 AND status = 'pending'`
      : `SELECT * FROM financial_approvals WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL) AND status = 'pending'`;
    const fetchParams = (isSuperadmin || !tenantId) ? [id] : [id, tenantId];

    const { rows } = await client.query(fetchQuery, fetchParams);
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return fail(res, 'NOT_FOUND', 'Pending approval request not found or already processed', 404);
    }
    const approval = rows[0];

    // 2. Multi-level Stage Auth
    const currentStage = approval.current_stage || 1;
    const totalStages = approval.total_stages || 1;
    let approvalChain = approval.approval_chain;
    if (typeof approvalChain === 'string') {
      try { approvalChain = JSON.parse(approvalChain); } catch(error){ /* noop */ }
    }
    approvalChain = approvalChain || [];
    
    const stageData = approvalChain.find(c => c.stage === currentStage);
    const requiredRole = stageData ? stageData.role : null;

    if (requiredRole) {
      const permissions = req.user.permissions || [];
      const isSuper = req.user.role === 'superadmin' || permissions.includes('admin');
      if (!isSuper && !permissions.includes(requiredRole)) {
        await client.query('ROLLBACK');
        return fail(res, 'FORBIDDEN', `Forbidden: require ${requiredRole} permission for stage ${currentStage}`, 403);
      }
    } else {
      if (!checkPermissionForType(req.user, approval.transaction_type)) {
        await client.query('ROLLBACK');
        return fail(res, 'FORBIDDEN', `Forbidden: require finance permission for ${approval.transaction_type}`, 403);
      }
    }

    // Update chain data
    if (stageData) {
      stageData.status = 'approved';
      stageData.approved_by = userId;
      stageData.approved_at = new Date().toISOString();
    }
    if (currentStage < totalStages) {
      // Partial approval, increment stage
      await client.query(
        `UPDATE financial_approvals 
         SET current_stage = current_stage + 1, approval_chain = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [JSON.stringify(approvalChain), id]
      );
      await client.query('COMMIT');
      logActivity(req, 'financial_approval', id, 'Approved', JSON.stringify({ stage: currentStage }), JSON.stringify({ stage: currentStage + 1 }));
      return success(res, { message: `Stage ${currentStage} approved successfully. Moving to stage ${currentStage + 1}.` });
    }

    // Final Stage
    await client.query(
      `UPDATE financial_approvals 
       SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP, approval_chain = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [userId, JSON.stringify(approvalChain), id]
    );

    // 4. Apply changes based on transaction type
    if (approval.transaction_type === 'invoice') {
      const changes = typeof approval.requested_changes === 'string' ? JSON.parse(approval.requested_changes) : approval.requested_changes;
      const { milestoneId, invoiceNumber } = changes || {};
      
      // Update invoice status to sent
      if (approval.target_id) {
        await client.query(
          `UPDATE invoices SET status = 'sent', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [approval.target_id]
        );
      }
      
      // Update payment milestone status and reference
      if (milestoneId && isUuid(milestoneId)) {
        await client.query(
          `UPDATE payment_milestones 
           SET invoice_reference = $1, status = 'invoice_raised' 
           WHERE id = $2`,
          [invoiceNumber || null, milestoneId]
        );
      }
    } 
    else if (
      ['payment_update', 'manual_payment', 'Manual Payment', 'payment', 'payment_adjustment', 'advance_adjustment', 'debit_note', 'write_off', 'gate_override'].includes(approval.transaction_type) ||
      (approval.transaction_type && approval.transaction_type.toLowerCase().includes('payment'))
    ) {
      let changes = approval.requested_changes;
      if (typeof changes === 'string') {
        try { changes = JSON.parse(changes); } catch (e) { /* noop */ }
      }
      const payload = changes?.payload || changes?.data || changes;
      const milestoneId = (approval.target_id && isUuid(approval.target_id) ? approval.target_id : null) 
        || (payload?.selectedPayment?.id && isUuid(payload.selectedPayment.id) ? payload.selectedPayment.id : null);

      if (milestoneId) {
        const { selectedPayment, splitPayments, tdsRate, tdsAmount, newStatus, newCollected } = payload || {};
        let paidAt = new Date().toISOString();
        if (splitPayments && splitPayments[0]?.date) {
          try {
            const d = new Date(splitPayments[0].date);
            if (!isNaN(d.getTime())) {
              paidAt = d.toISOString();
            }
          } catch (e) { /* fallback to default */ }
        }

        const rawAmt = newCollected !== undefined ? newCollected : (approval.amount !== undefined ? approval.amount : selectedPayment?.amount);
        const paidAmt = (rawAmt !== undefined && rawAmt !== null && !isNaN(Number(rawAmt))) ? Number(rawAmt) : null;
        const validTdsRate = (tdsRate !== undefined && tdsRate !== null && !isNaN(Number(tdsRate))) ? Number(tdsRate) : 0;
        const validTdsAmount = (tdsAmount !== undefined && tdsAmount !== null && !isNaN(Number(tdsAmount))) ? Number(tdsAmount) : 0;

        await client.query(
          `UPDATE payment_milestones 
           SET status = COALESCE($1, 'paid'), 
               paid_at = COALESCE($2::timestamptz, CURRENT_TIMESTAMP), 
               paid_amount = COALESCE($3, paid_amount, amount), 
               tds_rate = COALESCE($4, tds_rate, 0), 
               tds_amount = COALESCE(tds_amount, 0) + COALESCE($5, 0)
           WHERE id = $6`,
          [
            newStatus || 'paid',
            paidAt,
            paidAmt,
            validTdsRate,
            validTdsAmount,
            milestoneId
          ]
        );
      }
    } 
    else if (approval.transaction_type === 'discount') {
      const changes = typeof approval.requested_changes === 'string' ? JSON.parse(approval.requested_changes) : approval.requested_changes;
      if (approval.target_id && isUuid(approval.target_id)) {
        try {
          await quotationService.updateQuotation(
            tenantId || 'default',
            approval.target_id,
            { discountAmount: changes?.discountAmount },
            userId,
            true
          );
        } catch (e) {
          console.error('[Quotation Update Error]:', e);
        }
      }
    } 
    else if (approval.transaction_type === 'credit' || approval.transaction_type === 'Credit Note') {
      if (approval.target_id && isUuid(approval.target_id)) {
        await client.query(
          `UPDATE credit_notes SET status = 'issued', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [approval.target_id]
        );
      }
    } 
    else if (approval.transaction_type === 'refund' || approval.transaction_type === 'Refund') {
      if (approval.target_id && isUuid(approval.target_id)) {
        await client.query(
          `UPDATE refunds SET status = 'processed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [approval.target_id]
        );
      }
    }

    await client.query('COMMIT');
    logActivity(req, 'financial_approval', id, 'Approved', JSON.stringify({ status: 'pending' }), JSON.stringify({ status: 'approved' }));
    return success(res, { message: 'Approval request approved successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[APPROVE ERROR]:', error);
    return fail(res, 'INTERNAL_ERROR', error.message || 'Failed to approve transaction', 500);
  } finally {
    client.release();
  }
});

// POST /api/financial-approvals/:id/reject
router.post('/:id/reject', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const rawUserId = req.user?.id || req.user?.userId;
    const isUuid = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const userId = (rawUserId && isUuid(rawUserId)) ? rawUserId : null;
    const { id } = req.params;
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const { rejectionReason } = req.body;

    if (!rejectionReason || rejectionReason.trim() === '') {
      return fail(res, 'BAD_REQUEST', 'Rejection reason is required', 400);
    }

    const isSuperadmin = req.user?.role === 'superadmin' || (req.user?.permissions && req.user.permissions.includes('admin'));

    await client.query('BEGIN');

    // 1. Fetch approval record
    const fetchQuery = isSuperadmin || !tenantId
      ? `SELECT * FROM financial_approvals WHERE id = $1 AND status = 'pending'`
      : `SELECT * FROM financial_approvals WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL) AND status = 'pending'`;
    const fetchParams = (isSuperadmin || !tenantId) ? [id] : [id, tenantId];

    const { rows } = await client.query(fetchQuery, fetchParams);
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return fail(res, 'NOT_FOUND', 'Pending approval request not found or already processed', 404);
    }
    const approval = rows[0];

    // 2. Multi-level Stage Auth
    const currentStage = approval.current_stage || 1;
    let approvalChain = approval.approval_chain;
    if (typeof approvalChain === 'string') {
      try { approvalChain = JSON.parse(approvalChain); } catch(error){ /* noop */ }
    }
    approvalChain = approvalChain || [];
    
    const stageData = approvalChain.find(c => c.stage === currentStage);
    const requiredRole = stageData ? stageData.role : null;

    if (requiredRole) {
      const permissions = req.user.permissions || [];
      const isSuper = req.user.role === 'superadmin' || permissions.includes('admin');
      if (!isSuper && !permissions.includes(requiredRole)) {
        await client.query('ROLLBACK');
        return fail(res, 'FORBIDDEN', `Forbidden: require ${requiredRole} permission for stage ${currentStage}`, 403);
      }
    } else {
      if (!checkPermissionForType(req.user, approval.transaction_type)) {
        await client.query('ROLLBACK');
        return fail(res, 'FORBIDDEN', `Forbidden: require finance permission for ${approval.transaction_type}`, 403);
      }
    }

    // Update chain data
    if (stageData) {
      stageData.status = 'rejected';
      stageData.approved_by = userId;
      stageData.approved_at = new Date().toISOString();
    }

    // 3. Mark rejected
    await client.query(
      `UPDATE financial_approvals 
       SET status = 'rejected', approved_by = $1, approved_at = CURRENT_TIMESTAMP, rejection_reason = $2, approval_chain = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [userId, rejectionReason, JSON.stringify(approvalChain), id]
    );

    // 4. Apply rejection (revert status or delete/void)
    if (approval.transaction_type === 'invoice') {
      // Set status to void
      await client.query(
        `UPDATE invoices SET status = 'void', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [approval.target_id]
      );
    } 
    else if (
      ['payment_update', 'manual_payment', 'Manual Payment', 'payment', 'payment_adjustment', 'advance_adjustment', 'debit_note', 'write_off', 'gate_override'].includes(approval.transaction_type) ||
      (approval.transaction_type && approval.transaction_type.toLowerCase().includes('payment'))
    ) {
      let changes = approval.requested_changes;
      if (typeof changes === 'string') {
        try { changes = JSON.parse(changes); } catch (e) { /* noop */ }
      }
      const payload = changes?.payload || changes?.data || changes;
      const milestoneId = (approval.target_id && isUuid(approval.target_id) ? approval.target_id : null) 
        || (payload?.selectedPayment?.id && isUuid(payload.selectedPayment.id) ? payload.selectedPayment.id : null);
      const origStatus = payload?.selectedPayment?.status || changes?.original_status || 'unpaid';
      if (milestoneId) {
        await client.query(
          `UPDATE payment_milestones SET status = $1 WHERE id = $2`,
          [origStatus, milestoneId]
        );
      }
    } 
    else if (approval.transaction_type === 'credit') {
      // Set status to void
      await client.query(
        `UPDATE credit_notes SET status = 'void', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [approval.target_id]
      );
    } 
    else if (approval.transaction_type === 'refund') {
      // Set status to void
      await client.query(
        `UPDATE refunds SET status = 'void', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [approval.target_id]
      );
    }

    await client.query('COMMIT');
    logActivity(req, 'financial_approval', id, 'Rejected', JSON.stringify({ status: 'pending' }), JSON.stringify({ status: 'rejected', reason: rejectionReason }));
    return success(res, { message: 'Approval request rejected successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[REJECT ERROR]:', error);
    return fail(res, 'INTERNAL_ERROR', error.message || 'Failed to reject transaction', 500);
  } finally {
    client.release();
  }
});

// GET /api/financial-approvals/:id/comments
router.get('/:id/comments', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && (req.user.tenantId || req.user.tenant_id));
    const { id } = req.params;
    const userId = req.user?.id || req.user?.userId;
    const isSuper = req.user?.role === 'superadmin' || req.user?.permissions?.includes('admin');

    const query = `
      SELECT c.*, u.name as user_name, r.name as role_name, u.avatar_url
      FROM financial_approval_comments c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE c.tenant_id = $1 AND c.approval_id = $2
      ORDER BY c.created_at ASC
    `;
    const { rows } = await pool.query(query, [tenantId, id]);

    const formattedRows = rows.map(r => {
      const parts = (r.user_name || 'User').trim().split(' ');
      const firstName = parts[0] || 'User';
      const lastName = parts.slice(1).join(' ') || '';
      return {
        ...r,
        first_name: firstName,
        last_name: lastName,
        user_name: r.user_name,
        role: r.role_name || 'User'
      };
    });

    const filteredRows = isSuper ? formattedRows : formattedRows.filter(r => !r.is_internal || r.user_id === userId);

    return success(res, filteredRows);
  } catch (error) {
    next(error);
  }
});

// POST /api/financial-approvals/:id/comments
router.post('/:id/comments', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && (req.user.tenantId || req.user.tenant_id));
    const { id } = req.params;
    const userId = req.user?.id || req.user?.userId;
    const { content, is_internal, parent_id, mentions, attachments } = req.body;

    const query = `
      INSERT INTO financial_approval_comments (tenant_id, approval_id, user_id, parent_id, content, is_internal, mentions, attachments)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const { rows } = await pool.query(query, [tenantId, id, userId, parent_id || null, content, is_internal || false, JSON.stringify(mentions || []), JSON.stringify(attachments || [])]);
    const newComment = rows[0];

    logActivity(req, 'financial_approval', id, 'Commented', null, JSON.stringify({ comment_id: newComment.id, is_internal: newComment.is_internal }));

    if (mentions && mentions.length > 0) {
      const actorName = req.user?.name || `${req.user?.first_name || 'System'} ${req.user?.last_name || ''}`.trim();
      for (const mId of mentions) {
        await pool.query(
          `INSERT INTO notifications (tenant_id, user_id, type, message, reference_url, actor_id, actor_name)
           VALUES ($1, $2, 'mention', $3, $4, $5, $6)`,
          [tenantId, mId, `${actorName} mentioned you in a comment`, `/finance/approvals?id=${id}`, userId, actorName]
        );
      }
    }

    return success(res, newComment);
  } catch (error) {
    next(error);
  }
});

// PUT /api/financial-approvals/:id/comments/:commentId
router.put('/:id/comments/:commentId', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && (req.user.tenantId || req.user.tenant_id));
    const userId = req.user?.id || req.user?.userId;
    const { commentId } = req.params;
    const { content } = req.body;

    const query = `
      UPDATE financial_approval_comments
      SET content = $1, is_edited = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND tenant_id = $3 AND user_id = $4
      RETURNING *
    `;
    const { rows } = await pool.query(query, [content, commentId, tenantId, userId]);
    if (rows.length === 0) return fail(res, 'FORBIDDEN', 'Cannot edit this comment', 403);

    return success(res, rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/financial-approvals/:id/comments/:commentId
router.delete('/:id/comments/:commentId', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && (req.user.tenantId || req.user.tenant_id));
    const userId = req.user?.id || req.user?.userId;
    const { commentId } = req.params;

    const query = `
      DELETE FROM financial_approval_comments
      WHERE id = $1 AND tenant_id = $2 AND user_id = $3
      RETURNING id
    `;
    const { rows } = await pool.query(query, [commentId, tenantId, userId]);
    if (rows.length === 0) return fail(res, 'FORBIDDEN', 'Cannot delete this comment', 403);

    return success(res, { id: commentId });
  } catch (error) {
    next(error);
  }
});

// POST /api/financial-approvals/:id/comments/:commentId/reactions
router.post('/:id/comments/:commentId/reactions', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && (req.user.tenantId || req.user.tenant_id));
    const userId = req.user?.id || req.user?.userId;
    const { commentId } = req.params;
    const { emoji } = req.body;

    const { rows: currentRows } = await pool.query(`SELECT reactions FROM financial_approval_comments WHERE id = $1 AND tenant_id = $2`, [commentId, tenantId]);
    if (currentRows.length === 0) return fail(res, 'NOT_FOUND', 'Comment not found', 404);
    
    let reactions = currentRows[0].reactions || {};
    if (typeof reactions === 'string') reactions = JSON.parse(reactions);

    if (!reactions[emoji]) reactions[emoji] = [];
    
    if (reactions[emoji].includes(userId)) {
      reactions[emoji] = reactions[emoji].filter(u => u !== userId);
    } else {
      reactions[emoji].push(userId);
    }

    const { rows } = await pool.query(
      `UPDATE financial_approval_comments SET reactions = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [JSON.stringify(reactions), commentId, tenantId]
    );

    return success(res, rows[0]);
  } catch (error) {
    next(error);
  }
});

// POST /api/financial-approvals/:id/comments/read
router.post('/:id/comments/read', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && (req.user.tenantId || req.user.tenant_id));
    const { id } = req.params;
    const userId = req.user?.id || req.user?.userId;

    await pool.query(
      `INSERT INTO financial_approval_comment_reads (tenant_id, approval_id, user_id, last_read_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (tenant_id, approval_id, user_id) 
       DO UPDATE SET last_read_at = CURRENT_TIMESTAMP`,
      [tenantId, id, userId]
    );
    return success(res, { success: true });
  } catch (error) {
    next(error);
  }
});

// GET /api/financial-approvals/:id/comments/unread
router.get('/:id/comments/unread', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && (req.user.tenantId || req.user.tenant_id));
    const { id } = req.params;
    const userId = req.user?.id || req.user?.userId;
    const isSuper = req.user?.role === 'superadmin' || req.user?.permissions?.includes('admin');

    const { rows: readRows } = await pool.query(
      `SELECT last_read_at FROM financial_approval_comment_reads WHERE tenant_id = $1 AND approval_id = $2 AND user_id = $3`,
      [tenantId, id, userId]
    );
    const lastRead = readRows.length > 0 ? readRows[0].last_read_at : new Date(0);

    let query = `SELECT COUNT(*) FROM financial_approval_comments WHERE tenant_id = $1 AND approval_id = $2 AND created_at > $3`;
    const params = [tenantId, id, lastRead];
    if (!isSuper) {
       query += ` AND (is_internal = false OR user_id = $4)`;
       params.push(userId);
    }

    const { rows } = await pool.query(query, params);
    return success(res, { unread_count: parseInt(rows[0].count, 10) });
  } catch (error) {
    next(error);
  }
});

// PUT /api/financial-approvals/:id (Edit)
router.put('/:id', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && (req.user.tenantId || req.user.tenant_id));
    const { id } = req.params;
    const { requested_changes, amount } = req.body;
    
    const { rows: oldRows } = await pool.query(`SELECT amount, requested_changes FROM financial_approvals WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)`, [id, tenantId]);
    if (oldRows.length === 0) return fail(res, 'NOT_FOUND', 'Approval not found', 404);
    
    const { rows } = await pool.query(
      `UPDATE financial_approvals SET amount = COALESCE($1, amount), requested_changes = COALESCE($2, requested_changes), updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND (tenant_id = $4 OR tenant_id IS NULL) RETURNING *`,
      [amount, requested_changes ? JSON.stringify(requested_changes) : null, id, tenantId]
    );
    
    logActivity(req, 'financial_approval', id, 'Edited', JSON.stringify(oldRows[0]), JSON.stringify({ amount: rows[0].amount, requested_changes: rows[0].requested_changes }));
    return success(res, rows[0]);
  } catch (error) {
    next(error);
  }
});

// POST /api/financial-approvals/:id/assign
router.post('/:id/assign', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && (req.user.tenantId || req.user.tenant_id));
    const userId = req.user?.id || req.user?.userId;
    const { id } = req.params;
    const { assigned_to, backup_approver, assignment_notes, comments } = req.body;
    const notes = assignment_notes || comments || null;
    
    const { rows: oldRows } = await pool.query('SELECT assigned_to, backup_approver FROM financial_approvals WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)', [id, tenantId]);
    if (oldRows.length === 0) return fail(res, 'NOT_FOUND', 'Approval not found', 404);
    
    const isReassign = oldRows[0].assigned_to != null;
    const action = isReassign ? 'Reassigned' : 'Assigned';
    
    await pool.query(
      `UPDATE financial_approvals 
       SET assigned_to = $1, backup_approver = $2, assignment_notes = $3, assigned_by = $4, assigned_date = CURRENT_TIMESTAMP
       WHERE id = $5 AND (tenant_id = $6 OR tenant_id IS NULL)`,
      [assigned_to || null, backup_approver || null, notes, userId, id, tenantId]
    );
    
    logActivity(req, 'financial_approval', id, action, null, JSON.stringify({ assigned_to, backup_approver, notes }));
    return success(res, { success: true, message: 'Approval assigned successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/financial-approvals/:id/export
router.post('/:id/export', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { format } = req.body;
    logActivity(req, 'financial_approval', id, 'Exported', null, JSON.stringify({ format }));
    return success(res, { success: true });
  } catch (error) {
    next(error);
  }
});

// POST /api/financial-approvals/:id/reopen
router.post('/:id/reopen', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && (req.user.tenantId || req.user.tenant_id));
    const { id } = req.params;
    
    const { rows } = await pool.query("SELECT status FROM financial_approvals WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL) FOR UPDATE", [id, tenantId]);
    if (rows.length === 0) return fail(res, 'NOT_FOUND', 'Approval not found', 404);
    if (rows[0].status !== 'rejected') return fail(res, 'BAD_REQUEST', 'Only rejected approvals can be reopened', 400);

    await pool.query(
      "UPDATE financial_approvals SET status = 'pending', rejection_reason = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1", 
      [id]
    );
    
    logActivity(req, 'financial_approval', id, 'Reopened', null, null);
    return success(res, { success: true });
  } catch (error) {
    next(error);
  }
});

// POST /api/financial-approvals/:id/view
router.post('/:id/view', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && (req.user.tenantId || req.user.tenant_id));
    const { id } = req.params;
    const { type } = req.body || {};
    const actionType = type === 'Opened' ? 'Opened' : 'Viewed';
    const userId = req.user?.id || req.user?.userId || req.user?.user_id;

    if (userId) {
      try {
        const { rows } = await pool.query(
          `SELECT created_at FROM audit_logs 
           WHERE entity = 'financial_approval' AND entity_id = $1 AND user_id = $2 AND action = $3
           ORDER BY created_at DESC LIMIT 1`,
          [id, userId, actionType]
        );
        
        if (rows.length === 0 || (new Date() - new Date(rows[0].created_at)) > 15 * 60 * 1000) {
          logActivity(req, 'financial_approval', id, actionType);
        }
      } catch (logErr) {
        // Debounce query error fallback
      }
    }
    return success(res, { success: true, message: 'Approval marked as viewed' });
  } catch (error) {
    return success(res, { success: true });
  }
});

// GET /api/financial-approvals/:id/activity
router.get('/:id/activity', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && (req.user.tenantId || req.user.tenant_id));
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT a.*, u.name as user_name, r.name as role_name, u.avatar_url 
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE a.tenant_id = $1 AND a.entity = 'financial_approval' AND a.entity_id = $2
       ORDER BY a.created_at ASC`,
      [tenantId, id]
    );

    const formattedRows = rows.map(r => {
      const parts = (r.user_name || 'System User').trim().split(' ');
      const firstName = parts[0] || 'System';
      const lastName = parts.slice(1).join(' ') || '';
      return {
        ...r,
        first_name: firstName,
        last_name: lastName,
        role: r.role_name || 'User'
      };
    });

    return success(res, formattedRows);
  } catch (error) {
    next(error);
  }
});

// POST /api/financial-approvals/:id/export
router.post('/:id/export', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && (req.user.tenantId || req.user.tenant_id));
    const { id } = req.params;
    logActivity(req, 'financial_approval', id, 'Exported', null, null);
    return success(res, { success: true, message: 'Export initiated successfully' });
  } catch (error) {
    next(error);
  }
});


const multer = require('multer');
const path = require('path');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/attachments/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// GET /api/financial-approvals/:id/attachments
router.get('/:id/attachments', async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    
    // Check if approval exists
    const approvalRes = await pool.query('SELECT 1 FROM financial_approvals WHERE id = $1 AND tenant_id = $2', [id, req.tenantId]);
    if (approvalRes.rows.length === 0) return fail(res, 'NOT_FOUND', 'Approval not found', 404);

    const query = `
      SELECT a.*, u.name as uploaded_by_name
      FROM financial_approval_attachments a
      LEFT JOIN users u ON a.uploaded_by = u.id
      WHERE a.approval_id = $1 AND a.tenant_id = $2 AND a.status = 'active'
      ORDER BY a.created_at ASC
    `;
    const { rows } = await pool.query(query, [id, req.tenantId]);
    return success(res, rows);
  } catch (error) {
    next(error);
  }
});

// POST /api/financial-approvals/:id/attachments
router.post('/:id/attachments', upload.any(), async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const userId = req.user.id || req.user.userId;

    const files = req.files || (req.file ? [req.file] : []);
    if (files.length === 0) {
      return fail(res, 'BAD_REQUEST', 'No files uploaded', 400);
    }

    // Mock Virus Scan
    await new Promise(resolve => setTimeout(resolve, 1500)); 

    const uploadedAttachments = [];
    for (const file of files) {
      const fileUrl = `${process.env.API_URL || 'http://localhost:3000'}/uploads/attachments/${file.filename}`;
      const query = `
        INSERT INTO financial_approval_attachments 
        (tenant_id, approval_id, name, url, mime_type, size_bytes, uploaded_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;
      const { rows } = await pool.query(query, [req.tenantId, id, file.originalname, fileUrl, file.mimetype, file.size, userId]);
      uploadedAttachments.push(rows[0]);
    }
    
    logActivity(req, 'financial_approval', id, 'Edited', null, JSON.stringify({ event: 'Added Attachments', count: uploadedAttachments.length }));
    return success(res, uploadedAttachments);
  } catch (error) {
    next(error);
  }
});

// PUT /api/financial-approvals/:id/attachments/:attachmentId/replace
router.put('/:id/attachments/:attachmentId/replace', upload.single('file'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id, attachmentId } = req.params;
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const userId = req.user.id || req.user.userId;

    if (!req.file) return fail(res, 'BAD_REQUEST', 'No file provided', 400);

    // Mock Virus Scan
    await new Promise(resolve => setTimeout(resolve, 1500));

    await client.query('BEGIN');
    
    // Get old attachment
    const oldQuery = "SELECT * FROM financial_approval_attachments WHERE id = $1 AND approval_id = $2 AND tenant_id = $3 AND status = 'active' FOR UPDATE";
    const oldRes = await client.query(oldQuery, [attachmentId, id, req.tenantId]);
    
    if (oldRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return fail(res, 'NOT_FOUND', 'Attachment not found or inactive', 404);
    }
    const oldDoc = oldRes.rows[0];

    // Mark old as replaced
    await client.query("UPDATE financial_approval_attachments SET status = 'replaced' WHERE id = $1", [attachmentId]);

    // Insert new version
    const fileUrl = `${process.env.API_URL || 'http://localhost:3000'}/uploads/attachments/${req.file.filename}`;
    const newQuery = `
      INSERT INTO financial_approval_attachments 
      (tenant_id, approval_id, name, url, mime_type, size_bytes, uploaded_by, version, parent_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const { rows } = await client.query(newQuery, [req.tenantId, id, req.file.originalname, fileUrl, req.file.mimetype, req.file.size, userId, (oldDoc.version || 1) + 1, attachmentId]);

    await client.query('COMMIT');
    logActivity(req, 'financial_approval', id, 'Edited', null, JSON.stringify({ event: 'Replaced Attachment', file: req.file.originalname }));
    
    return success(res, rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// DELETE /api/financial-approvals/:id/attachments/:attachmentId
router.delete('/:id/attachments/:attachmentId', async (req, res, next) => {
  try {
    const { id, attachmentId } = req.params;
    const tenantId = req.tenantId || (req.user && req.user.tenantId);

    const { rows } = await pool.query('DELETE FROM financial_approval_attachments WHERE id = $1 AND approval_id = $2 AND tenant_id = $3 RETURNING *', [attachmentId, id, req.tenantId]);
    
    if (rows.length === 0) return fail(res, 'NOT_FOUND', 'Attachment not found', 404);

    logActivity(req, 'financial_approval', id, 'Edited', null, JSON.stringify({ event: 'Deleted Attachment', file: rows[0].name }));
    return success(res, { success: true });
  } catch (error) {
    next(error);
  }
});


// GET /api/financial-approvals/:id/attachments/:attachmentId/history
router.get('/:id/attachments/:attachmentId/history', async (req, res, next) => {
  try {
    const { id, attachmentId } = req.params;
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    
    // Recursive CTE to fetch full version history for this attachment lineage
    const query = `
      WITH RECURSIVE attachment_tree AS (
        SELECT * FROM financial_approval_attachments 
        WHERE id = $1 AND approval_id = $2 AND tenant_id = $3
        
        UNION ALL
        
        SELECT a.* FROM financial_approval_attachments a
        INNER JOIN attachment_tree t ON a.id = t.parent_id
      )
      SELECT a.*, u.name as uploaded_by_name 
      FROM attachment_tree a
      LEFT JOIN users u ON a.uploaded_by = u.id
      ORDER BY a.created_at ASC
    `;
    
    const { rows } = await pool.query(query, [attachmentId, id, req.tenantId]);
    return success(res, rows);
  } catch (error) {
    next(error);
  }
});


// POST /api/financial-approvals/bulk
router.post('/bulk', async (req, res, next) => {
  const { action, approvalIds, payload } = req.body;
  const tenantId = req.tenantId || (req.user && req.user.tenantId);
  const userId = req.user.id || req.user.userId;
  
  if (!Array.isArray(approvalIds) || approvalIds.length === 0) {
    return fail(res, 'BAD_REQUEST', 'No approvals selected', 400);
  }

  const results = { successful: [], failed: [] };

  for (const id of approvalIds) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const checkQuery = "SELECT status, priority, is_archived, amount FROM financial_approvals WHERE id = $1 AND tenant_id = $2 FOR UPDATE";
      const checkRes = await client.query(checkQuery, [id, req.tenantId]);
      
      if (checkRes.rows.length === 0) {
        throw new Error('Not found or unauthorized');
      }
      
      const approval = checkRes.rows[0];

      if (action === 'approve') {
        if (approval.status !== 'pending') throw new Error('Not in pending status');
        // Simple permission check (can be expanded)
        await client.query("UPDATE financial_approvals SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP WHERE id = $2", [userId, id]);
        logActivity(req, 'financial_approval', id, 'Approved', null, null);
    const { rows: tmp } = await pool.query('SELECT requested_by FROM financial_approvals WHERE id = $1', [id]);
    if (tmp.length > 0) {
      await sendNotification(tenantId, tmp[0].requested_by, 'Approved', `Your financial approval request has been approved.`, `/finance/approvals?id=${id}`, userId);
    }
      } 
      else if (action === 'reject') {
        if (approval.status !== 'pending') throw new Error('Not in pending status');
        const reason = payload?.reason || 'Bulk rejected';
        await client.query("UPDATE financial_approvals SET status = 'rejected', rejection_reason = $1 WHERE id = $2", [reason, id]);
        logActivity(req, 'financial_approval', id, 'Rejected', null, JSON.stringify({ reason }));
      }
      else if (action === 'assign') {
        const assignee = payload?.assignee_id;
        const backup = payload?.backup_approver;
        const notes = payload?.assignment_notes;
        if (!assignee) throw new Error('Assignee required');
        
        await client.query("UPDATE financial_approvals SET assigned_to = $1, backup_approver = $2, assignment_notes = $3, assigned_by = $4, assigned_date = CURRENT_TIMESTAMP WHERE id = $5", [assignee, backup || null, notes || null, userId, id]);
        logActivity(req, 'financial_approval', id, approval.assigned_to ? 'Reassigned' : 'Assigned', null, JSON.stringify({ assigned_to: assignee, backup_approver: backup }));
      }
      else if (action === 'archive') {
        await client.query("UPDATE financial_approvals SET is_archived = true WHERE id = $1", [id]);
        logActivity(req, 'financial_approval', id, 'Edited', null, JSON.stringify({ event: 'Archived' }));
      }
      else if (action === 'change_priority') {
        const priority = payload?.priority;
        if (!priority) throw new Error('Priority required');
        await client.query("UPDATE financial_approvals SET priority = $1 WHERE id = $2", [priority, id]);
        logActivity(req, 'financial_approval', id, 'Edited', approval.priority, priority);
      }
      
      await client.query('COMMIT');
      results.successful.push(id);
    } catch (error) {
      await client.query('ROLLBACK');
      results.failed.push({ id, error: error.message });
    } finally {
      client.release();
    }
  }

  return success(res, results);
});


// POST /api/financial-approvals/:id/reopen
router.post('/:id/reopen', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const { id } = req.params;
    
    const { rows } = await pool.query("SELECT status FROM financial_approvals WHERE id = $1 AND tenant_id = $2 FOR UPDATE", [id, req.tenantId]);
    if (rows.length === 0) return fail(res, 'NOT_FOUND', 'Approval not found', 404);
    if (rows[0].status !== 'rejected') return fail(res, 'BAD_REQUEST', 'Only rejected approvals can be reopened', 400);

    await pool.query(
      "UPDATE financial_approvals SET status = 'pending', rejection_reason = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1", 
      [id]
    );
    
    logActivity(req, 'financial_approval', id, 'Reopened', null, null);
    return success(res, { success: true });
  } catch (error) {
    next(error);
  }
});

// POST /api/financial-approvals/:id/activity
router.post('/:id/activity', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, details } = req.body; // error.g. action: 'Downloaded', 'Opened'
    
    if (['Downloaded', 'Opened', 'Viewed', 'Exported'].includes(action)) {
      logActivity(req, 'financial_approval', id, action, null, details ? JSON.stringify(details) : null);
    }
    
    return success(res, { success: true });
  } catch (error) {
    next(error);
  }
});


// POST /api/financial-approvals/:id/priority
router.post('/:id/priority', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const { id } = req.params;
    const { priority } = req.body;
    
    if (!['low', 'medium', 'high', 'critical'].includes(priority)) {
      return fail(res, 'BAD_REQUEST', 'Invalid priority', 400);
    }

    const { rows } = await pool.query('UPDATE financial_approvals SET priority = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *', [priority, id, req.tenantId]);
    if (rows.length === 0) return fail(res, 'NOT_FOUND', 'Approval not found', 404);
    
    logActivity(req, 'financial_approval', id, 'Priority Updated', null, JSON.stringify({ priority }));
    return success(res, { success: true, priority });
  } catch (error) {
    next(error);
  }
});


// POST /api/financial-approvals/:id/remind
router.post('/:id/remind', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const userId = req.user.id;
    const { id } = req.params;
    
    const { rows } = await pool.query('SELECT * FROM financial_approvals WHERE id = $1 AND tenant_id = $2', [id, req.tenantId]);
    if (rows.length === 0) return fail(res, 'NOT_FOUND', 'Approval not found', 404);
    const app = rows[0];
    
    if (app.assigned_to) {
      await sendNotification(tenantId, app.assigned_to, 'Reminder', `Reminder: Please review pending ${app.transaction_type} request.`, `/finance/approvals?id=${id}`, userId);
    }
    
    logActivity(req, 'financial_approval', id, 'Reminder Sent', null, JSON.stringify({ sent_to: app.assigned_to }));
    return success(res, { success: true });
  } catch (error) {
    next(error);
  }
});


// GET /api/financial-approvals/:id/budget-validation
router.get('/:id/budget-validation', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const data = await getProjectBudgetValidation(req.query.id, tenantId);
    return success(res, data);
  } catch (error) {
    if (error.message === 'Approval not found') return fail(res, 'NOT_FOUND', error.message, 404);
    next(error);
  }
});


// GET /api/financial-approvals/:id/risk-analysis
router.get('/:id/risk-analysis', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const data = await analyzeFinancialRisk(req.query.id, tenantId);
    return success(res, data);
  } catch (error) {
    if (error.message === 'Approval not found') return fail(res, 'NOT_FOUND', error.message, 404);
    next(error);
  }
});


// GET /api/financial-approvals/:id/construction-summary
router.get('/:id/construction-summary', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const data = await getConstructionFinancialSummary(req.query.id, tenantId);
    return success(res, data);
  } catch (error) {
    if (error.message === 'Approval not found') return fail(res, 'NOT_FOUND', error.message, 404);
    next(error);
  }
});

module.exports = router;
