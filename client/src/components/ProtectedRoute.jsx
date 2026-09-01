import { Navigate } from 'react-router-dom'
import { useAuth } from '../store/authContext'
import Spinner from './ui/Spinner'
import styles from './ProtectedRoute.module.css'

export default function ProtectedRoute({ children, requiredPermission, requiredModule }) {
  const { user, loading, isAuthenticated } = useAuth()

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner size='lg' />
        <span>Loading...</span>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to='/login' replace />
  }

  const roleName = (typeof user?.role === 'string' ? user.role : user?.role?.name || user?.role_name || '').toLowerCase().replace(/[\s_-]+/g, '');
  const perms = Array.isArray(user?.role?.permissions) 
    ? user.role.permissions 
    : (Array.isArray(user?.permissions) ? user.permissions : []);

  const isAdmin = 
    roleName === 'superadmin' || 
    roleName === 'admin' || 
    roleName.includes('admin') ||
    perms.includes('*') ||
    perms.includes('*:*') ||
    perms.includes('all');

  if (isAdmin) {
    return children;
  }

  if (requiredPermission) {
    const [mod] = requiredPermission.split(':');
    const hasPerm = perms.includes(requiredPermission) || perms.includes(`${mod}:*`) || perms.includes('*');
    if (!hasPerm) {
      return <Navigate to='/forbidden' replace />
    }
  }

  if (requiredModule) {
    const enabledModules = user?.role?.enabled_modules || [];
    const hasModulePerm = perms.some(p => p.startsWith(`${requiredModule}:`) || p === '*' || p === `${requiredModule}`);
    const isModuleAllowed = enabledModules.length === 0 
      ? (hasModulePerm || ['dashboards', 'settings', 'tasks'].includes(requiredModule)) 
      : (enabledModules.includes(requiredModule) || hasModulePerm || ['dashboards', 'settings', 'tasks'].includes(requiredModule));

    if (!isModuleAllowed) {
      return <Navigate to='/forbidden' replace />
    }
  }

  return children
}
