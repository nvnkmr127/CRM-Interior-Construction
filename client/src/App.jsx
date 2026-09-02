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
const CompanySettingsPage = lazy(() => import('./pages/settings/CompanySettingsPage'))
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
                    <Route path='/dashboard/:tab' element={<ProtectedRoute requiredModule="dashboards" requiredTab="dashboard"><Dashboard /></ProtectedRoute>} />
                    <Route path='/dashboard' element={<Navigate to='/dashboard/sales' replace />} />
                    <Route path='/leads' element={<ProtectedRoute requiredModule="leads" requiredTab="leads"><LeadsPage /></ProtectedRoute>} />
                    <Route path='/leads/forms' element={<ProtectedRoute requiredModule="leads" requiredTab="lead-forms"><LeadFormsListPage /></ProtectedRoute>} />
                    <Route path='/leads/forms/new' element={<ProtectedRoute requiredModule="leads" requiredTab="lead-forms"><LeadFormBuilderPage /></ProtectedRoute>} />
                    <Route path='/leads/forms/:id/edit' element={<ProtectedRoute requiredModule="leads" requiredTab="lead-forms"><LeadFormBuilderPage /></ProtectedRoute>} />
                    <Route path='/leads/forms/:id/submissions' element={<ProtectedRoute requiredModule="leads" requiredTab="lead-forms"><LeadFormSubmissionsPage /></ProtectedRoute>} />
                    <Route path='/leads/manager' element={<ProtectedRoute requiredModule="leads" requiredTab="leads-dashboard"><ManagerDashboard /></ProtectedRoute>} />
                    <Route path='/projects' element={<ProtectedRoute requiredModule="projects" requiredTab="projects"><ProjectsPage /></ProtectedRoute>} />
                    <Route path='/projects/resources' element={<ProtectedRoute requiredModule="projects" requiredTab="resource-capacity"><ResourceCapacityPage /></ProtectedRoute>} />
                    <Route path='/projects/coordination' element={<ProtectedRoute requiredModule="projects" requiredTab="coordination"><GlobalCoordinationPage /></ProtectedRoute>} />
                    <Route path='/projects/handover-dashboard' element={<ProtectedRoute requiredModule="projects" requiredTab="handover-dashboard"><GlobalHandoverDashboard /></ProtectedRoute>} />
                    <Route path='/projects/retention-dashboard' element={<ProtectedRoute requiredModule="projects" requiredTab="retention-dashboard"><GlobalRetentionDashboard /></ProtectedRoute>} />
                    <Route path='/projects/absences' element={<ProtectedRoute requiredModule="projects" requiredTab="absences"><ResourceAbsencePage /></ProtectedRoute>} />
                    <Route path='/factory/production' element={<ProtectedRoute requiredModule="factory" requiredTab="coordination"><GlobalFactoryProductionPage /></ProtectedRoute>} />
                    <Route path='/projects/:id' element={<ProtectedRoute requiredModule="projects" requiredTab="projects"><ProjectDetail /></ProtectedRoute>} />
                    <Route path='/tasks' element={<ProtectedRoute requiredModule="tasks" requiredTab="tasks"><MyTasksPage /></ProtectedRoute>} />
                    <Route path='/reports' element={<ProtectedRoute requiredModule="analytics" requiredTab="reports"><ReportsHubPage /></ProtectedRoute>} />
                    <Route path='/analytics/leads' element={<ProtectedRoute requiredModule="analytics" requiredTab="analytics-leads"><LeadAnalytics /></ProtectedRoute>} />
                    <Route path='/analytics/projects' element={<ProtectedRoute requiredModule="analytics" requiredTab="analytics-projects"><ProjectAnalytics /></ProtectedRoute>} />
                    <Route path='/analytics/boq-variance' element={<ProtectedRoute requiredModule="analytics" requiredTab="analytics-boq"><BOQVarianceReportPage /></ProtectedRoute>} />
                    <Route path='/analytics/vendors' element={<ProtectedRoute requiredModule="analytics" requiredTab="vendor-performance"><VendorPerformanceReportPage /></ProtectedRoute>} />
                    <Route path='/analytics/vendors/:vendorName' element={<ProtectedRoute requiredModule="analytics" requiredTab="vendor-performance"><VendorPerformanceDetailPage /></ProtectedRoute>} />
                    <Route path='/analytics/vendors-capacity' element={<ProtectedRoute requiredModule="analytics" requiredTab="vendor-capacity"><VendorCapacityPage /></ProtectedRoute>} />
                    <Route path='/analytics/collection-forecast' element={<ProtectedRoute requiredModule="analytics" requiredTab="analytics-collection-forecast"><CollectionForecastReportPage /></ProtectedRoute>} />
                    <Route path='/analytics/profitability' element={<ProtectedRoute requiredModule="analytics" requiredTab="analytics-profitability"><ProjectProfitabilityReportPage /></ProtectedRoute>} />
                    <Route path='/analytics/resources' element={<ProtectedRoute requiredModule="analytics" requiredTab="analytics-resources"><ResourceUtilisationReportPage /></ProtectedRoute>} />
                    <Route path='/analytics/resource-workload' element={<ProtectedRoute requiredModule="analytics" requiredTab="analytics-resource-workload"><ResourceWorkloadDashboard /></ProtectedRoute>} />
                    <Route path='/analytics/csat' element={<ProtectedRoute requiredModule="analytics" requiredTab="analytics-csat"><CSATReportPage /></ProtectedRoute>} />
                    <Route path='/analytics/delay-analysis' element={<ProtectedRoute requiredModule="analytics" requiredTab="analytics-delay"><DelayAnalysisReportPage /></ProtectedRoute>} />
                    <Route path='/settings/profile' element={<ProtectedRoute requiredModule="settings"><ProfilePage /></ProtectedRoute>} />
                    <Route path='/settings/security' element={<ProtectedRoute requiredModule="settings"><MySecurityPage /></ProtectedRoute>} />
                    <Route path='/settings/preferences' element={<ProtectedRoute requiredModule="settings"><PreferencesPage /></ProtectedRoute>} />
                    <Route path='/settings/audit-trail' element={<ProtectedRoute requiredModule="settings" requiredTab="audit-trail"><AuditTrailPage /></ProtectedRoute>} />
                    <Route path='/settings/approval-matrix' element={<ProtectedRoute requiredModule="settings" requiredTab="financial-thresholds"><ApprovalMatrixPage /></ProtectedRoute>} />
                    <Route path='/settings/company' element={<ProtectedRoute requiredModule="settings" requiredTab="company-settings"><CompanySettingsPage /></ProtectedRoute>} />
                    <Route path='/settings/superadmin' element={<ProtectedRoute requiredModule="settings" requiredTab="superadmin"><SuperAdminSettings /></ProtectedRoute>} />
                    <Route path='/team/members' element={<ProtectedRoute requiredModule="settings" requiredTab="team-members"><UsersManager /></ProtectedRoute>} />
                    <Route path='/team/roles' element={<ProtectedRoute requiredModule="settings" requiredTab="roles-permissions"><RolesManager /></ProtectedRoute>} />
                    
                    {/* Flattened Config Routes */}
                    <Route path='/financial-settings' element={<ProtectedRoute requiredModule="settings" requiredTab="financial-thresholds"><FinancialSettings /></ProtectedRoute>} />
                    <Route path='/lead-stages' element={<ProtectedRoute requiredModule="settings" requiredTab="lead-stages"><LeadStagesManager /></ProtectedRoute>} />
                    <Route path='/custom-fields' element={<ProtectedRoute requiredModule="settings" requiredTab="custom-fields"><CustomFieldsManager /></ProtectedRoute>} />
                    <Route path='/templates' element={<ProtectedRoute requiredModule="settings" requiredTab="templates"><TemplateBuilder /></ProtectedRoute>} />
                    <Route path='/trade-activities' element={<ProtectedRoute requiredModule="settings" requiredTab="trade-activities"><TradeActivityTemplatesManager /></ProtectedRoute>} />
                    <Route path='/qc-checklists' element={<ProtectedRoute requiredModule="settings" requiredTab="qc-checklists"><QcChecklistsManager /></ProtectedRoute>} />
                    <Route path='/conversion-checklist' element={<ProtectedRoute requiredModule="settings" requiredTab="conversion-checklist"><ConversionChecklistManager /></ProtectedRoute>} />
                    <Route path='/automations' element={<ProtectedRoute requiredModule="settings" requiredTab="automations"><AutomationBuilder /></ProtectedRoute>} />
                    <Route path='/vendor-lead-times' element={<ProtectedRoute requiredModule="settings" requiredTab="vendor-lead-times"><LeadTimesManager /></ProtectedRoute>} />
                    <Route path='/organization' element={<ProtectedRoute requiredModule="settings" requiredTab="organization"><OrganizationManager /></ProtectedRoute>} />
                    <Route path='/login-history' element={<ProtectedRoute requiredModule="settings" requiredTab="login-history"><LoginHistoryPage /></ProtectedRoute>} />
                    <Route path='/api-keys' element={<ProtectedRoute requiredModule="settings" requiredTab="api-keys"><ApiKeysManager /></ProtectedRoute>} />
                    <Route path='/email-templates' element={<ProtectedRoute requiredModule="settings" requiredTab="email-templates"><EmailTemplateBuilder /></ProtectedRoute>} />
                    <Route path='/logs' element={<ProtectedRoute requiredModule="settings" requiredTab="logs"><LogsViewer /></ProtectedRoute>} />
                    {/* End Flattened Config Routes */}

                    <Route path='/financial-approvals' element={<ProtectedRoute requiredModule="finance" requiredTab="financial-approvals"><FinancialApprovalsPage /></ProtectedRoute>} />
                    <Route path='/finance' element={<ProtectedRoute requiredModule="finance" requiredTab="finance-overview"><FinanceDashboardPage /></ProtectedRoute>} />
                    <Route path='/warehouse' element={<ProtectedRoute requiredModule="warehouse" requiredTab="coordination"><WarehousePage /></ProtectedRoute>} />
                    <Route path="developer/api" element={<ProtectedRoute requiredModule="settings" requiredTab="api-integration"><ApiIntegrationPage /></ProtectedRoute>} />
                    <Route path="developer/webhooks" element={<ProtectedRoute requiredModule="settings" requiredTab="webhooks"><WebhooksManager /></ProtectedRoute>} />
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

