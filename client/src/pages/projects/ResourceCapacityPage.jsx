import { useState, useEffect } from 'react'
import { usePageTitle } from '../../hooks/usePageTitle'
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs'
import { useToast } from '../../store/toastContext'
import { Card, Input, Select, Badge, Avatar, Button, Spinner } from '../../components/ui'
import api from '../../api/axios'
import styles from './ResourceCapacityPage.module.css'

export default function ResourceCapacityPage() {
  usePageTitle('Resource Capacity')
  useBreadcrumbs([{ label: 'Projects', to: '/projects' }, { label: 'Resource Capacity' }])
  const toast = useToast()

  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Search & Filter state
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

  // Handle User Capacity Update (PATCH /users/:id)
  const handleUpdateCapacity = async (userId, newCapacity) => {
    const parsedCapacity = parseInt(newCapacity, 10)
    if (isNaN(parsedCapacity) || parsedCapacity < 0) {
      return toast.error('Capacity must be a positive integer.')
    }

    try {
      // Optimistic state update
      setResources(prev => prev.map(u => 
        u.id === userId ? { ...u, weekly_capacity: parsedCapacity } : u
      ))

      await api.patch(`/users/${userId}`, { weekly_capacity: parsedCapacity })
      toast.success('Capacity updated successfully!')
    } catch (err) {
      console.error(err)
      toast.error('Failed to update capacity. Check your permissions.')
      // Revert if failed
      fetchCapacityData()
    }
  }

  // Handle Project Allocated Hours Update (PATCH /projects/:id)
  const handleUpdateProjectHours = async (userId, projectId, newHours, isPM) => {
    const parsedHours = parseInt(newHours, 10)
    if (isNaN(parsedHours) || parsedHours < 0) {
      return toast.error('Hours must be a positive integer.')
    }

    try {
      // Optimistic state update
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
      toast.success('Project workload hours updated successfully!')
    } catch (err) {
      console.error(err)
      toast.error('Failed to update project workload. Check your permissions.')
      // Revert if failed
      fetchCapacityData()
    }
  }

  // Calculate metrics
  const activePMsAndDesigners = resources.filter(u => 
    u.role_name === 'Project Manager' || u.role_name === 'Designer'
  )
  const totalResources = activePMsAndDesigners.length
  
  // Collect all unique active projects
  const uniqueActiveProjects = new Set()
  resources.forEach(u => {
    u.active_projects?.forEach(p => uniqueActiveProjects.add(p.id))
  })
  const totalActiveProjectsCount = uniqueActiveProjects.size

  // Total hours committed vs capacity
  let totalCommittedHours = 0
  let totalCapacity = 0
  let overloadedCount = 0

  activePMsAndDesigners.forEach(u => {
    const committed = u.active_projects?.reduce((sum, p) => sum + (p.hours_allocated || 0), 0) || 0
    const capacity = u.weekly_capacity || 40
    totalCommittedHours += committed
    totalCapacity += capacity
    if (committed > capacity) {
      overloadedCount++
    }
  })

  const avgUtilization = totalCapacity > 0 ? Math.round((totalCommittedHours / totalCapacity) * 100) : 0
  const availableCapacity = totalCapacity - totalCommittedHours

  // Filtered resources
  const filteredResources = resources.filter(u => {
    // Search match
    const nameMatch = (u.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    const emailMatch = (u.email || '').toLowerCase().includes(searchQuery.toLowerCase())
    const roleMatch = (u.role_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    const matchesSearch = nameMatch || emailMatch || roleMatch

    // Role filter
    let matchesRole = true
    if (roleFilter === 'pm') {
      matchesRole = u.role_name === 'Project Manager'
    } else if (roleFilter === 'designer') {
      matchesRole = u.role_name === 'Designer'
    } else if (roleFilter === 'other') {
      matchesRole = u.role_name !== 'Project Manager' && u.role_name !== 'Designer'
    }

    // Workload load filter
    let matchesLoad = true
    const committed = u.active_projects?.reduce((sum, p) => sum + (p.hours_allocated || 0), 0) || 0
    const cap = u.weekly_capacity || 40
    const util = cap > 0 ? (committed / cap) * 100 : 0

    if (loadFilter === 'underloaded') {
      matchesLoad = util < 50
    } else if (loadFilter === 'optimal') {
      matchesLoad = util >= 50 && util <= 100
    } else if (loadFilter === 'overloaded') {
      matchesLoad = util > 100
    }

    return matchesSearch && matchesRole && matchesLoad
  })

  if (loading && resources.length === 0) {
    return (
      <div className={styles.loadingContainer}>
        <Spinner size="lg" />
        <p>Loading capacity utilization details...</p>
      </div>
    )
  }

  if (error && resources.length === 0) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorCard}>
          <h3>⚠️ Error loading resource workload</h3>
          <p>{error}</p>
          <Button onClick={fetchCapacityData}>Retry</Button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* HEADER SECTION */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Resource Capacity & Workloads</h1>
          <p className={styles.subtitle}>Track team workloads, committed hours, and availability across active projects.</p>
        </div>
        <Button onClick={fetchCapacityData} variant="ghost" className={styles.refreshBtn}>
          🔄 Refresh Data
        </Button>
      </div>

      {/* OVERVIEW KPI PANEL */}
      <div className={styles.kpiPanel}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Active Projects</span>
            <span className={styles.kpiIcon}>◈</span>
          </div>
          <div className={styles.kpiValue}>{totalActiveProjectsCount}</div>
          <div className={styles.kpiSub}>Under ongoing execution</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Total Resources</span>
            <span className={styles.kpiIcon}>👥</span>
          </div>
          <div className={styles.kpiValue}>{totalResources}</div>
          <div className={styles.kpiSub}>Project Managers & Designers</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Avg. Utilization</span>
            <span className={styles.kpiIcon}>📈</span>
          </div>
          <div className={`${styles.kpiValue} ${avgUtilization > 100 ? styles.textDanger : ''}`}>
            {avgUtilization}%
          </div>
          <div className={styles.kpiSub}>
            {totalCommittedHours} / {totalCapacity} total weekly hours
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Overloaded Staff</span>
            <span className={styles.kpiIcon}>⚠️</span>
          </div>
          <div className={`${styles.kpiValue} ${overloadedCount > 0 ? styles.textWarning : ''}`}>
            {overloadedCount}
          </div>
          <div className={styles.kpiSub}>Exceeding weekly capacity limits</div>
        </div>
      </div>

      {/* FILTER PANEL */}
      <div className={styles.filterBar}>
        <div className={styles.searchWrapper}>
          <Input
            placeholder="Search by name, email, or role..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        <div className={styles.selectsWrapper}>
          <Select
            options={[
              { value: 'all', label: 'All Roles' },
              { value: 'pm', label: 'Project Managers Only' },
              { value: 'designer', label: 'Designers Only' },
              { value: 'other', label: 'Other Staff' }
            ]}
            value={roleFilter}
            onChange={setRoleFilter}
            className={styles.filterSelect}
          />
          <Select
            options={[
              { value: 'all', label: 'All Workloads' },
              { value: 'underloaded', label: 'Underutilized (<50%)' },
              { value: 'optimal', label: 'Optimal (50%-100%)' },
              { value: 'overloaded', label: 'Overloaded (>100%)' }
            ]}
            value={loadFilter}
            onChange={setLoadFilter}
            className={styles.filterSelect}
          />
        </div>
      </div>

      {/* RESOURCES GRID */}
      {filteredResources.length === 0 ? (
        <div className={styles.emptyState}>
          <div style={{ fontSize: '48px' }}>👥</div>
          <h3>No team members found</h3>
          <p>Try resetting filters or adjusting search queries.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredResources.map(u => {
            const committed = u.active_projects?.reduce((sum, p) => sum + (p.hours_allocated || 0), 0) || 0
            const maxCap = u.weekly_capacity || 40
            const utilization = maxCap > 0 ? Math.round((committed / maxCap) * 100) : 0
            const availability = maxCap - committed

            let statusVariant = 'info'
            let barColorClass = styles.barBlue
            if (utilization > 100) {
              statusVariant = 'danger'
              barColorClass = styles.barRed
            } else if (utilization >= 50) {
              statusVariant = 'success'
              barColorClass = styles.barGreen
            }

            const roleBadgeColors = {
              'Project Manager': 'info',
              'Designer': 'warning',
              'Sales': 'success'
            }

            return (
              <Card key={u.id} className={styles.resourceCard}>
                {/* User Info Header */}
                <div className={styles.cardHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Avatar name={u.name} size="md" />
                    <div>
                      <h3 className={styles.cardTitle}>{u.name}</h3>
                      <p className={styles.cardEmail}>{u.email}</p>
                    </div>
                  </div>
                  <Badge variant={roleBadgeColors[u.role_name] || 'neutral'}>{u.role_name}</Badge>
                </div>

                {/* Metrics Indicator */}
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
                      <span className={styles.metricUnit}>hrs/wk</span>
                    </div>
                  </div>

                  <div className={styles.metricRow}>
                    <span className={styles.metricLabel}>Hours Committed</span>
                    <span className={styles.metricValue}>{committed} hrs</span>
                  </div>

                  <div className={styles.metricRow}>
                    <span className={styles.metricLabel}>Availability</span>
                    <span className={`${styles.metricValue} ${availability < 0 ? styles.textDanger : styles.textSuccess}`}>
                      {availability >= 0 ? `+${availability} hrs free` : `${availability} hrs over`}
                    </span>
                  </div>

                  {/* Utilization Progress Bar */}
                  <div className={styles.progressWrapper}>
                    <div className={styles.progressBar}>
                      <div 
                        className={`${styles.progressBarFill} ${barColorClass}`} 
                        style={{ width: `${Math.min(utilization, 100)}%` }} 
                      />
                    </div>
                    <div className={styles.progressLabelRow}>
                      <span>{utilization}% Capacity Utilization</span>
                      <span className={styles.loadBadge}>
                        {utilization > 100 ? 'Overloaded' : utilization >= 50 ? 'Optimal' : 'Underutilized'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Assigned Projects List */}
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
                                title="Edit project hours committed for this staff"
                              />
                              <span className={styles.hrsLabel}>hrs/wk</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className={styles.noProjects}>
                      No active projects assigned. Available for assignments.
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
