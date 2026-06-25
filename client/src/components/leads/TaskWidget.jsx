import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { formatDistanceToNow, isPast } from 'date-fns';
import { logActivity } from '../../api/leads';
import { 
  getGlobalTasks, 
  getGlobalTask, 
  createGlobalTask, 
  updateGlobalTask, 
  deleteGlobalTask, 
  getGlobalTaskComments, 
  addGlobalTaskComment 
} from '../../api/tasks';
import { Badge, Button, Avatar, Select, Input } from '../ui';
import { useToast } from '../../store/toastContext';

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const PRIORITY_META = {
  low: { label: 'Low', color: 'bg-gray-100 text-gray-700 border-gray-200', dot: 'bg-gray-400' },
  medium: { label: 'Medium', color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  high: { label: 'High', color: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  urgent: { label: 'Urgent', color: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' }
};

const STATUS_META = {
  todo: { label: 'To Do', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  blocked: { label: 'Blocked', color: 'bg-red-100 text-red-800 border-red-200' },
  done: { label: 'Completed', color: 'bg-emerald-100 text-emerald-850 border-emerald-250' }
};

const TASK_TYPES = [
  { value: 'task', label: 'Standard Task' },
  { value: 'milestone', label: 'Milestone' },
  { value: 'crm_record', label: 'CRM Record' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'ooo', label: 'Out of Office' }
];

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' }
];

const EFFORT_OPTIONS = [
  { value: '', label: 'Unestimated effort' },
  { value: '1', label: '1 Point (Very Easy)' },
  { value: '2', label: '2 Points (Easy)' },
  { value: '3', label: '3 Points (Medium)' },
  { value: '5', label: '5 Points (Moderate)' },
  { value: '8', label: '8 Points (Hard)' },
  { value: '13', label: '13 Points (Complex)' }
];

export default function TaskWidget({ leadId, reps }) {
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [editingTask, setEditingTask] = useState(null); // Task object being edited

  // Expand and Detail details state
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [expandedTaskDetails, setExpandedTaskDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Form toggle & creation state
  const [isAdding, setIsAdding] = useState(false);
  const [formFields, setFormFields] = useState({
    title: '',
    description: '',
    assigned_to: '',
    due_date: '',
    priority: 'medium',
    status: 'todo',
    
    // Custom Fields to store inside tasks.custom_fields
    start_date: '',
    due_time: '',
    task_type: 'task',
    effort: '',
    budget: '',
    custom_checkbox: false,
    recurrence: 'none',
    relationship_link: ''
  });

  // Local Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');

  const fetchTasks = async () => {
    if (!leadId) return;
    setLoading(true);
    try {
      // Get lead tasks
      const res = await getGlobalTasks({ leadId, limit: 100 });
      setTasks(res.data?.data || []);
    } catch (e) {
      console.error('Failed to fetch tasks', e);
      toast.error('Failed to fetch tasks list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [leadId]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get('/users');
        setUsers(res.data?.data || []);
      } catch (e) {
        console.error('Failed to fetch users', e);
      }
    };
    fetchUsers();
  }, []);

  const availableReps = reps || users;

  // Load detailed subtasks & comments when expanding a task
  const handleToggleExpand = async (taskId) => {
    if (expandedTaskId === taskId) {
      setExpandedTaskId(null);
      setExpandedTaskDetails(null);
      return;
    }

    setExpandedTaskId(taskId);
    setDetailsLoading(true);
    try {
      const res = await getGlobalTask(taskId);
      setExpandedTaskDetails(res.data?.data || res.data);
    } catch (err) {
      console.error('Failed to load task details', err);
      toast.error('Could not load task details.');
      setExpandedTaskId(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  // Toggle complete / check status of task
  const handleToggleTaskStatus = async (task) => {
    const nextStatus = task.status === 'done' ? 'todo' : 'done';
    try {
      await updateGlobalTask(task.id, { status: nextStatus });
      toast.success(`Task marked as ${nextStatus === 'done' ? 'Completed' : 'To Do'}`);
      
      // Update local state list
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: nextStatus } : t));
      
      // Update expanded details if open
      if (expandedTaskId === task.id) {
        setExpandedTaskDetails(prev => prev ? { ...prev, status: nextStatus } : null);
      }

      await logActivity(leadId, { 
        type: 'task_completed', 
        notes: `Marked task "${task.title}" as ${nextStatus === 'done' ? 'completed' : 'pending'}` 
      });
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.details || 'Failed to update task status.');
    }
  };

  // Toggle checklist subtask completed status
  const handleToggleSubtask = async (subtask) => {
    const nextStatus = subtask.status === 'done' ? 'todo' : 'done';
    try {
      await updateGlobalTask(subtask.id, { status: nextStatus });
      
      // Update expanded detail state
      setExpandedTaskDetails(prev => {
        if (!prev) return null;
        return {
          ...prev,
          subtasks: prev.subtasks.map(s => s.id === subtask.id ? { ...s, status: nextStatus, done: nextStatus === 'done' } : s)
        };
      });

      // Update the subtask_count (or reflect) on the parent list
      fetchTasks();
    } catch (e) {
      toast.error('Failed to update subtask status.');
    }
  };

  // Quick inline add subtask
  const handleAddSubtaskSubmit = async (e) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim() || !expandedTaskId) return;

    try {
      const res = await createGlobalTask({
        leadId,
        title: newSubtaskTitle.trim(),
        parentTaskId: expandedTaskId,
        status: 'todo',
        priority: 'medium'
      });

      const newSub = res.data?.data || res.data;
      
      // Inject assignee name helper locally
      newSub.assignee_name = 'Unassigned';

      setExpandedTaskDetails(prev => {
        if (!prev) return null;
        return {
          ...prev,
          subtasks: [...(prev.subtasks || []), newSub]
        };
      });

      setNewSubtaskTitle('');
      toast.success('Subtask added.');
      
      // Refresh parent checklist progress indicator
      fetchTasks();
    } catch (err) {
      console.error(err);
      toast.error('Failed to create subtask.');
    }
  };

  // Add Comment
  const handleAddCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newCommentText.trim() || !expandedTaskId) return;

    setSubmittingComment(true);
    try {
      const res = await addGlobalTaskComment(expandedTaskId, newCommentText.trim());
      const comment = res.data?.data || res.data;
      
      setExpandedTaskDetails(prev => {
        if (!prev) return null;
        return {
          ...prev,
          comments: [...(prev.comments || []), comment]
        };
      });

      setNewCommentText('');
      toast.success('Comment posted.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to add comment.');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Create Task Form Submit
  const handleSaveTask = async (e) => {
    e.preventDefault();
    if (!formFields.title) return;

    // Build custom fields object
    const customFields = {
      start_date: formFields.start_date || null,
      due_time: formFields.due_time || null,
      task_type: formFields.task_type || 'task',
      effort: formFields.effort || null,
      budget: formFields.budget ? parseFloat(formFields.budget) : null,
      custom_checkbox: !!formFields.custom_checkbox,
      recurrence: formFields.recurrence || 'none',
      links: formFields.relationship_link ? [formFields.relationship_link.trim()] : []
    };

    try {
      if (editingTask) {
        // Edit task instance
        await updateGlobalTask(editingTask.id, {
          title: formFields.title,
          description: formFields.description || null,
          assigneeId: formFields.assigned_to || null,
          dueDate: formFields.due_date || null,
          priority: formFields.priority,
          status: formFields.status,
          customFields: customFields
        });
        toast.success('Task details updated.');
        
        if (expandedTaskId === editingTask.id) {
          // Re-fetch details to sync view
          const details = await getGlobalTask(editingTask.id);
          setExpandedTaskDetails(details.data?.data || details.data);
        }
      } else {
        // Create new task
        await createGlobalTask({
          leadId,
          title: formFields.title,
          description: formFields.description || null,
          assigneeId: formFields.assigned_to || null,
          dueDate: formFields.due_date || null,
          priority: formFields.priority,
          status: formFields.status || 'todo',
          customFields: customFields
        });
        toast.success('New task created.');
        await logActivity(leadId, { 
          type: 'note', 
          notes: `Added ClickUp task: ${formFields.title}` 
        });
      }

      // Reset form
      setIsAdding(false);
      setEditingTask(null);
      resetForm();
      fetchTasks();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save task.');
    }
  };

  const handleEditClick = (task) => {
    setEditingTask(task);
    
    // Parse custom fields if stored as JSON string or object
    let cf = {};
    if (task.custom_fields) {
      cf = typeof task.custom_fields === 'string' ? JSON.parse(task.custom_fields) : task.custom_fields;
    }

    setFormFields({
      title: task.title || '',
      description: task.description || '',
      assigned_to: task.assignee_id || '',
      due_date: task.due_date ? task.due_date.split('T')[0] : '',
      priority: task.priority || 'medium',
      status: task.status || 'todo',
      
      start_date: cf.start_date || '',
      due_time: cf.due_time || '',
      task_type: cf.task_type || 'task',
      effort: cf.effort || '',
      budget: cf.budget || '',
      custom_checkbox: !!cf.custom_checkbox,
      recurrence: cf.recurrence || 'none',
      relationship_link: cf.links && cf.links.length > 0 ? cf.links[0] : ''
    });
    
    setIsAdding(true);
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await deleteGlobalTask(taskId);
      toast.success('Task deleted successfully.');
      setTasks(prev => prev.filter(t => t.id !== taskId));
      if (expandedTaskId === taskId) {
        setExpandedTaskId(null);
        setExpandedTaskDetails(null);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete task.');
    }
  };

  const resetForm = () => {
    setFormFields({
      title: '',
      description: '',
      assigned_to: '',
      due_date: '',
      priority: 'medium',
      status: 'todo',
      start_date: '',
      due_time: '',
      task_type: 'task',
      effort: '',
      budget: '',
      custom_checkbox: false,
      recurrence: 'none',
      relationship_link: ''
    });
  };

  // Local sorting and filtering of top-level tasks list
  const filteredTasks = tasks
    .filter(t => {
      // Search term
      if (searchTerm && !t.title.toLowerCase().includes(searchTerm.toLowerCase()) && !(t.description || '').toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      // Status filter
      if (filterStatus && t.status !== filterStatus) {
        return false;
      }
      // Priority filter
      if (filterPriority && t.priority !== filterPriority) {
        return false;
      }
      // Assignee filter
      if (filterAssignee && t.assignee_id !== filterAssignee) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      // Sort priority weight: urgent (0) > high (1) > medium (2) > low (3)
      const priorityWeight = { urgent: 0, high: 1, medium: 2, low: 3 };
      const weightA = priorityWeight[a.priority] !== undefined ? priorityWeight[a.priority] : 2;
      const weightB = priorityWeight[b.priority] !== undefined ? priorityWeight[b.priority] : 2;
      
      if (weightA !== weightB) {
        return weightA - weightB;
      }

      // Check due dates
      if (a.due_date && b.due_date) {
        return new Date(a.due_date) - new Date(b.due_date);
      }
      return a.due_date ? -1 : (b.due_date ? 1 : 0);
    });

  // Calculate quick stats dynamically from all loaded tasks
  const stats = {
    total: tasks.length,
    todo: tasks.filter(t => t.status === 'todo').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
    done: tasks.filter(t => t.status === 'done').length
  };

  return (
    <div className="space-y-6">
      
      {/* Task Statistics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center shadow-sm">
          <div className="text-[10px] text-slate-500 uppercase font-extrabold tracking-wider">Total</div>
          <div className="text-xl font-bold text-slate-800 mt-1">{stats.total}</div>
        </div>
        <div className="bg-slate-100/50 border border-slate-200 rounded-xl p-3 text-center shadow-sm">
          <div className="text-[10px] text-slate-600 uppercase font-extrabold tracking-wider">To Do</div>
          <div className="text-xl font-bold text-slate-700 mt-1">{stats.todo}</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center shadow-sm">
          <div className="text-[10px] text-amber-600 uppercase font-extrabold tracking-wider">In Progress</div>
          <div className="text-xl font-bold text-amber-800 mt-1">{stats.in_progress}</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center shadow-sm">
          <div className="text-[10px] text-red-600 uppercase font-extrabold tracking-wider">Blocked</div>
          <div className="text-xl font-bold text-red-800 mt-1">{stats.blocked}</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center col-span-2 sm:col-span-1 shadow-sm">
          <div className="text-[10px] text-emerald-600 uppercase font-extrabold tracking-wider">Completed</div>
          <div className="text-xl font-bold text-emerald-800 mt-1">{stats.done}</div>
        </div>
      </div>

      {/* Control Filters & Toggle bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <span>📋 Lead Tasks</span>
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-bold">{filteredTasks.length}</span>
          </h3>
          <Button 
            variant={isAdding ? 'outline' : 'primary'}
            onClick={() => {
              setIsAdding(!isAdding);
              if (!isAdding) resetForm();
              setEditingTask(null);
            }}
            className="flex items-center gap-1 self-start md:self-auto"
          >
            {isAdding ? 'Cancel Form' : '⚡ Add ClickUp Task'}
          </Button>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-150">
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
          />

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs outline-none bg-white cursor-pointer"
          >
            <option value="">All Statuses</option>
            {Object.entries(STATUS_META).map(([key, value]) => (
              <option key={key} value={key}>{value.label}</option>
            ))}
          </select>

          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs outline-none bg-white cursor-pointer"
          >
            <option value="">All Priorities</option>
            {PRIORITIES.map(p => (
              <option key={p} value={p}>{p.toUpperCase()}</option>
            ))}
          </select>

          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs outline-none bg-white cursor-pointer"
          >
            <option value="">All Assignees</option>
            {availableReps.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Task Creation/Editing Form */}
      {isAdding && (
        <form onSubmit={handleSaveTask} className="bg-slate-50/70 border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 animate-in slide-in-from-top-4 duration-200">
          <div className="flex justify-between items-center border-b border-slate-200 pb-3">
            <h4 className="text-sm font-bold text-gray-800">
              {editingTask ? '🔧 Task Details' : '✨ New ClickUp Task Instance'}
            </h4>
            <button 
              type="button" 
              onClick={() => { setIsAdding(false); setEditingTask(null); }}
              className="text-gray-400 hover:text-gray-700 font-semibold"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Hand: Core fields */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="Enter task objective..."
                  value={formFields.title}
                  onChange={e => setFormFields({ ...formFields, title: e.target.value })}
                  className="w-full text-sm border border-gray-300 rounded-lg p-2 bg-white text-gray-800 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Scope Description</label>
                <textarea
                  placeholder="Provide context or description..."
                  value={formFields.description}
                  onChange={e => setFormFields({ ...formFields, description: e.target.value })}
                  className="w-full text-sm border border-gray-300 rounded-lg p-2 bg-white text-gray-800 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors shadow-sm min-h-[90px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Assign Worker</label>
                  <select
                    value={formFields.assigned_to}
                    onChange={e => setFormFields({ ...formFields, assigned_to: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg p-2 bg-white text-gray-800 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer transition-colors shadow-sm"
                  >
                    <option value="">Unassigned</option>
                    {availableReps.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Lifecycle Status</label>
                  <select
                    value={formFields.status}
                    onChange={e => setFormFields({ ...formFields, status: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg p-2 bg-white text-gray-800 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer transition-colors shadow-sm"
                  >
                    {Object.entries(STATUS_META).map(([key, value]) => (
                      <option key={key} value={key}>{value.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Start Date</label>
                  <input
                    type="date"
                    value={formFields.start_date}
                    onChange={e => setFormFields({ ...formFields, start_date: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg p-2 bg-white text-gray-800 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer transition-colors shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Due Date & Time</label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={formFields.due_date}
                      onChange={e => setFormFields({ ...formFields, due_date: e.target.value })}
                      className="flex-1 text-sm border border-gray-300 rounded-lg p-2 bg-white text-gray-800 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer transition-colors shadow-sm"
                    />
                    <input
                      type="time"
                      value={formFields.due_time}
                      onChange={e => setFormFields({ ...formFields, due_time: e.target.value })}
                      className="w-24 text-sm border border-gray-300 rounded-lg p-2 bg-white text-gray-800 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer text-center transition-colors shadow-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Hand: Advanced / Custom fields */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Priority Level</label>
                <div className="flex bg-gray-100 border border-gray-200 rounded-lg p-1">
                  {PRIORITIES.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setFormFields({ ...formFields, priority: p })}
                      className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
                        formFields.priority === p 
                          ? p === 'urgent' ? 'bg-red-600 text-white shadow-sm' : p === 'high' ? 'bg-orange-500 text-white shadow-sm' : p === 'medium' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-500 text-white shadow-sm'
                          : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200/50'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Task Type Layout</label>
                  <select
                    value={formFields.task_type}
                    onChange={e => setFormFields({ ...formFields, task_type: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg p-2 bg-white text-gray-800 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer transition-colors shadow-sm"
                  >
                    {TASK_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Recurring Interval</label>
                  <select
                    value={formFields.recurrence}
                    onChange={e => setFormFields({ ...formFields, recurrence: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg p-2 bg-white text-gray-800 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer transition-colors shadow-sm"
                  >
                    {RECURRENCE_OPTIONS.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Effort Rating</label>
                <select
                  value={formFields.effort}
                  onChange={e => setFormFields({ ...formFields, effort: e.target.value })}
                  className="w-full text-sm border border-gray-300 rounded-lg p-2 bg-white text-gray-800 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer transition-colors shadow-sm"
                >
                  {EFFORT_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Relationships & External Links</label>
                <input
                  type="url"
                  placeholder="https://docs.google.com/..."
                  value={formFields.relationship_link}
                  onChange={e => setFormFields({ ...formFields, relationship_link: e.target.value })}
                  className="w-full text-sm border border-gray-300 rounded-lg p-2 bg-white text-gray-800 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors shadow-sm"
                />
              </div>

              <div className="flex items-center pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={formFields.custom_checkbox}
                    onChange={e => setFormFields({ ...formFields, custom_checkbox: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded bg-white border-gray-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <span>Require Quality Check Handover</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => { setIsAdding(false); setEditingTask(null); }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
            >
              {editingTask ? 'Update ClickUp Task' : 'Create ClickUp Task'}
            </Button>
          </div>
        </form>
      )}

      {/* Task Listing View */}
      {filteredTasks.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No matching tasks</h3>
          <p className="mt-1 text-xs text-gray-500">Try adjusting your filters or search criteria, or add a new task.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map(task => {
            const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== 'done';
            
            // Extract custom_fields
            let cf = {};
            if (task.custom_fields) {
              cf = typeof task.custom_fields === 'string' ? JSON.parse(task.custom_fields) : task.custom_fields;
            }

            const priorityStyle = PRIORITY_META[task.priority] || PRIORITY_META.medium;
            const statusStyle = STATUS_META[task.status] || STATUS_META.todo;
            const isExpanded = expandedTaskId === task.id;

            return (
              <div 
                key={task.id} 
                className={`bg-white rounded-xl border transition-all duration-200 overflow-hidden shadow-sm hover:shadow-md ${
                  isExpanded ? 'border-blue-400 ring-1 ring-blue-400' : isOverdue ? 'border-red-300 bg-red-50/20' : 'border-gray-200'
                }`}
              >
                
                {/* Task Row Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="mt-1">
                      <input 
                        type="checkbox" 
                        checked={task.status === 'done'}
                        className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer transition"
                        onChange={() => handleToggleTaskStatus(task)}
                        title="Mark as done"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Task Type badge */}
                        {cf.task_type && cf.task_type !== 'task' && (
                          <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-slate-900 text-white rounded">
                            {cf.task_type.replace('_', ' ')}
                          </span>
                        )}
                        
                        <p className={`text-sm font-bold text-gray-900 ${task.status === 'done' ? 'line-through text-gray-400' : ''}`}>
                          {task.title}
                        </p>
                      </div>

                      {/* Micro Metadata row */}
                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[10px] text-gray-500 font-medium">
                        
                        {/* Priority indicator */}
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] uppercase tracking-wider font-extrabold ${priorityStyle.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${priorityStyle.dot}`} />
                          {priorityStyle.label}
                        </span>

                        {/* Status Badge */}
                        <span className={`inline-flex px-1.5 py-0.5 rounded-full border text-[9px] font-black uppercase ${statusStyle.color}`}>
                          {statusStyle.label}
                        </span>

                        {/* Dates */}
                        {cf.start_date && (
                          <span>
                            Start: {new Date(cf.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </span>
                        )}

                        {task.due_date ? (
                          <span className={`flex items-center gap-1 font-semibold ${isOverdue ? 'text-red-600 bg-red-50 border border-red-200 px-1 py-0.2 rounded' : 'text-gray-650'}`}>
                            {isOverdue && '⚠️ '}
                            Due: {new Date(task.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            {cf.due_time && ` at ${cf.due_time}`}
                            {isOverdue && ' (Overdue)'}
                          </span>
                        ) : (
                          <span className="italic text-gray-400">No due date</span>
                        )}

                        {/* Assignee */}
                        {task.assignee_name && (
                          <span className="flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full font-bold">
                            👤 {task.assignee_name}
                          </span>
                        )}

                        {/* Subtask completion ratio */}
                        {task.subtask_count > 0 && (
                          <span className="bg-slate-200/75 text-slate-850 px-2 py-0.5 rounded-full font-bold">
                            🌿 Subtasks: {task.subtask_count}
                          </span>
                        )}

                        {/* Recurrence check */}
                        {cf.recurrence && cf.recurrence !== 'none' && (
                          <span className="bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full border border-sky-150 font-bold uppercase tracking-widest text-[8px]">
                            🔄 Recur: {cf.recurrence}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      onClick={() => handleToggleExpand(task.id)}
                      className="text-xs px-2.5 py-1.5 rounded bg-gray-100 hover:bg-gray-200 font-bold text-gray-700 focus:outline-none flex items-center gap-1"
                    >
                      {isExpanded ? 'Collapse' : 'Manage & Expand'}
                      <svg className={`w-3.5 h-3.5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleEditClick(task)}
                      className="text-gray-400 hover:text-blue-650 p-1.5 hover:bg-slate-100 rounded transition"
                      title="Edit Task"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="text-gray-400 hover:text-red-600 p-1.5 hover:bg-slate-100 rounded transition"
                      title="Delete Task"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Expanded Details Section */}
                {isExpanded && (
                  <div className="border-t border-gray-150 bg-slate-50/50 p-5 space-y-5 animate-in fade-in duration-200">
                    {detailsLoading || !expandedTaskDetails ? (
                      <div className="text-center text-xs text-gray-500 py-6">Loading details...</div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* Column 1 & 2: Details, subtasks, checklists */}
                        <div className="lg:col-span-2 space-y-5">
                          {/* Task Description */}
                          <div>
                            <h5 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-1">Description</h5>
                            <p className="text-xs text-gray-750 bg-white p-3 rounded-lg border border-gray-200 whitespace-pre-wrap min-h-[50px]">
                              {expandedTaskDetails.description || <span className="italic text-gray-450">No description provided.</span>}
                            </p>
                          </div>

                          {/* Inline Subtasks / Checklist */}
                          <div className="space-y-2">
                            <h5 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 flex items-center justify-between">
                              <span>Checklist Subtasks</span>
                              <span className="text-gray-450 font-normal">
                                {expandedTaskDetails.subtasks?.filter(s => s.status === 'done').length || 0} / {expandedTaskDetails.subtasks?.length || 0} Done
                              </span>
                            </h5>

                            {/* Subtask list */}
                            {(!expandedTaskDetails.subtasks || expandedTaskDetails.subtasks.length === 0) ? (
                              <p className="text-xs text-gray-400 italic bg-white p-3 rounded-lg border border-gray-150">
                                No checklist subtasks yet. Add one below!
                              </p>
                            ) : (
                              <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-150">
                                {expandedTaskDetails.subtasks.map(sub => (
                                  <div key={sub.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                                    <label className="flex items-center gap-2 cursor-pointer select-none flex-1 min-w-0">
                                      <input
                                        type="checkbox"
                                        checked={sub.status === 'done'}
                                        onChange={() => handleToggleSubtask(sub)}
                                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                                      />
                                      <span className={`${sub.status === 'done' ? 'line-through text-gray-400' : 'text-gray-700'} font-medium truncate`}>
                                        {sub.title}
                                      </span>
                                    </label>
                                    <button 
                                      type="button" 
                                      onClick={() => handleDeleteTask(sub.id)}
                                      className="text-gray-450 hover:text-red-650"
                                      title="Delete Checklist Item"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Quick Add Subtask Input */}
                            <form onSubmit={handleAddSubtaskSubmit} className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Add checklist subtask objective..."
                                value={newSubtaskTitle}
                                onChange={e => setNewSubtaskTitle(e.target.value)}
                                className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                              />
                              <Button type="submit" variant="primary" className="text-xs py-1 px-4 font-bold">
                                + Add
                              </Button>
                            </form>
                          </div>
                        </div>

                        {/* Column 3: Custom fields details and comments */}
                        <div className="space-y-5">
                          {/* Premium Custom Fields Box */}
                          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
                            <h5 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 border-b pb-1.5 mb-2">ClickUp Custom Fields</h5>
                            
                            <div className="grid grid-cols-2 gap-y-2.5 gap-x-2 text-xs">
                              <div>
                                <span className="text-gray-400 block text-[9px] uppercase tracking-wider">Effort Score</span>
                                <span className="font-semibold text-gray-800">
                                  {cf.effort ? `${cf.effort} points` : '—'}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-400 block text-[9px] uppercase tracking-wider">Budget Allocation</span>
                                <span className="font-semibold text-gray-800">
                                  {cf.budget ? `₹${parseFloat(cf.budget).toLocaleString('en-IN')}` : '—'}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-400 block text-[9px] uppercase tracking-wider">Start Date</span>
                                <span className="font-semibold text-gray-800">
                                  {cf.start_date ? new Date(cf.start_date).toLocaleDateString('en-IN') : '—'}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-400 block text-[9px] uppercase tracking-wider">QA Checklist Req.</span>
                                <span className="font-semibold text-gray-800">
                                  {cf.custom_checkbox ? '✅ Required' : '❌ No'}
                                </span>
                              </div>
                            </div>

                            {/* Relationship links list */}
                            {cf.links && cf.links.length > 0 && (
                              <div className="pt-2 border-t text-xs">
                                <span className="text-gray-400 block text-[9px] uppercase tracking-wider mb-1">Relationship Links</span>
                                {cf.links.map((link, idx) => (
                                  <a 
                                    key={idx} 
                                    href={link} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-blue-600 hover:underline truncate block font-semibold"
                                  >
                                    🔗 Link Resource {idx + 1}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Task Comments Section */}
                          <div className="space-y-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                            <h5 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 border-b pb-1.5 mb-2">Discussion Activity</h5>
                            
                            {/* Comments list */}
                            <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                              {(!expandedTaskDetails.comments || expandedTaskDetails.comments.length === 0) ? (
                                <p className="text-xs text-gray-400 italic text-center py-2">No comments posted yet.</p>
                              ) : (
                                expandedTaskDetails.comments.map(comment => (
                                  <div key={comment.id} className="text-xs space-y-0.5 border-b border-gray-100 pb-2">
                                    <div className="flex justify-between items-center text-[10px]">
                                      <span className="font-bold text-gray-850">{comment.user_name || 'System'}</span>
                                      <span className="text-gray-400">
                                        {comment.createdAt ? formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true }) : ''}
                                      </span>
                                    </div>
                                    <p className="text-gray-600 whitespace-pre-wrap">{comment.text || comment.content}</p>
                                  </div>
                                ))
                              )}
                            </div>

                            {/* Post comment form */}
                            <form onSubmit={handleAddCommentSubmit} className="flex gap-2 pt-2">
                              <textarea
                                placeholder="Write a comment..."
                                rows="1"
                                value={newCommentText}
                                onChange={e => setNewCommentText(e.target.value)}
                                className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 min-h-[36px] bg-slate-55"
                              />
                              <Button 
                                type="submit" 
                                variant="primary" 
                                disabled={submittingComment || !newCommentText.trim()}
                                className="text-xs py-1 px-3 font-bold shrink-0 self-end"
                              >
                                {submittingComment ? '...' : 'Post'}
                              </Button>
                            </form>
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
