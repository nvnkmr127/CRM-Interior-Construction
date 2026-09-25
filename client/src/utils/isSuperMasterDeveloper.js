/**
 * Check if the current user has Super Master Developer privileges.
 * 
 * In this CRM, client workspace administrators also have role 'superadmin' 
 * within their tenant. Only the Super Master Developer has platform-wide 
 * workspace jumping, developer tooling, and tenant switching powers.
 * 
 * @param {Object} user 
 * @returns {boolean}
 */
export function isSuperMasterDeveloper(user) {
  if (!user) return false;

  // 1. Explicit platform flag (issued in JWT and session payload)
  if (user.is_master_developer === true) return true;

  // 2. Active master session (currently inspecting another workspace)
  if (user.masterSession && typeof user.masterSession === 'object') return true;

  // 3. Primary master platform root workspace or email
  const isMasterPlatformWorkspace = user?.tenant?.slug === 'demo' || user?.tenant?.id === 'demo';
  const emailLower = (user?.email || '').trim().toLowerCase();
  const isMasterPlatformEmail = emailLower === 'admin@demo.com' || emailLower === 'digicloudify@gmail.com';

  if (!isMasterPlatformWorkspace && !isMasterPlatformEmail) {
    return false;
  }

  // Verify administrative role inside the root platform workspace
  const roleName = (typeof user?.role === 'string' ? user.role : user?.role?.name || user?.role_name || '').toLowerCase().trim();
  const perms = Array.isArray(user?.role?.permissions) 
    ? user.role.permissions 
    : (Array.isArray(user?.permissions) ? user.permissions : []);

  const hasAdminRole = 
    roleName === 'superadmin' || 
    roleName === 'super admin' || 
    roleName === 'admin' || 
    roleName === 'owner' ||
    perms.includes('*') || 
    perms.includes('*:*');

  return (isMasterPlatformWorkspace || isMasterPlatformEmail) && hasAdminRole;
}
