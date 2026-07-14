import React, { useState, useEffect } from 'react'
import { Modal, Button } from '../ui'
import { getGlobalTasks, updateGlobalTask, updateTask } from '../../api/tasks'
import { useToast } from '../../store/toastContext'

export default function AiRiskAnalysisModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false)
  const [risks, setRisks] = useState(null)
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
      toast.error('Failed to load tasks for AI Risk Analysis')
    }
  }

  const runAnalysis = () => {
    setLoading(true)
    setTimeout(() => {
      const now = new Date()
      const todayStr = now.toISOString().split('T')[0]
      const tomorrow = new Date(now.getTime() + 86400000)
      const tomorrowStr = tomorrow.toISOString().split('T')[0]

      const generatedRisks = []
      let todayEstTotal = 0
      
      const projectCounts = {}
      const projectOverdue = {}
      
      // Pass 1: Gather stats
      for (const t of rawTasks) {
        const est = parseInt(t.estimatedTime) || 30
        const isToday = t.dueDate && t.dueDate.startsWith(todayStr)
        const isOverdue = t.dueDate && new Date(t.dueDate) < now && !isToday

        if (isToday || isOverdue) {
          todayEstTotal += est
        }

        if (t.project?.id) {
          projectCounts[t.project.id] = (projectCounts[t.project.id] || 0) + 1
          if (isOverdue || t.status === 'blocked') {
            projectOverdue[t.project.id] = (projectOverdue[t.project.id] || 0) + 1
          }
        }
      }

      // 1. Workload Imbalance
      if (todayEstTotal > 480) { // > 8 hours
        generatedRisks.push({
          id: 'workload_imbalance',
          type: 'Workload Imbalance',
          confidence: 95,
          description: `You have ${Math.round(todayEstTotal / 60)} hours of estimated work due today. Standard capacity is 8 hours.`,
          action: 'Defer low-priority tasks to tomorrow',
          tasksToAction: rawTasks.filter(t => t.dueDate && (t.dueDate.startsWith(todayStr) || new Date(t.dueDate) < now)).filter(t => t.priority === 'low' || !t.priority)
        })
      } else if (todayEstTotal > 400) {
        generatedRisks.push({
          id: 'workload_imbalance',
          type: 'Workload Imbalance',
          confidence: 70,
          description: `You have ${Math.round(todayEstTotal / 60)} hours of estimated work due today. Your schedule is highly saturated.`,
          action: 'Monitor progress closely; do not take on new tasks today',
          tasksToAction: []
        })
      }

      // 2. High-Risk Projects
      for (const pId in projectCounts) {
        const total = projectCounts[pId]
        const problematic = projectOverdue[pId] || 0
        if (total >= 3 && (problematic / total) > 0.4) {
          generatedRisks.push({
            id: `risk_proj_${pId}`,
            type: 'High-Risk Project',
            confidence: Math.round((problematic / total) * 100),
            description: `Project has a high concentration of overdue or blocked tasks (${problematic}/${total}).`,
            action: 'Review project timeline with team',
            tasksToAction: []
          })
        }
      }

      // 3. Likely Overdue Tasks & Missing Dependencies
      for (const t of rawTasks) {
        const est = parseInt(t.estimatedTime) || 0
        const isTomorrow = t.dueDate && t.dueDate.startsWith(tomorrowStr)
        const logged = Array.isArray(t.timeLogs) ? t.timeLogs.reduce((acc, log) => acc + (log.minutes || 0), 0) : 0
        const totalChecklist = Array.isArray(t.checklist) ? t.checklist.length : 0
        const doneChecklist = Array.isArray(t.checklist) ? t.checklist.filter(c => c.done).length : 0

        // Likely Overdue
        if (isTomorrow && est >= 120 && logged === 0 && doneChecklist === 0) {
          generatedRisks.push({
            id: `overdue_${t.id}`,
            type: 'Likely Overdue',
            confidence: 85,
            description: `Task "${t.title}" is due tomorrow, requires ${est} mins, but has 0 progress.`,
            action: 'Start immediately or request extension',
            tasksToAction: [t]
          })
        }

        // Missing Dependencies (Stuck in Blocked/Waiting)
        if (t.status === 'blocked' || t.status === 'waiting') {
          // If we had a lastUpdated field, we could check duration.
          // For now, if it's blocked and due soon, it's a high risk.
          const isTodayOrOverdue = t.dueDate && new Date(t.dueDate) < tomorrow
          if (isTodayOrOverdue) {
            generatedRisks.push({
              id: `dep_${t.id}`,
              type: 'Missing Dependencies',
              confidence: 90,
              description: `Task "${t.title}" is ${t.status} and due critically soon.`,
              action: 'Ping assignee / Unblock immediately',
              tasksToAction: [t]
            })
          }
        }
      }

      setRisks(generatedRisks)
      setLoading(false)
    }, 1500)
  }

  const applyAction = async (risk) => {
    // E.g., deferring tasks
    if (risk.id === 'workload_imbalance' && risk.tasksToAction.length > 0) {
      const now = new Date()
      const tomorrow = new Date(now.getTime() + 86400000)
      const tomorrowStr = tomorrow.toISOString().split('T')[0]
      for (const t of risk.tasksToAction) {
        if (t.project?.id) {
          await updateTask(t.project.id, t.id, { dueDate: tomorrowStr })
        } else {
          await updateGlobalTask(t.id, { dueDate: tomorrowStr })
        }
      }
      toast.success(`Deferred ${risk.tasksToAction.length} low-priority tasks to tomorrow.`)
      // Refresh UI by closing the modal and firing custom event
      window.dispatchEvent(new CustomEvent('automationExecuted'))
      onClose()
    } else {
      toast.info('Action recommended. Please follow up manually.')
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="⚠️ AI Risk Analysis" size="lg">
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', minHeight: '400px' }}>
        
        {!risks && !loading && (
          <div style={{ textAlign: 'center', margin: 'auto', maxWidth: '350px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>👁️‍🗨️</div>
            <h3 style={{ marginBottom: '8px' }}>Predict & Prevent Bottlenecks</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: '24px' }}>
              I will analyze your {rawTasks.length} active tasks to identify workload imbalances, likely overdue items, and blocked dependencies before they derail your schedule.
            </p>
            <Button variant="danger" onClick={runAnalysis}>Scan for Risks</Button>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', margin: 'auto' }}>
            <div style={{ fontSize: '24px', animation: 'pulse 1s ease-in-out infinite', display: 'inline-block', marginBottom: '16px' }}>⚠️</div>
            <div>Scanning heuristics across {rawTasks.length} tasks...</div>
          </div>
        )}

        {risks && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', margin: 0 }}>Detected Risks ({risks.length})</h3>
              <Button variant="outline" size="sm" onClick={runAnalysis}>Rescan</Button>
            </div>
            
            {risks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-success)', background: 'rgba(var(--color-success-rgb), 0.05)', borderRadius: '8px', border: '1px solid rgba(var(--color-success-rgb), 0.2)' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>✅</div>
                <div style={{ fontWeight: 600 }}>Your schedule looks solid!</div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>No major workload imbalances or high-risk tasks detected.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {risks.map((risk, idx) => (
                  <div key={idx} style={{ 
                    padding: '16px', 
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-danger)',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-danger)' }}>
                        {risk.type}
                      </div>
                      <div style={{ fontSize: '12px', background: 'rgba(var(--color-danger-rgb), 0.1)', color: 'var(--color-danger)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                        {risk.confidence}% Confidence
                      </div>
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--color-text)' }}>
                      {risk.description}
                    </div>
                    <div style={{ background: 'var(--color-background)', padding: '12px', borderRadius: '6px', border: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: '4px' }}>Suggested Action</div>
                        <div style={{ fontSize: '13px', fontWeight: 500 }}>{risk.action}</div>
                      </div>
                      {risk.tasksToAction && risk.tasksToAction.length > 0 && (
                        <Button variant="outline" size="sm" onClick={() => applyAction(risk)}>
                          1-Click Execute
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
      `}} />
    </Modal>
  )
}
