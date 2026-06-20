const pool = require('../db/pool');

exports.getEvents = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    
    // Pagination via cursor (last event id or created_at)
    const limit = parseInt(req.query.limit, 10) || 50;
    const beforeId = req.query.before; // e.g. cursor pagination
    
    let query = `
      SELECT * FROM audit_logs
      WHERE tenant_id = $1
    `;
    const values = [tenantId];
    
    if (beforeId) {
      query += ` AND id < $2 `;
      values.push(beforeId);
    }
    
    query += ` ORDER BY id DESC LIMIT $${values.length + 1}`;
    values.push(limit);
    
    const { rows } = await pool.query(query, values);
    
    res.json({
      success: true,
      data: rows,
      meta: {
        count: rows.length,
        hasMore: rows.length === limit,
        lastCursor: rows.length > 0 ? rows[rows.length - 1].id : null
      }
    });
  } catch (err) {
    next(err);
  }
};
