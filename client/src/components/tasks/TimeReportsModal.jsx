/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect */
import { useState, useEffect, useMemo } from 'react'
import { Modal, Badge } from '../ui'
import { getGlobalTasks } from '../../api/tasks'
import { useToast } from '../../store/toastContext'

export default function TimeReportsModal({ isOpen, onClose }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  useEffect(() => {
    if (isOpen) {
      setLoading(true)
      getGlobalTasks({ assigneeId: 'me', limit: 100 })
        .then(res => {
          const raw = res.data?.data || res.data || []
          setTasks(Array.isArray(raw) ? raw : [])
        })
        .catch(() => toast.error('Failed to load tasks for report'))
        .finally(() => setLoading(false))
    }
  }, [isOpen, toast])

  const stats = useMemo(() => {
    let totalEstimated = 0
    let totalLogged = 0
    let billableLogged = 0

    tasks.forEach(t => {
      totalEstimated += t.estimatedTime || 0
      totalLogged += t.actualTime || 0
      
      // Calculate billable time if we have timeLogs array, otherwise fallback
      if (t.timeLogs && Array.isArray(t.timeLogs)) {
        t.timeLogs.forEach(log => {
          if (log.isBillable) billableLogged += log.durationMinutes || 0
        })
      } else if (t.billableHours) {
        billableLogged += t.billableHours * 60
      }
    })

    const productivityScore = totalEstimated > 0 
      ? Math.round(Math.min((totalEstimated / totalLogged) * 100, 100)) || 0
      : 0

    return { totalEstimated, totalLogged, billableLogged, productivityScore }
  }, [tasks])

  const formatMin = (mins) => {
    if (!mins) return '0h 0m'
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${h}h ${m}m`
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Time Tracking Reports" size="lg">
      <div style={{ padding: '24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center' }}>Loading reports...</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 600 }}>Total Logged</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text)' }}>{formatMin(stats.totalLogged)}</div>
              </div>
              
              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 600 }}>Billable Hours</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-primary)' }}>{formatMin(stats.billableLogged)}</div>
              </div>

              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 600 }}>Total Estimated</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text)' }}>{formatMin(stats.totalEstimated)}</div>
              </div>

              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 600 }}>Productivity Score</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: stats.productivityScore > 80 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                  {stats.productivityScore}%
                </div>
              </div>
            </div>

            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>Task Breakdown</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
              {tasks.filter(t => t.actualTime > 0 || t.estimatedTime > 0).map(t => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: '16px' }}>
                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{t.project?.name || 'General'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '24px', textAlign: 'right' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Logged</div>
                      <div style={{ fontWeight: 600 }}>{formatMin(t.actualTime)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Estimate</div>
                      <div style={{ fontWeight: 600 }}>{formatMin(t.estimatedTime)}</div>
                    </div>
                  </div>
                </div>
              ))}
              {tasks.filter(t => t.actualTime > 0 || t.estimatedTime > 0).length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>No time tracked yet.</div>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
