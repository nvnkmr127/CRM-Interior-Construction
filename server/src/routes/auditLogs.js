const express = require('express');
const pool = require('../db/pool');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { success, fail } = require('../utils/response');

const router = express.Router();

router.use(authenticate);

// Note: we might use superadmin or a specific permission for this.
// For now, requiring superadmin or 'audit:read' if defined.
function checkAuditAccess(req, res, next) {
  if (req.user.role === 'superadmin') return next();
  if (req.user.permissions && req.user.permissions.includes('audit:read')) return next();
  return fail(res, 'FORBIDDEN', 'Access to audit logs requires superadmin or audit:read permissions', 403);
}

// GET /api/audit-logs
router.get('/', checkAuditAccess, async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    if (!tenantId) return fail(res, 'UNAUTHORIZED', 'Tenant context missing', 401);

    const { page = 1, limit = 50, date_from, date_to, user_id, entity, entity_id } = req.query;
    
    const offset = (Number(page) - 1) * Number(limit);
    
    let queryParams = [tenantId];
    let queryConditions = ['al.tenant_id = $1'];
    
    if (date_from) {
      queryParams.push(date_from);
      queryConditions.push(`al.created_at >= $${queryParams.length}`);
    }
    if (date_to) {
      queryParams.push(date_to);
      queryConditions.push(`al.created_at <= $${queryParams.length}`);
    }
    if (user_id) {
      queryParams.push(user_id);
      queryConditions.push(`al.user_id = $${queryParams.length}`);
    }
    if (entity) {
      queryParams.push(entity);
      queryConditions.push(`al.entity = $${queryParams.length}`);
    }
    if (entity_id) {
      queryParams.push(entity_id);
      queryConditions.push(`al.entity_id = $${queryParams.length}`);
    }

    const whereClause = queryConditions.length > 0 ? `WHERE ${queryConditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) FROM audit_logs al ${whereClause}`;
    const dataQuery = `
      SELECT al.*, u.name as user_name, u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;

    const countResult = await pool.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count, 10);
    
    const dataParams = [...queryParams, Number(limit), offset];
    const dataResult = await pool.query(dataQuery, dataParams);
    
    return res.json({
      success: true,
      data: dataResult.rows,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/audit-logs/export
router.get('/export', checkAuditAccess, async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    if (!tenantId) return fail(res, 'UNAUTHORIZED', 'Tenant context missing', 401);

    const { date_from, date_to, user_id, entity, entity_id } = req.query;
    
    let queryParams = [tenantId];
    let queryConditions = ['al.tenant_id = $1'];
    
    if (date_from) {
      queryParams.push(date_from);
      queryConditions.push(`al.created_at >= $${queryParams.length}`);
    }
    if (date_to) {
      queryParams.push(date_to);
      queryConditions.push(`al.created_at <= $${queryParams.length}`);
    }
    if (user_id) {
      queryParams.push(user_id);
      queryConditions.push(`al.user_id = $${queryParams.length}`);
    }
    if (entity) {
      queryParams.push(entity);
      queryConditions.push(`al.entity = $${queryParams.length}`);
    }
    if (entity_id) {
      queryParams.push(entity_id);
      queryConditions.push(`al.entity_id = $${queryParams.length}`);
    }

    const whereClause = queryConditions.length > 0 ? `WHERE ${queryConditions.join(' AND ')}` : '';

    const dataQuery = `
      SELECT al.*, u.name as user_name, u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT 10000 -- Hard limit for export
    `;

    const dataResult = await pool.query(dataQuery, queryParams);
    
    // Create CSV string
    const headers = ['Date', 'User Name', 'User Email', 'IP Address', 'Action', 'Entity', 'Entity ID', 'Old Value', 'New Value'];
    let csvString = headers.map(h => `"${h}"`).join(',') + '\\n';
    
    for (const row of dataResult.rows) {
      const date = new Date(row.created_at).toISOString();
      const userName = row.user_name || '';
      const userEmail = row.user_email || '';
      const ip = row.ip_address || '';
      const action = row.action || '';
      const entityName = row.entity || '';
      const entityId = row.entity_id || '';
      
      // Escape quotes for CSV
      const oldVal = row.old_value ? row.old_value.replace(/"/g, '""') : '';
      const newVal = row.new_value ? row.new_value.replace(/"/g, '""') : '';
      
      const csvRow = [
        `"${date}"`, 
        `"${userName}"`, 
        `"${userEmail}"`, 
        `"${ip}"`,
        `"${action}"`, 
        `"${entityName}"`, 
        `"${entityId}"`,
        `"${oldVal}"`,
        `"${newVal}"`
      ];
      csvString += csvRow.join(',') + '\\n';
    }
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
    return res.send(csvString);

  } catch (error) {
    next(error);
  }
});

module.exports = router;
