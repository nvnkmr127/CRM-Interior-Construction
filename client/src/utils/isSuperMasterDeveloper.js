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

  // 1. Active master session (currently inspecting another workspace via superadmin impersonation)
  if (user.masterSession && typeof user.masterSession === 'object') return true;

  // 2. Primary master platform root emails
  const emailLower = (user?.email || '').trim().toLowerCase();
  const isMasterPlatformEmail = emailLower === 'admin@demo.com' || emailLower === 'digicloudify@gmail.com';
  if (isMasterPlatformEmail) return true;

  // 3. Verify administrative role inside the root platform workspace ('demo')
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

  const isMasterPlatformWorkspace = user?.tenant?.slug === 'demo' || user?.tenant?.id === 'demo';

  // Even if user.is_master_developer flag is set in token/cache, they must be a master email or an admin in demo workspace
  if (user.is_master_developer === true) {
    return isMasterPlatformEmail || (isMasterPlatformWorkspace && hasAdminRole);
  }

  return (isMasterPlatformWorkspace || isMasterPlatformEmail) && hasAdminRole;
}
