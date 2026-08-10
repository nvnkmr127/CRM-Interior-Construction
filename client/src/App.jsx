import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './store/authContext'
import { GlobalToast } from './store/toastContext'
import { BreadcrumbsProvider } from './store/breadcrumbsContext'
import { ConfirmProvider } from './store/confirmContext'
import ProtectedRoute from './components/ProtectedRoute'
import Shell from './components/layout/Shell'
import PageLoader from './components/ui/PageLoader'
import ErrorBoundary from './components/ErrorBoundary'
import OfflineBanner from './components/layout/OfflineBanner'
import CommandPalette from './components/ui/CommandPalette'

import { initAutomationScheduler } from './store/useTaskAutomationStore'
import { initGovernanceListeners } from './store/useTaskGovernanceStore'

// Initialize Zustand stores' background jobs
initAutomationScheduler()
initGovernanceListeners()

// Lazy-load ALL pages
const Login          = lazy(() => import('./pages/auth/Login'))
const Register       = lazy(() => import('./pages/auth/Register'))
const NotFound       = lazy(() => import('./pages/NotFound'))
const Forbidden      = lazy(() => import('./pages/Forbidden'))
const Dashboard      = lazy(() => import('./pages/dashboard/DashboardPage'))
const LeadsPage      = lazy(() => import('./pages/leads/LeadsPage'))
const LeadFormsListPage = lazy(() => import('./pages/leads/forms/LeadFormsListPage'))
const LeadFormBuilderPage = lazy(() => import('./pages/leads/forms/LeadFormBuilderPage'))
const LeadFormSubmissionsPage = lazy(() => import('./pages/leads/forms/LeadFormSubmissionsPage'))
const PublicLeadFormPage = lazy(() => import('./pages/public/PublicLeadFormPage'))
const ProjectsPage   = lazy(() => import('./pages/projects/ProjectsPage'))
const ProjectDetail  = lazy(() => import('./pages/projects/ProjectDetail'))
const MyTasksPage    = lazy(() => import('./pages/tasks/MyTasksPage'))
const LeadAnalytics  = lazy(() => import('./pages/analytics/LeadAnalyticsPage'))
const ReportsHubPage = lazy(() => import('./pages/analytics/ReportsHubPage'))
const ManagerDashboard = lazy(() => import('./pages/leads/ManagerDashboard'))
const ProjectAnalytics= lazy(() => import('./pages/analytics/ProjectAnalyticsPage'))
const BOQVarianceReportPage = lazy(() => import('./pages/analytics/BOQVarianceReportPage'))
const VendorPerformanceReportPage = lazy(() => import('./pages/analytics/VendorPerformanceReportPage'))
const VendorPerformanceDetailPage = lazy(() => import('./pages/analytics/VendorPerformanceDetailPage'))
const VendorCapacityPage = lazy(() => import('./pages/analytics/VendorCapacityPage'))
const CollectionForecastReportPage = lazy(() => import('./pages/analytics/CollectionForecastReportPage'))
const ProjectProfitabilityReportPage = lazy(() => import('./pages/analytics/ProjectProfitabilityReportPage'))
const ResourceUtilisationReportPage = lazy(() => import('./pages/analytics/ResourceUtilisationReportPage'))
const ResourceWorkloadDashboard = lazy(() => import('./pages/analytics/ResourceWorkloadDashboard'))
const CSATReportPage = lazy(() => import('./pages/analytics/CSATReportPage'))
const DelayAnalysisReportPage = lazy(() => import('./pages/analytics/DelayAnalysisReportPage'))
const ResourceCapacityPage = lazy(() => import('./pages/projects/ResourceCapacityPage'))
const ProfilePage    = lazy(() => import('./pages/settings/ProfilePage'))
const MySecurityPage = lazy(() => import('./pages/profile/MySecurityPage'))
const PreferencesPage= lazy(() => import('./pages/settings/PreferencesPage'))
const AuditTrailPage  = lazy(() => import('./pages/settings/AuditTrailPage'))
const ApprovalMatrixPage = lazy(() => import('./pages/settings/ApprovalMatrixPage'))
const ConfigPage     = lazy(() => import('./pages/config/ConfigPage'))
const PortalApp      = lazy(() => import('./portal/PortalApp'))
const FinancialApprovalsPage = lazy(() => import('./pages/dashboard/FinancialApprovalsPage'))
const FinanceDashboardPage = lazy(() => import('./pages/finance/FinanceDashboardPage'))
const GlobalCoordinationPage = lazy(() => import('./pages/projects/GlobalCoordinationPage'))
const GlobalHandoverDashboard = lazy(() => import('./pages/projects/GlobalHandoverDashboard'))
const GlobalRetentionDashboard = lazy(() => import('./pages/projects/GlobalRetentionDashboard'))
const ResourceAbsencePage = lazy(() => import('./pages/projects/ResourceAbsencePage'))
const WarehousePage = lazy(() => import('./pages/warehouse/WarehousePage'))
const GlobalFactoryProductionPage = lazy(() => import('./pages/factory/GlobalFactoryProductionPage'))
const ApiIntegrationPage = lazy(() => import('./pages/developer/ApiIntegrationPage'))
const WebhooksManager = lazy(() => import('./pages/config/WebhooksManager'))
const UsersManager = lazy(() => import('./pages/config/UsersManager'))
const RolesManager = lazy(() => import('./pages/config/RolesManager'))
const SuperAdminSettings = lazy(() => import('./pages/config/SuperAdminSettings'))

