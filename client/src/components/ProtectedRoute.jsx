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

  const isAdmin = user?.role?.name === 'superadmin'

  if (requiredPermission) {
    const perms = user?.role?.permissions || []
    if (!isAdmin && !perms.includes(requiredPermission)) {
      return <Navigate to='/forbidden' replace />
    }
  }

  if (requiredModule) {
    const enabledModules = user?.role?.enabled_modules || []
    if (!isAdmin && !enabledModules.includes(requiredModule)) {
      return <Navigate to='/forbidden' replace />
    }
  }

  return children
}
