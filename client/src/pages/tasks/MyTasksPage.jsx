import { useState, useEffect, useMemo } from 'react'
import styles from './MyTasksPage.module.css'
import { Badge, Select, Button, ContentLoader, EmptyState } from '../../components/ui'
import TaskDetail from '../../components/tasks/TaskDetail'
import { usePageTitle } from '../../hooks/usePageTitle';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { useToast } from '../../store/toastContext'
import { getGlobalTasks, updateTask, updateGlobalTask } from '../../api/tasks'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Due Today' },
  { id: 'week', label: 'This Week' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'completed', label: 'Completed' }
]

const PRIORITY_COLORS = { low: 'info', medium: 'warning', high: 'danger', urgent: 'danger' }

export default function MyTasksPage() {
  usePageTitle('My Tasks')
  useBreadcrumbs([{ label: 'My Tasks' }])
  const toast = useToast()

  const [activeTab, setActiveTab] = useState('all')
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [updatingTaskId, setUpdatingTaskId] = useState(null)
  
  const [selectedTask, setSelectedTask] = useState(null)
  const [collapsedProjects, setCollapsedProjects] = useState(new Set())

  // Filters
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [projectFilter, setProjectFilter] = useState('all')
  const [sortBy, setSortBy] = useState('due_asc')
  
  // AI Feature States
  const [showDailyAssistant, setShowDailyAssistant] = useState(false)
  const [showAIModal, setShowAIModal] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiGeneratedTasks, setAiGeneratedTasks] = useState(null)
  const [showAIMeetingNotes, setShowAIMeetingNotes] = useState(false)
  const [meetingTranscript, setMeetingTranscript] = useState('')
  const [extractedTasks, setExtractedTasks] = useState(null)

  useEffect(() => {
    setLoading(true)
    getGlobalTasks({ assigneeId: 'me', limit: 100 })
      .then(res => {
        const _r = res.data?.data || res.data; const raw = Array.isArray(_r) ? _r : [];
        const normalized = raw.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority || 'medium',
          dueDate: t.due_date || t.dueDate || null,
          project: { 
            id: t.project_id || (t.lead_id ? 'lead-tasks' : 'general-tasks'), 
            name: t.project_name || (t.lead_id ? 'Lead Tasks' : 'General Tasks') 
          },
          milestone: t.milestone_name || null,
        }))
        setTasks(normalized)
      })
      .catch(() => setTasks([]))
      .finally(() => setLoading(false))
  }, [])

  const toggleTaskStatus = async (task) => {
    setUpdatingTaskId(task.id)
    const newStatus = task.status === 'done' ? 'todo' : 'done'
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
    try {
      if (task.project?.id && task.project.id !== 'lead-tasks' && task.project.id !== 'general-tasks') {
        await updateTask(task.project.id, task.id, { status: newStatus })
      } else {
        await updateGlobalTask(task.id, { status: newStatus })
      }
      toast.success(newStatus === 'done' ? 'Task completed!' : 'Task reopened')
    } catch (err) {
      console.error('Failed to update task:', err)
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t))
      toast.error(err?.response?.data?.error?.message || 'Failed to update task')
    } finally {
      setUpdatingTaskId(null)
    }
  }

  const toggleProjectGroup = (projectId) => {
    const next = new Set(collapsedProjects)
    if (next.has(projectId)) next.delete(projectId)
    else next.add(projectId)
    setCollapsedProjects(next)
  }

  // Derived state
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
    let filtered = tasks.filter(t => {
      // Tab filter
      if (activeTab === 'completed' && t.status !== 'done') return false
      if (activeTab !== 'all' && activeTab !== 'completed' && t.status === 'done') return false // Show done tasks in completed or all tabs
      if (activeTab === 'today' && (!isToday(t.dueDate) || t.status === 'done')) return false
      if (activeTab === 'overdue' && (!isOverdue(t.dueDate) || t.status === 'done')) return false
      // For 'week', only show tasks due within the current week
      if (activeTab === 'week') {
        if (!t.dueDate) return false
        const date = new Date(t.dueDate)
        const today = new Date()
        const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()))
        const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6))
        if (date < startOfWeek || date > endOfWeek || t.status === 'done') return false
      }
      // Bar filters
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
      if (projectFilter !== 'all' && t.project.id !== projectFilter) return false
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
  }, [tasks, activeTab, priorityFilter, projectFilter, sortBy])

  // Group by project
  const groupedTasks = useMemo(() => {
    const groups = {}
    filteredTasks.forEach(t => {
      if (!groups[t.project.id]) groups[t.project.id] = { project: t.project, tasks: [] }
      groups[t.project.id].tasks.push(t)
    })
    return Object.values(groups)
  }, [filteredTasks])

  const stats = useMemo(() => {
    return {
      overdue: tasks.filter(t => isOverdue(t.dueDate) && t.status !== 'done').length,
      today: tasks.filter(t => isToday(t.dueDate) && t.status !== 'done').length,
      week: tasks.filter(t => {
        if (t.status === 'done' || !t.dueDate) return false
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
    if (activeTab === 'today') return { icon: '🎉', text: "Nothing due today. You're ahead of schedule!" }
    if (activeTab === 'overdue') return { icon: '✓', text: 'No overdue tasks. Great work!' }
    return { icon: '◻', text: 'No tasks assigned to you yet.' }
  }
  const emptyState = getEmptyState()

  const formatDate = (d) => {
    if (isToday(d)) return 'Today'
    return new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short' })
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>My Tasks</h1>
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
                          {tasks.filter(t => t.dueDate && t.dueDate.startsWith(new Date().toISOString().split('T')[0]) && t.status !== 'completed').length} 
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
                          {tasks.filter(t => t.dueDate && t.dueDate < new Date().toISOString().split('T')[0] && t.status !== 'completed').length} 
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
                       {[...tasks].filter(t => t.status !== 'completed').sort((a,b) => (a.priority==='urgent'?-1:1)).slice(0,3).map((t, idx) => (
                          <li key={t.id}>
                             <strong>{idx+1}.</strong> {t.title} 
                             <span style={{ fontSize: '0.7rem', background: '#ff9800', padding: '2px 6px', borderRadius: '4px', color: '#fff', marginLeft: '8px', textTransform: 'uppercase', fontWeight: 'bold' }}>{t.priority}</span>
                          </li>
                       ))}
                       {[...tasks].filter(t => t.status !== 'completed').length === 0 && <li style={{color: '#cbd5e1'}}>No critical tasks pending! Have a great day.</li>}
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
                <div key={task.id} className={styles.taskRow}>
                  <input 
                    type="checkbox" 
                    className={`${styles.taskCheckbox} ${updatingTaskId === task.id ? styles.loading : ''}`}
                    checked={task.status === 'done'}
                    onChange={() => toggleTaskStatus(task)}
                  />
                  <div className={`${styles.taskTitle} ${task.status === 'done' ? styles.done : ''}`}>
                    {task.title}
                  </div>
                  
                  <div className={styles.taskMeta}>
                    <Badge variant={PRIORITY_COLORS[task.priority]} style={{textTransform:'capitalize'}}>{task.priority}</Badge>
                    {task.milestone && <Badge variant="neutral" style={{background:'var(--color-accent-light)', color:'var(--color-accent)'}}>{task.milestone}</Badge>}
                    
                    <span className={`${styles.dueDate} ${isOverdue(task.dueDate) && task.status !== 'done' ? styles.overdue : ''} ${isToday(task.dueDate) && task.status !== 'done' ? styles.today : ''}`}>
                      {formatDate(task.dueDate)}
                    </span>
                  </div>

                  <div className={styles.actions}>
                    <Button variant="secondary" size="sm" onClick={() => setSelectedTask(task)}>Open →</Button>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <TaskDetail 
        isOpen={!!selectedTask} 
        onClose={() => setSelectedTask(null)} 
        taskId={selectedTask?.id} 
        projectId={selectedTask?.project?.id}
      />
    </div>
  )
}
