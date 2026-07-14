import { useState, useEffect, useMemo, useRef } from 'react'
import styles from './MyTasksPage.module.css'
import { Badge, Select, Button, ContentLoader, EmptyState } from '../../components/ui'
import TaskDetail from '../../components/tasks/TaskDetail'
import TaskKanbanBoard from '../../components/tasks/TaskKanbanBoard'
import TaskCalendarBoard from '../../components/tasks/TaskCalendarBoard'
import TemplateGalleryModal from '../../components/tasks/TemplateGalleryModal'
import TagManagerModal from '../../components/tasks/TagManagerModal'
import ViewManagerModal from '../../components/tasks/ViewManagerModal'
import GlobalTimeTracker from '../../components/tasks/GlobalTimeTracker'
import TimeReportsModal from '../../components/tasks/TimeReportsModal'
import TaskAutomationsModal from '../../components/tasks/TaskAutomationsModal'
import AiScheduleAssistantModal from '../../components/tasks/AiScheduleAssistantModal'
import AiRiskAnalysisModal from '../../components/tasks/AiRiskAnalysisModal'
import AiTaskCreationModal from '../../components/tasks/AiTaskCreationModal'
import TaskAnalyticsModal from '../../components/tasks/TaskAnalyticsModal'
import TaskGovernanceModal from '../../components/tasks/TaskGovernanceModal'
import { usePageTitle } from '../../hooks/usePageTitle';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { useToast } from '../../store/toastContext'
import { useTaskAutomation } from '../../store/TaskAutomationContext'
import { useGovernance } from '../../store/TaskGovernanceContext'
import { getGlobalTasks, updateTask, updateGlobalTask, getTags, getTaskViews, createTaskView } from '../../api/tasks'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Due Today' },
  { id: 'week', label: 'This Week' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'completed', label: 'Completed' },
  { id: 'trash', label: 'Trash / Archived' }
]

const STATUSES = {
  todo: { label: 'To Do', color: 'neutral' },
  in_progress: { label: 'In Progress', color: 'primary' },
  waiting: { label: 'Waiting', color: 'warning' },
  blocked: { label: 'Blocked', color: 'danger' },
  review: { label: 'Review', color: 'info' },
  done: { label: 'Completed', color: 'success' },
  cancelled: { label: 'Cancelled', color: 'neutral' }
}

const PRIORITY_COLORS = { low: 'info', medium: 'warning', high: 'danger', urgent: 'danger' }

