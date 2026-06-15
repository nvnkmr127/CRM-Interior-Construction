const crypto = require('crypto');
const pool = require('../db/pool');

async function authenticatePortal(req, res, next) {
  try {
    let portalToken;
    
    // Check cookie
    if (req.cookies && req.cookies.portalToken) {
      portalToken = req.cookies.portalToken;
    } 
    // Check Authorization header
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      portalToken = req.headers.authorization.split(' ')[1];
    }

    if (!portalToken) {
      return res.status(401).json({ success: false, message: 'No portal token provided' });
    }

    const portalTokenHash = crypto.createHash('sha256').update(portalToken).digest('hex');

    const result = await pool.query(
      `SELECT id, tenant_id, project_id, name, phone, portal_token_expires_at 
       FROM client_portal_users 
       WHERE portal_token_hash = $1`,
      [portalTokenHash]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid portal token' });
    }

    if (!user.portal_token_expires_at || new Date(user.portal_token_expires_at) < new Date()) {
      return res.status(401).json({ success: false, message: 'Portal token expired' });
    }

    req.portalUser = {
      id: user.id,
      tenantId: user.tenant_id,
      projectId: user.project_id,
      name: user.name,
      phone: user.phone
    };

    next();
  } catch (error) {
    console.error('Portal Auth Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error during authentication' });
  }
}

module.exports = authenticatePortal;
