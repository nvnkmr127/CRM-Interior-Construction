import { NavLink, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../store/authContext'
import { usePageTitle } from '../../hooks/usePageTitle'
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs'
// Sub-page imports (all lazy-loaded):
import { lazy, Suspense } from 'react'
import styles from './ConfigPage.module.css'

const CustomFieldsManager = lazy(() => import('./CustomFieldsManager'))
const LeadStagesManager   = lazy(() => import('./LeadStagesManager'))
const TemplateBuilder     = lazy(() => import('./TemplateBuilder'))
const AutomationBuilder   = lazy(() => import('./AutomationBuilder'))
const EmailTemplateBuilder = lazy(() => import('./EmailTemplateBuilder'))
const ApiKeysManager      = lazy(() => import('./ApiKeysManager'))
const WebhooksManager     = lazy(() => import('./WebhooksManager'))
const LogsViewer          = lazy(() => import('./LogsViewer'))
const UsersManager        = lazy(() => import('./UsersManager'))
const EmployeeProfilePage = lazy(() => import('./EmployeeProfilePage'))
const OrganizationManager = lazy(() => import('./OrganizationManager'))
const ConversionChecklistManager = lazy(() => import('./ConversionChecklistManager'))
const QcChecklistsManager = lazy(() => import('./QcChecklistsManager'))
const FinancialSettings = lazy(() => import('./FinancialSettings'))
const LeadTimesManager = lazy(() => import('./LeadTimesManager'))
const TradeActivityTemplatesManager = lazy(() => import('./TradeActivityTemplatesManager'))
const AuditTrail = lazy(() => import('./AuditTrail'))
const RolesManager = lazy(() => import('./RolesManager'))
const LoginHistoryPage = lazy(() => import('./LoginHistoryPage'))
const SecuritySettingsPage = lazy(() => import('./SecuritySettingsPage'))


export default function ConfigPage() {
  const { user } = useAuth()
  const location = useLocation()
  
  const pathTitleMap = {
    '/config/lead-stages': 'Lead Stages',
    '/config/team-members': 'Team Members',
    '/config/roles-permissions': 'Roles & Permissions',
    '/config/organization': 'Organization',
    '/config/security': 'Security',
    '/config/login-history': 'Login History',
    '/config/audit-logs': 'Audit Trail',
    '/config/custom-fields': 'Custom Fields',
    '/config/templates': 'Project Templates',
    '/config/automations': 'Automations',
    '/config/conversion-checklist': 'Conversion Checklist',
    '/config/qc-checklists': 'Trade QC Checklists',
    '/config/trade-activities': 'Trade Templates',
    '/config/api-keys': 'API Keys',
    '/config/email-templates': 'Email Templates',
    '/config/logs': 'Logs',
    '/config/financial-settings': 'Financial Thresholds',
    '/config/vendor-lead-times': 'Vendor Lead Times'
  };

  const currentTitle = pathTitleMap[location.pathname] || 'Configuration';

  usePageTitle(currentTitle)
  useBreadcrumbs([{ label: currentTitle }])

  // Guard: only superadmin can access config
  if (user?.role?.name !== 'superadmin') {
    return <Navigate to='/forbidden' replace />
  }

  return (
    <Suspense fallback={<div className={styles.loading}>Loading...</div>}>
      <Routes>
        <Route index element={<Navigate to='/config/lead-stages' replace />} />
        <Route path='lead-stages'   element={<LeadStagesManager />} />
        <Route path="team-members" element={<UsersManager />} />
        <Route path="team-members/:id" element={<EmployeeProfilePage />} />
        <Route path="roles-permissions" element={<RolesManager />} />
        <Route path="organization" element={<OrganizationManager />} />
        <Route path="security" element={<SecuritySettingsPage />} />
        <Route path="login-history" element={<LoginHistoryPage />} />
        <Route path="audit-logs" element={<AuditTrail />} />
        <Route path='custom-fields' element={<CustomFieldsManager />} />
        <Route path='templates'     element={<TemplateBuilder />} />
        <Route path='automations'   element={<AutomationBuilder />} />
        <Route path='conversion-checklist' element={<ConversionChecklistManager />} />
        <Route path='qc-checklists' element={<QcChecklistsManager />} />
        <Route path='trade-activities' element={<TradeActivityTemplatesManager />} />
        <Route path='api-keys'      element={<ApiKeysManager />} />
        <Route path='email-templates' element={<EmailTemplateBuilder />} />
        <Route path='logs'          element={<LogsViewer />} />

        <Route path='financial-settings' element={<FinancialSettings />} />
        <Route path='vendor-lead-times' element={<LeadTimesManager />} />
        <Route path='*'             element={<Navigate to='/config/lead-stages' replace />} />
      </Routes>
    </Suspense>
  )
}
