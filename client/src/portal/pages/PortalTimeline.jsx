import { useState, useEffect, useMemo } from 'react'
import styles from './PortalTimeline.module.css'
import api from '../../api/axios'

export default function PortalTimeline() {
  const [project, setProject] = useState(null)
  const [phases, setPhases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([
      api.get('/portal/project'),
      api.get('/portal/project/phases')
    ])
    .then(([projRes, phasesRes]) => {
      if (projRes.data?.success) {
        setProject(projRes.data.data)
      }
      if (phasesRes.data?.success) {
        setPhases(phasesRes.data.data || [])
      }
    })
    .catch(err => {
      console.error('Error fetching timeline details:', err)
      setError('Failed to load project timeline. Please try again later.')
    })
    .finally(() => {
      setLoading(false)
    })
  }, [])

  // Calculate overall milestone completion statistics
  const { totalMilestones, completedMilestones, progressPct } = useMemo(() => {
    const milestones = phases.flatMap(p => p.milestones || [])
    const total = milestones.length
    const completed = milestones.filter(m => m.status === 'completed').length
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0
    return {
      totalMilestones: total,
      completedMilestones: completed,
      progressPct: pct
    }
  }, [phases])

  const getStatusClass = (status) => {
    if (status === 'completed') return styles.completed
    if (status === 'in_progress') return styles.in_progress
    return styles.pending
  }

  const getStatusLabel = (status) => {
    if (status === 'completed') return 'Completed'
    if (status === 'in_progress') return 'In Progress'
    return 'Upcoming'
  }

  // Helper to calculate individual phase completion %
  const getPhaseProgress = (phase) => {
    const ms = phase.milestones || []
    if (ms.length > 0) {
      const completed = ms.filter(m => m.status === 'completed').length
      return Math.round((completed / ms.length) * 100)
    }
    if (phase.status === 'completed') return 100
    if (phase.status === 'in_progress') return 50
    return 0
  }

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading timeline details...</div>
  }

  if (error) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-danger)' }}>{error}</div>
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Project Timeline</h1>
        <div className={styles.pageSub}>Track construction phases, upcoming milestones, and overall progress.</div>
      </div>

      <div className={styles.progressCard}>
        <div className={styles.progressHeader}>
          <h2 className={styles.progressTitle}>Overall Milestone Progress</h2>
          <span className={styles.progressValue}>{progressPct}%</span>
        </div>
        
        <div className={styles.progressBar}>
          <div 
            className={styles.progressBarFill} 
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className={styles.statsRow}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Milestones</span>
            <span className={styles.statValue}>
              {completedMilestones} of {totalMilestones} Completed
            </span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Design Scope</span>
            <span className={styles.statValue}>
              {project?.is_scope_locked ? '🔒 Frozen / Locked' : '🎨 Revisions Open'}
            </span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Task Completion</span>
            <span className={styles.statValue}>
              {project?.task_completion_pct || 0}% Complete
            </span>
          </div>
        </div>
      </div>

      {phases.length === 0 ? (
        <div className={styles.card} style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          No phases or milestones defined for this project yet.
        </div>
      ) : (
        <div className={styles.timeline}>
          {phases.map((phase) => {
            const phasePct = getPhaseProgress(phase)
            const phaseStatusClass = getStatusClass(phase.status)
            
            return (
              <div key={phase.id} className={`${styles.phaseNode} ${phaseStatusClass}`}>
                <div className={styles.phaseMarker} />
                
                <div className={styles.phaseCard}>
                  <div className={styles.phaseHeader}>
                    <div className={styles.phaseTitleInfo}>
                      <h3 className={styles.phaseName}>{phase.name}</h3>
                      <span className={styles.phaseCompletion}>
                        {phasePct}% Completed
                      </span>
                    </div>
                    <span className={`${styles.statusBadge} ${phaseStatusClass}`}>
                      {getStatusLabel(phase.status)}
                    </span>
                  </div>

                  <div className={styles.phaseProgressBar}>
                    <div 
                      className={styles.phaseProgressBarFill}
                      style={{ width: `${phasePct}%` }}
                    />
                  </div>

                  {phase.milestones && phase.milestones.length > 0 && (
                    <div className={styles.milestonesContainer}>
                      <h4 className={styles.milestonesTitle}>Milestones</h4>
                      <div className={styles.milestonesList}>
                        {phase.milestones.map((m) => {
                          const milestoneStatusClass = getStatusClass(m.status)
                          const formattedDate = m.due_date
                            ? new Date(m.due_date).toLocaleDateString('en-IN', { 
                                day: 'numeric', 
                                month: 'short', 
                                year: 'numeric' 
                              })
                            : 'TBD'
                            
                          return (
                            <div key={m.id} className={`${styles.milestoneItem} ${milestoneStatusClass}`}>
                              <div className={styles.milestoneIndicator}>
                                <div className={styles.milestoneDot} />
                              </div>
                              <div className={styles.milestoneContent}>
                                <div className={styles.milestoneHeader}>
                                  <span className={styles.milestoneName}>{m.name}</span>
                                  <span className={styles.milestoneDate}>
                                    {m.status === 'completed' ? 'Done' : `Due ${formattedDate}`}
                                  </span>
                                </div>
                                {m.description && (
                                  <span className={styles.milestoneDesc}>{m.description}</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
