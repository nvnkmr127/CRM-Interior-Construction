import { NavLink, Routes, Route, Navigate } from 'react-router-dom'
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
const ApiKeysManager      = lazy(() => import('./ApiKeysManager'))
const WebhooksManager     = lazy(() => import('./WebhooksManager'))
const LogsViewer          = lazy(() => import('./LogsViewer'))
const UsersManager        = lazy(() => import('./UsersManager'))
const ConversionChecklistManager = lazy(() => import('./ConversionChecklistManager'))
const QcChecklistsManager = lazy(() => import('./QcChecklistsManager'))
const FinancialSettings = lazy(() => import('./FinancialSettings'))
const LeadTimesManager = lazy(() => import('./LeadTimesManager'))
const TradeActivityTemplatesManager = lazy(() => import('./TradeActivityTemplatesManager'))
const AuditTrail = lazy(() => import('./AuditTrail'))
const RolesManager = lazy(() => import('./RolesManager'))

const CONFIG_NAV = [
  { group: 'PIPELINE', items: [
    { to: 'lead-stages',   icon: '◎', label: 'Lead Stages',   desc: 'Sales pipeline stages' },
    { to: 'custom-fields', icon: '⊡', label: 'Custom Fields', desc: 'Add fields to leads & projects' },
  ]},
  { group: 'PROJECTS', items: [
    { to: 'templates',     icon: '◈', label: 'Project Templates', desc: 'Phase & milestone blueprints' },
    { to: 'automations',   icon: '⚙', label: 'Automations',       desc: 'Trigger-based rules' },
    { to: 'conversion-checklist', icon: '☑', label: 'Conversion Checklist', desc: 'Pre-conversion requirements' },
    { to: 'qc-checklists', icon: '☑', label: 'Trade QC Checklists', desc: 'Pre-installation checklists' },
    { to: 'trade-activities', icon: '🛠', label: 'Trade Templates', desc: 'Configurable activity templates' },
    { to: 'vendor-lead-times', icon: '⏱', label: 'Vendor Lead Times', desc: 'Material category order lead times' },
  ]},
  { group: 'INTEGRATIONS', items: [
    { to: 'api-keys',      icon: '⊙', label: 'API Keys',    desc: 'Connect external tools' },
    { to: 'logs',          icon: '≡', label: 'Logs',        desc: 'Delivery history & retries' },
  ]},
  { group: 'TEAM', items: [
    { to: 'users',         icon: '◉', label: 'Team Members', desc: 'Invite and manage access' },
    { to: 'roles',         icon: '🔑', label: 'Roles & Permissions', desc: 'Manage access levels' },
    { to: 'audit-trail',   icon: '📜', label: 'Audit Trail', desc: 'View system logs and changes' },
  ]},
  { group: 'FINANCE', items: [
    { to: 'financial-settings', icon: '💰', label: 'Financial Thresholds', desc: 'Configurable approval thresholds' },
  ]},
]

export default function ConfigPage() {
  const { user } = useAuth()
  usePageTitle('Config Centre')
  useBreadcrumbs([{ label: 'Config Centre' }])

  // Guard: only superadmin can access config
  if (user?.role?.name !== 'superadmin') {
    return <Navigate to='/forbidden' replace />
  }

  return (
    <div className={styles.layout}>
      {/* LEFT NAV */}
      <aside className={styles.nav}>
        <div className={styles.navHeader}>
          <span className={styles.navTitle}>Config Centre</span>
          <span className={styles.navSub}>Workspace settings</span>
        </div>
        {CONFIG_NAV.map(group => (
          <div key={group.group} className={styles.navGroup}>
            <span className={styles.groupLabel}>{group.group}</span>
            {group.items.map(item => (
              <NavLink
                key={item.to}
                to={`/config/${item.to}`}
                className={({isActive}) => `${styles.navItem} ${isActive ? styles.active : ''}`}
              >
                <span className={styles.itemIcon}>{item.icon}</span>
                <span className={styles.itemText}>
                  <span className={styles.itemLabel}>{item.label}</span>
                  <span className={styles.itemDesc}>{item.desc}</span>
                </span>
              </NavLink>
            ))}
          </div>
        ))}
      </aside>

      {/* RIGHT CONTENT */}
      <main className={styles.content}>
        <Suspense fallback={<div className={styles.loading}>Loading...</div>}>
          <Routes>
            <Route index element={<Navigate to='/config/lead-stages' replace />} />
            <Route path='lead-stages'   element={<LeadStagesManager />} />
            <Route path='custom-fields' element={<CustomFieldsManager />} />
            <Route path='templates'     element={<TemplateBuilder />} />
            <Route path='automations'   element={<AutomationBuilder />} />
            <Route path='conversion-checklist' element={<ConversionChecklistManager />} />
            <Route path='qc-checklists' element={<QcChecklistsManager />} />
            <Route path='trade-activities' element={<TradeActivityTemplatesManager />} />
            <Route path='api-keys'      element={<ApiKeysManager />} />
            <Route path='logs'          element={<LogsViewer />} />
            <Route path='users'         element={<UsersManager />} />
            <Route path='roles'         element={<RolesManager />} />
            <Route path='audit-trail'   element={<AuditTrail />} />
            <Route path='financial-settings' element={<FinancialSettings />} />
            <Route path='vendor-lead-times' element={<LeadTimesManager />} />
            <Route path='*'             element={<Navigate to='/config/lead-stages' replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}
