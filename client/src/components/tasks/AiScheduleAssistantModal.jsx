/* eslint-disable no-unused-vars, react-hooks/immutability, react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react'
import { Modal, Button } from '../ui'
import { getGlobalTasks, updateGlobalTask, updateTask } from '../../api/tasks'
import { useToast } from '../../store/toastContext'

const PRIORITY_SCORE = { urgent: 4, high: 3, medium: 2, low: 1, none: 0 }

export default function AiScheduleAssistantModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false)
  const [schedule, setSchedule] = useState(null)
  const [rescheduled, setRescheduled] = useState([])
  const [rawTasks, setRawTasks] = useState([])
  const toast = useToast()

  useEffect(() => {
    if (isOpen) {
      fetchTasks()
    }
  }, [isOpen])

  const fetchTasks = async () => {
    try {
      const res = await getGlobalTasks({ assigneeId: 'me' })
      const allTasks = res.data?.data || res.data || []
      const active = (Array.isArray(allTasks) ? allTasks : []).filter(t => t.status !== 'done')
      setRawTasks(active)
    } catch (e) {
      toast.error('Failed to load tasks for AI')
    }
  }

  const generateSchedule = () => {
    setLoading(true)
    setTimeout(() => {
      // 1. Sort tasks by urgency (Due today + Priority)
      const now = new Date()
      const todayStr = now.toISOString().split('T')[0]
      
      const sorted = [...rawTasks].sort((a, b) => {
        // Priority
        const pA = PRIORITY_SCORE[a.priority] || 0
        const pB = PRIORITY_SCORE[b.priority] || 0
        
        // Due Dates
        const dueA = a.dueDate ? (a.dueDate.startsWith(todayStr) ? 5 : (new Date(a.dueDate) < now ? 6 : 0)) : 0
        const dueB = b.dueDate ? (b.dueDate.startsWith(todayStr) ? 5 : (new Date(b.dueDate) < now ? 6 : 0)) : 0
        
        const scoreA = pA + dueA
        const scoreB = pB + dueB
        
        return scoreB - scoreA
      })

      // 2. Pack into 8-hour workday (09:00 - 17:00 = 480 mins)
      // 12:00 - 13:00 is Lunch Break (60 mins)
      // 15 min break every ~2 hours of work.
      
      let currentTime = new Date()
      currentTime.setHours(9, 0, 0, 0)
      
      const endTime = new Date()
      endTime.setHours(17, 0, 0, 0)

      const lunchStart = new Date(); lunchStart.setHours(12, 0, 0, 0)
      const lunchEnd = new Date(); lunchEnd.setHours(13, 0, 0, 0)
      
      let timeline = []
      let skipped = []
      let workSinceLastBreak = 0

      for (const t of sorted) {
        let estMins = parseInt(t.estimatedTime) || 30
        
        // Check lunch
        if (currentTime >= lunchStart && currentTime < lunchEnd) {
          timeline.push({ type: 'break', title: '🍽️ Lunch Break', start: new Date(lunchStart), end: new Date(lunchEnd) })
          currentTime = new Date(lunchEnd)
          workSinceLastBreak = 0
        }

        // Check short break
        if (workSinceLastBreak >= 120) {
          const breakEnd = new Date(currentTime.getTime() + 15 * 60000)
          timeline.push({ type: 'break', title: '☕ Short Break', start: new Date(currentTime), end: breakEnd })
          currentTime = breakEnd
          workSinceLastBreak = 0
        }

        const taskEnd = new Date(currentTime.getTime() + estMins * 60000)
        
        if (taskEnd > endTime) {
          // Cannot fit today
          skipped.push(t)
        } else {
          timeline.push({ type: 'task', task: t, title: t.title, start: new Date(currentTime), end: taskEnd })
          currentTime = taskEnd
          workSinceLastBreak += estMins
        }
      }

      setSchedule(timeline)
      setRescheduled(skipped)
      setLoading(false)
    }, 1500)
  }

  const formatTime = (d) => {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const acceptSchedule = async () => {
    // Optionally update task metadata or reorder things. For now, just close.
    toast.success('Schedule Accepted! Have a great day.')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🤖 AI Daily Assistant" size="md">
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', minHeight: '400px' }}>
        
        {!schedule && !loading && (
          <div style={{ textAlign: 'center', margin: 'auto', maxWidth: '300px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✨</div>
            <h3 style={{ marginBottom: '8px' }}>Optimize Your Day</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: '24px' }}>
              I will analyze your {rawTasks.length} active tasks, factor in priorities, due dates, and your working hours (9 AM - 5 PM) to generate an optimal timeline.
            </p>
            <Button variant="primary" onClick={generateSchedule}>Generate Schedule</Button>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', margin: 'auto' }}>
            <div style={{ fontSize: '24px', animation: 'spin 1s linear infinite', display: 'inline-block', marginBottom: '16px' }}>⚙️</div>
            <div>Analyzing priorities and packing timeline...</div>
          </div>
        )}

        {schedule && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>📅 Today's Timeline</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
                {schedule.map((slot, idx) => (
                  <div key={idx} style={{ 
                    display: 'flex', gap: '16px', padding: '12px', 
                    background: slot.type === 'break' ? 'rgba(var(--color-success-rgb), 0.1)' : 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    alignItems: 'center'
                  }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', minWidth: '110px', color: 'var(--color-text-muted)' }}>
                      {formatTime(slot.start)} - {formatTime(slot.end)}
                    </div>
                    <div style={{ flex: 1, fontWeight: slot.type === 'task' ? 600 : 400, color: slot.type === 'break' ? 'var(--color-success)' : 'inherit' }}>
                      {slot.title}
                    </div>
                    {slot.type === 'task' && slot.task.priority && (
                      <span style={{ fontSize: '10px', padding: '2px 6px', background: 'var(--color-border)', borderRadius: '10px', textTransform: 'uppercase' }}>
                        {slot.task.priority}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {rescheduled.length > 0 && (
              <div>
                <h3 style={{ fontSize: '16px', marginBottom: '12px', color: 'var(--color-warning)' }}>⚠️ Reschedule Recommendations</h3>
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>These tasks exceeded your 8-hour workday and should be moved to tomorrow:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {rescheduled.map(t => (
                    <div key={t.id} style={{ padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px', background: 'var(--color-surface)' }}>
                      {t.title} <span style={{ color: 'var(--color-text-muted)' }}>({parseInt(t.estimatedTime) || 30}m)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px', borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
              <Button variant="secondary" onClick={() => setSchedule(null)}>Recalculate</Button>
              <Button variant="primary" onClick={acceptSchedule}>Accept Schedule</Button>
            </div>
          </div>
        )}
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </Modal>
  )
}
