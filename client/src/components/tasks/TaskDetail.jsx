import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import styles from './TaskDetail.module.css'
import { Drawer, Button, Badge, Avatar, Select } from '../ui'
import { useToast } from '../../store/toastContext'

const PRIORITIES = ['low', 'medium', 'high', 'urgent']
const PRIORITY_COLORS = { low: 'info', medium: 'warning', high: 'danger', urgent: 'danger' }

export default function TaskDetail({ isOpen, onClose, taskId, projectId }) {
  const [task, setTask] = useState(null)
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [saveStatus, setSaveStatus] = useState('')
  const [newSubtask, setNewSubtask] = useState('')
  const [newComment, setNewComment] = useState('')
  const [statusError, setStatusError] = useState(null)
  const toast = useToast()
  const descTimer = useRef(null)

  useEffect(() => {
    if (isOpen && taskId) {
      setLoading(true)
      // Mock fetch /api/projects/:projectId/tasks/:taskId
      setTimeout(() => {
        setTask({
          id: taskId,
          title: 'Finalize Kitchen Renderings',
          description: 'Need 3 angles. Make sure to include the new island design.',
          status: 'in_progress',
          priority: 'high',
          dueDate: new Date(Date.now() - 86400000).toISOString(), // overdue
          assignee: { id: '1', name: 'Rahul Desai' },
          project: { id: projectId || '1', name: 'Sharma Residence' },
          milestone: { id: 'm1', name: 'Design Phase' },
          tags: ['design', 'client-review'],
          subtasks: [
            { id: 's1', title: 'Angle 1 (From living room)', done: true, assignee: { name: 'Rahul Desai' } },
            { id: 's2', title: 'Angle 2 (From hallway)', done: false, assignee: { name: 'Rahul Desai' } },
            { id: 's3', title: 'Angle 3 (Top down)', done: false, assignee: { name: 'Priya Sharma' } },
          ],
          comments: [
            { id: 'c1', author: { name: 'Priya Sharma' }, text: 'Client requested darker cabinets', createdAt: new Date(Date.now() - 3600000).toISOString() }
          ]
        })
        setTitle('Finalize Kitchen Renderings')
        setDesc('Need 3 angles. Make sure to include the new island design.')
        setLoading(false)
      }, 400)
    }
  }, [isOpen, taskId, projectId])

  const handleTitleBlur = () => {
    if (title !== task.title) {
      setTask({ ...task, title })
      toast.success('Task title updated')
    }
  }

  const handleDescChange = (e) => {
    setDesc(e.target.value)
    setSaveStatus('Saving...')
    clearTimeout(descTimer.current)
    descTimer.current = setTimeout(() => {
      setTask(t => ({ ...t, description: e.target.value }))
      setSaveStatus('Saved ✓')
      setTimeout(() => setSaveStatus(''), 2000)
    }, 1500)
  }

  const cyclePriority = () => {
    const idx = PRIORITIES.indexOf(task.priority)
    const next = PRIORITIES[(idx + 1) % PRIORITIES.length]
    setTask({ ...task, priority: next })
    toast.success('Priority updated')
  }

  const handleStatusChange = (newStatus) => {
    if (newStatus === 'done' && task.subtasks.some(s => !s.done)) {
      setStatusError(task.subtasks.filter(s => !s.done))
      return
    }
    setStatusError(null)
    setTask({ ...task, status: newStatus })
    toast.success('Task status updated')
  }

  const completeAllSubtasks = () => {
    setTask({
      ...task,
      subtasks: task.subtasks.map(s => ({ ...s, done: true })),
      status: 'done'
    })
    setStatusError(null)
    toast.success('All subtasks completed and task marked done')
  }

  const toggleSubtask = (id) => {
    setTask({
      ...task,
      subtasks: task.subtasks.map(s => s.id === id ? { ...s, done: !s.done } : s)
    })
  }

  const addSubtask = (e) => {
    if (e.key === 'Enter' && newSubtask.trim()) {
      setTask({
        ...task,
        subtasks: [...task.subtasks, { id: Date.now().toString(), title: newSubtask.trim(), done: false }]
      })
      setNewSubtask('')
    } else if (e.key === 'Escape') {
      setNewSubtask('')
    }
  }

  const addComment = () => {
    if (!newComment.trim()) return
    setTask({
      ...task,
      comments: [...task.comments, { id: Date.now().toString(), author: { name: 'You' }, text: newComment.trim(), createdAt: new Date().toISOString() }]
    })
    setNewComment('')
  }

  if (!isOpen) return null

  return (
    <Drawer isOpen={isOpen} onClose={onClose} width={640}>
      {loading || !task ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading task details...</div>
      ) : (
        <>
          <div className={styles.headerRow}>
            <Badge variant={PRIORITY_COLORS[task.priority]} style={{ textTransform: 'capitalize' }}>{task.priority}</Badge>
            <Button variant="primary" size="sm" onClick={() => handleStatusChange('done')} disabled={task.status === 'done'}>
              {task.status === 'done' ? '✓ Completed' : 'Mark Complete'}
            </Button>
          </div>
          <input 
            className={styles.titleInput} 
            value={title} 
            onChange={e => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={e => e.key === 'Escape' && setTitle(task.title)}
          />

          <div className={styles.grid} style={{ marginTop: 24 }}>
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
                <div className={`${styles.detailValue} ${new Date(task.dueDate) < new Date() && task.status !== 'done' ? styles.overdue : ''}`}>
                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Set date'}
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
                <div className={styles.detailLabel}>Status</div>
                <div style={{ flex: 1, marginLeft: -8 }}>
                  <Select 
                    value={task.status} 
                    options={[
                      {value: 'todo', label: 'To Do'},
                      {value: 'in_progress', label: 'In Progress'},
                      {value: 'blocked', label: 'Blocked'},
                      {value: 'done', label: 'Done'}
                    ]}
                    onChange={handleStatusChange}
                  />
                </div>
              </div>

              {statusError && (
                <div className={styles.inlineError}>
                  <div style={{fontWeight: 600}}>⚠ {statusError.length} subtask{statusError.length > 1 ? 's' : ''} must be completed first:</div>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {statusError.map(s => <li key={s.id}>{s.title}</li>)}
                  </ul>
                  <Button variant="secondary" size="sm" onClick={completeAllSubtasks} style={{ marginTop: 8 }}>
                    Complete all subtasks
                  </Button>
                </div>
              )}

              <div className={styles.detailRow}>
                <div className={styles.detailLabel}>Tags</div>
                <div className={styles.detailValue} style={{ cursor: 'default' }}>
                  <div className={styles.tagChips}>
                    {task.tags.map(t => <Badge key={t} variant="neutral">{t}</Badge>)}
                    <input className={styles.addTagInput} placeholder="+ Add tag" onKeyDown={e => {
                      if (e.key === 'Enter' && e.target.value.trim()) {
                        setTask({...task, tags: [...task.tags, e.target.value.trim()]})
                        e.target.value = ''
                      }
                    }} />
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 24 }}>
                <div className={styles.sectionTitle}>Description</div>
                <div className={styles.descWrapper}>
                  <textarea 
                    className={styles.descTextarea}
                    placeholder="Add a description..."
                    value={desc}
                    onChange={handleDescChange}
                  />
                  {saveStatus && <span className={styles.saveIndicator}>{saveStatus}</span>}
                </div>
              </div>
            </div>

            {/* Right Col: Subtasks & Comments */}
            <div>
              <div className={styles.subtasks}>
                <div className={styles.sectionTitle}>
                  Subtasks
                  <Badge variant="neutral">{task.subtasks.filter(s => s.done).length}/{task.subtasks.length}</Badge>
                </div>
                <div className={styles.progressBg}>
                  <div 
                    className={styles.progressFill} 
                    style={{ width: `${task.subtasks.length ? (task.subtasks.filter(s => s.done).length / task.subtasks.length) * 100 : 0}%` }}
                  />
                </div>
                <div>
                  {task.subtasks.map(s => (
                    <div key={s.id} className={styles.subtaskRow}>
                      <input type="checkbox" checked={s.done} onChange={() => toggleSubtask(s.id)} />
                      <div className={`${styles.subtaskTitle} ${s.done ? styles.done : ''}`}>{s.title}</div>
                      {s.assignee && <Avatar name={s.assignee.name} size="xs" />}
                    </div>
                  ))}
                  <div className={styles.subtaskRow}>
                    <input type="checkbox" disabled style={{ opacity: 0.5 }} />
                    <input 
                      className={styles.addSubtask} 
                      placeholder="+ Add Subtask" 
                      value={newSubtask}
                      onChange={e => setNewSubtask(e.target.value)}
                      onKeyDown={addSubtask}
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className={styles.sectionTitle}>Comments</div>
                <div className={styles.commentsList}>
                  {task.comments.map(c => (
                    <div key={c.id} className={styles.comment}>
                      <Avatar name={c.author.name} size="sm" />
                      <div>
                        <div className={styles.commentHeader}>
                          <span className={styles.commentAuthor}>{c.author.name}</span>
                          <span className={styles.commentTime}>{new Date(c.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className={styles.commentText}>{c.text}</div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className={styles.composeArea}>
                  <Avatar name="You" size="sm" />
                  <div className={styles.composeCol}>
                    <textarea 
                      className={styles.composeTextarea} 
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                    />
                    <Button variant="primary" size="sm" disabled={!newComment.trim()} onClick={addComment}>Post</Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </Drawer>
  )
}
