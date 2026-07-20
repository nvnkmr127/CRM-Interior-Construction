const express = require('express');
const pool = require('../db/pool');
const authenticate = require('../middleware/authenticate');
const { success, fail } = require('../utils/response');
const paymentService = require('../services/projects/paymentMilestoneService');
const quotationService = require('../services/projects/quotationService');
const { logActivity } = require('../utils/activityLogger');

const router = express.Router();
router.use(authenticate);

// Helper to check specific finance permissions
function checkPermissionForType(user, type) {
  if (user.role === 'superadmin') return true;
  const perms = user.permissions || [];
  
  if (type === 'invoice') return perms.includes('finance:invoices');
  if (type === 'payment' || type === 'payment_update') return perms.includes('finance:payments');
  if (type === 'discount') return perms.includes('finance:discounts');
  if (type === 'credit' || type === 'refund') return perms.includes('finance:credits');
  if (type === 'change_order') return perms.includes('finance:change_orders') || perms.includes('projects:change_orders');
  return false;
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
    const values = [tenantId];
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

    let orderByClause = 'ORDER BY fa.created_at DESC, fa.id DESC'; // default
    if (sort_by) {
      switch (sort_by) {
        case 'newest':
        case 'requested_date':
        case 'priority': // Mocked mapping
          orderByClause = 'ORDER BY fa.created_at DESC, fa.id DESC';
          break;
        case 'oldest':
          orderByClause = 'ORDER BY fa.created_at ASC, fa.id ASC';
          break;
        case 'amount_desc':
          orderByClause = 'ORDER BY fa.amount DESC, fa.id DESC';
          break;
        case 'amount_asc':
          orderByClause = 'ORDER BY fa.amount ASC, fa.id ASC';
          break;
        case 'project_name':
          orderByClause = 'ORDER BY p.name ASC, fa.id DESC';
          break;
        case 'customer_name':
          orderByClause = 'ORDER BY p.client_name ASC, fa.id DESC';
          break;
        case 'approval_date':
          orderByClause = 'ORDER BY fa.updated_at DESC, fa.id DESC';
          break;
        default:
          orderByClause = 'ORDER BY fa.created_at DESC, fa.id DESC';
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
               WHEN fa.transaction_type = 'payment' THEN (SELECT project_id FROM payment_milestones WHERE id = fa.target_id)
               WHEN fa.transaction_type = 'payment_update' THEN (SELECT project_id FROM payment_milestones WHERE id = fa.target_id)
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
       a3.name as assigned_by_name, p.name as project_name, p.client_name as customer_name,
             CASE 
               WHEN fa.transaction_type = 'invoice' THEN (SELECT invoice_number FROM invoices WHERE id = fa.target_id)
               WHEN fa.transaction_type = 'payment' THEN (SELECT name FROM payment_milestones WHERE id = fa.target_id)
               WHEN fa.transaction_type = 'payment_update' THEN (SELECT name FROM payment_milestones WHERE id = fa.target_id)
               WHEN fa.transaction_type = 'discount' THEN (SELECT quotation_number FROM quotations WHERE id = fa.target_id)
               WHEN fa.transaction_type = 'credit' THEN (SELECT credit_note_number FROM credit_notes WHERE id = fa.target_id)
               WHEN fa.transaction_type = 'refund' THEN (SELECT refund_number FROM refunds WHERE id = fa.target_id)
             END as target_number
      FROM financial_approvals fa
      LEFT JOIN users u ON fa.requested_by = u.id
      LEFT JOIN users a1 ON fa.assigned_to = a1.id
      LEFT JOIN users a2 ON fa.backup_approver = a2.id
      LEFT JOIN users a3 ON fa.assigned_by = a3.id
      LEFT JOIN projects p ON p.id = (
             CASE
               WHEN fa.transaction_type = 'invoice' THEN (SELECT project_id FROM invoices WHERE id = fa.target_id)
               WHEN fa.transaction_type = 'payment' THEN (SELECT project_id FROM payment_milestones WHERE id = fa.target_id)
               WHEN fa.transaction_type = 'payment_update' THEN (SELECT project_id FROM payment_milestones WHERE id = fa.target_id)
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

    return success(res, {
      data: rows,
      pagination: {
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum)
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
    const tenantId = req.tenantId;
    const userId = req.user.id || req.user.userId;
    const { id } = req.params;

    await client.query('BEGIN');

    // 1. Fetch approval record
    const { rows } = await client.query(
      `SELECT * FROM financial_approvals WHERE id = $1 AND tenant_id = $2 AND status = 'pending'`,
      [id, tenantId]
    );
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return fail(res, 'NOT_FOUND', 'Pending approval request not found', 404);
    }
    const approval = rows[0];

    // 2. Multi-level Stage Auth
    const currentStage = approval.current_stage || 1;
    const totalStages = approval.total_stages || 1;
    let approvalChain = approval.approval_chain;
    if (typeof approvalChain === 'string') {
      try { approvalChain = JSON.parse(approvalChain); } catch(e) {}
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
      const { milestoneId, invoiceNumber } = changes;
      
      // Update invoice status to sent
      await client.query(
        `UPDATE invoices SET status = 'sent', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [approval.target_id]
      );
      
      // Update payment milestone status and reference
      await client.query(
        `UPDATE payment_milestones 
         SET invoice_reference = $1, status = 'invoice_raised' 
         WHERE id = $2 AND tenant_id = $3`,
        [invoiceNumber, milestoneId, tenantId]
      );
    } 
    else if (approval.transaction_type === 'payment') {
      // Update new payment milestone status to scheduled
      await client.query(
        `UPDATE payment_milestones SET status = 'scheduled' WHERE id = $1 AND tenant_id = $2`,
        [approval.target_id, tenantId]
      );
    } 
    else if (approval.transaction_type === 'payment_update') {
      const changes = typeof approval.requested_changes === 'string' ? JSON.parse(approval.requested_changes) : approval.requested_changes;
      // Call update internal logic bypassing approval check
      await paymentService.updatePaymentMilestone({
        tenantId,
        userId,
        milestoneId: approval.target_id,
        data: changes.data,
        bypassApproval: true
      });
    } 
    else if (approval.transaction_type === 'discount') {
      const changes = typeof approval.requested_changes === 'string' ? JSON.parse(approval.requested_changes) : approval.requested_changes;
      // Call update internal logic bypassing approval check
      await quotationService.updateQuotation(
        tenantId,
        approval.target_id,
        { discountAmount: changes.discountAmount },
        userId,
        true
      );
    } 
    else if (approval.transaction_type === 'credit') {
      // Update credit note status to issued
      await client.query(
        `UPDATE credit_notes SET status = 'issued', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [approval.target_id]
      );
    } 
    else if (approval.transaction_type === 'refund') {
      // Update refund status to processed
      await client.query(
        `UPDATE refunds SET status = 'processed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [approval.target_id]
      );
    }

    await client.query('COMMIT');
    logActivity(req, 'financial_approval', id, 'Approved', JSON.stringify({ status: 'pending' }), JSON.stringify({ status: 'approved' }));
    return success(res, { message: 'Approval request approved successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// POST /api/financial-approvals/:id/reject
router.post('/:id/reject', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const tenantId = req.tenantId;
    const userId = req.user.id || req.user.userId;
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason || rejectionReason.trim() === '') {
      return fail(res, 'BAD_REQUEST', 'Rejection reason is required', 400);
    }

    await client.query('BEGIN');

    // 1. Fetch approval record
    const { rows } = await client.query(
      `SELECT * FROM financial_approvals WHERE id = $1 AND tenant_id = $2 AND status = 'pending'`,
      [id, tenantId]
    );
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return fail(res, 'NOT_FOUND', 'Pending approval request not found', 404);
    }
    const approval = rows[0];

    // 2. Multi-level Stage Auth
    const currentStage = approval.current_stage || 1;
    let approvalChain = approval.approval_chain;
    if (typeof approvalChain === 'string') {
      try { approvalChain = JSON.parse(approvalChain); } catch(e) {}
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
    else if (approval.transaction_type === 'payment') {
      // Delete the payment milestone entirely since it was pending creation
      await client.query(
        `DELETE FROM payment_milestones WHERE id = $1 AND tenant_id = $2`,
        [approval.target_id, tenantId]
      );
    } 
    else if (approval.transaction_type === 'payment_update') {
      const changes = typeof approval.requested_changes === 'string' ? JSON.parse(approval.requested_changes) : approval.requested_changes;
      // Revert status to original status before update attempt
      await client.query(
        `UPDATE payment_milestones SET status = $1 WHERE id = $2 AND tenant_id = $3`,
        [changes.original_status, approval.target_id, tenantId]
      );
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
    next(error);
  } finally {
    client.release();
  }
});

// GET /api/financial-approvals/:id/comments
router.get('/:id/comments', async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const userId = req.user.id || req.user.userId;
    const isSuper = req.user.role === 'superadmin' || req.user.permissions?.includes('admin');

    const query = `
      SELECT c.*, u.first_name, u.last_name, u.role, u.avatar_url
      FROM financial_approval_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.tenant_id = $1 AND c.approval_id = $2
      ORDER BY c.created_at ASC
    `;
    const { rows } = await pool.query(query, [tenantId, id]);

    const filteredRows = isSuper ? rows : rows.filter(r => !r.is_internal || r.user_id === userId);

    return success(res, filteredRows);
  } catch (error) {
    next(error);
  }
});

// POST /api/financial-approvals/:id/comments
router.post('/:id/comments', async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const userId = req.user.id || req.user.userId;
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
      const actorName = `${req.user.first_name || 'System'} ${req.user.last_name || ''}`.trim();
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
    const tenantId = req.tenantId;
    const userId = req.user.id || req.user.userId;
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
    const tenantId = req.tenantId;
    const userId = req.user.id || req.user.userId;
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
    const tenantId = req.tenantId;
    const userId = req.user.id || req.user.userId;
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
    const tenantId = req.tenantId;
    const { id } = req.params;
    const userId = req.user.id || req.user.userId;

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
    const tenantId = req.tenantId;
    const { id } = req.params;
    const userId = req.user.id || req.user.userId;
    const isSuper = req.user.role === 'superadmin' || req.user.permissions?.includes('admin');

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

// POST /api/financial-approvals/:id/view
router.post('/:id/view', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type } = req.body; // 'Viewed' or 'Opened'
    const actionType = type === 'Opened' ? 'Opened' : 'Viewed';
    
    // Debouncing: check if user viewed in last 15 min
    const { rows } = await pool.query(
      `SELECT created_at FROM audit_logs 
       WHERE entity = 'financial_approval' AND entity_id = $1 AND user_id = $2 AND action = $3
       ORDER BY created_at DESC LIMIT 1`,
      [id, req.user?.id || req.user?.userId, actionType]
    );
    
    if (rows.length === 0 || (new Date() - new Date(rows[0].created_at)) > 15 * 60 * 1000) {
      logActivity(req, 'financial_approval', id, actionType);
    }
    return success(res, { success: true });
  } catch (error) {
    next(error);
  }
});

// PUT /api/financial-approvals/:id (Edit)
router.put('/:id', async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { requested_changes, amount } = req.body;
    
    const { rows: oldRows } = await pool.query(`SELECT amount, requested_changes FROM financial_approvals WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    if (oldRows.length === 0) return fail(res, 'NOT_FOUND', 'Approval not found', 404);
    
    const { rows } = await pool.query(
      `UPDATE financial_approvals SET amount = COALESCE($1, amount), requested_changes = COALESCE($2, requested_changes), updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND tenant_id = $4 RETURNING *`,
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
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const userId = req.user.id || req.user.userId;
    const { id } = req.params;
    const { assigned_to, backup_approver, assignment_notes } = req.body;
    
    const { rows: oldRows } = await pool.query('SELECT assigned_to, backup_approver FROM financial_approvals WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (oldRows.length === 0) return fail(res, 'NOT_FOUND', 'Approval not found', 404);
    
    const isReassign = oldRows[0].assigned_to != null;
    const action = isReassign ? 'Reassigned' : 'Assigned';
    
    await pool.query(
      `UPDATE financial_approvals 
       SET assigned_to = $1, backup_approver = $2, assignment_notes = $3, assigned_by = $4, assigned_date = CURRENT_TIMESTAMP
       WHERE id = $5 AND tenant_id = $6`,
      [assigned_to || null, backup_approver || null, assignment_notes || null, userId, id, tenantId]
    );
    
    logActivity(req, 'financial_approval', id, action, null, JSON.stringify({ assigned_to, backup_approver, notes: assignment_notes }));
    return success(res, { success: true });
  } catch (error) {
    next(error);
  }
});
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
    const tenantId = req.tenantId;
    const { id } = req.params;
    const isSuper = req.user.role === 'superadmin' || req.user.permissions?.includes('admin');
    if (!isSuper) return fail(res, 'FORBIDDEN', 'Only admins can reopen approvals', 403);
    
    const { rows } = await pool.query(
      `UPDATE financial_approvals SET status = 'pending', current_stage = 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [id, tenantId]
    );
    if (rows.length === 0) return fail(res, 'NOT_FOUND', 'Approval not found', 404);
    
    logActivity(req, 'financial_approval', id, 'Reopened', JSON.stringify({ status: rows[0].status }), JSON.stringify({ status: 'pending' }));
    return success(res, rows[0]);
  } catch (error) {
    next(error);
  }
});

// GET /api/financial-approvals/:id/activity
router.get('/:id/activity', async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT a.*, u.first_name, u.last_name, u.role, u.avatar_url 
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE a.tenant_id = $1 AND a.entity = 'financial_approval' AND a.entity_id = $2
       ORDER BY a.created_at ASC`,
      [tenantId, id]
    );
    return success(res, rows);
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
    const approvalRes = await pool.query('SELECT 1 FROM financial_approvals WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (approvalRes.rows.length === 0) return fail(res, 'NOT_FOUND', 'Approval not found', 404);

    const query = `
      SELECT a.*, u.name as uploaded_by_name
      FROM financial_approval_attachments a
      LEFT JOIN users u ON a.uploaded_by = u.id
      WHERE a.approval_id = $1 AND a.tenant_id = $2 AND a.status = 'active'
      ORDER BY a.created_at DESC
    `;
    const { rows } = await pool.query(query, [id, tenantId]);
    return success(res, rows);
  } catch (error) {
    next(error);
  }
});

// POST /api/financial-approvals/:id/attachments
router.post('/:id/attachments', upload.array('files'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const userId = req.user.id || req.user.userId;

    if (!req.files || req.files.length === 0) {
      return fail(res, 'BAD_REQUEST', 'No files uploaded', 400);
    }

    // Mock Virus Scan
    await new Promise(resolve => setTimeout(resolve, 1500)); 

    const uploadedAttachments = [];
    for (const file of req.files) {
      const fileUrl = `${process.env.API_URL || 'http://localhost:3000'}/uploads/attachments/${file.filename}`;
      const query = `
        INSERT INTO financial_approval_attachments 
        (tenant_id, approval_id, name, url, mime_type, size_bytes, uploaded_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;
      const { rows } = await pool.query(query, [tenantId, id, file.originalname, fileUrl, file.mimetype, file.size, userId]);
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
    const oldRes = await client.query(oldQuery, [attachmentId, id, tenantId]);
    
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
    const { rows } = await client.query(newQuery, [tenantId, id, req.file.originalname, fileUrl, req.file.mimetype, req.file.size, userId, (oldDoc.version || 1) + 1, attachmentId]);

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

    const { rows } = await pool.query('DELETE FROM financial_approval_attachments WHERE id = $1 AND approval_id = $2 AND tenant_id = $3 RETURNING *', [attachmentId, id, tenantId]);
    
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
      ORDER BY a.version DESC
    `;
    
    const { rows } = await pool.query(query, [attachmentId, id, tenantId]);
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
      const checkRes = await client.query(checkQuery, [id, tenantId]);
      
      if (checkRes.rows.length === 0) {
        throw new Error('Not found or unauthorized');
      }
      
      const approval = checkRes.rows[0];

      if (action === 'approve') {
        if (approval.status !== 'pending') throw new Error('Not in pending status');
        // Simple permission check (can be expanded)
        await client.query("UPDATE financial_approvals SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP WHERE id = $2", [userId, id]);
        logActivity(req, 'financial_approval', id, 'Approved', null, null);
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
    } catch (e) {
      await client.query('ROLLBACK');
      results.failed.push({ id, error: e.message });
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
    
    const { rows } = await pool.query("SELECT status FROM financial_approvals WHERE id = $1 AND tenant_id = $2 FOR UPDATE", [id, tenantId]);
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
    const { action, details } = req.body; // e.g. action: 'Downloaded', 'Opened'
    
    if (['Downloaded', 'Opened', 'Viewed', 'Exported'].includes(action)) {
      logActivity(req, 'financial_approval', id, action, null, details ? JSON.stringify(details) : null);
    }
    
    return success(res, { success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
