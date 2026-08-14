/* eslint-disable no-unused-vars, no-empty, react-hooks/exhaustive-deps */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Badge, Button, ContentLoader, EmptyState } from '../ui';
import TaskDetail from '../tasks/TaskDetail';
import TaskKanbanBoard from '../tasks/TaskKanbanBoard';
import TaskCalendarBoard from '../tasks/TaskCalendarBoard';
import TemplateGalleryModal from '../tasks/TemplateGalleryModal';
import TagManagerModal from '../tasks/TagManagerModal';
import ViewManagerModal from '../tasks/ViewManagerModal';
import GlobalTimeTracker from '../tasks/GlobalTimeTracker';
import TimeReportsModal from '../tasks/TimeReportsModal';
import TaskAutomationsModal from '../tasks/TaskAutomationsModal';
import AiScheduleAssistantModal from '../tasks/AiScheduleAssistantModal';
import AiRiskAnalysisModal from '../tasks/AiRiskAnalysisModal';
import AiTaskCreationModal from '../tasks/AiTaskCreationModal';
import GlobalTaskFormModal from '../tasks/GlobalTaskFormModal';
import TaskAnalyticsModal from '../tasks/TaskAnalyticsModal';
import TaskGovernanceModal from '../tasks/TaskGovernanceModal';
import { useToast } from '../../store/toastContext';
import { useTaskAutomationStore } from '../../store/useTaskAutomationStore';
import { useTaskGovernanceStore } from '../../store/useTaskGovernanceStore';
import { useTaskNotifications } from '../../store/TaskNotificationContext';
import { updateTask, getTags, getTaskViews, createTaskView, createGlobalTask } from '../../api/tasks';
import { getTasks } from '../../api/projects';
import api from '../../api/axios';

// Reuse styles from MyTasksPage
import styles from '../../pages/tasks/MyTasksPage.module.css';
import h from '../../pages/tasks/MyTasksPageHelpers.module.css';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Due Today' },
  { id: 'week', label: 'This Week' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'completed', label: 'Completed' },
  { id: 'trash', label: 'Trash / Archived' }
];

const STATUSES = {
  todo: { label: 'To Do', color: 'neutral' },
  in_progress: { label: 'In Progress', color: 'primary' },
  waiting: { label: 'Waiting', color: 'warning' },
  blocked: { label: 'Blocked', color: 'danger' },
  review: { label: 'Review', color: 'info' },
  done: { label: 'Completed', color: 'success' },
  cancelled: { label: 'Cancelled', color: 'neutral' }
};

const PRIORITY_COLORS = { low: 'info', medium: 'warning', high: 'danger', urgent: 'danger' };

