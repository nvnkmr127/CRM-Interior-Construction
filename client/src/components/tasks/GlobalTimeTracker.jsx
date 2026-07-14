import React from 'react'
import { useTimeTracker } from '../../store/TimeTrackerContext'
import { Button } from '../ui'

export default function GlobalTimeTracker() {
  const { activeTimer, elapsedSecs, pauseTimer, stopTimer, discardTimer, startTimer } = useTimeTracker()

  if (!activeTimer) return null

  const formatTime = (totalSecs) => {
    const h = Math.floor(totalSecs / 3600)
    const m = Math.floor((totalSecs % 3600) / 60)
    const s = totalSecs % 60
    if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleStop = async () => {
    // For the global tracker, we don't have direct access to the task patcher easily without triggering a refetch.
    // However, if the user stops it from the global tracker, we can either emit an event,
    // or just let the stopTimer return the final secs, and in a real app, `stopTimer` would do the API call.
    // We'll trust the TimeTrackerContext to eventually handle it, or we dispatch a custom event.
    const totalSecs = await stopTimer()
    if (totalSecs > 60) {
      window.dispatchEvent(new CustomEvent('globalTimeLogged', { detail: { taskId: activeTimer.taskId, mins: Math.floor(totalSecs/60) } }))
    }
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-lg)',
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      zIndex: 9999
    }}>
      <div>
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
          Tracking Task
        </div>
        <div style={{ fontWeight: 600, maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {activeTimer.title}
        </div>
      </div>
      <div style={{ fontSize: '1.2rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--color-primary)' }}>
        {formatTime(elapsedSecs)}
      </div>
      <div style={{ display: 'flex', gap: '4px' }}>
        {activeTimer.startTime ? (
          <Button variant="outline" size="sm" onClick={pauseTimer}>⏸️</Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => startTimer(activeTimer.taskId, activeTimer.projectId, activeTimer.title)}>▶️</Button>
        )}
        <Button variant="danger" size="sm" onClick={handleStop}>⏹️</Button>
        <Button variant="ghost" size="sm" onClick={discardTimer}>❌</Button>
      </div>
    </div>
  )
}
