import React, { useState, useEffect } from 'react';
import { Modal, Button } from '../ui';
import { createGlobalTask } from '../../api/tasks';
import { getProjects } from '../../api/projects';
import { useToast } from '../../store/toastContext';

export default function GlobalTaskFormModal({ isOpen, onClose, onSuccess }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setDueDate('');
      setProjectId('');
      
      // Fetch projects for dropdown
      getProjects()
        .then(res => {
          if (res.data?.success) {
            setProjects(res.data.data);
          }
        })
        .catch(err => {
          console.error("Failed to fetch projects", err);
        });
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    setSubmitting(true);
    try {
      const taskData = {
        title,
        description,
        priority,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        project_id: projectId || null,
        status: 'todo'
      };
      
      await createGlobalTask(taskData);
      toast.success('Task created successfully');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Task">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '400px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>Task Title *</label>
          <input 
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
            placeholder="E.g., Review architectural drawings"
            required
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>Project (Optional)</label>
          <select
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
          >
            <option value="">No Project</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>Due Date</label>
          <input 
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>Priority</label>
          <select
            value={priority}
            onChange={e => setPriority(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>Description</label>
          <textarea 
            value={description}
            onChange={e => setDescription(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', minHeight: '100px', resize: 'vertical' }}
            placeholder="Add more details about the task..."
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Task'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
