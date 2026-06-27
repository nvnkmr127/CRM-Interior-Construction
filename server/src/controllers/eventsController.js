const pool = require('../db/pool');

function convertToCSV(data) {
  const headers = ['Timestamp', 'User Name', 'User Email', 'Action', 'Entity', 'Entity ID', 'Old Value', 'New Value', 'IP Address'];
  const rows = data.map(row => [
    row.created_at ? new Date(row.created_at).toISOString() : '',
    row.user_name || 'System',
    row.user_email || '',
    row.action,
    row.entity,
    row.entity_id || '',
    row.old_value || '',
    row.new_value || '',
    row.ip_address || ''
  ]);
  
  const escapeCsv = val => {
    if (val === null || val === undefined) return '';
    let str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    str = str.replace(/"/g, '""');
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      return `"${str}"`;
    }
    return str;
  };
  
  return [
    headers.join(','),
    ...rows.map(row => row.map(escapeCsv).join(','))
  ].join('\n');
}

exports.getEvents = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;
    const beforeId = req.query.before;
    
    const projectId = req.query.projectId;
    const userId = req.query.userId;
    const entity = req.query.entity;
    const action = req.query.action;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const exportFormat = req.query.export;

    let baseFilter = ` WHERE al.tenant_id = $1 `;
    const filterValues = [tenantId];

    if (projectId) {
      baseFilter += ` AND (
        (al.entity = 'project' AND al.entity_id = $${filterValues.length + 1})
        OR (al.entity = 'task' AND al.entity_id IN (SELECT id FROM tasks WHERE project_id = $${filterValues.length + 1}))
        OR (al.entity = 'document' AND al.entity_id IN (SELECT id FROM documents WHERE project_id = $${filterValues.length + 1}))
        OR (al.entity = 'payment_milestone' AND al.entity_id IN (SELECT id FROM payment_milestones WHERE project_id = $${filterValues.length + 1}))
        OR (al.entity = 'project_work_activity' AND al.entity_id IN (SELECT id FROM project_work_activities WHERE project_id = $${filterValues.length + 1}))
        OR (al.entity = 'handover_checklist' AND al.entity_id IN (SELECT id FROM handover_checklists WHERE project_id = $${filterValues.length + 1}))
        OR (al.entity = 'warranty' AND al.entity_id IN (SELECT id FROM warranties WHERE project_id = $${filterValues.length + 1}))
        OR (al.entity = 'amc' AND al.entity_id IN (SELECT id FROM amcs WHERE project_id = $${filterValues.length + 1}))
        OR (al.entity = 'service_ticket' AND al.entity_id IN (SELECT id FROM service_tickets WHERE project_id = $${filterValues.length + 1}))
      ) `;
      filterValues.push(projectId);
    }

    if (userId) {
      baseFilter += ` AND al.user_id = $${filterValues.length + 1} `;
      filterValues.push(userId);
    }

    if (entity) {
      baseFilter += ` AND al.entity = $${filterValues.length + 1} `;
      filterValues.push(entity);
    }

    if (action) {
      baseFilter += ` AND al.action = $${filterValues.length + 1} `;
      filterValues.push(action);
    }

    if (startDate) {
      baseFilter += ` AND al.created_at >= $${filterValues.length + 1} `;
      filterValues.push(startDate);
    }

    if (endDate) {
      baseFilter += ` AND al.created_at <= $${filterValues.length + 1} `;
      filterValues.push(endDate);
    }

    // Handle CSV Export
    if (exportFormat === 'csv') {
      const exportQuery = `
        SELECT al.*, u.name as user_name, u.email as user_email
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        ${baseFilter}
        ORDER BY al.created_at DESC, al.id DESC
      `;
      const { rows } = await pool.query(exportQuery, filterValues);
      const csvData = convertToCSV(rows);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="audit_logs.csv"');
      return res.status(200).send(csvData);
    }

    // Standard pagination: Count total matching rows
    const countQuery = `
      SELECT COUNT(*)::int FROM audit_logs al
      ${baseFilter}
    `;
    const countRes = await pool.query(countQuery, filterValues);
    const totalCount = countRes.rows[0].count;

    // Fetch data rows
    let dataQuery = `
      SELECT al.*, u.name as user_name, u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${baseFilter}
    `;

    const dataValues = [...filterValues];
    if (beforeId) {
      dataQuery += ` AND al.id < $${dataValues.length + 1} `;
      dataValues.push(beforeId);
    }

    dataQuery += ` ORDER BY al.created_at DESC, al.id DESC LIMIT $${dataValues.length + 1} OFFSET $${dataValues.length + 2} `;
    dataValues.push(limit, offset);

    const { rows } = await pool.query(dataQuery, dataValues);

    res.json({
      success: true,
      data: rows,
      meta: {
        total: totalCount,
        count: rows.length,
        offset,
        limit,
        hasMore: offset + rows.length < totalCount,
        lastCursor: rows.length > 0 ? rows[rows.length - 1].id : null
      }
    });
  } catch (err) {
    next(err);
  }
};
