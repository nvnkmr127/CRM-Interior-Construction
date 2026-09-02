import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import styles from './PortalShell.module.css'
import { usePortalAuth } from '../store/portalAuthContext'

const NAV_GROUPS = [
  {
    group: 'PROJECT OVERVIEW',
    items: [
      { path: '/portal/overview', label: 'Overview', icon: '🏠' },
      { path: '/portal/timeline', label: 'Timeline & Milestones', icon: '📅' },
    ]
  },
  {
    group: 'DESIGN & SPECIFICATIONS',
    items: [
      { path: '/portal/design-concepts', label: '3D Concepts & Renders', icon: '🎨' },
      { path: '/portal/design-reviews', label: 'Design Reviews', icon: '📐' },
      { path: '/portal/material-palettes', label: 'Material Palettes', icon: '🧱' },
      { path: '/portal/material-approvals', label: 'Material Approvals', icon: '🔄' },
    ]
  },
  {
    group: 'APPROVALS & CHANGES',
    items: [
      { path: '/portal/approvals', label: 'Client Approvals', icon: '📋' },
      { path: '/portal/change-orders', label: 'Change Orders', icon: '📄' },
      { path: '/portal/quotations', label: 'Quotations & Budget', icon: '💰' },
    ]
  },
  {
    group: 'SITE & EXECUTION',
    items: [
      { path: '/portal/snags', label: 'Snags Tracker', icon: '🔧' },
      { path: '/portal/punch-list', label: 'Punch List', icon: '✅' },
      { path: '/portal/site-visits', label: 'Site Visits', icon: '📍' },
      { path: '/portal/weekly-reports', label: 'Weekly Reports', icon: '📊' },
      { path: '/portal/meeting-notes', label: 'Meeting Notes', icon: '📝' },
    ]
  },
  {
    group: 'FINANCIALS & WARRANTY',
    items: [
      { path: '/portal/payments', label: 'Payments & Invoices', icon: '💳' },
      { path: '/portal/handover', label: 'Handover Certificate', icon: '🏆' },
      { path: '/portal/warranties', label: 'Warranties & Care', icon: '🛡️' },
      { path: '/portal/amcs', label: 'Maintenance (AMC)', icon: '🛠️' },
      { path: '/portal/claims', label: 'Warranty Claims', icon: '⚙️' },
      { path: '/portal/documents', label: 'Project Documents', icon: '📁' },
    ]
  }
]

export default function PortalShell({ children }) {
  const { portalUser, logout } = usePortalAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'light') return false
    if (saved === 'dark') return true
    return document.documentElement.classList.contains('dark')
  })
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [isDark])

  const toggleTheme = () => {
    setIsDark(prev => !prev)
  }

  // Find active label for breadcrumbs
  const allItems = NAV_GROUPS.flatMap(g => g.items)
  const currentItem = allItems.find(i => location.pathname.startsWith(i.path)) || { label: 'Project Overview' }

  return (
    <div className={styles.shell}>
      
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div className={styles.mobileBackdrop} onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Sidebar (Matching Admin & Team Member Layout) */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        
        {/* Brand Area */}
        <div className={styles.brandHeader}>
          <div className={styles.brand} onClick={() => { navigate('/portal/overview'); setSidebarOpen(false); }}>
            <div className={styles.brandMark}>✦</div>
            <div>
              <div className={styles.brandName}>Customer Portal</div>
              <div className={styles.brandSubtitle}>Interior & Construction Hub</div>
            </div>
          </div>
        </div>

        {/* Project Selector / Indicator */}
        <div className={styles.projectPill}>
          <span className={styles.projectIcon}>🏠</span>
          <span className={styles.projectNameText} title={portalUser?.name || 'Active Project'}>
            {portalUser?.name ? `${portalUser.name}'s Residence` : 'Active Residence'}
          </span>
          <span className={styles.projectStatusDot} title="Project In Progress" />
        </div>

        {/* Scrollable Navigation Groups */}
        <div className={styles.navScroll}>
          {NAV_GROUPS.map((group, idx) => (
            <div key={idx} className={styles.navGroup}>
              <div className={styles.groupLabel}>{group.group}</div>
              {group.items.map(item => {
                const isActive = location.pathname === item.path || (item.path !== '/portal/overview' && location.pathname.startsWith(item.path))
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive: isNavActive }) => `${styles.navLink} ${(isActive || isNavActive) ? styles.navLinkActive : ''}`}
                  >
                    <span className={styles.navIcon}>{item.icon}</span>
                    <span className={styles.navLabel}>{item.label}</span>
                  </NavLink>
                )
              })}
            </div>
          ))}
        </div>

        {/* Sidebar Footer: User Card & Theme Toggle & Sign Out */}
        <div className={styles.sidebarFooter}>
          <div className={styles.userCard}>
            <div className={styles.avatar}>
              {(portalUser?.clientName || portalUser?.name || 'C').charAt(0).toUpperCase()}
            </div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{portalUser?.clientName || portalUser?.name || 'Client'}</span>
              <span className={styles.userRole}>Homeowner</span>
            </div>
          </div>

          <div className={styles.footerActions}>
            <button 
              type="button" 
              onClick={toggleTheme} 
              className={styles.themeToggleBtn}
              title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
            >
              <span>{isDark ? '☀️' : '🌙'}</span>
              <span>{isDark ? 'Light' : 'Dark'}</span>
            </button>

            <button 
              type="button" 
              onClick={logout} 
              className={styles.logoutBtn}
              title="Sign Out of Portal"
            >
              🚪 Exit
            </button>
          </div>
        </div>

      </aside>

      {/* Main Content Area */}
      <div className={styles.contentArea}>
        
        {/* Topbar Header */}
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button 
              type="button" 
              className={styles.hamburgerBtn} 
              onClick={() => setSidebarOpen(true)}
              aria-label="Open Sidebar"
            >
              ☰
            </button>

            <div className={styles.pageBreadcrumb}>
              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>Portal</span>
              <span className={styles.breadcrumbDivider}>›</span>
              <span className={styles.breadcrumbActive}>{currentItem.label}</span>
            </div>
          </div>

          <div className={styles.topbarRight}>
            <span className={styles.statusIndicator}>
              ● Active Project
            </span>

            {/* Topbar Theme Toggle Button */}
            <button 
              type="button" 
              onClick={toggleTheme} 
              className={styles.topThemeBtn}
              title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
              aria-label="Toggle Theme"
            >
              {isDark ? '☀️' : '🌙'}
            </button>
          </div>
        </header>

        {/* Page Content Body */}
        <main className={styles.mainBody}>
          {children}
        </main>

      </div>

    </div>
  )
}