export default function ProjectTasksTab({ projectId, project }) {
  const [selectedTask, setSelectedTask] = useState(null);
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('all');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const [globalTags, setGlobalTags] = useState([]);
  const [expandedTaskIds, setExpandedTaskIds] = useState(new Set());
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverTaskId, setDragOverTaskId] = useState(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isTagManagerModalOpen, setIsTagManagerModalOpen] = useState(false);
  const [isViewManagerOpen, setIsViewManagerOpen] = useState(false);
  const [isTimeReportsOpen, setIsTimeReportsOpen] = useState(false);
  const [isAutomationsOpen, setIsAutomationsOpen] = useState(false);
  const [isAiScheduleOpen, setIsAiScheduleOpen] = useState(false);
  const [isAiRiskOpen, setIsAiRiskOpen] = useState(false);
  const [isAiTaskCreationOpen, setIsAiTaskCreationOpen] = useState(false);
  const [isGlobalTaskModalOpen, setIsGlobalTaskModalOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isGovernanceOpen, setIsGovernanceOpen] = useState(false);

  const { addNotification } = useTaskNotifications();
  const { role, setRole } = useTaskGovernanceStore();
  const { runAutomations } = useTaskAutomationStore();

  const [savedViews, setSavedViews] = useState([]);
  const [currentViewId, setCurrentViewId] = useState('default');

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef(null);

  const [viewMode, setViewMode] = useState(() => localStorage.getItem(`projectTasksViewMode_${projectId}`) || 'list');

  useEffect(() => {
    localStorage.setItem(`projectTasksViewMode_${projectId}`, viewMode);
  }, [viewMode, projectId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadTasks = () => {
    if (!projectId) return;
    setLoading(true);
    
    Promise.all([
      getTasks(projectId),
      getTags().catch(() => ({ data: [] })),
      getTaskViews().catch(() => ({ data: [] }))
    ]).then(([res, tagsRes, viewsRes]) => {
      setGlobalTags(tagsRes.data?.data || tagsRes.data || []);
      const vs = viewsRes.data?.data || viewsRes.data || [];
      setSavedViews(vs);

      const _r = res.data?.data || res.data; 
      const raw = Array.isArray(_r) ? _r : [];
      let normalized = raw.map(t => {
        return {
          ...t,
          id: t.id,
          title: t.title,
          description: t.description || '',
          assigneeName: t.assignee_name || t.assigneeName || t.assignee || '',
          assignee_id: t.assignee_id || t.assigned_to || t.assigneeId || null,
          tags: Array.isArray(t.tags) ? t.tags : [],
          status: t.status || 'todo',
          priority: t.priority || 'medium',
          dueDate: t.due_date || t.dueDate || null,
          estimatedTime: t.estimatedTime || 0,
          actualTime: t.actualTime || 0,
          billableHours: t.billableHours || 0,
          timeLogs: t.timeLogs || [],
          project: { 
            id: projectId, 
            name: project?.name || 'Project Tasks'
          },
          parent_id: t.parent_id || null,
          milestone: t.milestone_name || t.milestone || null,
          checklist: Array.isArray(t.checklist) ? t.checklist : (Array.isArray(t.subtasks) ? t.subtasks : []),
        };
      });

      setTasks(normalized);
    }).catch(err => {
      console.error('Failed to load project tasks', err);
      setTasks([]);
    }).finally(() => {
      setLoading(false);
    });
  };

  useEffect(() => {
    loadTasks();
  }, [projectId]);

  const handleStatusChange = async (task, newStatus) => {
    if (project?.status === 'completed') {
      toast.warning('Cannot modify tasks of a completed project.');
      return;
    }
    setUpdatingTaskId(task.id);
    const prevStatus = task.status;
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    try {
      await updateTask(projectId, task.id, { status: newStatus });
      toast.success(newStatus === 'done' ? 'Task completed!' : `Task marked as ${STATUSES[newStatus]?.label || newStatus}`);
      
      const updated = { ...task, status: newStatus };
      if (newStatus !== task.status) {
        runAutomations('status_changed', updated, task, { toast, addNotification });
      }
      runAutomations('task_updated', updated, task, { toast, addNotification });
    } catch (err) {
      console.error('Failed to update task:', err);
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: prevStatus } : t));
      toast.error(err?.response?.data?.error?.message || 'Failed to update task status');
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleKanbanDrop = (taskId, newStatus) => {
    if (project?.status === 'completed') {
      toast.warning('Cannot modify tasks of a completed project.');
      return;
    }
    const task = tasks.find(t => t.id === taskId);
    if (task) handleStatusChange(task, newStatus);
  };

  const handleKanbanUpdate = async (taskId, updates) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
    try {
      await updateTask(projectId, taskId, updates);
      runAutomations('task_updated', { ...task, ...updates }, task, { toast, addNotification });
    } catch (err) {
      console.error('Failed to update task:', err);
      toast.error(err?.response?.data?.error?.message || 'Failed to update task');
      setTasks(prev => prev.map(t => t.id === taskId ? task : t));
    }
  };

  const toggleTaskExpand = (taskId) => {
    const next = new Set(expandedTaskIds);
    if (next.has(taskId)) next.delete(taskId);
    else next.add(taskId);
    setExpandedTaskIds(next);
  };

  const isPending = (status) => !['done', 'cancelled'].includes(status);

  const isToday = (d) => {
    if (!d) return false;
    const date = new Date(d.includes('T') ? d : d + 'T00:00:00');
    const today = new Date();
    return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
  };

  const isOverdue = (d) => {
    if (!d) return false;
    const date = new Date(d.includes('T') ? d : d + 'T00:00:00'); date.setHours(0,0,0,0);
    const today = new Date(); today.setHours(0,0,0,0);
    return date < today;
  };

  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [sortBy, setSortBy] = useState('due_asc');

  const filteredTasks = useMemo(() => {
    const filtered = tasks.filter(t => {
      const isTrashed = ['soft_deleted', 'archived', 'deleted'].includes(t.status);
      if (activeTab === 'trash') {
        if (!isTrashed) return false;
      } else {
        if (isTrashed) return false;
        if (activeTab === 'completed' && t.status !== 'done') return false;
        
        if (viewMode === 'list') {
          if (activeTab === 'all' && (t.status === 'done' || t.status === 'cancelled')) return false;
        } else {
          if (activeTab === 'all' && (t.status === 'done' || t.status === 'cancelled') && statusFilter === 'all') return false;
        }
      }

      if (activeTab === 'today' && (!isToday(t.dueDate) || !isPending(t.status))) return false;
      if (activeTab === 'overdue' && (!isOverdue(t.dueDate) || !isPending(t.status))) return false;
      if (activeTab === 'week') {
        if (!t.dueDate) return false;
        const date = new Date(t.dueDate);
        const today = new Date();
        const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
        const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6));
        if (date < startOfWeek || date > endOfWeek || !isPending(t.status)) return false;
      }
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (tagFilter !== 'all' && !t.tags.includes(tagFilter)) return false;
      
      if (debouncedSearchQuery) {
        const q = debouncedSearchQuery.toLowerCase();
        const searchableText = [
          t.title,
          t.description,
          t.assigneeName,
          t.tags.join(' '),
          t.milestone
        ].filter(Boolean).join(' ').toLowerCase();
        if (!searchableText.includes(q)) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      if (sortBy === 'due_asc') return new Date(a.dueDate) - new Date(b.dueDate);
      if (sortBy === 'due_desc') return new Date(b.dueDate) - new Date(a.dueDate);
      if (sortBy === 'priority') {
        const pMap = { urgent: 4, high: 3, medium: 2, low: 1 };
        return pMap[b.priority] - pMap[a.priority];
      }
      return 0;
    });

    return filtered;
  }, [tasks, activeTab, priorityFilter, sortBy, debouncedSearchQuery, statusFilter, viewMode, tagFilter]);

  const projectTasksTree = useMemo(() => {
    const map = new Map();
    const roots = [];
    filteredTasks.forEach(t => map.set(t.id, { ...t, subtasks: [] }));
    const visited = new Set();
    map.forEach(node => {
      if (visited.has(node.id)) return;
      visited.add(node.id);
      if (node.parent_id && map.has(node.parent_id)) {
        map.get(node.parent_id).subtasks.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  }, [filteredTasks]);

  const stats = useMemo(() => {
    return {
      overdue: tasks.filter(t => isOverdue(t.dueDate) && isPending(t.status)).length,
      today: tasks.filter(t => isToday(t.dueDate) && isPending(t.status)).length,
      week: tasks.filter(t => {
        if (!isPending(t.status) || !t.dueDate) return false;
        const date = new Date(t.dueDate);
        const today = new Date();
        const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
        const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6));
        return date >= startOfWeek && date <= endOfWeek;
      }).length,
      completed: tasks.filter(t => t.status === 'done').length,
      deleted: tasks.filter(t => ['soft_deleted', 'archived', 'deleted'].includes(t.status)).length,
      allActive: tasks.filter(t => !['soft_deleted', 'archived', 'deleted'].includes(t.status)).length
    };
  }, [tasks]);

  const getEmptyState = () => {
    if (debouncedSearchQuery && filteredTasks.length === 0) {
      return { icon: '🔍', text: `No matching tasks found for "${debouncedSearchQuery}"` };
    }
    if (activeTab === 'today') return { icon: '🎉', text: "Nothing due today. You're ahead of schedule!" };
    if (activeTab === 'overdue') return { icon: '✓', text: 'No overdue tasks. Great work!' };
    return { icon: '◻', text: 'No tasks found for this project.' };
  };
  const emptyState = getEmptyState();

  const formatDate = (d) => {
    if (isToday(d)) return 'Today';
    return new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short' });
  };

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

  const calculateProgress = (taskNode) => {
    if (!taskNode.subtasks || taskNode.subtasks.length === 0) {
      return taskNode.status === 'done' ? 100 : 0;
    }
    const total = taskNode.subtasks.reduce((sum, child) => sum + calculateProgress(child), 0);
    return Math.round(total / taskNode.subtasks.length);
  };

  const handleDragStart = (e, taskId) => {
    e.stopPropagation();
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };
  
  const handleDragOver = (e, taskId) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedTaskId !== taskId && dragOverTaskId !== taskId) {
      setDragOverTaskId(taskId);
    }
  };

  const handleDrop = async (e, targetTaskId) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTaskId(null);
    
    if (draggedTaskId && draggedTaskId !== targetTaskId) {
      const taskToMove = tasks.find(t => t.id === draggedTaskId);
      if (taskToMove) {
         setTasks(prev => prev.map(t => t.id === draggedTaskId ? { ...t, parent_id: targetTaskId } : t));
         try {
            await updateTask(projectId, draggedTaskId, { parent_id: targetTaskId });
            toast.success('Task nested successfully');
         } catch(err) {
            setTasks(prev => prev.map(t => t.id === draggedTaskId ? { ...t, parent_id: taskToMove.parent_id } : t));
            toast.error('Failed to nest task');
         }
      }
    }
    setDraggedTaskId(null);
  };

  const TaskNode = ({ task, level = 0 }) => {
    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
    const isExpanded = expandedTaskIds.has(task.id);
    const progress = calculateProgress(task);
    const [dragHandleTaskId, setDragHandleTaskId] = useState(null);

    return (
      <div 
        className={`${h.taskNodeWrapper} ${dragOverTaskId === task.id ? h.taskNodeDragOver : ''} ${draggedTaskId === task.id ? h.taskNodeDragged : ''}`}
        style={{ marginLeft: `${level * 24}px` }}
        draggable={dragHandleTaskId === task.id}
        onDragStart={(e) => handleDragStart(e, task.id)}
        onDragOver={(e) => handleDragOver(e, task.id)}
        onDragLeave={(e) => { e.stopPropagation(); setDragOverTaskId(null); }}
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
            {project?.status !== 'completed' && (
              <span 
                style={{ cursor: 'grab', color: 'var(--color-text-muted)', padding: '0 4px' }}
                onMouseEnter={() => setDragHandleTaskId(task.id)}
                onMouseLeave={() => setDragHandleTaskId(null)}
                title="Drag to move"
              >
                ⋮⋮
              </span>
            )}
            <select 
              value={task.status || 'todo'} 
              onChange={(e) => handleStatusChange(task, e.target.value)}
              className={h.statusSelect}
              style={{ color: `var(--color-${STATUSES[task.status]?.color || 'neutral'})` }}
              disabled={updatingTaskId === task.id || project?.status === 'completed'}
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
                   const tObj = globalTags.find(x => x.id === tagId);
                   if (!tObj) return null;
                   return <Badge key={tagId} variant="neutral" style={{ color: tObj.color, borderColor: tObj.color }}>{tObj.name}</Badge>
                })}
                {task.tags.length > 2 && <Badge variant="neutral">+{task.tags.length - 2}</Badge>}
              </div>
            )}
            {task.dueDate && (
              <span className={`${styles.dueDate} ${isOverdue(task.dueDate) && isPending(task.status) ? styles.overdue : ''} ${isToday(task.dueDate) && isPending(task.status) ? styles.today : ''}`}>
                {formatDate(task.dueDate)}
              </span>
            )}
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
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', minHeight: '600px' }}>
      {selectedTask ? (
        <TaskDetail
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          taskId={typeof selectedTask === 'object' ? selectedTask.id : selectedTask}
          projectId={projectId}
          initialTask={typeof selectedTask === 'object' ? selectedTask : tasks.find(t => t.id === selectedTask)}
          inline={true}
          projectStatus={project?.status}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
          <div className={styles.header} style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>
            <div className={styles.headerLeft}>
              <h2 className={styles.title} style={{ fontSize: '20px' }}>Project Tasks</h2>
            </div>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
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
              {project?.status === 'completed' ? (
                <Badge variant="success" style={{ padding: '6px 12px', fontSize: '12px' }}>✓ Closed (Completed)</Badge>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setIsAiTaskCreationOpen(true)}>✨ AI Task</Button>
                  <Button variant="primary" onClick={() => setIsGlobalTaskModalOpen(true)}>+ New Task</Button>
                </>
              )}
            </div>
          </div>

          <div className={styles.statsRibbon} style={{ margin: 0 }}>
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
              <span style={{ color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>{stats.allActive}</span>
              <span style={{ color: activeTab === 'all' ? 'var(--color-text)' : 'var(--color-text-secondary)' }}>All Tasks</span>
            </button>
            <button className={`${styles.statChip} ${activeTab === 'completed' ? styles.statChipActive : ''}`}
              onClick={() => setActiveTab('completed')}
              style={{ borderColor: activeTab === 'completed' ? 'var(--color-success)' : 'var(--color-border)' }}
            >
              <span className={styles.statDot} style={{ background: 'var(--color-success)' }} />
              <span style={{ color: 'var(--color-success)', fontVariantNumeric: 'tabular-nums' }}>{stats.completed}</span>
              <span style={{ color: activeTab === 'completed' ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>Completed</span>
            </button>
            <button className={`${styles.statChip} ${activeTab === 'trash' ? styles.statChipActive : ''}`}
              onClick={() => setActiveTab('trash')}
              style={{ borderColor: activeTab === 'trash' ? 'var(--color-danger)' : 'var(--color-border)' }}
            >
              <span className={styles.statDot} style={{ background: 'var(--color-danger)' }} />
              <span style={{ color: 'var(--color-danger)', fontVariantNumeric: 'tabular-nums' }}>{stats.deleted}</span>
              <span style={{ color: activeTab === 'trash' ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}>Deleted</span>
            </button>
          </div>

          <div className={styles.filterBar} style={{ margin: 0 }}>
            <div className={styles.searchWrap}>
              <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 20 20" fill="none">
                <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.8" />
                <path d="M14 14l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <input
                ref={searchInputRef}
                className={styles.searchInput}
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
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
          </div>

          <div className={styles.taskList} style={{ flex: 1, minHeight: '400px', margin: 0 }}>
            {loading ? (
                <ContentLoader type="list" rows={5} />
            ) : viewMode === 'kanban' ? (
              <TaskKanbanBoard tasks={filteredTasks} onTaskClick={setSelectedTask} onTaskDrop={handleKanbanDrop} onTaskUpdate={handleKanbanUpdate} />
            ) : viewMode === 'calendar' ? (
              <TaskCalendarBoard tasks={filteredTasks} onTaskClick={setSelectedTask} onTaskUpdate={handleKanbanUpdate} />
            ) : projectTasksTree.length === 0 ? (
              <div className={h.emptyStateContainer} style={{ minHeight: '300px' }}>
                <EmptyState 
                  icon={<span className={h.emptyStateIcon}>{emptyState.icon}</span>}
                  title={emptyState.text}
                />
              </div>
            ) : (
              <div className={styles.projectGroup} style={{ border: 'none', padding: 0 }}>
                {projectTasksTree.map(task => (
                  <TaskNode key={task.id} task={task} />
                ))}
              </div>
            )}
          </div>

          {isTemplateModalOpen && (
            <TemplateGalleryModal
              isOpen={isTemplateModalOpen}
              onClose={() => setIsTemplateModalOpen(false)}
              onUseTemplate={async (template) => {
                try {
                  const payload = {
                    title: template.title,
                    description: template.description,
                    priority: template.priority,
                    project_id: projectId,
                    checklist: template.checklist?.map(c => ({ ...c, id: Date.now().toString() + Math.random(), done: false })) || []
                  };
                  await createGlobalTask(payload);
                  toast.success(`Task created from template: ${template.title}`);
                  setIsTemplateModalOpen(false);
                  loadTasks();
                } catch (e) {
                  toast.error('Failed to create task from template');
                }
              }}
            />
          )}

          {isTagManagerModalOpen && (
            <TagManagerModal 
              isOpen={isTagManagerModalOpen}
              onClose={() => {
                setIsTagManagerModalOpen(false);
                loadTasks();
              }}
            />
          )}

          {isViewManagerOpen && (
            <ViewManagerModal
              isOpen={isViewManagerOpen}
              onClose={() => {
                setIsViewManagerOpen(false);
                getTaskViews().then(r => setSavedViews(r.data?.data || r.data || [])).catch(()=>{});
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
            initialProjectId={projectId}
          />
        </div>
      )}
    </div>
  );
}