export default function MyTasksPage() {
  usePageTitle('My Tasks')
  useBreadcrumbs([{ label: 'My Tasks' }])
  const toast = useToast()

  const [activeTab, setActiveTab] = useState('all')
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [updatingTaskId, setUpdatingTaskId] = useState(null)
  const [globalTags, setGlobalTags] = useState([])
  
  const [selectedTask, setSelectedTask] = useState(null)
  const [collapsedProjects, setCollapsedProjects] = useState(new Set())
  const [expandedTaskIds, setExpandedTaskIds] = useState(new Set())
  const [draggedTaskId, setDraggedTaskId] = useState(null)
  const [dragOverTaskId, setDragOverTaskId] = useState(null)
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [isTagManagerModalOpen, setIsTagManagerModalOpen] = useState(false)
  const [isViewManagerOpen, setIsViewManagerOpen] = useState(false)
  const [isTimeReportsOpen, setIsTimeReportsOpen] = useState(false)
  const [isAutomationsOpen, setIsAutomationsOpen] = useState(false)
  const [isAiScheduleOpen, setIsAiScheduleOpen] = useState(false)
  const [isAiRiskOpen, setIsAiRiskOpen] = useState(false)
  const [isAiTaskCreationOpen, setIsAiTaskCreationOpen] = useState(false)
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false)
  const [isGovernanceOpen, setIsGovernanceOpen] = useState(false)

  const [savedViews, setSavedViews] = useState([])
  const [currentViewId, setCurrentViewId] = useState('default')

  const { runAutomations } = useTaskAutomation()
  const { role, setRole, isOffline } = useGovernance()

  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [recentSearches, setRecentSearches] = useState([])
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const searchInputRef = useRef(null)

  const [viewMode, setViewMode] = useState(() => localStorage.getItem('myTasksViewMode') || 'list')

  useEffect(() => {
    localStorage.setItem('myTasksViewMode', viewMode)
  }, [viewMode])

  useEffect(() => {
    const saved = localStorage.getItem('myTasksRecentSearches')
    if (saved) {
      try { setRecentSearches(JSON.parse(saved)) } catch(e){}
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
      if (searchQuery.trim() && !recentSearches.includes(searchQuery.trim())) {
        const newSearches = [searchQuery.trim(), ...recentSearches].slice(0, 5)
        setRecentSearches(newSearches)
        localStorage.setItem('myTasksRecentSearches', JSON.stringify(newSearches))
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, recentSearches])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    const handleGlobalLog = (e) => {
      loadTasks()
    }
    const handleAutoReload = () => loadTasks()

    window.addEventListener('globalTimeLogged', handleGlobalLog)
    window.addEventListener('automationExecuted', handleAutoReload)
    return () => {
      window.removeEventListener('globalTimeLogged', handleGlobalLog)
      window.removeEventListener('automationExecuted', handleAutoReload)
    }
  }, [])

  const highlightText = (text, highlight) => {
    if (!highlight || !text) return text;
    const parts = String(text).split(new RegExp(`(${highlight})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === highlight.toLowerCase() ? 
            <mark key={i} style={{ backgroundColor: 'var(--color-primary-light, #ffd54f)', color: '#000', padding: '0 2px', borderRadius: '2px' }}>{part}</mark> : part
        )}
      </span>
    );
  };

  // Filters
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [projectFilter, setProjectFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [sortBy, setSortBy] = useState('due_asc')
  
  // AI Feature States
  const [showDailyAssistant, setShowDailyAssistant] = useState(false)
  const [showAIModal, setShowAIModal] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiGeneratedTasks, setAiGeneratedTasks] = useState(null)
  const [showAIMeetingNotes, setShowAIMeetingNotes] = useState(false)
  const [meetingTranscript, setMeetingTranscript] = useState('')
  const [extractedTasks, setExtractedTasks] = useState(null)



  const loadTasks = () => {
    setLoading(true)
    Promise.all([
      getGlobalTasks({ assigneeId: 'me', limit: 100 }),
      getTags().catch(() => ({ data: [] })),
      getTaskViews().catch(() => ({ data: [] }))
    ]).then(([res, tagsRes, viewsRes]) => {
        setGlobalTags(tagsRes.data?.data || tagsRes.data || [])
        const vs = viewsRes.data?.data || viewsRes.data || []
        setSavedViews(vs)
        
        const def = vs.find(v => v.is_default)
        if (def) {
          setCurrentViewId(def.id)
          applyViewPayload(def.payload)
        }

        const _r = res.data?.data || res.data; const raw = Array.isArray(_r) ? _r : [];
        const normalized = raw.map(t => ({
          id: t.id,
          title: t.title,
          description: t.description || '',
          customerName: t.customer_name || t.customerName || '',
          leadName: t.lead_name || t.leadName || '',
          assigneeName: t.assignee_name || t.assigneeName || '',
          tags: Array.isArray(t.tags) ? t.tags : [],
          status: t.status || 'todo',
          priority: t.priority || 'medium',
          dueDate: t.due_date || t.dueDate || null,
          estimatedTime: t.estimatedTime || 0,
          actualTime: t.actualTime || 0,
          billableHours: t.billableHours || 0,
          timeLogs: t.timeLogs || [],
          project: { 
            id: t.project_id || (t.lead_id ? 'lead-tasks' : 'general-tasks'), 
            name: t.project_name || (t.lead_id ? 'Lead Tasks' : 'General Tasks') 
          },
          parent_id: t.parent_id || null,
          milestone: t.milestone_name || null,
          checklist: Array.isArray(t.checklist) ? t.checklist : (Array.isArray(t.subtasks) ? t.subtasks : []),
        }))
        setTasks(normalized)
      })
      .catch(() => setTasks([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadTasks()
  }, [])

  const handleStatusChange = async (task, newStatus) => {
    setUpdatingTaskId(task.id)
    const prevStatus = task.status
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
    try {
      if (task.project?.id && task.project.id !== 'lead-tasks' && task.project.id !== 'general-tasks') {
        await updateTask(task.project.id, task.id, { status: newStatus })
      } else {
        await updateGlobalTask(task.id, { status: newStatus })
      }
      toast.success(newStatus === 'done' ? 'Task completed!' : `Task marked as ${STATUSES[newStatus]?.label || newStatus}`)
      
      const updated = { ...task, status: newStatus }
      runAutomations('status_changed', updated, task)
      runAutomations('task_updated', updated, task)
      
    } catch (err) {
      console.error('Failed to update task:', err)
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: prevStatus } : t))
      toast.error(err?.response?.data?.error?.message || 'Failed to update task')
    } finally {
      setUpdatingTaskId(null)
    }
  }

  const applyViewPayload = (payload) => {
    if (payload.activeTab) setActiveTab(payload.activeTab)
    if (payload.statusFilter) setStatusFilter(payload.statusFilter)
    if (payload.priorityFilter) setPriorityFilter(payload.priorityFilter)
    if (payload.projectFilter) setProjectFilter(payload.projectFilter)
    if (payload.tagFilter) setTagFilter(payload.tagFilter)
    if (payload.sortBy) setSortBy(payload.sortBy)
    if (payload.viewMode) setViewMode(payload.viewMode)
  }

  const handleSaveCurrentView = async () => {
    const name = window.prompt('Enter a name for this view:')
    if (!name) return
    const payload = {
      activeTab, statusFilter, priorityFilter, projectFilter, tagFilter, sortBy, viewMode
    }
    try {
      const res = await createTaskView({ name, payload })
      const nv = res.data?.data || res.data
      setSavedViews([...savedViews, nv])
      setCurrentViewId(nv.id)
      toast.success('View saved!')
    } catch {
      toast.error('Failed to save view')
    }
  }

  const toggleProjectGroup = (projectId) => {
    const next = new Set(collapsedProjects)
    if (next.has(projectId)) next.delete(projectId)
    else next.add(projectId)
    setCollapsedProjects(next)
  }

  const toggleTaskExpand = (taskId) => {
    const next = new Set(expandedTaskIds)
    if (next.has(taskId)) next.delete(taskId)
    else next.add(taskId)
    setExpandedTaskIds(next)
  }

  // Derived state
  const isPending = (status) => !['done', 'cancelled'].includes(status)

  const isToday = (d) => {
    const date = new Date(d)
    const today = new Date()
    return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()
  }
  const isOverdue = (d) => {
    const date = new Date(d); date.setHours(0,0,0,0)
    const today = new Date(); today.setHours(0,0,0,0)
    return date < today
  }

  const filteredTasks = useMemo(() => {
    const filtered = tasks.filter(t => {
      // Tab filters
      const isTrashed = ['soft_deleted', 'archived'].includes(t.status)
      if (activeTab === 'trash') {
        if (!isTrashed) return false
      } else {
        if (isTrashed) return false
        if (activeTab === 'completed' && t.status !== 'done') return false
        
        if (viewMode === 'list') {
          if (activeTab === 'all' && (t.status === 'done' || t.status === 'cancelled')) return false
        } else {
          // Kanban view: Show completed only if tab is completed, otherwise hide completed by default if 'all' is selected unless status filter is explicitly set
          if (activeTab === 'all' && (t.status === 'done' || t.status === 'cancelled') && statusFilter === 'all') return false
        }
      }

      if (activeTab === 'today' && (!isToday(t.dueDate) || !isPending(t.status))) return false
      if (activeTab === 'overdue' && (!isOverdue(t.dueDate) || !isPending(t.status))) return false
      // For 'week', only show tasks due within the current week
      if (activeTab === 'week') {
        if (!t.dueDate) return false
        const date = new Date(t.dueDate)
        const today = new Date()
        const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()))
        const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6))
        if (date < startOfWeek || date > endOfWeek || !isPending(t.status)) return false
      }
      // Bar filters
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
      if (tagFilter !== 'all' && !t.tags.includes(tagFilter)) return false
      
      // Text Search
      if (debouncedSearchQuery) {
        const q = debouncedSearchQuery.toLowerCase()
        const searchableText = [
          t.id,
          t.title,
          t.description,
          t.project.name,
          t.customerName,
          t.leadName,
          t.assigneeName,
          t.tags.join(' '),
          t.milestone
        ].filter(Boolean).join(' ').toLowerCase()
        if (!searchableText.includes(q)) return false
      }
      return true
    })

    // Sorting
    filtered.sort((a, b) => {
      if (sortBy === 'due_asc') return new Date(a.dueDate) - new Date(b.dueDate)
      if (sortBy === 'due_desc') return new Date(b.dueDate) - new Date(a.dueDate)
      if (sortBy === 'priority') {
        const pMap = { urgent: 4, high: 3, medium: 2, low: 1 }
        return pMap[b.priority] - pMap[a.priority]
      }
      return 0
    })

    return filtered
  }, [tasks, activeTab, priorityFilter, projectFilter, sortBy, debouncedSearchQuery, statusFilter, viewMode, tagFilter])

  // Group by project
  const groupedTasks = useMemo(() => {
    const groups = {}
    filteredTasks.forEach(t => {
      if (!groups[t.project.id]) groups[t.project.id] = { project: t.project, tasks: [] }
      groups[t.project.id].tasks.push(t)
    })
    
    const buildTree = (tasksList) => {
      const map = new Map()
      const roots = []
      tasksList.forEach(t => map.set(t.id, { ...t, subtasks: [] }))
      const visited = new Set()
      map.forEach(node => {
        if (visited.has(node.id)) return
        visited.add(node.id)
        if (node.parent_id && map.has(node.parent_id)) {
          map.get(node.parent_id).subtasks.push(node)
        } else {
          roots.push(node)
        }
      })
      return roots
    }

    return Object.values(groups).map(g => ({ ...g, tasks: buildTree(g.tasks) }))
  }, [filteredTasks])

  const stats = useMemo(() => {
    return {
      overdue: tasks.filter(t => isOverdue(t.dueDate) && isPending(t.status)).length,
      today: tasks.filter(t => isToday(t.dueDate) && isPending(t.status)).length,
      week: tasks.filter(t => {
        if (!isPending(t.status) || !t.dueDate) return false
        const date = new Date(t.dueDate)
        const today = new Date()
        const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()))
        const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6))
        return date >= startOfWeek && date <= endOfWeek
      }).length,
      doneWeek: tasks.filter(t => {
        if (t.status !== 'done' || !t.dueDate) return false
        const date = new Date(t.dueDate)
        const today = new Date()
        const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()))
        const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6))
        return date >= startOfWeek && date <= endOfWeek
      }).length
    }
  }, [tasks])

  const projectsOptions = useMemo(() => {
    const map = new Map()
    tasks.forEach(t => map.set(t.project.id, t.project.name))
    return [{value:'all', label:'All Projects'}, ...Array.from(map.entries()).map(([id, name]) => ({value:id, label:name}))]
  }, [tasks])

  const getEmptyState = () => {
    if (debouncedSearchQuery && filteredTasks.length === 0) {
      return { icon: '🔍', text: `No matching tasks found for "${debouncedSearchQuery}"` }
    }
    if (activeTab === 'today') return { icon: '🎉', text: "Nothing due today. You're ahead of schedule!" }
    if (activeTab === 'overdue') return { icon: '✓', text: 'No overdue tasks. Great work!' }
    return { icon: '◻', text: 'No tasks assigned to you yet.' }
  }
  const emptyState = getEmptyState()

  const formatDate = (d) => {
    if (isToday(d)) return 'Today'
    return new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short' })
  }

  const handleDragStart = (e, taskId) => {
    e.stopPropagation()
    setDraggedTaskId(taskId)
    e.dataTransfer.effectAllowed = 'move'
  }
  
  const handleDragOver = (e, taskId) => {
    e.preventDefault()
    e.stopPropagation()
    if (draggedTaskId !== taskId && dragOverTaskId !== taskId) {
      setDragOverTaskId(taskId)
    }
  }

  const handleDrop = async (e, targetTaskId) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverTaskId(null)
    
    if (draggedTaskId && draggedTaskId !== targetTaskId) {
      const taskToMove = tasks.find(t => t.id === draggedTaskId)
      if (taskToMove) {
         setTasks(prev => prev.map(t => t.id === draggedTaskId ? { ...t, parent_id: targetTaskId } : t))
         try {
            if (taskToMove.project?.id && taskToMove.project.id !== 'lead-tasks' && taskToMove.project.id !== 'general-tasks') {
              await updateTask(taskToMove.project.id, draggedTaskId, { parent_id: targetTaskId })
            } else {
              await updateGlobalTask(draggedTaskId, { parent_id: targetTaskId })
            }
            toast.success('Task nested successfully')
         } catch(err) {
            setTasks(prev => prev.map(t => t.id === draggedTaskId ? { ...t, parent_id: taskToMove.parent_id } : t))
            toast.error('Failed to nest task')
         }
      }
    }
    setDraggedTaskId(null)
  }

  const calculateProgress = (taskNode) => {
    if (!taskNode.subtasks || taskNode.subtasks.length === 0) {
      return taskNode.status === 'done' ? 100 : 0
    }
    const total = taskNode.subtasks.reduce((sum, child) => sum + calculateProgress(child), 0)
    return Math.round(total / taskNode.subtasks.length)
  }

  const TaskNode = ({ task, level = 0 }) => {
    const hasSubtasks = task.subtasks && task.subtasks.length > 0
    const isExpanded = expandedTaskIds.has(task.id)
    const progress = calculateProgress(task)

    return (
      <div 
        style={{ marginLeft: `${level * 24}px`, transition: 'all 0.2s', border: dragOverTaskId === task.id ? '2px dashed var(--color-primary)' : '2px solid transparent', borderRadius: '8px' }}
        draggable
        onDragStart={(e) => handleDragStart(e, task.id)}
        onDragOver={(e) => handleDragOver(e, task.id)}
        onDragLeave={(e) => { e.stopPropagation(); setDragOverTaskId(null) }}
        onDrop={(e) => handleDrop(e, task.id)}
      >
        <div className={styles.taskRow} style={{ margin: '4px 0', border: '1px solid var(--color-border)', background: 'var(--color-surface)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {hasSubtasks ? (
               <button 
                 onClick={() => toggleTaskExpand(task.id)} 
                 style={{ background: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: '4px', cursor: 'pointer', padding: '2px 6px', fontSize: '10px', color: 'var(--color-text-muted)' }}
               >
                 {isExpanded ? '▼' : '▶'}
               </button>
            ) : <div style={{ width: '24px' }} />}
            
            <input 
              type="checkbox" 
              className={`${styles.taskCheckbox} ${updatingTaskId === task.id ? styles.loading : ''}`}
              checked={task.status === 'done'}
              onChange={() => handleStatusChange(task, task.status === 'done' ? 'todo' : 'done')}
            />
            <select 
              value={task.status || 'todo'} 
              onChange={(e) => handleStatusChange(task, e.target.value)}
              style={{ border: 'none', background: 'transparent', fontSize: '11px', textTransform: 'uppercase', color: `var(--color-${STATUSES[task.status]?.color || 'neutral'})`, fontWeight: '700', cursor: 'pointer', outline: 'none', padding: 0 }}
              disabled={updatingTaskId === task.id}
            >
              {Object.entries(STATUSES).map(([val, {label}]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: '6px' }}>
            <div className={`${styles.taskTitle} ${task.status === 'done' ? styles.done : ''}`} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {highlightText(task.title, debouncedSearchQuery)}
            </div>
            {hasSubtasks && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                <div style={{ width: '100px', height: '6px', background: 'var(--color-border)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: progress === 100 ? 'var(--color-success)' : 'var(--color-primary)', transition: 'width 0.3s' }} />
                </div>
                {progress}% Complete
              </div>
            )}
          </div>
          
          <div className={styles.taskMeta}>
            <Badge variant={PRIORITY_COLORS[task.priority]} style={{textTransform:'capitalize'}}>{task.priority}</Badge>
            {task.milestone && <Badge variant="neutral" style={{background:'var(--color-accent-light)', color:'var(--color-accent)'}}>{highlightText(task.milestone, debouncedSearchQuery)}</Badge>}
            
            {task.checklist && task.checklist.length > 0 && (
              <Badge variant="neutral" style={{color: 'var(--color-text-muted)'}}>
                ☑ {task.checklist.filter(c => c.done || c.status === 'done').length}/{task.checklist.length}
              </Badge>
            )}
            {task.tags?.length > 0 && (
              <div style={{ display: 'flex', gap: '4px' }}>
                {task.tags.slice(0,2).map(tagId => {
                   const tObj = globalTags.find(x => x.id === tagId)
                   if (!tObj) return null
                   return <Badge key={tagId} variant="neutral" style={{ color: tObj.color, borderColor: tObj.color }}>{tObj.name}</Badge>
                })}
                {task.tags.length > 2 && <Badge variant="neutral">+{task.tags.length - 2}</Badge>}
              </div>
            )}

            <span className={`${styles.dueDate} ${isOverdue(task.dueDate) && isPending(task.status) ? styles.overdue : ''} ${isToday(task.dueDate) && isPending(task.status) ? styles.today : ''}`}>
              {formatDate(task.dueDate)}
            </span>
          </div>

          <div className={styles.actions}>
            <Button variant="secondary" size="sm" onClick={() => setSelectedTask(task)}>Open →</Button>
          </div>
        </div>

        {hasSubtasks && isExpanded && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {task.subtasks.map(subtask => (
              <TaskNode key={subtask.id} task={subtask} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h1 className={styles.title}>My Tasks</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Select
                value={currentViewId}
                onChange={val => {
                  if (val === 'manage') {
                    setIsViewManagerOpen(true)
                  } else if (val === 'default') {
                    setCurrentViewId('default')
                  } else {
                    const v = savedViews.find(x => x.id === val)
                    if (v) {
                      setCurrentViewId(v.id)
                      applyViewPayload(v.payload)
                    }
                  }
                }}
                options={[
                  { value: 'default', label: 'Default View' },
                  ...savedViews.map(v => ({ value: v.id, label: v.name })),
                  { value: 'manage', label: '⚙ Manage Views...' }
                ]}
              />
              <Button variant="ghost" size="sm" onClick={handleSaveCurrentView} title="Save current filters as a new view">💾 Save</Button>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '16px', paddingLeft: '16px', borderLeft: '1px solid var(--color-border)' }}>
              <select value={role} onChange={e => setRole(e.target.value)} style={{ padding: '6px', borderRadius: '4px', fontSize: '13px', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="contributor">Contributor</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.viewToggle} style={{ display: 'flex', gap: '4px', background: 'var(--color-background)', padding: '4px', borderRadius: '8px' }}>
              <button className={`${styles.viewBtn} ${viewMode === 'list' ? styles.active : ''}`} onClick={() => setViewMode('list')} title="List View" style={{ padding: '6px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: viewMode === 'list' ? 'var(--color-surface)' : 'transparent' }}>List</button>
              <button className={`${styles.viewBtn} ${viewMode === 'kanban' ? styles.active : ''}`} onClick={() => setViewMode('kanban')} title="Kanban View" style={{ padding: '6px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: viewMode === 'kanban' ? 'var(--color-surface)' : 'transparent' }}>Kanban</button>
              <button className={`${styles.viewBtn} ${viewMode === 'calendar' ? styles.active : ''}`} onClick={() => setViewMode('calendar')} title="Calendar View" style={{ padding: '6px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: viewMode === 'calendar' ? 'var(--color-surface)' : 'transparent' }}>Calendar</button>
            </div>
            <Button variant="outline" onClick={() => setIsTimeReportsOpen(true)}>⏱️ Time Reports</Button>
            <Button variant="outline" onClick={() => setIsAutomationsOpen(true)}>⚡ Automations</Button>
            <Button variant="outline" onClick={() => setIsAiScheduleOpen(true)}>🤖 AI Schedule</Button>
            <Button variant="outline" onClick={() => setIsAiRiskOpen(true)}>⚠️ Risk Analysis</Button>
            <Button variant="outline" onClick={() => setIsAnalyticsOpen(true)}>📊 Analytics</Button>
            <Button variant="outline" onClick={() => setIsGovernanceOpen(true)}>🛡️ Governance</Button>
            <Button variant="outline" onClick={() => setIsTagManagerModalOpen(true)}>Manage Tags</Button>
            <Button variant="outline" onClick={() => setIsTemplateModalOpen(true)}>Templates</Button>
            <Button variant="outline" onClick={() => setIsAiTaskCreationOpen(true)}>✨ AI Task</Button>
            <Button variant="primary" onClick={() => {/* Handle Create Global Task */}}>+ New Task</Button>
          </div>
        </div>
        <div className={styles.date}>{new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' })}</div>
      </div>

      <div className={styles.summaryStrip}>
        <div className={styles.statChip}>
          <Badge variant="danger">Overdue</Badge>
          <span className={styles.statValue}>{stats.overdue}</span>
        </div>
        <div className={styles.statChip}>
          <Badge variant="warning">Due Today</Badge>
          <span className={styles.statValue}>{stats.today}</span>
        </div>
        <div className={styles.statChip}>
          <Badge variant="info">This Week</Badge>
          <span className={styles.statValue}>{stats.week}</span>
        </div>
        <div className={styles.statChip}>
          <Badge variant="success">Done This Week</Badge>
          <span className={styles.statValue}>{stats.doneWeek}</span>
        </div>
      </div>

      <div className={styles.tabs}>
        {TABS.map(tab => (
          <div 
            key={tab.id} 
            className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </div>
        ))}
      </div>

      <div className={styles.filterBar}>
        <div style={{ display: 'flex', gap: '8px', marginRight: 'auto' }}>
          <button onClick={() => setShowDailyAssistant(!showDailyAssistant)} style={{ padding: '8px 12px', background: 'linear-gradient(135deg, #0d3b66, #125491)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>✨</span> Daily Briefing
          </button>
          <button onClick={() => setShowAIModal(true)} style={{ padding: '8px 12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🪄</span> Generate Tasks
          </button>
          <button onClick={() => setShowAIMeetingNotes(true)} style={{ padding: '8px 12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🎙️</span> Meeting Transcript
          </button>
        </div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input 
            ref={searchInputRef}
            type="text"
            placeholder="Search tasks... (Cmd+K)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
            style={{ 
              padding: '8px 12px', paddingLeft: '32px',
              border: '1px solid var(--color-border)', borderRadius: '6px', 
              background: 'var(--color-surface)', color: 'var(--color-text)',
              width: '250px', outline: 'none', fontSize: '14px'
            }}
          />
          <span style={{ position: 'absolute', left: '10px', color: 'var(--color-text-muted)' }}>🔍</span>
          
          {isSearchFocused && recentSearches.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10
            }}>
              <div style={{ padding: '8px', fontSize: '12px', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>Recent Searches</div>
              {recentSearches.map((s, i) => (
                <div 
                  key={i} 
                  style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '14px', color: 'var(--color-text)' }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setSearchQuery(s);
                    setIsSearchFocused(false);
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'var(--color-background)'}
                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                >
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>
        <Select 
          options={[{value:'all', label:'All Statuses'}, ...Object.entries(STATUSES).map(([val, {label}]) => ({value:val, label}))]} 
          value={statusFilter} 
          onChange={setStatusFilter} 
        />
        <Select 
          options={[{value:'all', label:'All Priorities'}, {value:'low', label:'Low'}, {value:'medium', label:'Medium'}, {value:'high', label:'High'}, {value:'urgent', label:'Urgent'}]} 
          value={priorityFilter} 
          onChange={setPriorityFilter} 
        />
        <Select 
          options={projectsOptions} 
          value={projectFilter} 
          onChange={setProjectFilter} 
        />
        <Select 
          options={[{value:'all', label:'All Tags'}, ...globalTags.map(t => ({value:t.id, label:t.name}))]} 
          value={tagFilter} 
          onChange={setTagFilter} 
        />
        <Select 
          options={[
            {value:'due_asc', label:'Sort: Due Date (Asc)'},
            {value:'due_desc', label:'Sort: Due Date (Desc)'},
            {value:'priority', label:'Sort: Priority'}
          ]} 
          value={sortBy} 
          onChange={setSortBy} 
        />
      </div>

      {/* AI Daily Assistant */}
      {showDailyAssistant && (
        <div style={{ margin: '0 0 24px 0', padding: '24px', background: 'linear-gradient(135deg, #0d3b66, #125491)', borderRadius: 'var(--radius-lg)', color: '#fff', boxShadow: 'var(--shadow-sm)', position: 'relative', overflow: 'hidden' }}>
           <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '250px', height: '250px', background: '#ffffff', borderRadius: '50%', opacity: 0.1 }}></div>
           
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
              <div style={{ width: '100%' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                    <span style={{ fontSize: '1.8rem' }}>⛅</span>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '600', color: '#fff' }}>Good Morning! Here is your AI Briefing.</h2>
                 </div>
                 
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', marginBottom: '24px' }}>
                    {/* Workload */}
                    <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '16px', borderRadius: '8px' }}>
                       <div style={{ fontSize: '0.8rem', color: '#cbd5e1', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '8px' }}>Today's Workload</div>
                       <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff' }}>
                          {tasks.filter(t => t.dueDate && t.dueDate.startsWith(new Date().toISOString().split('T')[0]) && isPending(t.status)).length} 
                          <span style={{ fontSize: '1rem', fontWeight: 'normal', color: '#cbd5e1', marginLeft: '4px' }}>tasks</span>
                       </div>
                       <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '4px' }}>
                          ~ 0h 0m estimated
                       </div>
                    </div>
                    
                    {/* Overdue & Risks */}
                    <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #f44336' }}>
                       <div style={{ fontSize: '0.8rem', color: '#ffcdd2', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '8px' }}>Overdue & Risks</div>
                       <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ffcdd2' }}>
                          {tasks.filter(t => t.dueDate && t.dueDate < new Date().toISOString().split('T')[0] && isPending(t.status)).length} 
                          <span style={{ fontSize: '1rem', fontWeight: 'normal', color: '#ffcdd2', marginLeft: '4px' }}>overdue</span>
                       </div>
                       <div style={{ fontSize: '0.85rem', color: '#ffb74d', marginTop: '4px' }}>
                          ⚠️ 2 High priority tasks lack estimates
                       </div>
                    </div>

                    {/* Insights */}
                    <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '16px', borderRadius: '8px' }}>
                       <div style={{ fontSize: '0.8rem', color: '#cbd5e1', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '8px' }}>Productivity Insights</div>
                       <div style={{ fontSize: '0.9rem', lineHeight: '1.4', color: '#fff' }}>
                          You completed <strong>5 tasks</strong> yesterday. Your peak productivity is typically between <strong>10:00 AM and 11:30 AM</strong> based on your historical tracker data.
                       </div>
                    </div>
                 </div>
                 
                 {/* Execution Order */}
                 <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
                    <div style={{ fontSize: '0.85rem', color: '#cbd5e1', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '12px' }}>Suggested Execution Order & Next Actions</div>
                    <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.95rem', color: '#fff' }}>
                       {[...tasks].filter(t => isPending(t.status)).sort((a,b) => (a.priority==='urgent'?-1:1)).slice(0,3).map((t, idx) => (
                          <li key={t.id}>
                             <strong>{idx+1}.</strong> {t.title} 
                             <span style={{ fontSize: '0.7rem', background: '#ff9800', padding: '2px 6px', borderRadius: '4px', color: '#fff', marginLeft: '8px', textTransform: 'uppercase', fontWeight: 'bold' }}>{t.priority}</span>
                          </li>
                       ))}
                       {[...tasks].filter(t => isPending(t.status)).length === 0 && <li style={{color: '#cbd5e1'}}>No critical tasks pending! Have a great day.</li>}
                    </ul>
                 </div>
                 
                 <div style={{ display: 'flex', gap: '12px' }}>
                    <button style={{ padding: '10px 20px', background: '#4caf50', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                       ▶ Start First Task
                    </button>
                    <button onClick={() => setShowDailyAssistant(false)} style={{ padding: '10px 20px', background: 'rgba(255, 255, 255, 0.1)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                       Re-balance Schedule
                    </button>
                 </div>
              </div>
            </div>
        </div>
      )}

      <div className={styles.taskList}>
        {loading ? (
            <ContentLoader type="list" rows={5} />
        ) : viewMode === 'kanban' ? (
          <TaskKanbanBoard tasks={filteredTasks} onTaskClick={setSelectedTask} onTaskDrop={handleKanbanDrop} onTaskUpdate={handleKanbanUpdate} />
        ) : viewMode === 'calendar' ? (
          <TaskCalendarBoard tasks={filteredTasks} onTaskClick={setSelectedTask} onTaskUpdate={handleKanbanUpdate} />
        ) : groupedTasks.length === 0 ? (
          <div style={{ padding: '40px 0' }}>
            <EmptyState 
              icon={<span style={{fontSize: 32}}>{emptyState.icon}</span>}
              title={emptyState.text}
            />
          </div>
        ) : (
          groupedTasks.map(group => (
            <div key={group.project.id} className={styles.projectGroup}>
              <div className={styles.projectHeader} onClick={() => toggleProjectGroup(group.project.id)}>
                <span className={styles.projectIcon}>◈</span>
                <span className={styles.projectName}>{group.project.name}</span>
                <Badge variant="neutral">{group.tasks.length}</Badge>
                <span className={`${styles.chevron} ${collapsedProjects.has(group.project.id) ? styles.collapsed : ''}`}>▼</span>
              </div>
              
              {!collapsedProjects.has(group.project.id) && group.tasks.map(task => (
                <TaskNode key={task.id} task={task} />
              ))}
            </div>
          ))
        )}
      </div>

      {selectedTask && (
        <TaskDetail
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          taskId={selectedTask}
          projectId={tasks.find(t => t.id === selectedTask)?.project_id}
        />
      )}

      {isTemplateModalOpen && (
        <TemplateGalleryModal
          isOpen={isTemplateModalOpen}
          onClose={() => setIsTemplateModalOpen(false)}
          onUseTemplate={async (template) => {
            try {
              // Extract template payload and post it
              const payload = {
                title: template.title,
                description: template.description,
                priority: template.priority,
                checklist: template.checklist?.map(c => ({ ...c, id: Date.now().toString() + Math.random(), done: false })) || []
              }
              await createGlobalTask(payload)
              toast.success(`Task created from template: ${template.name}`)
              setIsTemplateModalOpen(false)
              loadTasks()
            } catch (e) {
              toast.error('Failed to create task from template')
            }
          }}
        />
      )}

      {isTagManagerModalOpen && (
        <TagManagerModal 
          isOpen={isTagManagerModalOpen}
          onClose={() => {
            setIsTagManagerModalOpen(false)
            // reload tasks to get updated tags if merged/deleted
            getGlobalTasks({ assigneeId: 'me', limit: 100 }).then(res => {
              const _r = res.data?.data || res.data; const raw = Array.isArray(_r) ? _r : [];
              setTasks(raw.map(t => ({...t, project: t.project || {id:'gen',name:'Gen'}}))) 
            }).catch(()=>{})
          }}
        />
      )}

      {isViewManagerOpen && (
        <ViewManagerModal
          isOpen={isViewManagerOpen}
          onClose={() => {
            setIsViewManagerOpen(false)
            getTaskViews().then(r => setSavedViews(r.data?.data || r.data || [])).catch(()=>{})
          }}
        />
      )}

      {isTimeReportsOpen && (
        <TimeReportsModal
          isOpen={isTimeReportsOpen}
          onClose={() => setIsTimeReportsOpen(false)}
        />
      )}

      {isAutomationsOpen && (
        <TaskAutomationsModal
          isOpen={isAutomationsOpen}
          onClose={() => setIsAutomationsOpen(false)}
        />
      )}

      {isAiScheduleOpen && (
        <AiScheduleAssistantModal
          isOpen={isAiScheduleOpen}
          onClose={() => setIsAiScheduleOpen(false)}
        />
      )}

      {isAiRiskOpen && (
        <AiRiskAnalysisModal
          isOpen={isAiRiskOpen}
          onClose={() => setIsAiRiskOpen(false)}
        />
      )}

      {isAiTaskCreationOpen && (
        <AiTaskCreationModal
          isOpen={isAiTaskCreationOpen}
          onClose={() => setIsAiTaskCreationOpen(false)}
        />
      )}

      {isAnalyticsOpen && (
        <TaskAnalyticsModal
          isOpen={isAnalyticsOpen}
          onClose={() => setIsAnalyticsOpen(false)}
        />
      )}

      {isGovernanceOpen && (
        <TaskGovernanceModal
          isOpen={isGovernanceOpen}
          onClose={() => setIsGovernanceOpen(false)}
        />
      )}

      <GlobalTimeTracker />
    </div>
  )
}
