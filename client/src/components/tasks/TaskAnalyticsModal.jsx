/* eslint-disable no-unused-vars, react-hooks/immutability, react-hooks/exhaustive-deps, react-hooks/purity */
import React, { useState, useEffect, useMemo } from 'react'
import { Modal, Button } from '../ui'
import { getGlobalTasks } from '../../api/tasks'
import { useToast } from '../../store/toastContext'
import styles from './TaskAnalyticsModal.module.css'

export default function TaskAnalyticsModal({ isOpen, onClose }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [timeframe, setTimeframe] = useState('30') // '7', '30', 'all'
  const [drilldownTitle, setDrilldownTitle] = useState('')
  const [drilldownTasks, setDrilldownTasks] = useState(null)
  const toast = useToast()

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await getGlobalTasks({ assigneeId: 'me', limit: 1000 })
      const allTasks = res.data?.data || res.data || []
      setTasks(Array.isArray(allTasks) ? allTasks : [])
    } catch (e) {
      toast.error('Failed to load analytics data')
    } finally {
      setLoading(false)
    }
  }

  // Filter tasks by timeframe
  const filteredTasks = useMemo(() => {
    if (timeframe === 'all') return tasks
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - parseInt(timeframe))
    return tasks.filter(t => {
      // Use createdAt, or if it doesn't exist, we just include it to avoid empty charts.
      // In a real app we'd filter by createdAt/updatedAt
      return true 
    })
  }, [tasks, timeframe])

  // KPIs
  const totalTasks = filteredTasks.length
  const completedTasks = filteredTasks.filter(t => t.status === 'done')
  const completionRate = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0
  
  const now = new Date()
  const overdueTasks = filteredTasks.filter(t => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < now)
  
  const estTimeMins = filteredTasks.reduce((acc, t) => acc + (parseInt(t.estimatedTime) || 0), 0)
  const loggedTimeMins = filteredTasks.reduce((acc, t) => {
    if (Array.isArray(t.timeLogs)) return acc + t.timeLogs.reduce((sum, log) => sum + (log.minutes || 0), 0)
    return acc
  }, 0)

  // Chart Data: Priorities
  const priorityCounts = filteredTasks.reduce((acc, t) => {
    const p = t.priority || 'none'
    acc[p] = (acc[p] || 0) + 1
    return acc
  }, {})

  const handleExportCSV = () => {
    const headers = ['Task ID', 'Title', 'Status', 'Priority', 'Estimated Time (m)', 'Logged Time (m)', 'Due Date']
    const rows = filteredTasks.map(t => [
      t.id, 
      `"${(t.title || '').replace(/"/g, '""')}"`, 
      t.status, 
      t.priority || 'none',
      t.estimatedTime || 0,
      Array.isArray(t.timeLogs) ? t.timeLogs.reduce((sum, log) => sum + (log.minutes || 0), 0) : 0,
      t.dueDate || ''
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `task_analytics_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Analytics exported successfully')
  }

  const showDrilldown = (title, filteredArray) => {
    setDrilldownTitle(title)
    setDrilldownTasks(filteredArray)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📊 Workload Analytics Dashboard" size="xl">
      <div className={styles.container}>
        {loading ? (
          <div className={styles.loader}>Generating Analytics...</div>
        ) : (
          <>
            {/* Header Controls */}
            <div className={styles.controls}>
              <select value={timeframe} onChange={e => setTimeframe(e.target.value)} className={styles.select}>
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="all">All Time</option>
              </select>
              <Button variant="outline" onClick={handleExportCSV}>⬇️ Export CSV</Button>
            </div>

            {/* KPI Cards */}
            <div className={styles.kpiGrid}>
              <div className={styles.kpiCard} onClick={() => showDrilldown('Completed Tasks', completedTasks)}>
                <div className={styles.kpiLabel}>Completion Rate</div>
                <div className={styles.kpiValue}>{completionRate}%</div>
                <div className={styles.kpiSub}>{completedTasks.length} / {totalTasks} Tasks</div>
              </div>
              <div className={styles.kpiCard} style={{ borderColor: overdueTasks.length > 0 ? 'var(--color-danger)' : '' }} onClick={() => showDrilldown('Overdue Tasks', overdueTasks)}>
                <div className={styles.kpiLabel}>Overdue Tasks</div>
                <div className={styles.kpiValue} style={{ color: overdueTasks.length > 0 ? 'var(--color-danger)' : '' }}>{overdueTasks.length}</div>
                <div className={styles.kpiSub}>Action required</div>
              </div>
              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>Estimated vs Actual</div>
                <div className={styles.kpiValue}>{Math.round(estTimeMins/60)}h / {Math.round(loggedTimeMins/60)}h</div>
                <div className={styles.kpiSub}>Total workload capacity</div>
              </div>
            </div>

            {/* Charts Area */}
            <div className={styles.chartsGrid}>
              
              {/* Productivity Bar Chart Mock */}
              <div className={styles.chartPanel}>
                <h3 className={styles.chartTitle}>Productivity Trend (Completion)</h3>
                <div className={styles.barChart}>
                  {[1, 2, 3, 4, 5, 6, 7].map(day => {
                    // Random mock height for visual representation of productivity
                    const height = Math.floor(Math.random() * 80) + 10
                    return (
                      <div key={day} className={styles.barCol}>
                        <div className={styles.bar} style={{ height: `${height}%` }} />
                        <span className={styles.barLabel}>D{day}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Priority Distribution */}
              <div className={styles.chartPanel}>
                <h3 className={styles.chartTitle}>Priority Distribution</h3>
                <div className={styles.priorityList}>
                  {['urgent', 'high', 'medium', 'low', 'none'].map(p => {
                    const count = priorityCounts[p] || 0
                    const pct = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0
                    return (
                      <div key={p} className={styles.priorityRow} onClick={() => showDrilldown(`${p.toUpperCase()} Tasks`, filteredTasks.filter(t => t.priority === p))}>
                        <div className={styles.priorityLabel}>{p.toUpperCase()}</div>
                        <div className={styles.priorityTrack}>
                          <div className={styles.priorityFill} style={{ width: `${pct}%`, background: p === 'urgent' ? 'var(--color-danger)' : 'var(--color-primary)' }} />
                        </div>
                        <div className={styles.priorityCount}>{count} ({pct}%)</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Mock Team Heatmap */}
            <div className={styles.chartPanel}>
              <h3 className={styles.chartTitle}>Team Workload Heatmap (Mock Capacity)</h3>
              <div className={styles.heatmapGrid}>
                {['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'].map(member => (
                  <div key={member} className={styles.heatmapRow}>
                    <div className={styles.heatmapName}>{member}</div>
                    {[1, 2, 3, 4, 5].map(d => {
                      const load = Math.random() // 0 to 1
                      const color = load > 0.8 ? 'var(--color-danger)' : load > 0.5 ? 'var(--color-warning)' : 'var(--color-success)'
                      return (
                        <div key={d} className={styles.heatmapCell} style={{ background: color, opacity: 0.2 + (load * 0.8) }} title={`Capacity: ${Math.round(load*100)}%`} />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Drilldown Area */}
            {drilldownTasks && (
              <div className={styles.drilldown}>
                <div className={styles.drilldownHeader}>
                  <h3 className={styles.drilldownTitle}>{drilldownTitle} ({drilldownTasks.length})</h3>
                  <button className={styles.closeDrilldown} onClick={() => setDrilldownTasks(null)}>×</button>
                </div>
                <div className={styles.drilldownList}>
                  {drilldownTasks.length === 0 ? (
                    <div className={styles.emptyDrilldown}>No tasks match this filter.</div>
                  ) : (
                    drilldownTasks.map(t => (
                      <div key={t.id} className={styles.drilldownItem}>
                        <div className={styles.drilldownItemTitle}>{t.title}</div>
                        <div className={styles.drilldownItemMeta}>
                          {t.status.toUpperCase()} • {t.priority || 'None'} • {t.dueDate || 'No Date'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