// Flattened config imports
const CustomFieldsManager = lazy(() => import('./pages/config/CustomFieldsManager'))
const LeadStagesManager   = lazy(() => import('./pages/config/LeadStagesManager'))
const TemplateBuilder     = lazy(() => import('./pages/config/TemplateBuilder'))
const AutomationBuilder   = lazy(() => import('./pages/config/AutomationBuilder'))
const EmailTemplateBuilder = lazy(() => import('./pages/config/EmailTemplateBuilder'))
const ApiKeysManager      = lazy(() => import('./pages/config/ApiKeysManager'))
const LogsViewer          = lazy(() => import('./pages/config/LogsViewer'))
const OrganizationManager = lazy(() => import('./pages/config/OrganizationManager'))
const ConversionChecklistManager = lazy(() => import('./pages/config/ConversionChecklistManager'))
const QcChecklistsManager = lazy(() => import('./pages/config/QcChecklistsManager'))
const FinancialSettings = lazy(() => import('./pages/config/FinancialSettings'))
const LeadTimesManager = lazy(() => import('./pages/config/LeadTimesManager'))
const TradeActivityTemplatesManager = lazy(() => import('./pages/config/TradeActivityTemplatesManager'))
const LoginHistoryPage = lazy(() => import('./pages/config/LoginHistoryPage'))



