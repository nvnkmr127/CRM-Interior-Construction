import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../store/authContext';
import Spinner from './ui/Spinner';

export default function ProtectedRoute({ children, requiredPermission }) {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh', 
        backgroundColor: 'var(--color-bg)' 
      }}>
        <Spinner size={40} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to='/login' replace />;
  }

  // Superadmin bypasses permission checks (mirroring backend logic)
  if (requiredPermission && user?.role?.name !== 'superadmin' && !user?.role?.permissions?.includes(requiredPermission)) {
    return <Navigate to='/forbidden' replace />;
  }

  return children;
}
