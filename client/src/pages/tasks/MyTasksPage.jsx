import React, { useState, useEffect } from 'react';
import { getGlobalTasks, updateTask } from '../../api/tasks';
import { Badge, Spinner, Button } from '../../components/ui';
import TaskDetail from '../../components/tasks/TaskDetail';

export default function MyTasksPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [quickFilter, setQuickFilter] = useState('All'); 
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  const [selectedTask, setSelectedTask] = useState(null); 
  const [expandedProjects, setExpandedProjects] = useState({});

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await getGlobalTasks({ assigneeId: 'me', limit: 200 });
      setTasks(res.data?.data || res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleMarkDone = async (task, e) => {
    e.stopPropagation();
    try {
      const newStatus = task.status === 'done' ? 'todo' : 'done';
      setTasks(tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
      await updateTask(task.project_id, task.id, { status: newStatus });
      fetchTasks();
    } catch (err) {
      console.error(err);
      fetchTasks();
    }
  };

  const toggleProject = (projName) => {
    setExpandedProjects(prev => ({ ...prev, [projName]: prev[projName] === false ? true : false }));
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  let stats = { overdue: 0, today: 0, week: 0, completedWeek: 0 };
  
  tasks.forEach(t => {
    if (t.status === 'done') {
      const updatedDate = t.updated_at ? new Date(t.updated_at) : new Date(t.created_at);
      if (updatedDate >= startOfWeek) {
        stats.completedWeek++;
      }
      return;
    }

    if (t.due_date) {
      const due = new Date(t.due_date);
      due.setHours(0,0,0,0);
      if (due < today) stats.overdue++;
      else if (due.getTime() === today.getTime()) stats.today++;
      else if (due <= nextWeek) stats.week++;
    }
  });

  const filteredTasks = tasks.filter(t => {
    if (statusFilter && t.status !== statusFilter) return false;
    if (priorityFilter && t.priority !== priorityFilter) return false;

    if (quickFilter === 'Today') {
      if (t.status === 'done' || !t.due_date) return false;
      const due = new Date(t.due_date);
      due.setHours(0,0,0,0);
      return due.getTime() === today.getTime();
    }
    if (quickFilter === 'Week') {
      if (t.status === 'done' || !t.due_date) return false;
      const due = new Date(t.due_date);
      due.setHours(0,0,0,0);
      return due >= today && due <= nextWeek;
    }
    if (quickFilter === 'Overdue') {
      if (t.status === 'done' || !t.due_date) return false;
      const due = new Date(t.due_date);
      due.setHours(0,0,0,0);
      return due < today;
    }
    
    // Default 'All' shows active tasks unless specifically filtering status
    if (quickFilter === 'All' && !statusFilter) {
      return t.status !== 'done';
    }

    return true;
  });

  const groupedTasks = filteredTasks.reduce((acc, t) => {
    const projName = t.project_name || `Project #${t.project_id.substring(0,8)}`;
    if (!acc[projName]) acc[projName] = [];
    acc[projName].push(t);
    return acc;
  }, {});

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'danger';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'neutral';
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in">
      
      {/* HEADER & FILTERS */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-4">My Tasks</h1>
          <div className="flex gap-2 bg-slate-800/80 p-1.5 rounded-lg border border-slate-700 w-max shadow-lg">
            {['All', 'Today', 'Week', 'Overdue'].map(f => (
              <button 
                key={f}
                onClick={() => setQuickFilter(f)}
                className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${quickFilter === f ? 'bg-blue-500 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
              >
                {f === 'All' ? 'All Active' : f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <select 
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors shadow-lg"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="in_review">In Review</option>
            <option value="done">Done</option>
          </select>
          <select 
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500 transition-colors shadow-lg"
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
          >
            <option value="">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Overdue</p>
          <p className="text-3xl font-black text-red-400">{stats.overdue}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Due Today</p>
          <p className="text-3xl font-black text-amber-400">{stats.today}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Due This Week</p>
          <p className="text-3xl font-black text-blue-400">{stats.week}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-lg">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Completed (Week)</p>
          <p className="text-3xl font-black text-green-400">{stats.completedWeek}</p>
        </div>
      </div>

      {/* TASK SECTIONS */}
      {loading ? (
        <div className="flex justify-center p-20"><Spinner size="lg" /></div>
      ) : Object.keys(groupedTasks).length === 0 ? (
        <div className="text-center py-20 bg-slate-800/40 border border-slate-700/50 rounded-xl">
          <span className="text-4xl mb-4 block">🎉</span>
          <h3 className="text-lg font-bold text-white">You're all caught up!</h3>
          <p className="text-slate-400 text-sm">No tasks matching the current filters.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedTasks).map(([projName, projTasks]) => {
            const isExpanded = expandedProjects[projName] !== false;
            
            return (
              <div key={projName} className="bg-slate-800 border border-slate-700 rounded-xl shadow-lg overflow-hidden transition-all">
                <button 
                  className="w-full flex items-center justify-between px-5 py-4 bg-slate-900/50 hover:bg-slate-900/80 transition-colors border-b border-slate-700"
                  onClick={() => toggleProject(projName)}
                >
                  <div className="flex items-center gap-3">
                    <svg className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    <h2 className="text-md font-bold text-white tracking-wide">{projName}</h2>
                  </div>
                  <Badge variant="neutral">{projTasks.length} Task{projTasks.length !== 1 ? 's' : ''}</Badge>
                </button>

                {isExpanded && (
                  <div className="divide-y divide-slate-700/50">
                    {projTasks.map(task => (
                      <div 
                        key={task.id} 
                        onClick={() => setSelectedTask({ projectId: task.project_id, taskId: task.id })}
                        className="flex items-center gap-4 px-5 py-3 hover:bg-slate-700/30 cursor-pointer transition-colors group"
                      >
                        <button 
                          onClick={(e) => handleMarkDone(task, e)}
                          className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-all ${task.status === 'done' ? 'bg-green-500 border-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'bg-slate-900 border-slate-600 hover:border-blue-400'}`}
                        >
                          {task.status === 'done' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                        </button>
                        
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm truncate transition-colors ${task.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-200 font-medium group-hover:text-white'}`}>
                            {task.title}
                          </p>
                          {task.subtask_count > 0 && (
                            <p className="text-[10px] font-bold text-slate-500 mt-0.5">🔗 {task.subtask_count} subtasks</p>
                          )}
                        </div>
                        
                        <div className="hidden md:flex shrink-0 items-center gap-4">
                          <Badge variant={getPriorityColor(task.priority)} className="uppercase text-[10px] w-16 justify-center">
                            {task.priority || 'Medium'}
                          </Badge>
                          <div className={`text-xs w-24 text-right font-medium ${task.due_date && new Date(task.due_date) < today && task.status !== 'done' ? 'text-red-400' : 'text-slate-400'}`}>
                            {task.due_date ? new Date(task.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '-'}
                          </div>
                          <Badge variant="neutral" className="uppercase text-[10px] w-24 justify-center">
                            {task.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedTask && (
        <TaskDetail 
          projectId={selectedTask.projectId} 
          taskId={selectedTask.taskId} 
          isOpen={true} 
          onClose={() => setSelectedTask(null)} 
          onTaskUpdated={() => fetchTasks()} 
        />
      )}

    </div>
  );
}
