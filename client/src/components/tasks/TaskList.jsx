import React from 'react';
import { Badge } from '../ui';
import styles from './TaskList.module.css';

export default function TaskList() {
  const tasks = [
    { id: 1, title: 'Finalize kitchen layout', status: 'To Do', priority: 'High', assignee: 'Priya Desai', dueDate: '2026-08-10' },
  ];
  return (
    <div className={styles.list}>
      {tasks.map(t => (
        <div key={t.id} className={styles.row}>
          <div className={styles.left}>
            <input type="checkbox" />
            <span className={styles.title}>{t.title}</span>
            <Badge variant="warning" size="sm">{t.priority}</Badge>
          </div>
          <div className={styles.right}>
            <Badge variant="neutral" size="sm">{t.status}</Badge>
            <span style={{fontSize: '12px', color: 'var(--color-text-secondary)'}}>{t.dueDate}</span>
            <div className={styles.avatar}>{t.assignee.charAt(0)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
