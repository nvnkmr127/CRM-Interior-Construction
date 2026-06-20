const pool = require('../db/pool');

exports.createWebhook = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const { url, events, secret, retry_count, is_active } = req.body;
    
    if (!url || !events || !Array.isArray(events)) {
      return res.status(400).json({ success: false, error: 'url and events array are required' });
    }

    const query = `
      INSERT INTO outbound_webhooks (tenant_id, url, events, secret, retry_count, is_active)
      VALUES ($1, $2, $3::jsonb, $4, $5, $6)
      RETURNING *
    `;
    const values = [
      tenantId, 
      url, 
      JSON.stringify(events), 
      secret || null, 
      retry_count || 3, 
      is_active !== undefined ? is_active : true
    ];

    const { rows } = await pool.query(query, values);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

exports.getWebhooks = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    
    const { rows } = await pool.query(`
      SELECT * FROM outbound_webhooks WHERE tenant_id = $1 ORDER BY created_at DESC
    `, [tenantId]);
    
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

exports.deleteWebhook = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const { id } = req.params;
    
    const { rowCount } = await pool.query(`
      DELETE FROM outbound_webhooks WHERE id = $1 AND tenant_id = $2
    `, [id, tenantId]);
    
    if (rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Webhook not found' });
    }
    
    res.json({ success: true, message: 'Webhook deleted successfully' });
  } catch (err) {
    next(err);
  }
};

exports.getWebhookLogs = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    
    const { rows } = await pool.query(`
      SELECT * FROM webhook_logs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 100
    `, [tenantId]);
    
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};
