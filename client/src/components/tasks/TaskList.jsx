import React, { useState, useEffect } from 'react';
import { getTasks, updateTask, deleteTask } from '../../api/projects';

const TaskList = ({ projectId, milestoneId = null }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sortConfig, setSortConfig] = useState({ key: 'due_date', direction: 'asc' });

  const priorities = ['low', 'medium', 'high', 'urgent'];
  const priorityColors = {
    low: 'bg-slate-700 text-slate-300 border-slate-600',
    medium: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    urgent: 'bg-red-500/20 text-red-400 border-red-500/30'
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const params = { limit: 500 }; // Ensure high enough limit for complete local sorting
      if (milestoneId) params.milestoneId = milestoneId;
      const res = await getTasks(projectId, params);
      setTasks(res.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, milestoneId]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    const aVal = a[sortConfig.key] || '';
    const bVal = b[sortConfig.key] || '';
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const toggleSelectAll = () => {
    if (selectedIds.size === tasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tasks.map(t => t.id)));
    }
  };

  const toggleSelect = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const updateTaskOptimistic = async (taskId, updates) => {
    const originalTasks = [...tasks];
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
    try {
      await updateTask(projectId, taskId, updates);
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.details || e.response?.data?.message || 'Update failed due to validation rules.');
      setTasks(originalTasks); // Hard revert
    }
  };

  const handlePriorityCycle = (task) => {
    const currentIndex = priorities.indexOf(task.priority || 'low');
    const nextPriority = priorities[(currentIndex + 1) % priorities.length];
    updateTaskOptimistic(task.id, { priority: nextPriority });
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Permanently delete ${selectedIds.size} tasks?`)) return;
    try {
      await Promise.all(Array.from(selectedIds).map(id => deleteTask(projectId, id)));
      setTasks(prev => prev.filter(t => !selectedIds.has(t.id)));
      setSelectedIds(new Set());
    } catch (e) {
      console.error(e);
      alert('Failed to delete some tasks. Syncing state.');
      fetchTasks();
    }
  };

  const handleBulkStatusChange = async (newStatus) => {
    try {
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map(id => updateTask(projectId, id, { status: newStatus })));
      setTasks(prev => prev.map(t => selectedIds.has(t.id) ? { ...t, status: newStatus } : t));
      setSelectedIds(new Set());
    } catch (e) {
      console.error(e);
      alert('Validation failure: Ensure subtasks are completed before moving tasks to Done.');
      fetchTasks();
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center py-24">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
    </div>
  );

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden animate-in fade-in duration-300">
      
      {/* Bulk Actions Header */}
      {selectedIds.size > 0 && (
        <div className="bg-indigo-900/60 border-b border-indigo-500/30 px-6 py-4 flex justify-between items-center animate-in slide-in-from-top-4 backdrop-blur-sm shadow-inner">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center bg-indigo-500 text-white font-black text-xs w-6 h-6 rounded-full">{selectedIds.size}</span>
            <span className="text-sm font-bold text-indigo-200 tracking-wide">Tasks Selected</span>
          </div>
          <div className="flex items-center gap-3">
            <select 
              onChange={e => { if (e.target.value) handleBulkStatusChange(e.target.value); e.target.value=''; }}
              className="bg-slate-900 border border-slate-600 text-xs font-black uppercase tracking-widest text-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-inner"
              defaultValue=""
            >
              <option value="" disabled>Change Status...</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done</option>
            </select>
            <button onClick={handleBulkDelete} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all hover:shadow-[0_0_15px_rgba(239,68,68,0.3)]">
              Delete All
            </button>
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="text-center py-24 bg-slate-800/20 border-t border-slate-700/30 border-dashed">
          <p className="text-slate-400 font-bold mb-4 tracking-wide">No tasks yet. Spawn your first task via the Kanban board.</p>
        </div>
      ) : (
        <div className="overflow-x-auto hide-scrollbar">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-800/80 text-[10px] uppercase tracking-widest font-black text-slate-400 border-b border-slate-700 shadow-sm backdrop-blur-sm">
              <tr>
                <th className="px-5 py-4 w-12 text-center">
                  <input type="checkbox" checked={selectedIds.size === tasks.length && tasks.length > 0} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-600 bg-slate-700 accent-blue-500 cursor-pointer" />
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('title')}>
                  <div className="flex items-center gap-2">Task Title {sortConfig.key === 'title' && <span className="text-blue-400 text-xs">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}</div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('milestone_name')}>
                  <div className="flex items-center gap-2">Milestone {sortConfig.key === 'milestone_name' && <span className="text-blue-400 text-xs">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}</div>
                </th>
                <th className="px-6 py-4">Assignee</th>
                <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('due_date')}>
                  <div className="flex items-center gap-2">Due Date {sortConfig.key === 'due_date' && <span className="text-blue-400 text-xs">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}</div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('priority')}>
                  <div className="flex items-center gap-2">Priority {sortConfig.key === 'priority' && <span className="text-blue-400 text-xs">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}</div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('status')}>
                  <div className="flex items-center gap-2">Status {sortConfig.key === 'status' && <span className="text-blue-400 text-xs">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {sortedTasks.map(task => {
                const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
                return (
                  <tr key={task.id} className={`hover:bg-slate-700/40 transition-colors group ${selectedIds.has(task.id) ? 'bg-indigo-900/10' : ''}`}>
                    <td className="px-5 py-4 text-center">
                      <input type="checkbox" checked={selectedIds.has(task.id)} onChange={() => toggleSelect(task.id)} className="w-4 h-4 rounded border-slate-600 bg-slate-700 accent-blue-500 cursor-pointer" />
                    </td>
                    <td className="px-6 py-4 font-bold text-white max-w-[280px] truncate group-hover:text-blue-400 transition-colors">{task.title}</td>
                    <td className="px-6 py-4">
                      {task.milestone_name ? (
                        <span className="text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 bg-indigo-500/10 text-indigo-400 rounded-md border border-indigo-500/20 shadow-inner truncate max-w-[150px] inline-block">{task.milestone_name}</span>
                      ) : <span className="text-slate-600 font-black">-</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {task.assignee_name ? (
                          <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center text-[10px] font-extrabold text-white shadow-inner border border-slate-500" title={task.assignee_name}>{task.assignee_name.charAt(0)}</div>
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-600 border-dashed flex items-center justify-center text-slate-500 text-[10px] font-extrabold shadow-inner">?</div>
                        )}
                        <span className="text-[11px] font-bold text-slate-400 truncate max-w-[100px]">{task.assignee_name || 'Unassigned'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {task.due_date ? (
                        <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-md border shadow-sm ${isOverdue ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-slate-400 bg-slate-800 border-slate-700'}`}>
                          {new Date(task.due_date).toLocaleDateString()}
                        </span>
                      ) : <span className="text-slate-600 font-black">-</span>}
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => handlePriorityCycle(task)}
                        className={`px-3 py-1.5 text-[10px] uppercase font-black tracking-widest rounded-md border hover:opacity-80 transition-all shadow-inner ${priorityColors[task.priority] || priorityColors.low}`}
                      >
                        {task.priority || 'low'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <select 
                        value={task.status}
                        onChange={(e) => updateTaskOptimistic(task.id, { status: e.target.value })}
                        className={`text-[10px] font-black uppercase tracking-widest rounded-md px-3 py-1.5 focus:outline-none border shadow-inner cursor-pointer transition-colors ${task.status === 'done' ? 'bg-green-500/10 text-green-400 border-green-500/30' : task.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-slate-800 text-slate-300 border-slate-600 hover:border-slate-500'}`}
                      >
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="blocked">Blocked</option>
                        <option value="done">Done</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TaskList;
