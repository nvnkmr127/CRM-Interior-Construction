/* eslint-disable no-unused-vars */
import { useState } from 'react'
import { Badge, Button, Modal } from '../ui'
import { useTimeTracker } from '../../store/TimeTrackerContext'
import { useToast } from '../../store/toastContext'
import styles from './TimeTracker.module.css'

export default function TimeTracker({ task, onTimeLogged }) {
  const { activeTimer, elapsedSecs, startTimer, pauseTimer, stopTimer, discardTimer } = useTimeTracker()
  const [showManualModal, setShowManualModal] = useState(false)
  const [manualMin, setManualMin] = useState('')
  const [isBillable, setIsBillable] = useState(true)
  const toast = useToast()

  const isTrackingThis = activeTimer?.taskId === task.id
  
  const estimatedMin = task.estimatedTime || 0
  const actualMin = task.actualTime || 0
  
  // Format MM:SS or HH:MM:SS
  const formatTime = (totalSecs) => {
    const h = Math.floor(totalSecs / 3600)
    const m = Math.floor((totalSecs % 3600) / 60)
    const s = totalSecs % 60
    if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleStart = () => {
    startTimer(task.id, task.project?.id || null, task.title)
  }

  const handleStop = async () => {
    const totalSecs = await stopTimer()
    const addedMin = Math.floor(totalSecs / 60)
    if (addedMin > 0) {
      onTimeLogged(addedMin, true, false) // minutes, isBillable, isManual
      toast.success(`Logged ${addedMin}m to task`)
    } else {
      toast.info('Timer stopped (less than 1m elapsed)')
    }
  }

  const handleManualSubmit = () => {
    const min = parseInt(manualMin, 10)
    if (isNaN(min) || min <= 0) return toast.error('Enter valid minutes')
    onTimeLogged(min, isBillable, true)
    setShowManualModal(false)
    setManualMin('')
    toast.success(`Logged ${min}m manually`)
  }

  // Calculate progress
  const currentTotalMin = actualMin + (isTrackingThis ? Math.floor(elapsedSecs / 60) : 0)
  const progressPercent = estimatedMin > 0 ? Math.min((currentTotalMin / estimatedMin) * 100, 100) : 0
  const isOver = estimatedMin > 0 && currentTotalMin > estimatedMin

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          ⏱️ Time Tracking
          {isTrackingThis && <div className={styles.pulseDot} />}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowManualModal(true)}>+ Manual</Button>
      </div>

      <div className={styles.timerDisplay}>
        <div className={styles.timeVal}>
          {isTrackingThis ? formatTime(elapsedSecs) : '00:00'}
        </div>
        <div className={styles.controls}>
          {isTrackingThis ? (
            <>
              {activeTimer.startTime ? (
                <Button variant="outline" size="sm" onClick={pauseTimer}>⏸️ Pause</Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => startTimer(task.id, task.project?.id, task.title)}>▶️ Resume</Button>
              )}
              <Button variant="danger" size="sm" onClick={handleStop}>⏹️ Stop</Button>
              <Button variant="ghost" size="sm" onClick={discardTimer} title="Discard">❌</Button>
            </>
          ) : (
            <Button variant="primary" size="sm" onClick={handleStart} style={{ width: '100%' }}>▶️ Start Timer</Button>
          )}
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.statBox}>
          <div className={styles.statLabel}>Logged</div>
          <div className={styles.statVal}>{Math.floor(currentTotalMin / 60)}h {currentTotalMin % 60}m</div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statLabel}>Estimated</div>
          <div className={styles.statVal}>{estimatedMin > 0 ? `${Math.floor(estimatedMin / 60)}h ${estimatedMin % 60}m` : '--'}</div>
        </div>
      </div>

      {estimatedMin > 0 && (
        <div className={styles.progressWrap}>
          <div className={styles.progressBg}>
            <div 
              className={styles.progressFill} 
              style={{ 
                width: `${progressPercent}%`, 
                background: isOver ? 'var(--color-danger)' : 'var(--color-primary)' 
              }} 
            />
          </div>
          {isOver && <div style={{ fontSize: '10px', color: 'var(--color-danger)', marginTop: '4px' }}>Over estimate by {currentTotalMin - estimatedMin}m</div>}
        </div>
      )}

      {showManualModal && (
        <Modal isOpen={showManualModal} onClose={() => setShowManualModal(false)} title="Log Time Manually">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '8px' }}>Duration (Minutes)</label>
              <input 
                type="number" 
                value={manualMin} 
                onChange={e => setManualMin(e.target.value)} 
                placeholder="e.g. 120"
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
                autoFocus
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
              <input type="checkbox" checked={isBillable} onChange={e => setIsBillable(e.target.checked)} />
              Billable Time
            </label>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <Button variant="secondary" onClick={() => setShowManualModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleManualSubmit}>Log Time</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
