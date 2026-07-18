/* eslint-disable no-unused-vars, no-empty, react-hooks/exhaustive-deps */
import { useState, useEffect, useMemo, useRef } from 'react'
import styles from './MyTasksPage.module.css'
import h from './MyTasksPageHelpers.module.css'
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
import GlobalTaskFormModal from '../../components/tasks/GlobalTaskFormModal'
import TaskAnalyticsModal from '../../components/tasks/TaskAnalyticsModal'
import TaskGovernanceModal from '../../components/tasks/TaskGovernanceModal'
import { usePageTitle } from '../../hooks/usePageTitle';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { useToast } from '../../store/toastContext'
import { useTaskAutomation } from '../../store/TaskAutomationContext'
import { useGovernance } from '../../store/TaskGovernanceContext'
import { getGlobalTasks, updateTask, updateGlobalTask, getTags, getTaskViews, createTaskView, createGlobalTask } from '../../api/tasks'

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
  const [isGlobalTaskModalOpen, setIsGlobalTaskModalOpen] = useState(false)
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
        let normalized = raw.map(t => ({
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

        // Inject Mock Data if no tasks exist (Dev only)
        if (normalized.length === 0 && import.meta.env.DEV) {
          const today = new Date();
          const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
          const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
          const nextWeek = new Date(today); nextWeek.setDate(nextWeek.getDate() + 5);
          
          normalized = [
            {
              id: 'mock-1',
              title: 'Review interior design blueprints for Smith Villa',
              description: 'Check the master bedroom lighting layout and ensure electrical points align with the new false ceiling design.',
              customerName: 'John Smith',
              assigneeName: 'Pavan Kalyan',
              tags: [{id: 't1', name: 'Design'}, {id: 't2', name: 'Urgent'}],
              status: 'in_progress',
              priority: 'high',
              dueDate: today.toISOString().split('T')[0],
              estimatedTime: 120,
              actualTime: 45,
              project: { id: 'p1', name: 'Smith Villa Renovation' },
              checklist: [
                { id: 'c1', title: 'Verify lighting points', done: true },
                { id: 'c2', title: 'Check HVAC duct routing', done: false }
              ]
            },
            {
              id: 'mock-2',
              title: 'Procure Italian marble for living room',
              description: 'Vendor needs confirmation by EOD. Call the supplier in Mumbai to confirm shipping timeline.',
              customerName: 'Sarah Jenkins',
              assigneeName: 'Pavan Kalyan',
              tags: [{id: 't3', name: 'Procurement'}],
              status: 'todo',
              priority: 'urgent',
              dueDate: yesterday.toISOString().split('T')[0],
              estimatedTime: 30,
              actualTime: 0,
              project: { id: 'p2', name: 'Jenkins Penthouse' },
              checklist: []
            },
            {
              id: 'mock-3',
              title: 'Site inspection & plumbing quality check',
              description: 'Walkthrough with the plumbing contractor to ensure no leakages before tiling begins.',
              customerName: 'Robert Fox',
              assigneeName: 'Pavan Kalyan',
              tags: [{id: 't4', name: 'Site Visit'}],
              status: 'waiting',
              priority: 'medium',
              dueDate: tomorrow.toISOString().split('T')[0],
              estimatedTime: 180,
              actualTime: 0,
              project: { id: 'p3', name: 'Fox Office Setup' },
              checklist: [
                { id: 'c3', title: 'Master bathroom pressure test', done: false },
                { id: 'c4', title: 'Kitchen sink drainage', done: false }
              ]
            },
            {
              id: 'mock-4',
              title: 'Finalize modular kitchen 3D renders',
              description: 'Client requested changes to the cabinet finishes (wants matte instead of gloss).',
              customerName: 'Emma Watson',
              assigneeName: 'Pavan Kalyan',
              tags: [{id: 't1', name: 'Design'}],
              status: 'review',
              priority: 'high',
              dueDate: nextWeek.toISOString().split('T')[0],
              estimatedTime: 240,
              actualTime: 200,
              project: { id: 'p4', name: 'Watson Kitchen Remodel' },
              checklist: []
            },
            {
              id: 'mock-5',
              title: 'Sign vendor contract for electrical fittings',
              description: 'Contract is drafted, just need to review the penalty clauses before signing.',
              assigneeName: 'Pavan Kalyan',
              tags: [{id: 't5', name: 'Admin'}],
              status: 'done',
              priority: 'low',
              dueDate: yesterday.toISOString().split('T')[0],
              estimatedTime: 60,
              actualTime: 60,
              project: { id: 'general-tasks', name: 'General Tasks' },
              checklist: []
            }
          ];
        }

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

  const handleKanbanDrop = (taskId, newStatus) => {
    const task = tasks.find(t => t.id === taskId)
    if (task) handleStatusChange(task, newStatus)
  }

  const handleKanbanUpdate = async (taskId, updates) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t))
    try {
      if (task.project?.id && task.project.id !== 'lead-tasks' && task.project.id !== 'general-tasks') {
        await updateTask(task.project.id, taskId, updates)
      } else {
        await updateGlobalTask(taskId, updates)
      }
      runAutomations('task_updated', { ...task, ...updates }, task)
    } catch (err) {
      console.error('Failed to update task:', err)
      toast.error(err?.response?.data?.error?.message || 'Failed to update task')
      setTasks(prev => prev.map(t => t.id === taskId ? task : t))
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
    if (!d) return false;
    const date = new Date(d.includes('T') ? d : d + 'T00:00:00')
    const today = new Date()
    return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()
  }
  const isOverdue = (d) => {
    if (!d) return false;
    const date = new Date(d.includes('T') ? d : d + 'T00:00:00'); date.setHours(0,0,0,0)
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
        className={`${h.taskNodeWrapper} ${dragOverTaskId === task.id ? h.taskNodeDragOver : ''} ${draggedTaskId === task.id ? h.taskNodeDragged : ''}`}
        style={{ marginLeft: `${level * 24}px` }}
        draggable
        onDragStart={(e) => handleDragStart(e, task.id)}
        onDragOver={(e) => handleDragOver(e, task.id)}
        onDragLeave={(e) => { e.stopPropagation(); setDragOverTaskId(null) }}
        onDrop={(e) => handleDrop(e, task.id)}
      >
        <div className={`${styles.taskRow} ${h.taskItemCard}`}>
          <div className={`${h.flexCenter} ${h.gap2}`}>
            {hasSubtasks ? (
               <button 
                 onClick={() => toggleTaskExpand(task.id)} 
                 className={h.expandBtn}
               >
                 {isExpanded ? '▼' : '▶'}
               </button>
            ) : <div className={h.expandPlaceholder} />}
            
            <input 
              type="checkbox" 
              className={`${styles.taskCheckbox} ${updatingTaskId === task.id ? styles.loading : ''}`}
              checked={task.status === 'done'}
              onChange={() => handleStatusChange(task, task.status === 'done' ? 'todo' : 'done')}
            />
            <select 
              value={task.status || 'todo'} 
              onChange={(e) => handleStatusChange(task, e.target.value)}
              className={h.statusSelect}
              style={{ color: `var(--color-${STATUSES[task.status]?.color || 'neutral'})` }}
              disabled={updatingTaskId === task.id}
            >
              {Object.entries(STATUSES).map(([val, {label}]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          
          <div className={h.taskContentCol}>
            <div className={`${styles.taskTitle} ${h.taskTitleText} ${task.status === 'done' ? styles.done : ''}`}>
              {highlightText(task.title, debouncedSearchQuery)}
            </div>
            {hasSubtasks && (
              <div className={h.progressBarContainer}>
                <div className={h.progressBarTrack}>
                  <div className={`${h.progressBarFill} ${progress === 100 ? h.progressBarFillSuccess : h.progressBarFillPrimary}`} style={{ width: `${progress}%` }} />
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
              <div className={h.tagList}>
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
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>My Tasks</h1>
          <p className={styles.subtitle}>{new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' })}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button variant="outline" onClick={() => setIsTimeReportsOpen(true)}>⏱️ Time Reports</Button>
          <Button variant="outline" onClick={() => setIsAiTaskCreationOpen(true)}>✨ AI Task</Button>
          <select 
            className={styles.filterSelect}
            onChange={(e) => {
               const val = e.target.value;
               if(val === 'automations') setIsAutomationsOpen(true);
               if(val === 'aiSchedule') setIsAiScheduleOpen(true);
               if(val === 'risk') setIsAiRiskOpen(true);
               if(val === 'analytics') setIsAnalyticsOpen(true);
               if(val === 'governance') setIsGovernanceOpen(true);
               if(val === 'tags') setIsTagManagerModalOpen(true);
               if(val === 'templates') setIsTemplateModalOpen(true);
               e.target.value = '';
            }}
            value=""
            style={{ minWidth: '160px' }}
          >
            <option value="" disabled>⚙️ More Actions...</option>
            <option value="automations">⚡ Automations</option>
            <option value="aiSchedule">🤖 AI Schedule</option>
            <option value="risk">⚠️ Risk Analysis</option>
            <option value="analytics">📊 Analytics</option>
            <option value="governance">🛡️ Governance</option>
            <option value="tags">🏷️ Manage Tags</option>
            <option value="templates">📑 Templates</option>
          </select>
          <select value={role} onChange={e => setRole(e.target.value)} className={styles.filterSelect} style={{ minWidth: '140px' }}>
            <option value="admin">Role: Admin</option>
            <option value="manager">Role: Manager</option>
            <option value="contributor">Role: Contributor</option>
            <option value="viewer">Role: Viewer</option>
          </select>
          <Button variant="primary" onClick={() => setIsGlobalTaskModalOpen(true)}>+ New Task</Button>
        </div>

      </div>

      {/* Stats Ribbon */}
      <div className={styles.statsRibbon}>
        <button className={`${styles.statChip} ${activeTab === 'overdue' ? styles.statChipActive : ''}`}
          onClick={() => setActiveTab('overdue')}
          style={{ borderColor: activeTab === 'overdue' ? 'var(--color-danger)' : 'var(--color-border)', background: activeTab === 'overdue' ? 'var(--color-danger-bg)' : 'var(--color-surface)' }}
        >
          <span className={styles.statDot} style={{ background: 'var(--color-danger)' }} />
          <span style={{ color: 'var(--color-danger)', fontVariantNumeric: 'tabular-nums' }}>{stats.overdue}</span>
          <span style={{ color: activeTab === 'overdue' ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>Overdue</span>
        </button>
        <button className={`${styles.statChip} ${activeTab === 'today' ? styles.statChipActive : ''}`}
          onClick={() => setActiveTab('today')}
          style={{ borderColor: activeTab === 'today' ? 'var(--color-warning)' : 'var(--color-border)', background: activeTab === 'today' ? 'var(--color-warning-bg)' : 'var(--color-surface)' }}
        >
          <span className={styles.statDot} style={{ background: 'var(--color-warning)' }} />
          <span style={{ color: 'var(--color-warning)', fontVariantNumeric: 'tabular-nums' }}>{stats.today}</span>
          <span style={{ color: activeTab === 'today' ? 'var(--color-warning)' : 'var(--color-text-secondary)' }}>Due Today</span>
        </button>
        <button className={`${styles.statChip} ${activeTab === 'week' ? styles.statChipActive : ''}`}
          onClick={() => setActiveTab('week')}
          style={{ borderColor: activeTab === 'week' ? 'var(--color-info)' : 'var(--color-border)', background: activeTab === 'week' ? 'var(--color-info-bg)' : 'var(--color-surface)' }}
        >
          <span className={styles.statDot} style={{ background: 'var(--color-info)' }} />
          <span style={{ color: 'var(--color-info)', fontVariantNumeric: 'tabular-nums' }}>{stats.week}</span>
          <span style={{ color: activeTab === 'week' ? 'var(--color-info)' : 'var(--color-text-secondary)' }}>This Week</span>
        </button>
        <button className={`${styles.statChip} ${activeTab === 'all' ? styles.statChipActive : ''}`}
          onClick={() => setActiveTab('all')}
          style={{ borderColor: activeTab === 'all' ? 'var(--color-text)' : 'var(--color-border)' }}
        >
          <span className={styles.statDot} style={{ background: 'var(--color-text)' }} />
          <span style={{ color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>{tasks.length}</span>
          <span style={{ color: activeTab === 'all' ? 'var(--color-text)' : 'var(--color-text-secondary)' }}>All Tasks</span>
        </button>
        
        {/* View selection within stats ribbon */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
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
            <Button variant="ghost" size="sm" onClick={handleSaveCurrentView} title="Save current filters as a new view">💾 Save View</Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 20 20" fill="none">
            <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M14 14l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            ref={searchInputRef}
            className={styles.searchInput}
            placeholder="Search tasks... (Cmd+K)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
          />
          {isSearchFocused && recentSearches.length > 0 && (
            <div className={h.recentSearches}>
              <div className={h.recentSearchesHeader}>Recent Searches</div>
              {recentSearches.map((s, i) => (
                <div 
                  key={i} 
                  className={h.recentSearchItem}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setSearchQuery(s);
                    setIsSearchFocused(false);
                  }}
                >
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>

        <select 
          className={styles.filterSelect}
          value={statusFilter} 
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          {Object.entries(STATUSES).map(([val, {label}]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>

        <select 
          className={styles.filterSelect}
          value={priorityFilter} 
          onChange={(e) => setPriorityFilter(e.target.value)}
        >
          <option value="all">All Priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>

        <select 
          className={styles.filterSelect}
          value={projectFilter} 
          onChange={(e) => setProjectFilter(e.target.value)}
        >
          <option value="all">All Projects</option>
          {projectsOptions.filter(o => o.value !== 'all').map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        
        <select 
          className={styles.filterSelect}
          value={tagFilter} 
          onChange={(e) => setTagFilter(e.target.value)}
        >
          <option value="all">All Tags</option>
          {globalTags.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        
        <select 
          className={styles.filterSelect}
          value={sortBy} 
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="due_asc">Sort: Due Date (Asc)</option>
          <option value="due_desc">Sort: Due Date (Desc)</option>
          <option value="priority">Sort: Priority</option>
        </select>

        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewBtn} ${viewMode === 'list' ? styles.viewBtnActive : ''}`}
            onClick={() => setViewMode('list')}
            title="List View"
          >
            &#9776; List
          </button>
          <button
            className={`${styles.viewBtn} ${viewMode === 'kanban' ? styles.viewBtnActive : ''}`}
            onClick={() => setViewMode('kanban')}
            title="Kanban View"
          >
            &#9638; Kanban
          </button>
          <button
            className={`${styles.viewBtn} ${viewMode === 'calendar' ? styles.viewBtnActive : ''}`}
            onClick={() => setViewMode('calendar')}
            title="Calendar View"
          >
            &#128197; Calendar
          </button>
        </div>
      </div>
      {/* AI Daily Assistant */}
      {showDailyAssistant && (
        <div className={styles.aiAssistantPanel}>
           <div className={styles.aiDecal}></div>
           
           <div className={styles.aiContent}>
              <div className={styles.aiMain}>
                 <div className={styles.aiHeaderRow}>
                    <span className={h.aiHeaderIcon}>⛅</span>
                    <h2 className={styles.aiTitle}>Good Morning! Here is your AI Briefing.</h2>
                 </div>
                 
                 <div className={styles.aiGrid}>
                    {/* Workload */}
                    <div className={styles.aiCard}>
                       <div className={styles.aiCardLabel}>Today's Workload</div>
                       <div className={styles.aiCardValue}>
                          {tasks.filter(t => t.dueDate && t.dueDate.startsWith(new Date().toISOString().split('T')[0]) && isPending(t.status)).length} 
                          <span className={styles.aiCardUnit}>tasks</span>
                       </div>
                       <div className={styles.aiCardSubtext}>
                          ~ 0h 0m estimated
                       </div>
                    </div>
                    
                    {/* Overdue & Risks */}
                    <div className={`${styles.aiCard} ${styles.aiCardDanger}`}>
                       <div className={`${styles.aiCardLabel} ${styles.aiCardLabelDanger}`}>Overdue & Risks</div>
                       <div className={`${styles.aiCardValue} ${styles.aiCardValueDanger}`}>
                          {tasks.filter(t => t.dueDate && t.dueDate < new Date().toISOString().split('T')[0] && isPending(t.status)).length} 
                          <span className={`${styles.aiCardUnit} ${h.textDanger}`}>overdue</span>
                       </div>
                       <div className={`${styles.aiCardSubtext} ${styles.aiCardSubtextDanger}`}>
                          ⚠️ 2 High priority tasks lack estimates
                       </div>
                    </div>

                    {/* Insights */}
                    <div className={styles.aiCard}>
                       <div className={styles.aiCardLabel}>Productivity Insights</div>
                       <div className={styles.aiInsightText}>
                          You completed <strong>5 tasks</strong> yesterday. Your peak productivity is typically between <strong>10:00 AM and 11:30 AM</strong> based on your historical tracker data.
                       </div>
                    </div>
                 </div>
                 
                 {/* Execution Order */}
                 <div className={styles.aiExecOrder}>
                    <div className={styles.aiExecTitle}>Suggested Execution Order & Next Actions</div>
                    <ul className={styles.aiExecList}>
                       {[...tasks].filter(t => isPending(t.status)).sort((a,b) => (a.priority==='urgent'?-1:1)).slice(0,3).map((t, idx) => (
                          <li key={t.id}>
                             <strong>{idx+1}.</strong> {t.title} 
                             <span className={styles.aiExecItemPriority}>{t.priority}</span>
                          </li>
                       ))}
                       {[...tasks].filter(t => isPending(t.status)).length === 0 && <li className={h.textSecondary}>No critical tasks pending! Have a great day.</li>}
                    </ul>
                 </div>
                 
                 <div className={styles.aiActions}>
                    <button className={styles.aiBtnPrimary}>
                       ▶ Start First Task
                    </button>
                    <button onClick={() => setShowDailyAssistant(false)} className={styles.aiBtnSecondary}>
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
          <div className={h.emptyStateContainer}>
            <EmptyState 
              icon={<span className={h.emptyStateIcon}>{emptyState.icon}</span>}
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
          taskId={typeof selectedTask === 'object' ? selectedTask.id : selectedTask}
          projectId={typeof selectedTask === 'object' ? selectedTask.project?.id : tasks.find(t => t.id === selectedTask)?.project?.id}
          initialTask={typeof selectedTask === 'object' ? selectedTask : tasks.find(t => t.id === selectedTask)}
          inline={true}
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

      <GlobalTaskFormModal 
        isOpen={isGlobalTaskModalOpen}
        onClose={() => setIsGlobalTaskModalOpen(false)}
        onSuccess={loadTasks}
      />


    </div>
  )
}
