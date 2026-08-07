/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps, react-hooks/purity */
import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import styles from './TaskDetail.module.css'
import { Button, Badge, Avatar, Select, RichTextEditor } from '../ui'
import TaskComments from './TaskComments'
import TaskAttachments from './TaskAttachments'
import { useToast } from '../../store/toastContext'
import { useTaskNotifications } from '../../store/TaskNotificationContext'
import { useTaskAutomationStore } from '../../store/useTaskAutomationStore'
import { useTaskGovernanceStore } from '../../store/useTaskGovernanceStore'
import { getTask, getGlobalTask, updateTask, addTaskComment, deleteTask, createTask, createGlobalTask, deleteGlobalTask } from '../../api/tasks'
import { usersApi } from '../../api/users'
import { getProject, getProjects } from '../../api/projects'

import { useConfirm } from '../../store/confirmContext';

const PRIORITIES = ['low', 'medium', 'high', 'urgent']
const PRIORITY_COLORS = { low: 'info', medium: 'warning', high: 'danger', urgent: 'danger' }

export default function TaskDetail({ isOpen, onClose, taskId, projectId, initialTask, inline = false }) {
  const { confirm } = useConfirm();

  const [task, setTask] = useState(null)
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [saveStatus, setSaveStatus] = useState('')
  
  const [newComment, setNewComment] = useState('')
  const [statusError, setStatusError] = useState(null)
  const [users, setUsers] = useState([])
  const [projectsList, setProjectsList] = useState([])
  const [isEditingMode, setIsEditingMode] = useState(false)
  const [isEditingRoom, setIsEditingRoom] = useState(false)
  const [tempRoomName, setTempRoomName] = useState('')

  
  const [draggedChecklistItemId, setDraggedChecklistItemId] = useState(null)
  const [dragOverChecklistItemId, setDragOverChecklistItemId] = useState(null)
  const [dragHandleActiveId, setDragHandleActiveId] = useState(null)
  const [pendingUpdate, setPendingUpdate] = useState(null)
  
  const checklistSaveTimer = useRef(null)
  const descTimer = useRef(null)
  
  const toast = useToast()
  const { addNotification } = useTaskNotifications()
  const { runAutomations } = useTaskAutomationStore()
  const governance = useTaskGovernanceStore()
  const logAuditActivity = governance?.logAuditActivity || (() => {})
  const permissions = { ...governance?.permissions, canEdit: true }

  useEffect(() => {
    if (task && task.project?.id && (!task.project.name || task.project.name === 'General Tasks' || task.project.name === '—') && !task.project.id.includes('-tasks')) {
      getProject(task.project.id).then(pres => {
        const p = pres.data?.data || pres.data;
        if (p && p.name) {
          setTask(curr => curr ? { ...curr, project: { ...curr.project, name: p.name } } : curr);
        }
      }).catch(() => {});
    }
  }, [task?.project?.id, task?.project?.name]);

  const loadTask = () => {
    if (!isOpen || !taskId) return;
    setLoading(true)

    // Bypass fetch for mock tasks
    if (String(taskId).startsWith('mock-') && initialTask) {
      setTask({
        ...initialTask,
        assignee: (initialTask.assignee_id || initialTask.assigned_to || initialTask.assigneeId) 
          ? { 
              id: initialTask.assignee_id || initialTask.assigned_to || initialTask.assigneeId, 
              name: initialTask.assignee_name || initialTask.assigneeName || 'Unknown' 
            } 
          : null
      });
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
          assignee: (t.assignee_id || t.assigned_to || t.assigneeId) 
            ? { id: t.assignee_id || t.assigned_to || t.assigneeId, name: t.assignee_name || t.assigneeName || 'Unknown' } 
            : null,
          project: { id: t.project_id || projectId, name: t.project_name || '—' },
          roomName: t.room_name || t.roomName || null,
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
        
        // Fetch project name if it defaulted to '—' or is missing
        if ((!t.project_name || normalized.project.name === '—') && normalized.project.id && !normalized.project.id.includes('-tasks')) {
          getProject(normalized.project.id).then(pres => {
            const p = pres.data?.data || pres.data
            if (p && p.name) {
              setTask(curr => curr ? { ...curr, project: { ...curr.project, name: p.name } } : curr)
            }
          }).catch(() => {})
        }
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

  useEffect(() => {
    usersApi.getAll().then(res => setUsers(res || [])).catch(() => {})
    getProjects().then(res => setProjectsList(res.data?.data || res.data || [])).catch(() => {})
  }, [])

  useEffect(loadTask, [isOpen, taskId, projectId])

  const applyUpdate = async (payload, forceMode = null) => {
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
        runAutomations('status_changed', updatedTask, task, { toast, addNotification })
        logAuditActivity(task.id, 'STATUS_CHANGE', task.status, finalPayload.status)
      }
      runAutomations('task_updated', updatedTask, task, { toast, addNotification })
      window.dispatchEvent(new CustomEvent('taskUpdated', { detail: updatedTask }))

    } catch (e) {
      toast.error('Failed to update task')
      throw e
    }
  }

  const handleSave = async (updates) => {
    await applyUpdate(updates)
  }

  const handleTitleBlur = () => {
    if (title.trim() && title !== task.title) {
      setTask(t => ({ ...t, title: title.trim() }))
      applyUpdate({ title: title.trim() }).catch(() => setTask(t => ({ ...t, title: task.title })))
    }
  }

  const handleDelete = async () => {
    if (await confirm('Are you sure you want to permanently delete this task?')) {
      try {
        if (projectId && projectId !== 'general-tasks' && projectId !== 'lead-tasks') {
          await deleteTask(projectId, task.id, { params: { hard: true } })
        } else {
          await deleteGlobalTask(task.id, { params: { hard: true } })
        }
        logAuditActivity(task.id, 'HARD_DELETE', 'active', 'deleted')
        onClose();
        window.dispatchEvent(new CustomEvent('taskUpdated', { detail: { id: task.id, status: 'deleted' } }))
        window.dispatchEvent(new CustomEvent('globalTimeLogged'))
        toast.success('Task permanently deleted')
      } catch (e) {
        toast.error('Failed to delete task');
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

  const handlePriorityChange = async (next) => {
    if (!permissions.canEdit) return
    setTask(t => ({ ...t, priority: next }))
    try {
      await applyUpdate({ priority: next })
      logAuditActivity(task.id, 'PRIORITY_CHANGE', task.priority, next)
      toast.success('Priority updated')
    } catch {
      setTask(t => ({ ...t, priority: task.priority }))
    }
  }

  const handleSaveRoom = async () => {
    setIsEditingRoom(false);
    if (tempRoomName === (task.roomName || '')) return;
    
    const oldName = task.roomName;
    setTask(t => ({ ...t, roomName: tempRoomName, room_name: tempRoomName }));
    try {
      await applyUpdate({ roomName: tempRoomName, room_name: tempRoomName });
      toast.success('Room updated');
    } catch {
      setTask(t => ({ ...t, roomName: oldName, room_name: oldName }));
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
      if (newStatus === 'done' && onClose) {
        onClose()
      }
    } catch (err) {
      setTask(t => ({ ...t, status: task.status }))
    }
  }

  const completeChecklist = () => {
    setTask(t => ({
      ...t,
      checklist: t.checklist.map(s => ({ ...s, done: true }))
    }))
    setStatusError(null)
    updateTask(projectId, task.id, { 
       checklist: task.checklist.map(s => ({ ...s, done: true })) 
    }).catch(() => toast.error('Failed to save checklist'))
    toast.success('Checklist completed')
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
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <Button variant="ghost" onClick={onClose}>
          &larr; Back to Tasks
        </Button>
      </div>
      {loading || !task ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading task details...</div>
      ) : (
        <>
          <div className={styles.headerCard}>
            <div className={styles.headerTop}>
              <div className={styles.headerLeft}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Badge variant={PRIORITY_COLORS[task.priority]} style={{ textTransform: 'capitalize', cursor: 'pointer' }} onClick={cyclePriority}>{task.priority}</Badge>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Task ID: {task.id.substring(0, 8)}</span>
                </div>
                <input 
                  className={styles.titleInput} 
                  value={title} 
                  onChange={e => setTitle(e.target.value)}
                  onBlur={handleTitleBlur}
                  disabled={!permissions.canEdit}
                  onKeyDown={e => e.key === 'Escape' && setTitle(task.title)}
                  placeholder="Task Title"
                />
              </div>
              <div className={styles.headerRight}>
                {['soft_deleted', 'archived', 'deleted'].includes(task.status) ? (
                  <Button variant="outline" size="sm" onClick={handleRestore}>Restore Task</Button>
                ) : (
                  <>
                    {permissions.canDelete && <Button variant="outline" size="sm" className={styles.textMuted} onClick={handleArchive}>Archive</Button>}
                    <Button variant="outline" size="sm" className={styles.textDanger} onClick={handleDelete}>Delete</Button>
                    {permissions.canEdit && (
                      <Button variant="primary" size="sm" onClick={async () => handleStatusChange('done')} disabled={task.status === 'done'}>
                        {task.status === 'done' ? '✓ Completed' : 'Mark Complete'}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className={styles.grid}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              
              <div className={styles.statsGrid}>
                {/* Assignee Card */}
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Assignee</div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', width: '100%' }}>
                    {task.assignee?.name && <div style={{marginRight: 4}}><Avatar name={task.assignee?.name} size="xs" /></div>}
                    <div style={{ flex: 1 }}>
                      <Select
                        searchable={true}
                        value={task.assignee?.id || 'unassigned'}
                        options={[
                          { value: 'unassigned', label: 'Unassigned' },
                          ...users.map(u => ({ value: u.id || u.user_id, label: u.name }))
                        ]}
                        onChange={async (newAssigneeId) => {
                          const actualId = newAssigneeId === 'unassigned' ? null : newAssigneeId
                          const user = users.find(u => String(u.id || u.user_id) === String(actualId))
                          const prevAssignee = task.assignee
                          setTask(t => ({ ...t, assignee: user ? { id: user.id || user.user_id, name: user.name } : null }))
                          try {
                            await applyUpdate({ 
                              assignee_id: actualId, 
                              assigneeId: actualId, 
                              assigned_to: actualId,
                              assignee_name: user ? user.name : null,
                              assigneeName: user ? user.name : null
                            }, 'single')
                            toast.success('Assignee updated')
                          } catch (err) {
                            setTask(t => ({ ...t, assignee: prevAssignee }))
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Due Date Card */}
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Due Date</div>
                  <div className={`${styles.statValue} ${new Date(task.dueDate || task.due_date) < new Date() && task.status !== 'done' ? styles.overdue : ''}`}>
                    <input
                      type="date"
                      value={task.dueDate ? task.dueDate.split('T')[0] : ''}
                      disabled={!permissions.canEdit}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        setTask(t => ({ ...t, dueDate: newDate }));
                        applyUpdate({ dueDate: newDate });
                      }}
                    />
                  </div>
                </div>

                {/* Priority Card */}
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Priority</div>
                  <div className={styles.statValue} style={{ width: '100%' }}>
                    <div style={{ flex: 1 }}>
                      <Select 
                        value={task.priority} 
                        disabled={!permissions.canEdit}
                        options={[
                          {value: 'low', label: 'Low'},
                          {value: 'medium', label: 'Medium'},
                          {value: 'high', label: 'High'},
                          {value: 'urgent', label: 'Urgent'}
                        ]}
                        onChange={handlePriorityChange}
                      />
                    </div>
                  </div>
                </div>

                {/* Project Card */}
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Project</div>
                  {isEditingMode ? (
                    <div className={styles.statValue}>
                      <Select
                        searchable={true}
                        disabled={!permissions.canEdit}
                        value={task.project?.id && !task.project.id.includes('-tasks') ? task.project.id : 'general'}
                        options={[
                          { value: 'general', label: 'General Tasks (No Project)' },
                          ...projectsList.map(p => ({ value: p.id, label: p.name }))
                        ]}
                        onChange={async (newProjectId) => {
                          const actualId = newProjectId === 'general' ? null : newProjectId
                          const proj = projectsList.find(p => String(p.id) === String(actualId))
                          const prevProj = task.project
                          setTask(t => ({ ...t, project: proj ? { id: proj.id, name: proj.name } : { id: 'general-tasks', name: 'General Tasks' } }))
                          try {
                            await applyUpdate({ project_id: actualId }, 'single')
                            toast.success('Project updated')
                          } catch (err) {
                            setTask(t => ({ ...t, project: prevProj }))
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div className={styles.statValue} style={{ padding: '4px 8px', marginLeft: '-8px' }}>
                      {task.project?.id && !task.project.id.includes('-tasks') ? (
                        <Link to={`/projects/${task.project.id}`} className={styles.link}>{task.project.name}</Link>
                      ) : (
                        <span>General Tasks</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Room / Area Card */}
                <div className={styles.statCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className={styles.statLabel}>Room / Area</div>
                    {permissions.canEdit && !isEditingRoom && (
                      <Button variant="ghost" size="sm" style={{ padding: '2px 8px', height: 'auto', fontSize: '11px', fontWeight: 600 }} onClick={async () => { setIsEditingRoom(true); setTempRoomName(task.roomName || ''); }}>
                        Edit
                      </Button>
                    )}
                  </div>
                  <div className={styles.statValue} style={{ padding: '4px 8px', marginLeft: '-8px' }}>
                    {isEditingRoom ? (
                      <input 
                        type="text" 
                        value={tempRoomName} 
                        onChange={(e) => setTempRoomName(e.target.value)}
                        onBlur={handleSaveRoom}
                        autoFocus
                        style={{ flex: 1, padding: '4px', border: '1px solid var(--color-border)', borderRadius: '4px', width: '100%', fontSize: 'var(--text-sm)' }}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveRoom() }}
                      />
                    ) : (
                      task.roomName || 'General (No room tag)'
                    )}
                  </div>
                </div>

                {/* Status Card */}
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Status</div>
                  <div className={styles.statValue} style={{ width: '100%' }}>
                    <div style={{ flex: 1 }}>
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

              <div className={styles.contentCard}>
                <div className={styles.sectionTitle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Description</span>
                  {saveStatus && <span className={styles.saveIndicator} style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{saveStatus}</span>}
                </div>
                <div className={styles.descWrapper}>
                  <RichTextEditor value={desc} onChange={handleDescChange} hideToolbar={true} />
                </div>
              </div>

              <div className={styles.contentCard}>
                <TaskAttachments taskId={task.id} projectId={projectId} isGlobal={!projectId} />
              </div>
            </div>

            {/* Right Col: Checklist & Comments */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              <div className={styles.contentCard}>
                <div className={styles.sectionTitle} style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <span>Checklist</span>
                  <Badge variant="neutral">{task.checklist.filter(s => s.done).length}/{task.checklist.length}</Badge>
                </div>

                <div>
                  {task.checklist.map((s, idx) => (
                    <div 
                      key={s.id} 
                      className={styles.subtaskRow}
                      style={{ borderTop: dragOverChecklistItemId === s.id ? '2px solid var(--color-primary)' : 'none' }}
                      draggable={dragHandleActiveId === s.id}
                      onDragStart={(e) => handleChecklistDragStart(e, s.id)}
                      onDragOver={(e) => handleChecklistDragOver(e, s.id)}
                      onDragLeave={() => setDragOverChecklistItemId(null)}
                      onDrop={(e) => handleChecklistDrop(e, s.id)}
                    >
                      <span 
                        style={{color: 'var(--color-text-muted)', cursor: 'grab', padding: '0 4px'}}
                        onMouseEnter={() => setDragHandleActiveId(s.id)}
                        onMouseLeave={() => setDragHandleActiveId(null)}
                      >
                        ⋮⋮
                      </span>
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

                    </div>
                  ))}
                  <div className={styles.subtaskRow} style={{ marginTop: '8px', cursor: 'pointer' }} onClick={handleChecklistAdd}>
                    <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>+ Add item</span>
                  </div>
                </div>
              </div>
              
              <div className={styles.contentCard}>
                <TaskComments taskId={task.id} projectId={projectId} isGlobal={!projectId} />
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  )
}
