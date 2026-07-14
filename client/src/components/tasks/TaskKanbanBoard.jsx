import { useState, useMemo } from 'react'
import { Badge, Avatar } from '../ui'
import styles from './TaskKanbanBoard.module.css'

const COLUMNS = [
  { id: 'todo', label: 'To Do', color: 'neutral' },
  { id: 'in_progress', label: 'In Progress', color: 'primary' },
  { id: 'waiting', label: 'Waiting', color: 'warning' },
  { id: 'blocked', label: 'Blocked', color: 'danger' },
  { id: 'review', label: 'Review', color: 'info' },
  { id: 'done', label: 'Completed', color: 'success' },
]

const PRIORITY_COLORS = { low: 'info', medium: 'warning', high: 'danger', urgent: 'danger' }

export default function TaskKanbanBoard({ tasks, onTaskClick, onTaskDrop, onTaskUpdate, highlightText }) {
  const [collapsedCols, setCollapsedCols] = useState(new Set(['done']))
  const [collapsedSwimlanes, setCollapsedSwimlanes] = useState(new Set())
  const [draggedTaskId, setDraggedTaskId] = useState(null)
  const [dragOverCol, setDragOverCol] = useState(null)
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [editingTitle, setEditingTitle] = useState('')

  const swimlanes = useMemo(() => {
    const grouped = {}
    tasks.forEach(t => {
      const projName = t.project_name || 'General'
      if (!grouped[projName]) {
        grouped[projName] = { id: t.project_id || 'general', name: projName, columns: {} }
        COLUMNS.forEach(c => grouped[projName].columns[c.id] = [])
      }
      // Normalize status to match standard columns, default to todo if not found
      const colId = COLUMNS.find(c => c.id === t.status) ? t.status : 'todo'
      grouped[projName].columns[colId].push(t)
    })
    
    // Sort swimlanes: General last, then alphabetically
    return Object.values(grouped).sort((a, b) => {
      if (a.id === 'general') return 1
      if (b.id === 'general') return -1
      return a.name.localeCompare(b.name)
    })
  }, [tasks])

  const toggleColumn = (colId) => {
    const next = new Set(collapsedCols)
    if (next.has(colId)) next.delete(colId)
    else next.add(colId)
    setCollapsedCols(next)
  }

  const toggleSwimlane = (swimlaneId) => {
    const next = new Set(collapsedSwimlanes)
    if (next.has(swimlaneId)) next.delete(swimlaneId)
    else next.add(swimlaneId)
    setCollapsedSwimlanes(next)
  }

  const handleDragStart = (e, taskId) => {
    setDraggedTaskId(taskId)
    e.dataTransfer.setData('text/plain', taskId)
    e.dataTransfer.effectAllowed = 'move'
    
    // Create a generic drag image so the native preview doesn't look messy
    const el = e.target.cloneNode(true)
    el.style.position = 'absolute'
    el.style.top = '-1000px'
    el.style.opacity = '0.5'
    document.body.appendChild(el)
    e.dataTransfer.setDragImage(el, 20, 20)
    setTimeout(() => document.body.removeChild(el), 10)
  }

  const handleDragOver = (e, statusId) => {
    e.preventDefault() // Necessary to allow dropping
    e.dataTransfer.dropEffect = 'move'
    if (dragOverCol !== statusId) setDragOverCol(statusId)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setDragOverCol(null)
  }

  const handleDrop = (e, targetStatus) => {
    e.preventDefault()
    setDragOverCol(null)
    const taskId = e.dataTransfer.getData('text/plain')
    if (taskId) {
      onTaskDrop(taskId, targetStatus)
    }
    setDraggedTaskId(null)
  }

  const handleDragEnd = () => {
    setDraggedTaskId(null)
    setDragOverCol(null)
  }

  const handleInlineEditStart = (e, task) => {
    e.stopPropagation()
    setEditingTaskId(task.id)
    setEditingTitle(task.title)
  }

  const handleInlineEditSave = (task) => {
    if (editingTitle.trim() && editingTitle !== task.title) {
      onTaskUpdate(task.id, { title: editingTitle.trim() })
    }
    setEditingTaskId(null)
  }

  const handleKeyDown = (e, task) => {
    if (e.key === 'Enter') handleInlineEditSave(task)
    if (e.key === 'Escape') setEditingTaskId(null)
  }

  return (
    <div className={styles.board}>
      <div className={styles.boardHeader}>
        {COLUMNS.map(col => {
          const isCollapsed = collapsedCols.has(col.id)
          return (
            <div 
              key={col.id} 
              className={`${styles.colHeader} ${isCollapsed ? styles.collapsed : ''}`}
            >
              <div className={styles.colHeaderContent}>
                <Badge variant={col.color} className={styles.colBadge}>
                  {isCollapsed ? col.label.charAt(0) : col.label}
                </Badge>
              </div>
              <button 
                className={styles.collapseBtn} 
                onClick={() => toggleColumn(col.id)}
                title={isCollapsed ? 'Expand column' : 'Collapse column'}
              >
                {isCollapsed ? '»' : '«'}
              </button>
            </div>
          )
        })}
      </div>

      <div className={styles.swimlanes}>
        {swimlanes.map(swimlane => {
          const isSwimlaneCollapsed = collapsedSwimlanes.has(swimlane.id)
          return (
            <div key={swimlane.id} className={styles.swimlane}>
              <div 
                className={styles.swimlaneHeader}
                onClick={() => toggleSwimlane(swimlane.id)}
              >
                <span className={styles.swimlaneIcon}>{isSwimlaneCollapsed ? '▶' : '▼'}</span>
                <span className={styles.swimlaneTitle}>{swimlane.name}</span>
                <span className={styles.swimlaneCount}>
                  {Object.values(swimlane.columns).reduce((acc, arr) => acc + arr.length, 0)} tasks
                </span>
              </div>

              {!isSwimlaneCollapsed && (
                <div className={styles.swimlaneCols}>
                  {COLUMNS.map(col => {
                    const isCollapsed = collapsedCols.has(col.id)
                    const items = swimlane.columns[col.id]
                    const isOver = dragOverCol === col.id
                    
                    return (
                      <div 
                        key={col.id} 
                        className={`${styles.colBody} ${isCollapsed ? styles.collapsed : ''} ${isOver ? styles.dragOver : ''}`}
                        onDragOver={(e) => !isCollapsed && handleDragOver(e, col.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => !isCollapsed && handleDrop(e, col.id)}
                      >
                        {!isCollapsed && items.map(t => {
                          const isDragging = draggedTaskId === t.id
                          const isOverdue = new Date(t.due_date) < new Date() && t.status !== 'done'
                          
                          return (
                            <div 
                              key={t.id}
                              className={`${styles.card} ${isDragging ? styles.dragging : ''}`}
                              draggable
                              onDragStart={(e) => handleDragStart(e, t.id)}
                              onDragEnd={handleDragEnd}
                              onClick={() => onTaskClick(t.id)}
                            >
                              <div className={styles.cardHeader}>
                                <span className={styles.taskId}>{t.id.slice(0,8).toUpperCase()}</span>
                                <Badge variant={PRIORITY_COLORS[t.priority] || 'neutral'} className={styles.priorityBadge}>
                                  {t.priority}
                                </Badge>
                              </div>
                              
                              {editingTaskId === t.id ? (
                                <input 
                                  autoFocus
                                  className={styles.inlineEditInput}
                                  value={editingTitle}
                                  onChange={e => setEditingTitle(e.target.value)}
                                  onBlur={() => handleInlineEditSave(t)}
                                  onKeyDown={e => handleKeyDown(e, t)}
                                  onClick={e => e.stopPropagation()}
                                />
                              ) : (
                                <div className={styles.cardTitle} onClick={(e) => {
                                  // Enable inline edit if clicking directly on the text when not dragging
                                  if (e.detail === 2) { 
                                    handleInlineEditStart(e, t)
                                  }
                                }}>
                                  {highlightText ? highlightText(t.title) : t.title}
                                </div>
                              )}

                              <div className={styles.cardFooter}>
                                <div className={styles.cardMeta}>
                                  {t.is_recurring && <span title="Recurring">🔄</span>}
                                  {t.due_date && (
                                    <span className={`${styles.date} ${isOverdue ? styles.overdue : ''}`}>
                                      {new Date(t.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                    </span>
                                  )}
                                  {(t.comments?.length > 0) && (
                                    <span className={styles.metaIcon}>💬 {t.comments.length}</span>
                                  )}
                                  {t.attachments_count > 0 && (
                                    <span className={styles.metaIcon}>📎 {t.attachments_count}</span>
                                  )}
                                  {t.checklist?.length > 0 && (
                                    <span className={styles.metaIcon}>☑️ {t.checklist.filter(c => c.done).length}/{t.checklist.length}</span>
                                  )}
                                </div>
                                <div className={styles.assignee}>
                                  {t.assigned_to && (
                                    <Avatar name={t.assignee_name} size="xs" title={t.assignee_name} />
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        {swimlanes.length === 0 && (
          <div style={{ padding: '64px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No tasks found.
          </div>
        )}
      </div>
    </div>
  )
}
