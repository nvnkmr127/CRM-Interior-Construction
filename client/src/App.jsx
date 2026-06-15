import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Login from './pages/auth/Login';
import ProtectedRoute from './components/ProtectedRoute';
import Shell from './components/layout/Shell';
import ConfigPage from './pages/config/ConfigPage';
import CustomFieldsManager from './pages/config/CustomFieldsManager';
import TemplateBuilder from './pages/config/TemplateBuilder';

const Dashboard = () => <div>Dashboard</div>;
const LeadsPage = () => <div>LeadsPage</div>;
const ProjectsPage = () => <div>ProjectsPage</div>;
const ProjectDetail = () => <div>ProjectDetail</div>;
const PortalApp = () => <div>PortalApp</div>;

const Stub = ({ name }) => <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)' }}>{name} (Stub)</div>;

export default function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/portal/*" element={<PortalApp />} />

      {/* Protected Routes wrapped in Shell */}
      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            <Shell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="leads" element={<LeadsPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        
        <Route path="config" element={<ConfigPage />}>
          <Route index element={<Navigate to="general" replace />} />
          <Route path="general" element={<Stub name="General Settings" />} />
          <Route path="custom-fields" element={<CustomFieldsManager />} />
          <Route path="lead-stages" element={<Stub name="Lead Stages" />} />
          <Route path="templates" element={<TemplateBuilder />} />
          <Route path="automations" element={<Stub name="Automations" />} />
          <Route path="api-keys" element={<Stub name="API Keys" />} />
          <Route path="webhooks" element={<Stub name="Webhooks" />} />
          <Route path="logs" element={<Stub name="Logs" />} />
          <Route path="roles" element={<Stub name="Roles & Permissions" />} />
        </Route>
      </Route>

      {/* Fallback Catch-all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
