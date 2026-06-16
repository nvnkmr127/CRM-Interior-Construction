import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { formatDistanceToNow, isPast } from 'date-fns';
import { logActivity } from '../../api/leads';

export default function TaskWidget({ leadId, reps }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', due_date: '', assigned_to: '' });

  const fetchTasks = async () => {
    if (!leadId) return;
    setLoading(true);
    try {
      const res = await api.get(`/tasks?lead_id=${leadId}&status=open`);
      setTasks(res.data?.data || []);
    } catch (e) {
      console.error('Failed to fetch tasks', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [leadId]);

  const handleCompleteTask = async (task) => {
    try {
      await api.patch(`/tasks/${task.id}`, { status: 'done' });
      // Log task_completed activity
      await logActivity(leadId, { 
        type: 'task_completed', 
        notes: `Completed task: ${task.title}` 
      });
      setTasks(prev => prev.filter(t => t.id !== task.id));
    } catch (e) {
      alert('Failed to complete task.');
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTask.title || !newTask.due_date) return;
    try {
      const res = await api.post('/tasks', {
        lead_id: leadId,
        title: newTask.title,
        due_date: newTask.due_date,
        assigned_to: newTask.assigned_to || null,
        status: 'open',
        priority: 'medium'
      });
      setTasks(prev => [res.data?.data || res.data, ...prev]);
      setIsAdding(false);
      setNewTask({ title: '', due_date: '', assigned_to: '' });
      await logActivity(leadId, { 
        type: 'note', 
        notes: `Scheduled task: ${newTask.title} due on ${newTask.due_date}` 
      });
    } catch (e) {
      alert('Failed to add task.');
    }
  };

  if (loading) {
    return <div className="p-4 text-sm text-gray-500">Loading tasks...</div>;
  }

  return (
    <div className="mt-8 border-t pt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg text-gray-800">Open Tasks</h3>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="text-sm font-medium text-blue-600 hover:text-blue-800 focus:outline-none"
        >
          {isAdding ? 'Cancel' : '+ Add Task'}
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAddTask} className="mb-4 p-3 bg-gray-50 border rounded-lg space-y-3">
          <input
            type="text"
            required
            placeholder="What needs to be done?"
            value={newTask.title}
            onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
            className="w-full rounded border border-gray-300 p-2 text-sm outline-none focus:border-blue-500"
          />
          <div className="flex gap-2">
            <input
              type="date"
              required
              value={newTask.due_date}
              onChange={(e) => setNewTask(prev => ({ ...prev, due_date: e.target.value }))}
              className="flex-1 rounded border border-gray-300 p-2 text-sm outline-none focus:border-blue-500"
            />
            <select
              value={newTask.assigned_to}
              onChange={(e) => setNewTask(prev => ({ ...prev, assigned_to: e.target.value }))}
              className="flex-1 rounded border border-gray-300 p-2 text-sm outline-none focus:border-blue-500 bg-white"
            >
              <option value="">Assign to...</option>
              {reps?.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white font-medium text-sm py-2 rounded hover:bg-blue-700 transition">
            Save Task
          </button>
        </form>
      )}

      {tasks.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No open tasks for this lead.</p>
      ) : (
        <div className="space-y-2">
          {tasks.map(task => {
            const isOverdue = task.due_date && isPast(new Date(task.due_date));
            return (
              <div 
                key={task.id} 
                className={`flex items-start gap-3 p-3 rounded-lg border bg-white shadow-sm transition-colors ${
                  isOverdue ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="mt-0.5">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                    onChange={() => handleCompleteTask(task)}
                    title="Mark as done"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">{task.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs">
                    <span className={`font-semibold ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                      {isOverdue ? 'Overdue' : 'Due'}: {task.due_date ? formatDistanceToNow(new Date(task.due_date), { addSuffix: true }) : 'No date'}
                    </span>
                    {task.assignee_name && (
                      <span className="text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                        {task.assignee_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
