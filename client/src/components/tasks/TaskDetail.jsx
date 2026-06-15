import React, { useState, useEffect } from 'react';
import { getTask, updateTask, addTaskComment, createTask } from '../../api/tasks';
import Drawer from '../ui/Drawer';
import { Badge, Button, Spinner, Avatar } from '../ui';
import { Link } from 'react-router-dom';

export default function TaskDetail({ projectId, taskId, isOpen, onClose, onTaskUpdated }) {
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);

  // Edits
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState('');

  // Subtasks
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Comments
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    if (isOpen && taskId && projectId) {
      fetchTask();
    } else {
      setTask(null);
    }
    // eslint-disable-next-line
  }, [isOpen, taskId, projectId]);

  const fetchTask = async () => {
    setLoading(true);
    try {
      const res = await getTask(projectId, taskId);
      const data = res.data?.data || res.data;
      setTask(data);
      setEditTitle(data.title);
      setEditDesc(data.description || '');
    } catch (e) {
      console.error('Failed to fetch task details', e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (updates) => {
    try {
      setTask(prev => ({ ...prev, ...updates }));
      await updateTask(projectId, taskId, updates);
      if (onTaskUpdated) onTaskUpdated();
    } catch (e) {
      console.error('Failed to update task', e);
      fetchTask(); // revert
    }
  };

  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    if (editTitle !== task.title && editTitle.trim() !== '') {
      handleUpdate({ title: editTitle });
    } else {
      setEditTitle(task.title);
    }
  };

  const handleDescBlur = () => {
    setIsEditingDesc(false);
    if (editDesc !== task.description) {
      handleUpdate({ description: editDesc });
    }
  };

  const handleToggleSubtask = async (subtask) => {
    const newStatus = subtask.status === 'done' ? 'todo' : 'done';
    try {
      const newSubtasks = task.subtasks.map(st => st.id === subtask.id ? { ...st, status: newStatus } : st);
      setTask(prev => ({ ...prev, subtasks: newSubtasks }));
      await updateTask(projectId, subtask.id, { status: newStatus });
    } catch (e) {
      console.error(e);
      fetchTask();
    }
  };

  const handleAddSubtask = async (e) => {
    if (e.key === 'Enter' && newSubtaskTitle.trim()) {
      try {
        await createTask(projectId, { title: newSubtaskTitle, parentTaskId: taskId });
        setNewSubtaskTitle('');
        fetchTask();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    try {
      await addTaskComment(projectId, taskId, newComment);
      setNewComment('');
      fetchTask();
    } catch (err) {
      console.error('Failed to post comment', err);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'danger';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'neutral';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'todo': return 'neutral';
      case 'in_progress': return 'primary';
      case 'in_review': return 'warning';
      case 'done': return 'success';
      default: return 'neutral';
    }
  };

  if (!isOpen) return null;

  return (
    <Drawer isOpen={isOpen} onClose={onClose} width={520} title="">
      {loading || !task ? (
        <div className="flex justify-center items-center h-full">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="flex flex-col h-full bg-slate-900 text-slate-200">
          
          {/* HEADER */}
          <div className="p-6 border-b border-slate-700 bg-slate-800 shrink-0">
            <div className="flex justify-between items-start mb-3">
              <div className="flex gap-2">
                <Badge variant={getPriorityColor(task.priority)} className="uppercase text-[10px]">{task.priority || 'No Priority'}</Badge>
                <Badge variant={getStatusColor(task.status)} className="uppercase text-[10px]">{task.status.replace('_', ' ')}</Badge>
              </div>
              <div>
                {task.status !== 'done' ? (
                  <Button variant="success" size="sm" onClick={() => handleUpdate({ status: 'done' })}>Complete Task</Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => handleUpdate({ status: 'todo' })}>Reopen Task</Button>
                )}
              </div>
            </div>

            {isEditingTitle ? (
              <input
                autoFocus
                type="text"
                className="w-full bg-slate-900 border border-blue-500 rounded px-2 py-1 text-xl font-bold text-white outline-none"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={e => e.key === 'Enter' && e.target.blur()}
              />
            ) : (
              <h2 
                className="text-2xl font-bold text-white cursor-text hover:bg-slate-700/50 rounded px-1 -mx-1 transition-colors"
                onClick={() => setIsEditingTitle(true)}
              >
                {task.title}
              </h2>
            )}
          </div>

          {/* BODY */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-8">
            
            {/* LEFT COLUMN: Details */}
            <div className="flex-1 space-y-6">
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Assignee</label>
                <div className="flex items-center gap-3 bg-slate-800/50 p-2 rounded-lg border border-slate-700 hover:border-slate-500 cursor-pointer transition-colors">
                  <Avatar name={task.assignee_name || 'Unassigned'} size="sm" />
                  <span className="text-sm font-medium text-white">{task.assignee_name || 'Unassigned'}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Due Date</label>
                <input 
                  type="date"
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none hover:border-slate-500 transition-colors focus:border-blue-500 cursor-pointer"
                  value={task.due_date ? task.due_date.split('T')[0] : ''}
                  onChange={e => handleUpdate({ dueDate: e.target.value || null })}
                />
              </div>

              {task.milestone_name && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Milestone</label>
                  <p className="text-sm font-medium text-slate-300">🎯 {task.milestone_name}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Project</label>
                <Link to={`/projects/${task.project_id}`} className="text-sm font-medium text-blue-400 hover:underline">
                  {task.project_name || `Project #${task.project_id.substring(0,8)}`}
                </Link>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tags</label>
                <div className="flex flex-wrap gap-2">
                  {task.tags && task.tags.map(t => (
                    <Badge key={t} variant="neutral">{t}</Badge>
                  ))}
                  <button className="text-xs font-medium text-slate-400 hover:text-white bg-slate-800 px-2 py-1 rounded border border-dashed border-slate-600 transition-colors">
                    + Add
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</label>
                {isEditingDesc ? (
                  <textarea
                    autoFocus
                    className="w-full bg-slate-900 border border-blue-500 rounded px-3 py-2 text-sm text-white outline-none min-h-[100px]"
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    onBlur={handleDescBlur}
                  />
                ) : (
                  <div 
                    className="text-sm text-slate-300 bg-slate-800/30 border border-transparent hover:border-slate-700 p-3 rounded-lg min-h-[100px] cursor-text whitespace-pre-wrap transition-colors"
                    onClick={() => setIsEditingDesc(true)}
                  >
                    {task.description || <span className="text-slate-500 italic">Click to add description...</span>}
                  </div>
                )}
              </div>

            </div>

            {/* RIGHT COLUMN: Subtasks + Comments */}
            <div className="flex-1 space-y-8 border-l border-slate-700/50 pl-6">
              
              {/* SUBTASKS */}
              <section>
                <div className="flex justify-between items-end mb-4">
                  <h3 className="text-sm font-bold text-white">Subtasks</h3>
                  {task.subtasks?.length > 0 && (
                    <span className="text-xs text-slate-400">
                      {task.subtasks.filter(st => st.status === 'done').length}/{task.subtasks.length} done
                    </span>
                  )}
                </div>
                
                <div className="space-y-2 mb-3">
                  {task.subtasks?.map(st => (
                    <div key={st.id} className="flex items-start gap-3 group">
                      <button 
                        onClick={() => handleToggleSubtask(st)}
                        className={`mt-0.5 w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 transition-colors ${st.status === 'done' ? 'bg-green-500 border-green-500 text-white' : 'bg-transparent border-slate-500 hover:border-blue-400'}`}
                      >
                        {st.status === 'done' && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                      </button>
                      <span className={`text-sm ${st.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-300 group-hover:text-white'} transition-colors`}>
                        {st.title}
                      </span>
                    </div>
                  ))}
                </div>
                
                <input 
                  type="text"
                  className="w-full bg-slate-800/50 border border-slate-700 rounded px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500 transition-colors"
                  placeholder="+ Add Subtask"
                  value={newSubtaskTitle}
                  onChange={e => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={handleAddSubtask}
                />
              </section>

              {/* COMMENTS */}
              <section className="flex flex-col h-full">
                <h3 className="text-sm font-bold text-white mb-4">Comments</h3>
                
                <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar">
                  {task.comments?.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No comments yet.</p>
                  ) : (
                    task.comments?.map(c => (
                      <div key={c.id} className="flex gap-3">
                        <Avatar name={c.user_name} size="sm" className="shrink-0" />
                        <div className="flex-1 bg-slate-800 rounded-lg rounded-tl-none p-3 border border-slate-700 shadow-sm">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-white">{c.user_name}</span>
                            <span className="text-[10px] text-slate-500">{new Date(c.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                          </div>
                          <p className="text-sm text-slate-300 whitespace-pre-wrap">{c.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-auto">
                  <textarea 
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white outline-none focus:border-blue-500 transition-colors resize-none mb-2"
                    rows="2"
                    placeholder="Write a comment..."
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handlePostComment();
                      }
                    }}
                  />
                  <div className="flex justify-end">
                    <Button variant="primary" size="sm" onClick={handlePostComment} disabled={!newComment.trim()}>
                      Post Comment
                    </Button>
                  </div>
                </div>
              </section>

            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}
