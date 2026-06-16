import { Navigate } from 'react-router-dom'
import { useAuth } from '../store/authContext'
import Spinner from './ui/Spinner'
import styles from './ProtectedRoute.module.css'

export default function ProtectedRoute({ children, requiredPermission }) {
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

  if (requiredPermission) {
    const perms = user?.role?.permissions || []
    const isAdmin = user?.role?.name === 'superadmin'
    if (!isAdmin && !perms.includes(requiredPermission)) {
      return <Navigate to='/forbidden' replace />
    }
  }

  return children
}
