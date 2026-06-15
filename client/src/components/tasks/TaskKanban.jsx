import React, { useState } from 'react';
import { Badge, Button } from '../ui';
import styles from './TaskKanban.module.css';

export default function TaskKanban({ projectId }) {
  const columns = [
    { id: 'todo', name: 'To Do', color: '#E5E1D8' },
    { id: 'in_progress', name: 'In Progress', color: '#3B82F6' },
    { id: 'blocked', name: 'Blocked', color: '#F59E0B' },
    { id: 'done', name: 'Done', color: '#10B981' }
  ];

  const [tasks, setTasks] = useState([
    { id: 1, title: 'Finalize kitchen layout', status: 'todo', priority: 'high', milestone: 'Design Concept', assignee: 'Priya Desai', dueDate: '2026-08-10', overdue: true, subtasks: { done: 1, total: 3 }, blocked: false },
    { id: 2, title: 'Order materials for living room', status: 'in_progress', priority: 'medium', milestone: 'Execution', assignee: 'Rahul Sharma', dueDate: '2026-09-01', overdue: false, subtasks: null, blocked: false },
    { id: 3, title: 'Client approval on tiles', status: 'blocked', priority: 'urgent', milestone: 'Execution', assignee: 'Priya Desai', dueDate: '2026-08-15', overdue: false, subtasks: null, blocked: true },
  ]);

  const [toastMsg, setToastMsg] = useState(null);

  const getPriorityVariant = (p) => {
    switch(p) {
      case 'low': return 'neutral';
      case 'medium': return 'info';
      case 'high': return 'warning';
      case 'urgent': return 'danger';
      default: return 'neutral';
    }
  };

  const handleDragStart = (e, task) => {
    e.dataTransfer.setData('taskId', task.id);
  };

  const handleDrop = (e, targetStatus) => {
    const taskId = parseInt(e.dataTransfer.getData('taskId'));
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    if (targetStatus === 'done' && task.subtasks && task.subtasks.done < task.subtasks.total) {
      setToastMsg(`${task.subtasks.total - task.subtasks.done} subtasks still open. Complete them first.`);
      setTimeout(() => setToastMsg(null), 3000);
      return;
    }

    setTasks(tasks.map(t => t.id === taskId ? { ...t, status: targetStatus, blocked: targetStatus === 'blocked' } : t));
  };

  const handleDragOver = (e) => e.preventDefault();

  return (
    <div style={{position: 'relative', height: '100%'}}>
      {toastMsg && (
        <div style={{position: 'absolute', top: 10, right: 10, background: 'var(--color-danger)', color: 'white', padding: '8px 16px', borderRadius: '4px', zIndex: 100, boxShadow: 'var(--shadow-md)'}}>
          {toastMsg}
        </div>
      )}
      <div className={styles.board}>
        {columns.map(col => {
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
                {colTasks.map(task => (
                  <div 
                    key={task.id} 
                    className={`${styles.taskCard} ${task.blocked ? styles.taskCardBlocked : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task)}
                  >
                    <div className={styles.taskTitle}>{task.title || task.name}</div>
                    
                    <div className={styles.tagsRow}>
                      <Badge variant={getPriorityVariant(task.priority)} size="sm">{task.priority}</Badge>
                      {task.milestone && <Badge variant="accent" size="sm"><span style={{maxWidth: '80px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'inline-block'}}>{task.milestone}</span></Badge>}
                      {task.blocked && <span className={styles.blockedLabel}>Blocked</span>}
                      {task.subtasks && <span className={styles.subtaskProg}>{task.subtasks.done}/{task.subtasks.total} ⊡</span>}
                    </div>

                    <div className={styles.bottomRow}>
                      <div className={styles.assignee}>
                        <div className={styles.avatar}>{task.assignee.charAt(0)}</div>
                      </div>
                      <span className={task.overdue ? styles.dateOverdue : styles.date}>{task.dueDate}</span>
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