export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ConfirmProvider>
          <BreadcrumbsProvider>
            <ErrorBoundary>
              <OfflineBanner />
              <CommandPalette />
              <GlobalToast />
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path='/login' element={<Login />} />
                  <Route path='/register' element={<Register />} />
                  <Route path='/forbidden' element={<Forbidden />} />
                  <Route path='/forms/:slug' element={<PublicLeadFormPage />} />
                  <Route path='/portal/*' element={<PortalApp />} />
                  <Route element={<ProtectedRoute><Shell /></ProtectedRoute>}>
                    <Route index element={<Navigate to='/dashboard/sales' replace />} />
                    <Route path='/dashboard/:tab' element={<ProtectedRoute requiredModule="dashboards"><Dashboard /></ProtectedRoute>} />
                    <Route path='/dashboard' element={<Navigate to='/dashboard/sales' replace />} />
                    <Route path='/leads' element={<ProtectedRoute requiredModule="leads"><LeadsPage /></ProtectedRoute>} />
                    <Route path='/leads/forms' element={<ProtectedRoute requiredModule="leads"><LeadFormsListPage /></ProtectedRoute>} />
                    <Route path='/leads/forms/new' element={<ProtectedRoute requiredModule="leads"><LeadFormBuilderPage /></ProtectedRoute>} />
                    <Route path='/leads/forms/:id/edit' element={<ProtectedRoute requiredModule="leads"><LeadFormBuilderPage /></ProtectedRoute>} />
                    <Route path='/leads/forms/:id/submissions' element={<ProtectedRoute requiredModule="leads"><LeadFormSubmissionsPage /></ProtectedRoute>} />
                    <Route path='/leads/manager' element={<ProtectedRoute requiredModule="leads"><ManagerDashboard /></ProtectedRoute>} />
                    <Route path='/projects' element={<ProtectedRoute requiredModule="projects"><ProjectsPage /></ProtectedRoute>} />
                    <Route path='/projects/resources' element={<ProtectedRoute requiredModule="projects"><ResourceCapacityPage /></ProtectedRoute>} />
                    <Route path='/projects/coordination' element={<ProtectedRoute requiredModule="projects"><GlobalCoordinationPage /></ProtectedRoute>} />
                    <Route path='/projects/handover-dashboard' element={<ProtectedRoute requiredModule="projects"><GlobalHandoverDashboard /></ProtectedRoute>} />
                    <Route path='/projects/retention-dashboard' element={<ProtectedRoute requiredModule="projects"><GlobalRetentionDashboard /></ProtectedRoute>} />
                    <Route path='/projects/absences' element={<ProtectedRoute requiredModule="projects"><ResourceAbsencePage /></ProtectedRoute>} />
                    <Route path='/factory/production' element={<ProtectedRoute requiredModule="factory"><GlobalFactoryProductionPage /></ProtectedRoute>} />
                    <Route path='/projects/:id' element={<ProtectedRoute requiredModule="projects"><ProjectDetail /></ProtectedRoute>} />
                    <Route path='/tasks' element={<ProtectedRoute requiredModule="tasks"><MyTasksPage /></ProtectedRoute>} />
                    <Route path='/analytics/hub' element={<ProtectedRoute requiredModule="analytics"><ReportsHubPage /></ProtectedRoute>} />
                    <Route path='/analytics/leads' element={<ProtectedRoute requiredModule="analytics"><LeadAnalytics /></ProtectedRoute>} />
                    <Route path='/analytics/projects' element={<ProtectedRoute requiredModule="analytics"><ProjectAnalytics /></ProtectedRoute>} />
                    <Route path='/analytics/boq-variance' element={<ProtectedRoute requiredModule="analytics"><BOQVarianceReportPage /></ProtectedRoute>} />
                    <Route path='/analytics/vendors' element={<ProtectedRoute requiredModule="analytics"><VendorPerformanceReportPage /></ProtectedRoute>} />
                    <Route path='/analytics/vendors/:vendorName' element={<ProtectedRoute requiredModule="analytics"><VendorPerformanceDetailPage /></ProtectedRoute>} />
                    <Route path='/analytics/vendors-capacity' element={<ProtectedRoute requiredModule="analytics"><VendorCapacityPage /></ProtectedRoute>} />
                    <Route path='/analytics/collection-forecast' element={<ProtectedRoute requiredModule="analytics"><CollectionForecastReportPage /></ProtectedRoute>} />
                    <Route path='/analytics/profitability' element={<ProtectedRoute requiredModule="analytics"><ProjectProfitabilityReportPage /></ProtectedRoute>} />
                    <Route path='/analytics/resources' element={<ProtectedRoute requiredModule="analytics"><ResourceUtilisationReportPage /></ProtectedRoute>} />
                    <Route path='/analytics/resource-workload' element={<ProtectedRoute requiredModule="analytics"><ResourceWorkloadDashboard /></ProtectedRoute>} />
                    <Route path='/analytics/csat' element={<ProtectedRoute requiredModule="analytics"><CSATReportPage /></ProtectedRoute>} />
                    <Route path='/analytics/delay-analysis' element={<ProtectedRoute requiredModule="analytics"><DelayAnalysisReportPage /></ProtectedRoute>} />
                    <Route path='/settings/profile' element={<ProtectedRoute requiredModule="settings"><ProfilePage /></ProtectedRoute>} />
                    <Route path='/settings/security' element={<ProtectedRoute requiredModule="settings"><MySecurityPage /></ProtectedRoute>} />
                    <Route path='/settings/preferences' element={<ProtectedRoute requiredModule="settings"><PreferencesPage /></ProtectedRoute>} />
                    <Route path='/settings/audit-trail' element={<ProtectedRoute requiredModule="settings"><AuditTrailPage /></ProtectedRoute>} />
                    <Route path='/settings/approval-matrix' element={<ProtectedRoute requiredModule="settings"><ApprovalMatrixPage /></ProtectedRoute>} />
                    <Route path='/team/members' element={<ProtectedRoute requiredModule="settings"><UsersManager /></ProtectedRoute>} />
                    <Route path='/team/roles' element={<ProtectedRoute requiredModule="settings"><RolesManager /></ProtectedRoute>} />
                    
                    {/* Flattened Config Routes */}
                    <Route path='/financial-settings' element={<ProtectedRoute requiredModule="settings"><FinancialSettings /></ProtectedRoute>} />
                    <Route path='/lead-stages' element={<ProtectedRoute requiredModule="settings"><LeadStagesManager /></ProtectedRoute>} />
                    <Route path='/custom-fields' element={<ProtectedRoute requiredModule="settings"><CustomFieldsManager /></ProtectedRoute>} />
                    <Route path='/templates' element={<ProtectedRoute requiredModule="settings"><TemplateBuilder /></ProtectedRoute>} />
                    <Route path='/trade-activities' element={<ProtectedRoute requiredModule="settings"><TradeActivityTemplatesManager /></ProtectedRoute>} />
                    <Route path='/qc-checklists' element={<ProtectedRoute requiredModule="settings"><QcChecklistsManager /></ProtectedRoute>} />
                    <Route path='/conversion-checklist' element={<ProtectedRoute requiredModule="settings"><ConversionChecklistManager /></ProtectedRoute>} />
                    <Route path='/automations' element={<ProtectedRoute requiredModule="settings"><AutomationBuilder /></ProtectedRoute>} />
                    <Route path='/vendor-lead-times' element={<ProtectedRoute requiredModule="settings"><LeadTimesManager /></ProtectedRoute>} />
                    <Route path='/organization' element={<ProtectedRoute requiredModule="settings"><OrganizationManager /></ProtectedRoute>} />
                    <Route path='/login-history' element={<ProtectedRoute requiredModule="settings"><LoginHistoryPage /></ProtectedRoute>} />
                    <Route path='/api-keys' element={<ProtectedRoute requiredModule="settings"><ApiKeysManager /></ProtectedRoute>} />
                    <Route path='/email-templates' element={<ProtectedRoute requiredModule="settings"><EmailTemplateBuilder /></ProtectedRoute>} />
                    <Route path='/logs' element={<ProtectedRoute requiredModule="settings"><LogsViewer /></ProtectedRoute>} />
                    {/* End Flattened Config Routes */}

                    <Route path='/financial-approvals' element={<ProtectedRoute requiredModule="finance"><FinancialApprovalsPage /></ProtectedRoute>} />
                    <Route path='/finance' element={<ProtectedRoute requiredModule="finance"><FinanceDashboardPage /></ProtectedRoute>} />
                    <Route path='/warehouse' element={<ProtectedRoute requiredModule="warehouse"><WarehousePage /></ProtectedRoute>} />
                    <Route path="developer/api" element={<ProtectedRoute requiredModule="settings"><ApiIntegrationPage /></ProtectedRoute>} />
                    <Route path="developer/webhooks" element={<ProtectedRoute requiredModule="settings"><WebhooksManager /></ProtectedRoute>} />
                  </Route>
                  <Route path='*' element={<NotFound />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </BreadcrumbsProvider>
        </ConfirmProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

