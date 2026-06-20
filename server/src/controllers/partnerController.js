const pool = require('../db/pool');

function getTenantAndUser(req) {
  return { tenantId: req.user.tenantId, userId: req.user.id };
}

exports.getPartners = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const result = await pool.query(
      `SELECT * FROM marketplace_partners WHERE tenant_id = $1 ORDER BY rating DESC, completed_projects DESC`,
      [tenantId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};
