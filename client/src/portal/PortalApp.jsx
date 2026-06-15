import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PortalAuthProvider } from './store/portalAuthContext';
import PortalProtectedRoute from './components/PortalProtectedRoute';
import PortalShell from './components/PortalShell';

import PortalLogin from './pages/PortalLogin';
import PortalProject from './pages/PortalProject';
import PortalApprovals from './pages/PortalApprovals';
import PortalSnags from './pages/PortalSnags';

const PortalDocuments = () => <div style={{ padding: '1rem' }}><h2>Documents Stub</h2></div>;

export default function PortalApp() {
  return (
    <PortalAuthProvider>
      <Routes>
        <Route path="login" element={<PortalLogin />} />
        
        <Route element={<PortalProtectedRoute />}>
          <Route element={<PortalShell />}>
            <Route index element={<Navigate to="project" replace />} />
            <Route path="project" element={<PortalProject />} />
            <Route path="approvals" element={<PortalApprovals />} />
            <Route path="snags" element={<PortalSnags />} />
            <Route path="documents" element={<PortalDocuments />} />
          </Route>
        </Route>
        
        <Route path="*" element={<Navigate to="project" replace />} />
      </Routes>
    </PortalAuthProvider>
  );
}
