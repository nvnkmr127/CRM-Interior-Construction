import React, { useState, useEffect } from 'react';
import { Badge, Button } from '../ui';
import styles from './TaskKanban.module.css';
import { getTasks, updateTask } from '../../api/projects';
import { useToast } from '../../store/toastContext';

const COLUMNS = [
  { id: 'todo',        name: 'To Do',       color: '#E5E1D8' },
  { id: 'in_progress', name: 'In Progress', color: '#3B82F6' },
  { id: 'blocked',     name: 'Blocked',     color: '#F59E0B' },
  { id: 'done',        name: 'Done',        color: '#10B981' },
];

function getPriorityVariant(p) {
  return { low: 'neutral', medium: 'info', high: 'warning', urgent: 'danger' }[p] || 'neutral';
}

function isTaskOverdue(dueDate) {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

function formatDue(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function normalizeTask(t) {
  return {
    id: t.id,
    title: t.title,
    status: t.status || 'todo',
    priority: t.priority || 'medium',
    milestone: t.milestone_name || t.milestone || null,
    assignee: t.assignee_name || t.assignee || null,
    dueDate: t.due_date || t.dueDate || null,
    overdue: isTaskOverdue(t.due_date || t.dueDate),
    blocked: t.status === 'blocked',
  };
}

export default function TaskKanban({ projectId }) {
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState(null);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    getTasks(projectId)
      .then(res => {
        const raw = res.data?.data || res.data || [];
        setTasks(raw.map(normalizeTask));
      })
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleDragStart = (e, task) => {
    e.dataTransfer.setData('taskId', String(task.id));
  };

  const handleDrop = async (e, targetStatus) => {
    const taskId = e.dataTransfer.getData('taskId');
    const task = tasks.find(t => String(t.id) === taskId);
    if (!task || task.status === targetStatus) return;

    // Optimistic update
    setTasks(prev => prev.map(t =>
      String(t.id) === taskId
        ? { ...t, status: targetStatus, blocked: targetStatus === 'blocked' }
        : t
    ));

    try {
      await updateTask(projectId, taskId, { status: targetStatus });
    } catch {
      setTasks(prev => prev.map(t =>
        String(t.id) === taskId ? { ...t, status: task.status, blocked: task.blocked } : t
      ));
      toast.error('Failed to update task status');
    }
  };

  const handleDragOver = (e) => e.preventDefault();

  if (loading) {
    return (
      <div style={{ padding: '32px', color: 'var(--color-text-muted)' }}>Loading tasks…</div>
    );
  }

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      {toastMsg && (
        <div style={{
          position: 'absolute', top: 10, right: 10, zIndex: 100,
          background: 'var(--color-danger)', color: '#fff',
          padding: '8px 16px', borderRadius: 4, boxShadow: 'var(--shadow-md)',
        }}>
          {toastMsg}
        </div>
      )}
      <div className={styles.board}>
        {COLUMNS.map(col => {
          const colTasks = tasks.filter(t => t.status === col.id);
          return (
            <div
              key={col.id}
              className={styles.column}
              style={{ '--col-color': col.color }}
              onDrop={(e) => handleDrop(e, col.id)}
              onDragOver={handleDragOver}
            >
              <div className={styles.colHeader}>
                <div className={styles.colTitle}>
                  {col.name} <Badge variant="neutral" size="sm">{colTasks.length}</Badge>
                </div>
                <Button variant="ghost" size="sm">+</Button>
              </div>
              <div className={styles.colBody}>
                {colTasks.length === 0 && (
                  <div style={{ padding: '16px 8px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
                    Drop tasks here
                  </div>
                )}
                {colTasks.map(task => (
                  <div
                    key={task.id}
                    className={`${styles.taskCard} ${task.blocked ? styles.taskCardBlocked : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task)}
                  >
                    <div className={styles.taskTitle}>{task.title}</div>

                    <div className={styles.tagsRow}>
                      <Badge variant={getPriorityVariant(task.priority)} size="sm">{task.priority}</Badge>
                      {task.milestone && (
                        <Badge variant="accent" size="sm">
                          <span style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>
                            {task.milestone}
                          </span>
                        </Badge>
                      )}
                      {task.blocked && <span className={styles.blockedLabel}>Blocked</span>}
                    </div>

                    <div className={styles.bottomRow}>
                      <div className={styles.assignee}>
                        {task.assignee
                          ? <div className={styles.avatar}>{task.assignee.charAt(0)}</div>
                          : <div className={styles.avatar} style={{ opacity: 0.3 }}>?</div>
                        }
                      </div>
                      {task.dueDate && (
                        <span className={task.overdue ? styles.dateOverdue : styles.date}>
                          {formatDue(task.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
