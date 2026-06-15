import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './store/authContext'
import { ToastProvider } from './store/toastContext'
import { BreadcrumbsProvider } from './store/breadcrumbsContext'
import ProtectedRoute from './components/ProtectedRoute'
import Shell from './components/layout/Shell'
import PageLoader from './components/ui/PageLoader'
import ErrorBoundary from './components/ErrorBoundary'
import OfflineBanner from './components/layout/OfflineBanner'

// Lazy-load ALL pages
const Login          = lazy(() => import('./pages/auth/Login'))
const Register       = lazy(() => import('./pages/auth/Register'))
const NotFound       = lazy(() => import('./pages/NotFound'))
const Forbidden      = lazy(() => import('./pages/Forbidden'))
const Dashboard      = lazy(() => import('./pages/dashboard/DashboardPage'))
const LeadsPage      = lazy(() => import('./pages/leads/LeadsPage'))
const ProjectsPage   = lazy(() => import('./pages/projects/ProjectsPage'))
const ProjectDetail  = lazy(() => import('./pages/projects/ProjectDetail'))
const MyTasksPage    = lazy(() => import('./pages/tasks/MyTasksPage'))
const LeadAnalytics  = lazy(() => import('./pages/analytics/LeadAnalyticsPage'))
const ProjectAnalytics= lazy(() => import('./pages/analytics/ProjectAnalyticsPage'))
const ProfilePage    = lazy(() => import('./pages/settings/ProfilePage'))
const ConfigPage     = lazy(() => import('./pages/config/ConfigPage'))
const PortalApp      = lazy(() => import('./portal/PortalApp'))

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <BreadcrumbsProvider>
            <ErrorBoundary>
              <OfflineBanner />
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path='/login' element={<Login />} />
                  <Route path='/register' element={<Register />} />
                  <Route path='/forbidden' element={<Forbidden />} />
                  <Route path='/portal/*' element={<PortalApp />} />
                  <Route element={<ProtectedRoute><Shell /></ProtectedRoute>}>
                    <Route index element={<Navigate to='/dashboard' replace />} />
                    <Route path='/dashboard' element={<Dashboard />} />
                    <Route path='/leads' element={<LeadsPage />} />
                    <Route path='/projects' element={<ProjectsPage />} />
                    <Route path='/projects/:id' element={<ProjectDetail />} />
                    <Route path='/tasks' element={<MyTasksPage />} />
                    <Route path='/analytics/leads' element={<LeadAnalytics />} />
                    <Route path='/analytics/projects' element={<ProjectAnalytics />} />
                    <Route path='/settings/profile' element={<ProfilePage />} />
                    <Route path='/config/*' element={<ConfigPage />} />
                  </Route>
                  <Route path='*' element={<NotFound />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </BreadcrumbsProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
