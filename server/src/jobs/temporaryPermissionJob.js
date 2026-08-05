const logger = require('../utils/logger');
const pool = require('../config/db');
const { queueEmail } = require('../services/emailService');
class TemporaryPermissionJob {
  async run() {
    console.log('[TemporaryPermissionJob] Checking for expiring and expired temporary permissions...');
    try {
      // Fetch all users that have temporary permissions
      const { rows } = await pool.query(`
        SELECT id, tenant_id, name, email, temporary_permissions 
        FROM users 
        WHERE temporary_permissions IS NOT NULL AND jsonb_array_length(temporary_permissions) > 0
      `);

      for (const user of rows) {
        let modified = false;
        let activeTempPerms = [];
        let tempPerms = typeof user.temporary_permissions === 'string' ? JSON.parse(user.temporary_permissions) : user.temporary_permissions;

        for (const temp of tempPerms) {
          const expiresAt = new Date(temp.expires_at);
          const now = new Date();
          
          // 1. Expired Phase
          if (expiresAt <= now) {
            // It expired, we exclude it from activeTempPerms
            modified = true;
            console.log(`[TemporaryPermissionJob] Revoking expired permissions for user ${user.id}`);
            continue;
          }

          // 2. Notification Phase (Expires within 24 hours)
          const msUntilExpiry = expiresAt.getTime() - now.getTime();
          const hoursUntilExpiry = msUntilExpiry / (1000 * 60 * 60);

          if (hoursUntilExpiry <= 24 && !temp.notified) {
            console.log(`[TemporaryPermissionJob] Notifying admin for user ${user.id} expiry within 24h`);
            
            // Send email to superadmins of this tenant
            const { rows: admins } = await pool.query(
              `SELECT email, name FROM users WHERE tenant_id = $1 AND role_id IN (SELECT id FROM roles WHERE name = 'superadmin' AND tenant_id = $1)`, 
              [user.tenant_id]
            );

            for (const admin of admins) {
              queueEmail(
                user.tenant_id, 
                user.id, 
                admin.email, 
                'Temporary Permissions Expiring Soon', 
                'standard_alert', 
                { 
                  name: admin.name, 
                  message: `User ${user.name} (${user.email}) has temporary permissions that will expire on ${expiresAt.toLocaleString()}.` 
                }
              );
            }

            temp.notified = true;
            modified = true;
          }

          activeTempPerms.push(temp);
        }

        // Save back if there were any modifications
        if (modified) {
          await pool.query(
            `UPDATE users SET temporary_permissions = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3`,
            [JSON.stringify(activeTempPerms), user.id, user.tenant_id]
          );
        }
      }

      console.log('[TemporaryPermissionJob] Completed successfully.');
    } catch (error) {
      logger.error('[TemporaryPermissionJob] Failed:', error);
      throw error;
    }
  }
}

module.exports = new TemporaryPermissionJob();
