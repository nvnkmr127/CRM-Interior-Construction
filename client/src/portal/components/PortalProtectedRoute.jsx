/* eslint-disable no-unused-vars */
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { usePortalAuth } from '../store/portalAuthContext';

export default function PortalProtectedRoute() {
  const { projectId, loading } = usePortalAuth();

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading Portal...</div>;
  }
  
  if (!projectId) {
    return <Navigate to="/portal/login" replace />;
  }

  return <Outlet />;
}
