import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { createTask, updateTask, bulkCreateTasks, getProject, getTasks } from '../../api/projects';

const TaskForm = ({ projectId, milestoneId: initialMilestoneId, task, onSave, onClose }) => {
  const [mode, setMode] = useState('single'); // 'single' | 'bulk'
  
  // Single form state
  const [formData, setFormData] = useState({
    title: task?.title || '',
    description: task?.description || '',
    milestoneId: task?.milestone_id || initialMilestoneId || '',
    assigneeId: task?.assignee_id || '',
    dueDate: task?.due_date ? task.due_date.split('T')[0] : '',
    priority: task?.priority || 'low',
    tags: task?.tags ? task.tags.join(', ') : '',
    parentTaskId: task?.parent_task_id || ''
  });

  // Bulk form state
  const [bulkText, setBulkText] = useState('');

  // Dropdown options
  const [users, setUsers] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [parentTasks, setParentTasks] = useState([]);

  // Errors
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Fetch user dictionary map
    api.get('/users').then(res => setUsers(res.data.data)).catch(() => {});
    
    // Dehydrate the project phases tree to extract isolated milestone endpoints
    getProject(projectId).then(res => {
      const p = res.data.data;
      if (p && p.phases) {
        const ms = [];
        p.phases.forEach(phase => {
          if (phase.milestones) {
            phase.milestones.forEach(m => ms.push({ ...m, phaseName: phase.name }));
          }
        });
        setMilestones(ms);
      }
    }).catch(() => {});

    // Fetch potential parent tasks to support infinite nesting subtask structure mapping
    getTasks(projectId, { limit: 100 }).then(res => {
      setParentTasks(res.data.data.filter(t => t.id !== task?.id));
    }).catch(() => {});
  }, [projectId, task]);

  const handleSingleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setSubmitting(true);

    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        priority: formData.priority
      };
      
      if (formData.milestoneId) payload.milestoneId = formData.milestoneId;
      if (formData.assigneeId) payload.assigneeId = formData.assigneeId;
      if (formData.dueDate) payload.dueDate = formData.dueDate;
      if (formData.parentTaskId) payload.parentTaskId = formData.parentTaskId;
      if (formData.tags) payload.tags = formData.tags.split(',').map(t => t.trim()).filter(t => t);

      let savedTask;
      if (task) {
        const res = await updateTask(projectId, task.id, payload);
        savedTask = res.data.data;
      } else {
        const res = await createTask(projectId, payload);
        savedTask = res.data.data;
      }
      onSave(savedTask);
    } catch (error) {
      if (error.response?.data?.details) {
        const validationErrors = {};
        error.response.data.details.forEach(err => {
          validationErrors[err.path?.[0] || 'general'] = err.message;
        });
        setErrors(validationErrors);
      } else {
        setErrors({ general: error.response?.data?.message || 'Failed to sync task modifications.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setSubmitting(true);

    try {
      const lines = bulkText.split('\n').map(t => t.trim()).filter(t => t);
      if (lines.length === 0) throw new Error('Input field is empty.');

      const payload = lines.map(title => ({
        title,
        milestoneId: initialMilestoneId || undefined
      }));

      await bulkCreateTasks(projectId, payload);
      onSave(null); // Execute generic re-render trigger hook
    } catch (error) {
      setErrors({ general: error.message || 'Fatal error executing bulk ingestion pipeline.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8 w-full max-w-2xl mx-auto shadow-black/50">
      <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-800/30">
        <h2 className="text-xl font-black text-white tracking-tight">{task ? 'Edit Configuration' : 'New Task Instance'}</h2>
        {!task && (
          <div className="bg-slate-900 rounded-lg p-1 border border-slate-700 flex shadow-inner">
            <button 
              onClick={() => setMode('single')} 
              className={`px-4 py-1.5 text-[10px] uppercase tracking-widest font-extrabold transition-all rounded-md ${mode === 'single' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
            >
              Standard
            </button>
            <button 
              onClick={() => setMode('bulk')} 
              className={`px-4 py-1.5 text-[10px] uppercase tracking-widest font-extrabold transition-all rounded-md ${mode === 'bulk' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
            >
              Bulk Mode
            </button>
          </div>
        )}
      </div>

      <div className="p-8">
        {errors.general && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] font-black uppercase tracking-wider rounded-lg shadow-inner">
            {errors.general}
          </div>
        )}

        {mode === 'single' ? (
          <form onSubmit={handleSingleSubmit} className="space-y-6 animate-in fade-in duration-200">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Task Title *</label>
              <input
                autoFocus
                type="text"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                className={`w-full bg-slate-900/50 border rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-medium ${errors.title ? 'border-red-500/50' : 'border-slate-700'}`}
              />
              {errors.title && <p className="text-red-400 text-xs mt-1.5 font-bold">{errors.title}</p>}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Scope Description</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 min-h-[120px] transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Milestone Bridge</label>
                <select
                  value={formData.milestoneId}
                  onChange={e => setFormData({ ...formData, milestoneId: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all text-sm cursor-pointer"
                >
                  <option value="">No Milestone Dependency</option>
                  {milestones.map(m => (
                    <option key={m.id} value={m.id}>{m.phaseName} - {m.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Assign Worker</label>
                <select
                  value={formData.assigneeId}
                  onChange={e => setFormData({ ...formData, assigneeId: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all text-sm cursor-pointer"
                >
                  <option value="">Unassigned Floating Task</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Target Date</label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all text-sm cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Priority Level</label>
                <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700 shadow-inner">
                  {['low', 'medium', 'high', 'urgent'].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setFormData({ ...formData, priority: p })}
                      className={`flex-1 px-2 py-2 text-[9px] font-black uppercase tracking-wider rounded-md transition-all ${formData.priority === p ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Parent Subtask Node</label>
                <select
                  value={formData.parentTaskId}
                  onChange={e => setFormData({ ...formData, parentTaskId: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all text-sm cursor-pointer"
                >
                  <option value="">Top-Level Root Task</option>
                  {parentTasks.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Metadata Tags</label>
                <input
                  type="text"
                  placeholder="electrical, kitchen, compliance..."
                  value={formData.tags}
                  onChange={e => setFormData({ ...formData, tags: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all text-sm placeholder:text-slate-600"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-8 border-t border-slate-800 mt-8">
              <button type="button" onClick={onClose} className="px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors">Abort</button>
              <button type="submit" disabled={submitting} className="px-8 py-3 text-xs font-black uppercase tracking-widest bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 disabled:opacity-50">
                {submitting ? 'Encrypting...' : task ? 'Commit Update' : 'Initialize Task'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleBulkSubmit} className="space-y-6 animate-in fade-in duration-200">
            <div>
              <div className="flex justify-between items-end mb-3">
                <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Rapid Ingestion Pipeline</label>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest bg-slate-800 px-2 py-1 rounded">One task per line strict</span>
              </div>
              <textarea
                autoFocus
                placeholder="Buy raw materials&#10;Install wiring conduits&#10;Call electrical inspector"
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                className="w-full bg-slate-900 border border-indigo-500/30 rounded-xl px-5 py-5 text-white text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 min-h-[300px] leading-relaxed shadow-inner placeholder:text-slate-700"
              />
            </div>
            
            <div className="flex justify-end gap-3 pt-8 border-t border-slate-800">
              <button type="button" onClick={onClose} className="px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors">Abort</button>
              <button type="submit" disabled={submitting} className="px-8 py-3 text-xs font-black uppercase tracking-widest bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] hover:-translate-y-0.5 disabled:opacity-50 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {submitting ? 'Executing...' : 'Bulk Generate Vectors'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default TaskForm;
