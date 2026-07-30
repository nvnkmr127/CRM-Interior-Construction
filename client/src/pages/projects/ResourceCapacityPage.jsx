/* eslint-disable react-hooks/set-state-in-effect, no-unused-vars */
import { useState, useEffect } from 'react'
import { usePageTitle } from '../../hooks/usePageTitle'
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs'
import { useToast } from '../../store/toastContext'
import { Skeleton, Avatar } from '../../components/ui'
import api from '../../api/axios'
import styles from './ResourceCapacityPage.module.css'

export default function ResourceCapacityPage() {
  usePageTitle('Resource Capability')
  useBreadcrumbs([{ label: 'Projects', to: '/projects' }, { label: 'Resource Capability' }])
  const toast = useToast()

  const [view, setView] = useState('grid')
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [loadFilter, setLoadFilter] = useState('all')

  const fetchCapacityData = async () => {
    setLoading(true)
    try {
      const res = await api.get('/users/resource-capacity')
      setResources(res.data?.data || res.data || [])
      setError(null)
    } catch (err) {
      console.error(err)
      setError('Failed to fetch resource capacity and workload data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCapacityData()
  }, [])

  const handleUpdateCapacity = async (userId, newCapacity) => {
    const parsedCapacity = parseInt(newCapacity, 10)
    if (isNaN(parsedCapacity) || parsedCapacity < 0) {
      return toast.error('Capacity must be a positive integer.')
    }

    try {
      setResources(prev => prev.map(u => 
        u.id === userId ? { ...u, weekly_capacity: parsedCapacity } : u
      ))

      await api.patch(`/users/${userId}`, { weekly_capacity: parsedCapacity })
      toast.success('Capacity updated successfully!')
    } catch (err) {
      console.error(err)
      toast.error('Failed to update capacity.')
      fetchCapacityData()
    }
  }

  const handleUpdateProjectHours = async (userId, projectId, newHours, isPM) => {
    const parsedHours = parseInt(newHours, 10)
    if (isNaN(parsedHours) || parsedHours < 0) {
      return toast.error('Hours must be a positive integer.')
    }

    try {
      setResources(prev => prev.map(u => {
        if (u.id !== userId) return u
        const updatedProjects = u.active_projects.map(p => 
          p.id === projectId ? { ...p, hours_allocated: parsedHours } : p
        )
        return { ...u, active_projects: updatedProjects }
      }))

      const payload = isPM 
        ? { pm_hours_allocated: parsedHours } 
        : { designer_hours_allocated: parsedHours }

      await api.patch(`/projects/${projectId}`, payload)
      toast.success('Project workload hours updated!')
    } catch (err) {
      console.error(err)
      toast.error('Failed to update project workload.')
      fetchCapacityData()
    }
  }

  const activePMsAndDesigners = resources.filter(u => 
    u.role_name === 'Project Manager' || u.role_name === 'Designer'
  )
  
  let totalCommittedHours = 0
  let totalCapacity = 0
  let overloadedCount = 0
  let underloadedCount = 0
  let optimalCount = 0

  activePMsAndDesigners.forEach(u => {
    const committed = u.active_projects?.reduce((sum, p) => sum + (p.hours_allocated || 0), 0) || 0
    const capacity = u.weekly_capacity || 40
    totalCommittedHours += committed
    totalCapacity += capacity
    const util = capacity > 0 ? (committed / capacity) * 100 : 0
    if (util > 100) overloadedCount++
    else if (util < 50) underloadedCount++
    else optimalCount++
  })

  const uniqueActiveProjects = new Set()
  resources.forEach(u => u.active_projects?.forEach(p => uniqueActiveProjects.add(p.id)))
  const totalActiveProjectsCount = uniqueActiveProjects.size

  const filteredResources = resources.filter(u => {
    const q = searchQuery.toLowerCase()
    const matchesSearch = !searchQuery || (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || (u.role_name || '').toLowerCase().includes(q)

    let matchesRole = true
    if (roleFilter === 'pm') matchesRole = u.role_name === 'Project Manager'
    else if (roleFilter === 'designer') matchesRole = u.role_name === 'Designer'
    else if (roleFilter === 'other') matchesRole = u.role_name !== 'Project Manager' && u.role_name !== 'Designer'

    let matchesLoad = true
    const committed = u.active_projects?.reduce((sum, p) => sum + (p.hours_allocated || 0), 0) || 0
    const cap = u.weekly_capacity || 40
    const util = cap > 0 ? (committed / cap) * 100 : 0

    if (loadFilter === 'underloaded') matchesLoad = util < 50
    else if (loadFilter === 'optimal') matchesLoad = util >= 50 && util <= 100
    else if (loadFilter === 'overloaded') matchesLoad = util > 100

    return matchesSearch && matchesRole && matchesLoad
  })

  const statChips = [
    { key: 'all', label: 'Total Resources', count: activePMsAndDesigners.length, color: 'var(--color-text-secondary)', bg: 'var(--color-surface-2)' },
    { key: 'overloaded', label: 'Overloaded', count: overloadedCount, color: 'var(--color-danger)', bg: 'var(--color-danger-bg)' },
    { key: 'optimal', label: 'Optimal', count: optimalCount, color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
    { key: 'underloaded', label: 'Underloaded', count: underloadedCount, color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
  ]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Resource Capability</h1>
        <button onClick={fetchCapacityData} className={styles.refreshBtn}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.92-10.45l5.08 5.08"/>
          </svg>
          Refresh
        </button>
      </div>

      <div className={styles.statsRibbon}>
        {statChips.map(chip => {
          const isActive = loadFilter === chip.key
          return (
            <button
              key={chip.key}
              className={`${styles.statChip} ${isActive ? styles.statChipActive : ''}`}
              style={{
                background: isActive ? chip.bg : 'var(--color-surface)',
                borderColor: isActive ? chip.color : 'var(--color-border)',
              }}
              onClick={() => setLoadFilter(prev => prev === chip.key ? 'all' : chip.key)}
            >
              <span className={styles.statDot} style={{ background: chip.color }} />
              <span style={{ color: chip.color, fontVariantNumeric: 'tabular-nums' }}>{chip.count}</span>
              <span style={{ color: isActive ? chip.color : 'var(--color-text-secondary)' }}>{chip.label}</span>
            </button>
          )
        })}
        {loadFilter !== 'all' && (
          <button
            className={styles.statChip}
            onClick={() => setLoadFilter('all')}
            style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)', fontSize: 'var(--text-xs)' }}
          >
            Clear filter ×
          </button>
        )}
      </div>

      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 20 20" fill="none">
            <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M14 14l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            className={styles.searchInput}
            placeholder="Search resources..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className={styles.filterSelect}
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
        >
          <option value="all">All Roles</option>
          <option value="pm">Project Managers</option>
          <option value="designer">Designers</option>
          <option value="other">Other Staff</option>
        </select>

        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewBtn} ${view === 'grid' ? styles.viewBtnActive : ''}`}
            onClick={() => setView('grid')}
            title="Grid view"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <rect x="1" y="1" width="6" height="6" rx="1" />
              <rect x="9" y="1" width="6" height="6" rx="1" />
              <rect x="1" y="9" width="6" height="6" rx="1" />
              <rect x="9" y="9" width="6" height="6" rx="1" />
            </svg>
            Grid
          </button>
          <button
            className={`${styles.viewBtn} ${view === 'list' ? styles.viewBtnActive : ''}`}
            onClick={() => setView('list')}
            title="List view"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <rect x="1" y="2" width="14" height="2" rx="1" />
              <rect x="1" y="7" width="14" height="2" rx="1" />
              <rect x="1" y="12" width="14" height="2" rx="1" />
            </svg>
            List
          </button>
        </div>
      </div>

      {loading ? (
        <div className={styles.grid}>
          {Array(6).fill(0).map((_, i) => <Skeleton key={i} height="220px" />)}
        </div>
      ) : error ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>⚠</div>
          <div style={{ color: 'var(--color-danger)', fontWeight: 600 }}>{error}</div>
        </div>
      ) : filteredResources.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>👥</div>
          <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>No resources found</div>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
            Try adjusting your search or filters.
          </div>
        </div>
      ) : view === 'grid' ? (
        <div className={styles.grid}>
          {filteredResources.map(u => {
            const committed = u.active_projects?.reduce((sum, p) => sum + (p.hours_allocated || 0), 0) || 0
            const maxCap = u.weekly_capacity || 40
            const utilization = maxCap > 0 ? Math.round((committed / maxCap) * 100) : 0
            const availability = maxCap - committed
            const barColorClass = utilization > 100 ? styles.barRed : utilization >= 50 ? styles.barGreen : styles.barBlue

            return (
              <div key={u.id} className={styles.resourceCard}>
                <div className={styles.cardHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Avatar name={u.name} size="md" />
                    <div>
                      <h3 className={styles.cardTitle}>{u.name}</h3>
                      <p className={styles.cardEmail}>{u.email}</p>
                    </div>
                  </div>
                  <span className={styles.phaseTag}>{u.role_name}</span>
                </div>

                <div className={styles.metricSection}>
                  <div className={styles.metricRow}>
                    <span className={styles.metricLabel}>Weekly Capacity</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="number"
                        min="0"
                        className={styles.inlineCapInput}
                        value={u.weekly_capacity}
                        onChange={e => handleUpdateCapacity(u.id, e.target.value)}
                        title="Edit Weekly Capacity Limit"
                      />
                      <span className={styles.metricUnit}>hrs</span>
                    </div>
                  </div>
                  <div className={styles.metricRow}>
                    <span className={styles.metricLabel}>Committed</span>
                    <span className={styles.metricValue}>{committed} hrs</span>
                  </div>

                  <div className={styles.progressWrapper}>
                    <div className={styles.progressBar}>
                      <div className={`${styles.progressBarFill} ${barColorClass}`} style={{ width: `${Math.min(utilization, 100)}%` }} />
                    </div>
                    <div className={styles.progressLabelRow}>
                      <span>{utilization}% Utilized</span>
                      <span className={styles.loadBadge}>
                        {utilization > 100 ? 'Overloaded' : utilization >= 50 ? 'Optimal' : 'Underutilized'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={styles.projectsSection}>
                  <h4 className={styles.sectionHeading}>
                    Active Projects ({u.active_projects?.length || 0})
                  </h4>
                  {u.active_projects && u.active_projects.length > 0 ? (
                    <div className={styles.projectsList}>
                      {u.active_projects.map(p => {
                        const isPM = u.role_name === 'Project Manager'
                        return (
                          <div key={p.id} className={styles.projectRow}>
                            <div className={styles.projInfo}>
                              <span className={styles.projName}>{p.name}</span>
                              <span className={styles.projType}>{p.project_type || 'Residential'}</span>
                            </div>
                            <div className={styles.projAllocation}>
                              <input
                                type="number"
                                min="0"
                                className={styles.inlineHoursInput}
                                value={p.hours_allocated}
                                onChange={e => handleUpdateProjectHours(u.id, p.id, e.target.value, isPM)}
                              />
                              <span className={styles.hrsLabel}>hrs</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className={styles.noProjects}>Available for assignment</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className={styles.listWrap}>
          <table className={styles.listTable}>
            <thead>
              <tr>
                <th className={styles.listTh}>Resource</th>
                <th className={styles.listTh}>Role</th>
                <th className={styles.listTh}>Capacity</th>
                <th className={styles.listTh}>Committed</th>
                <th className={styles.listTh}>Utilization</th>
                <th className={styles.listTh}>Active Projects</th>
              </tr>
            </thead>
            <tbody>
              {filteredResources.map(u => {
                const committed = u.active_projects?.reduce((sum, p) => sum + (p.hours_allocated || 0), 0) || 0
                const maxCap = u.weekly_capacity || 40
                const utilization = maxCap > 0 ? Math.round((committed / maxCap) * 100) : 0
                const barColorClass = utilization > 100 ? styles.barRed : utilization >= 50 ? styles.barGreen : styles.barBlue

                return (
                  <tr key={u.id} className={styles.listTr}>
                    <td className={styles.listTd}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Avatar name={u.name} size="sm" />
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{u.name}</div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className={styles.listTd}>
                      <span className={styles.phaseTag}>{u.role_name}</span>
                    </td>
                    <td className={styles.listTd}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="number"
                          min="0"
                          className={styles.inlineCapInput}
                          value={u.weekly_capacity}
                          onChange={e => handleUpdateCapacity(u.id, e.target.value)}
                        />
                        <span className={styles.hrsLabel}>hrs</span>
                      </div>
                    </td>
                    <td className={styles.listTd}>
                      <span style={{ fontWeight: 600 }}>{committed}</span> <span className={styles.hrsLabel}>hrs</span>
                    </td>
                    <td className={styles.listTd}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className={styles.miniProgress}>
                          <div className={`${styles.miniProgressFill} ${barColorClass}`} style={{ width: `${Math.min(utilization, 100)}%` }} />
                        </div>
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>{utilization}%</span>
                      </div>
                    </td>
                    <td className={styles.listTd} style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      {u.active_projects?.length || 0}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
