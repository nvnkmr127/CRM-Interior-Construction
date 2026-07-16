import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import styles from './TaskDetail.module.css'
import { Modal, Button, Badge, Avatar, Select, RichTextEditor } from '../ui'
import TaskComments from './TaskComments'
import TaskAttachments from './TaskAttachments'
import TaskActivityHistory from './TaskActivityHistory'
import TaskRecurrenceModal from './TaskRecurrenceModal'
import EditSeriesModal from './EditSeriesModal'
import TagInput from './TagInput'
import TimeTracker from './TimeTracker'
import TaskReminders from './TaskReminders'
import { useToast } from '../../store/toastContext'
import { useTaskNotifications } from '../../store/TaskNotificationContext'
import { useTaskAutomation } from '../../store/TaskAutomationContext'
import { useGovernance } from '../../store/TaskGovernanceContext'
import { getTask, getGlobalTask, updateTask, addTaskComment, deleteTask, createTask, createGlobalTask } from '../../api/tasks'

const PRIORITIES = ['low', 'medium', 'high', 'urgent']
const PRIORITY_COLORS = { low: 'info', medium: 'warning', high: 'danger', urgent: 'danger' }

export default function TaskDetail({ isOpen, onClose, taskId, projectId, initialTask, inline = false }) {
  const [task, setTask] = useState(null)
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [saveStatus, setSaveStatus] = useState('')
  
  const [isRecurrenceModalOpen, setIsRecurrenceModalOpen] = useState(false)
  const [isEditSeriesModalOpen, setIsEditSeriesModalOpen] = useState(false)
  
  const [newComment, setNewComment] = useState('')
  const [statusError, setStatusError] = useState(null)
  
  const [draggedChecklistItemId, setDraggedChecklistItemId] = useState(null)
  const [dragOverChecklistItemId, setDragOverChecklistItemId] = useState(null)
  const [pendingUpdate, setPendingUpdate] = useState(null)
  
  const checklistSaveTimer = useRef(null)
  const descTimer = useRef(null)
  
  const toast = useToast()
  const { addNotification } = useTaskNotifications()
  const { runAutomations } = useTaskAutomation()
  const { permissions, logAuditActivity } = useGovernance()

  const loadTask = () => {
    if (!isOpen || !taskId) return;
    setLoading(true)

    // Bypass fetch for mock tasks
    if (String(taskId).startsWith('mock-') && initialTask) {
      setTask(initialTask);
      setTitle(initialTask.title || '');
      setDesc(initialTask.description || '');
      setLoading(false);
      return;
    }

    if (!projectId) {
      setLoading(false)
      return;
    }

    const fetchTask = (projectId === 'general-tasks' || projectId === 'lead-tasks') 
      ? getGlobalTask(taskId) 
      : getTask(projectId, taskId);

    fetchTask
      .then(res => {
        const t = res.data?.data || res.data
        if (!t) return
        const normalized = {
          id: t.id,
          title: t.title,
          description: t.description || '',
          status: t.status || 'todo',
          priority: t.priority || 'medium',
          dueDate: t.due_date || t.dueDate || null,
          assignee: t.assignee_id ? { id: t.assignee_id, name: t.assignee_name || 'Unknown' } : null,
          project: { id: t.project_id || projectId, name: t.project_name || '—' },
          milestone: t.milestone_id ? { id: t.milestone_id, name: t.milestone_name || '—' } : null,
          roomName: t.room_name || t.roomName || null,
          is_recurring: t.is_recurring,
          recurrence_rule: t.recurrence_rule,
          tags: t.tags || [],
          customFields: t.customFields || [],
          checklist: (Array.isArray(t.checklist) ? t.checklist : (t.subtasks || [])).map(s => ({
            id: s.id || Date.now().toString() + Math.random(), 
            title: s.title, 
            done: s.done || s.status === 'done'
          })),
          comments: (t.comments || []).map(c => ({
            id: c.id,
            author: { name: c.author_name || c.author?.name || 'Unknown' },
            text: c.content || c.text,
            createdAt: c.created_at || c.createdAt,
          })),
        }
        setTask(normalized)
        setTitle(normalized.title)
        setDesc(normalized.description)
      })
      .catch(() => {
        if (initialTask) {
          setTask(initialTask);
          setTitle(initialTask.title || '');
          setDesc(initialTask.description || '');
        } else {
          toast.error('Failed to load task');
        }
      })
      .finally(() => setLoading(false))
  }

  useEffect(loadTask, [isOpen, taskId, projectId])

  const applyUpdate = async (payload, forceMode = null) => {
    if (task.is_recurring && !forceMode && ['title', 'description', 'priority', 'dueDate', 'recurrence_rule'].some(key => key in payload)) {
      setPendingUpdate(payload)
      setIsEditSeriesModalOpen(true)
      return
    }

    if (payload.status && payload.status !== task.status) {
      addNotification('status_changed', `Status Updated`, `Task "${task.title}" is now ${payload.status}`, task.id)
    }

    const finalPayload = { ...payload }
    if (forceMode) finalPayload.updateMode = forceMode

    try {
      await updateTask(projectId, task.id, finalPayload)
      if (finalPayload.title) setTitle(finalPayload.title)
      if (finalPayload.description) setDesc(finalPayload.description)
      if (forceMode === 'future' || forceMode === 'all') {
        loadTask()
      }
      
      const updatedTask = { ...task, ...finalPayload }
      if (finalPayload.status && finalPayload.status !== task.status) {
        runAutomations('status_changed', updatedTask, task)
        logAuditActivity(task.id, 'STATUS_CHANGE', task.status, finalPayload.status)
      }
      runAutomations('task_updated', updatedTask, task)

    } catch (e) {
      toast.error('Failed to update task')
      throw e
    }
  }

  const handleSave = async (updates) => {
    await applyUpdate(updates)
  }

  const handleTimeLogged = async (mins, isBillable, isManual) => {
    try {
      const logs = Array.isArray(task.timeLogs) ? [...task.timeLogs] : []
      logs.push({
        id: Date.now().toString(),
        date: new Date().toISOString(),
        durationMinutes: mins,
        isManual,
        isBillable
      })
      const newActual = (task.actualTime || 0) + mins
      const newBillable = (task.billableHours || 0) + (isBillable ? (mins / 60) : 0)

      setTask(t => ({ ...t, timeLogs: logs, actualTime: newActual, billableHours: newBillable }))
      await applyUpdate({ timeLogs: logs, actualTime: newActual, billableHours: newBillable })
    } catch (e) {
      toast.error('Failed to save time log')
    }
  }

  const handleSeriesEditSelect = async (mode) => {
    if (pendingUpdate) {
      try {
        await applyUpdate(pendingUpdate, mode)
        toast.success('Series updated successfully')
      } catch (e) {}
    }
    setPendingUpdate(null)
  }

  const handleTitleBlur = () => {
    if (title.trim() && title !== task.title) {
      setTask(t => ({ ...t, title: title.trim() }))
      applyUpdate({ title: title.trim() }).catch(() => setTask(t => ({ ...t, title: task.title })))
    }
  }

  const handleDelete = async () => {
    if (window.confirm('Move task to Trash? (Soft delete)')) {
      try {
        await applyUpdate({ status: 'soft_deleted' })
        logAuditActivity(task.id, 'DELETE', 'active', 'soft_deleted')
        onClose();
        window.dispatchEvent(new CustomEvent('globalTimeLogged'))
      } catch (e) {
        toast.error('Failed to move task to trash');
      }
    }
  };

  const handleArchive = async () => {
    try {
      await applyUpdate({ status: 'archived' })
      logAuditActivity(task.id, 'ARCHIVE', 'active', 'archived')
      onClose();
      window.dispatchEvent(new CustomEvent('globalTimeLogged'))
    } catch (e) {
      toast.error('Failed to archive task');
    }
  };
  
  const handleRestore = async () => {
    try {
      await applyUpdate({ status: 'todo' })
      logAuditActivity(task.id, 'RESTORE', task.status, 'todo')
      toast.success('Task restored!')
    } catch (e) {
      toast.error('Failed to restore task');
    }
  };

  const handleDescChange = (newDesc) => {
    setDesc(newDesc)
    setSaveStatus('Saving...')
    clearTimeout(descTimer.current)
    descTimer.current = setTimeout(async () => {
      setTask(t => ({ ...t, description: newDesc }))
      try {
        await applyUpdate({ description: newDesc })
        setSaveStatus('Saved ✓')
      } catch {
        setSaveStatus('Save failed')
      }
      setTimeout(() => setSaveStatus(''), 2000)
    }, 1200)
  }

  const cyclePriority = async () => {
    if (!permissions.canEdit) return
    const idx = PRIORITIES.indexOf(task.priority)
    const next = PRIORITIES[(idx + 1) % PRIORITIES.length]
    setTask(t => ({ ...t, priority: next }))
    try {
      await applyUpdate({ priority: next })
      logAuditActivity(task.id, 'PRIORITY_CHANGE', task.priority, next)
      toast.success('Priority updated')
    } catch {
      setTask(t => ({ ...t, priority: task.priority }))
    }
  }

  const handleStatusChange = async (newStatus) => {
    if (newStatus === 'done' && task.checklist?.some(s => !s.done)) {
      setStatusError(task.checklist.filter(s => !s.done))
      return
    }
    setStatusError(null)
    setTask(t => ({ ...t, status: newStatus }))
    try {
      await applyUpdate({ status: newStatus }, 'single')
      toast.success('Status updated')
    } catch (err) {
      setTask(t => ({ ...t, status: task.status }))
    }
  }

  const completeChecklist = () => {
    setTask(t => ({
      ...t,
      checklist: t.checklist.map(s => ({ ...s, done: true })),
      status: 'done'
    }))
    setStatusError(null)
    updateTask(projectId, task.id, { 
       status: 'done', 
       checklist: task.checklist.map(s => ({ ...s, done: true })) 
    }).catch(() => {})
    toast.success('Checklist completed and task marked done')
  }

  const saveChecklist = (newChecklist) => {
    clearTimeout(checklistSaveTimer.current)
    checklistSaveTimer.current = setTimeout(() => {
      updateTask(projectId, task.id, { checklist: newChecklist }).catch(() => toast.error('Failed to save checklist'))
    }, 500)
  }

  const handleChecklistToggle = (id) => {
    setTask(t => {
      const next = t.checklist.map(c => c.id === id ? { ...c, done: !c.done } : c)
      saveChecklist(next)
      return { ...t, checklist: next }
    })
  }

  const handleChecklistChange = (id, newTitle) => {
    setTask(t => {
      const next = t.checklist.map(c => c.id === id ? { ...c, title: newTitle } : c)
      saveChecklist(next)
      return { ...t, checklist: next }
    })
  }

  const handleChecklistKeyDown = (e, idx) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const newItem = { id: Date.now().toString() + Math.random(), title: '', done: false }
      setTask(t => {
        const next = [...t.checklist]
        next.splice(idx + 1, 0, newItem)
        saveChecklist(next)
        return { ...t, checklist: next }
      })
    } else if (e.key === 'Backspace' && task.checklist[idx].title === '') {
      e.preventDefault()
      setTask(t => {
        const next = task.checklist.filter((_, i) => i !== idx)
        saveChecklist(next)
        return { ...t, checklist: next }
      })
    }
  }

  const handleChecklistAdd = () => {
    const newItem = { id: Date.now().toString() + Math.random(), title: '', done: false }
    setTask(t => {
      const next = [...(t.checklist || []), newItem]
      saveChecklist(next)
      return { ...t, checklist: next }
    })
  }

  const duplicateChecklistItem = (item, idx) => {
    const newItem = { id: Date.now().toString() + Math.random(), title: item.title, done: false }
    setTask(t => {
      const next = [...t.checklist]
      next.splice(idx + 1, 0, newItem)
      saveChecklist(next)
      return { ...t, checklist: next }
    })
  }

  const convertToChecklistSubtask = async (item, idx) => {
    setTask(t => {
      const next = t.checklist.filter(c => c.id !== item.id)
      saveChecklist(next)
      return { ...t, checklist: next }
    })
    try {
       if (projectId && projectId !== 'lead-tasks' && projectId !== 'general-tasks') {
         await createTask(projectId, { title: item.title, parent_id: task.id })
       } else {
         await createGlobalTask({ title: item.title, parent_id: task.id })
       }
       toast.success('Converted to subtask')
       setTimeout(() => window.location.reload(), 1000)
    } catch(err) {
       toast.error('Failed to convert')
    }
  }

  const handleChecklistDragStart = (e, id) => {
    setDraggedChecklistItemId(id)
    e.dataTransfer.effectAllowed = 'move'
  }
  
  const handleChecklistDragOver = (e, id) => {
    e.preventDefault()
    if (draggedChecklistItemId !== id) setDragOverChecklistItemId(id)
  }
  
  const handleChecklistDrop = (e, id) => {
    e.preventDefault()
    setDragOverChecklistItemId(null)
    if (draggedChecklistItemId && draggedChecklistItemId !== id) {
       setTask(t => {
         const next = [...t.checklist]
         const dragIdx = next.findIndex(c => c.id === draggedChecklistItemId)
         const dropIdx = next.findIndex(c => c.id === id)
         const [draggedItem] = next.splice(dragIdx, 1)
         next.splice(dropIdx, 0, draggedItem)
         saveChecklist(next)
         return { ...t, checklist: next }
       })
    }
    setDraggedChecklistItemId(null)
  }

  const addComment = async () => {
    if (!newComment.trim()) return
    const optimistic = { id: Date.now().toString(), author: { name: 'You' }, text: newComment.trim(), createdAt: new Date().toISOString() }
    
    if (newComment.includes('@')) {
      addNotification('mentioned', 'Mentioned', `You were mentioned in "${task.title}"`, task.id)
    } else {
      addNotification('commented', 'New Comment', `New comment on "${task.title}"`, task.id)
    }

    setTask(t => ({ ...t, comments: [...(t.comments || []), optimistic] }))
    setNewComment('')
    try {
      await addTaskComment(projectId, task.id, newComment.trim())
    } catch {
      setTask(t => ({ ...t, comments: (t.comments || []).filter(c => c.id !== optimistic.id) }))
      toast.error('Failed to post comment')
    }
  }

  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="full" hideHeader={false} title="" inline={inline}>
      {loading || !task ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading task details...</div>
      ) : (
        <>
          <div className={styles.headerRow}>
            <Badge variant={PRIORITY_COLORS[task.priority]} style={{ textTransform: 'capitalize' }}>{task.priority}</Badge>
            <div className={styles.flexGap2}>
              {['soft_deleted', 'archived'].includes(task.status) ? (
                <Button variant="outline" size="sm" onClick={handleRestore}>Restore Task</Button>
              ) : (
                <>
                  {permissions.canDelete && <Button variant="outline" size="sm" className={styles.textMuted} onClick={handleArchive}>Archive</Button>}
                  {permissions.canDelete && <Button variant="outline" size="sm" className={styles.textDanger} onClick={handleDelete}>Delete</Button>}
                  {permissions.canEdit && (
                    <Button variant="primary" size="sm" onClick={() => handleStatusChange('done')} disabled={task.status === 'done'}>
                      {task.status === 'done' ? '✓ Completed' : 'Mark Complete'}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
          <input 
            className={styles.titleInput} 
            value={title} 
            onChange={e => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            disabled={!permissions.canEdit}
            onKeyDown={e => e.key === 'Escape' && setTitle(task.title)}
          />

          <div className={`${styles.grid} ${styles.section}`}>
            {/* Left Col: Details */}
            <div>
              <div className={styles.detailRow}>
                <div className={styles.detailLabel}>Assignee</div>
                <div className={styles.detailValue}>
                  <Avatar name={task.assignee?.name} size="xs" />
                  {task.assignee?.name || 'Unassigned'}
                </div>
              </div>

              <div className={styles.detailRow}>
                <div className={styles.detailLabel}>Due Date</div>
                <div className={`${styles.detailValue} ${new Date(task.dueDate || task.due_date) < new Date() && task.status !== 'done' ? styles.overdue : ''}`}>
                  {(task.dueDate || task.due_date) ? new Date(task.dueDate || task.due_date).toLocaleDateString() : 'Set date'}
                </div>
              </div>

              <div className={styles.detailRow}>
                <div className={styles.detailLabel}>Recurring</div>
                <div className={styles.detailValue} style={{ cursor: 'pointer', color: 'var(--color-primary)' }} onClick={() => setIsRecurrenceModalOpen(true)}>
                  {task.is_recurring ? `🔄 ${task.recurrence_rule?.frequency} (Series)` : 'None'}
                </div>
              </div>

              <div className={styles.detailRow}>
                <div className={styles.detailLabel}>Priority</div>
                <div className={styles.detailValue} onClick={cyclePriority}>
                  <Badge variant={PRIORITY_COLORS[task.priority]} style={{ textTransform: 'capitalize' }}>{task.priority}</Badge>
                </div>
              </div>

              <div className={styles.detailRow}>
                <div className={styles.detailLabel}>Project</div>
                <div className={styles.detailValue}>
                  <Link to={`/projects/${task.project.id}`} className={styles.link}>{task.project.name}</Link>
                </div>
              </div>

              <div className={styles.detailRow}>
                <div className={styles.detailLabel}>Room / Area</div>
                <div className={styles.detailValue}>
                  {task.roomName || 'General (No room tag)'}
                </div>
              </div>

              {/* Custom Fields */}
              <div className={styles.detailRow}>
                <div className={styles.detailLabel} style={{ alignSelf: 'flex-start', marginTop: '4px' }}>Custom Fields</div>
                <div style={{ flex: 1 }}>
                  {task.customFields?.map((cf, idx) => (
                    <div key={idx} className={styles.flexGap2} style={{ marginBottom: '8px' }}>
                      <input 
                        value={cf.key} 
                        placeholder="Key (e.g. Client ID)" 
                        onChange={e => {
                          if (!permissions.canEdit) return
                          const next = [...task.customFields]; next[idx].key = e.target.value; setTask(t => ({...t, customFields: next}))
                        }}
                        onBlur={() => applyUpdate({ customFields: task.customFields })}
                        disabled={!permissions.canEdit}
                        className={styles.customFieldInput}
                      />
                      <input 
                        value={cf.value} 
                        placeholder="Value" 
                        onChange={e => {
                          if (!permissions.canEdit) return
                          const next = [...task.customFields]; next[idx].value = e.target.value; setTask(t => ({...t, customFields: next}))
                        }}
                        onBlur={() => applyUpdate({ customFields: task.customFields })}
                        disabled={!permissions.canEdit}
                        className={styles.customFieldInput}
                      />
                    </div>
                  ))}
                  {permissions.canEdit && (
                    <Button variant="ghost" size="sm" onClick={() => {
                      const next = [...(task.customFields || []), { key: '', value: '' }];
                      setTask(t => ({...t, customFields: next}))
                    }}>+ Add Field</Button>
                  )}
                </div>
              </div>

              <div className={styles.detailRow}>
                <div className={styles.detailLabel}>Status</div>
                <div style={{ flex: 1, marginLeft: -8 }}>
                  <Select 
                    value={task.status} 
                    disabled={!permissions.canEdit}
                    options={[
                      {value: 'todo', label: 'To Do'},
                      {value: 'in_progress', label: 'In Progress'},
                      {value: 'blocked', label: 'Blocked'},
                      {value: 'done', label: 'Done'},
                      {value: 'soft_deleted', label: 'Deleted (Trash)'},
                      {value: 'archived', label: 'Archived'}
                    ]}
                    onChange={handleStatusChange}
                  />
                </div>
              </div>

              {statusError && (
                <div className={styles.inlineError}>
                  <div style={{fontWeight: 600}}>⚠ {statusError.length} checklist item{statusError.length > 1 ? 's' : ''} must be completed first:</div>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {statusError.map(s => <li key={s.id}>{s.title}</li>)}
                  </ul>
                  <Button variant="secondary" size="sm" onClick={completeChecklist} style={{ marginTop: 8 }}>
                    Complete checklist
                  </Button>
                </div>
              )}

              <div className={styles.detailRow}>
                <div className={styles.detailLabel}>Tags</div>
                <div className={styles.detailValue}>
                  <TagInput 
                    selectedTagIds={task.tags || []} 
                    onChange={tags => handleSave({ tags })}
                  />
                </div>
              </div>

              <div className={styles.detailRow}>
                <div className={styles.detailLabel}>Estimated</div>
                <div className={styles.detailValue}>
                    <input 
                      type="number" 
                      placeholder="Minutes"
                      value={task.estimatedTime || ''}
                      onChange={e => handleSave({ estimatedTime: parseInt(e.target.value) || 0 })}
                      className={styles.estimatedInput}
                    /> min
                </div>
              </div>

              <div className={styles.section}>
                <TimeTracker task={task} onTimeLogged={handleTimeLogged} disabled={!permissions.canEdit} />
              </div>

              <div className={styles.section}>
                <TaskReminders task={task} onRemindersChange={(reminders) => applyUpdate({ reminders })} disabled={!permissions.canEdit} />
              </div>

              <div className={styles.sectionPadded}>
                <div className={styles.sectionTitle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Description</span>
                  {saveStatus && <span className={styles.saveIndicator} style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{saveStatus}</span>}
                </div>
                <div className={styles.descWrapper}>
                  <RichTextEditor value={desc} onChange={handleDescChange} />
                </div>
              </div>



              <div className={styles.sectionPadded}>
                <TaskAttachments taskId={task.id} projectId={projectId} isGlobal={!projectId} />
              </div>
            </div>

            {/* Right Col: Checklist & Comments */}
            <div>
              <div className={styles.subtasks}>
                <div className={styles.sectionTitle} style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <span>Checklist</span>
                  <Badge variant="neutral">{task.checklist.filter(s => s.done).length}/{task.checklist.length}</Badge>
                </div>
                <div className={styles.progressBg}>
                  <div 
                    className={styles.progressFill} 
                    style={{ width: `${task.checklist.length ? (task.checklist.filter(s => s.done).length / task.checklist.length) * 100 : 0}%`, transition: 'width 0.3s' }}
                  />
                </div>
                <div>
                  {task.checklist.map((s, idx) => (
                    <div 
                      key={s.id} 
                      className={styles.subtaskRow}
                      style={{ borderTop: dragOverChecklistItemId === s.id ? '2px solid var(--color-primary)' : 'none', cursor: 'grab' }}
                      draggable
                      onDragStart={(e) => handleChecklistDragStart(e, s.id)}
                      onDragOver={(e) => handleChecklistDragOver(e, s.id)}
                      onDragLeave={() => setDragOverChecklistItemId(null)}
                      onDrop={(e) => handleChecklistDrop(e, s.id)}
                    >
                      <span style={{color: 'var(--color-text-muted)', cursor: 'grab'}}>⋮⋮</span>
                      <input type="checkbox" checked={s.done} disabled={!permissions.canEdit} onChange={() => handleChecklistToggle(s.id)} />
                      <input
                        autoFocus={s.title === ''}
                        value={s.title}
                        disabled={!permissions.canEdit}
                        onChange={(e) => handleChecklistChange(s.id, e.target.value)}
                        onKeyDown={(e) => handleChecklistKeyDown(e, idx)}
                        style={{ border: 'none', background: 'transparent', flex: 1, textDecoration: s.done ? 'line-through' : 'none', color: s.done ? 'var(--color-text-muted)' : 'var(--color-text)', outline: 'none' }}
                        placeholder="Checklist item..."
                      />
                      <div className={styles.checklistActions} style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => duplicateChecklistItem(s, idx)} title="Duplicate" style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'12px'}}>⎘</button>
                        <button onClick={() => convertToChecklistSubtask(s, idx)} title="Convert to Subtask" style={{background:'transparent', border:'none', cursor:'pointer', fontSize:'12px'}}>⤴</button>
                      </div>
                    </div>
                  ))}
                  <div className={styles.subtaskRow} style={{ marginTop: '8px', cursor: 'pointer' }} onClick={handleChecklistAdd}>
                    <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>+ Add item</span>
                  </div>
                </div>
                <div className={styles.section}>
                  <TaskComments taskId={task.id} projectId={projectId} isGlobal={!projectId} />
                </div>            
                <div className={styles.sectionBordered}>
                  <div className={styles.sectionTitle}>Immutable Audit Log</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>A permanent record of all modifications to this task, enforced by governance policy.</div>
                  <TaskActivityHistory taskId={task.id} projectId={projectId} isGlobal={!projectId} />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {isRecurrenceModalOpen && (
        <TaskRecurrenceModal
          isOpen={isRecurrenceModalOpen}
          onClose={() => setIsRecurrenceModalOpen(false)}
          initialRule={task.recurrence_rule}
          onSave={(rule) => {
            const payload = rule ? { is_recurring: true, recurrence_rule: rule } : { is_recurring: false, recurrence_rule: null }
            setTask(t => ({ ...t, ...payload }))
            applyUpdate(payload).catch(() => setTask(t => ({ ...t, is_recurring: task.is_recurring, recurrence_rule: task.recurrence_rule })))
          }}
        />
      )}

      {isEditSeriesModalOpen && (
        <EditSeriesModal
          isOpen={isEditSeriesModalOpen}
          onClose={() => setIsEditSeriesModalOpen(false)}
          onSelect={handleSeriesEditSelect}
        />
      )}
    </Modal>
  )
}
