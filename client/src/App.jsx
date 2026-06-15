import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Shell from './components/layout/Shell';
import PageLoader from './components/ui/PageLoader';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineBanner from './components/layout/OfflineBanner';

// Lazy loaded pages
const Login = lazy(() => import('./pages/auth/Login'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const LeadsPage = lazy(() => import('./pages/leads/LeadsPage'));
const ProjectsPage = lazy(() => import('./pages/projects/ProjectsPage'));
const ProjectDetail = lazy(() => import('./pages/projects/ProjectDetail'));
const MyTasksPage = lazy(() => import('./pages/tasks/MyTasksPage'));
const LeadAnalyticsPage = lazy(() => import('./pages/analytics/LeadAnalyticsPage'));
const ConfigPage = lazy(() => import('./pages/config/ConfigPage'));
const CustomFieldsManager = lazy(() => import('./pages/config/CustomFieldsManager'));
const TemplateBuilder = lazy(() => import('./pages/config/TemplateBuilder'));

const PortalApp = lazy(() => import('./portal/PortalApp'));
const Stub = ({ name }) => <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)' }}>{name} (Stub)</div>;

export default function App() {
  return (
    <>
      <OfflineBanner />
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
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
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="leads" element={<LeadsPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="tasks" element={<MyTasksPage />} />
        <Route path="analytics/leads" element={<LeadAnalyticsPage />} />
        
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
        </Suspense>
      </ErrorBoundary>
    </>
  );
}
