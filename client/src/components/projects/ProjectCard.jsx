import React from 'react';
import { Badge } from '../ui';
import styles from './ProjectCard.module.css';

export default function ProjectCard({ project, onClick }) {
  const getProgressColor = (val) => {
    if (val > 80) return 'var(--color-success)';
    if (val >= 50) return 'var(--color-warning)';
    return '#DC143C'; // crimson
  };

  const getStatusVariant = (st) => {
    if(st === 'Active') return 'info';
    if(st === 'Completed') return 'success';
    if(st === 'Overdue') return 'danger';
    return 'neutral';
  };

  return (
    <div className={styles.card} onClick={onClick}>
      <div className={styles.topRow}>
        <div className={styles.typeIcon}>{project.type === 'Residential' ? '🏠' : '🏢'}</div>
        <Badge variant={getStatusVariant(project.status)} dot>{project.status}</Badge>
      </div>

      <div className={styles.titleBlock}>
        <span className={styles.projName}>{project.name}</span>
        <span className={styles.clientName}>{project.clientName}</span>
      </div>

      <div className={styles.pmRow}>
        <div className={styles.pmAvatar}>{project.pmName.charAt(0)}</div>
        <span className={styles.pmName}>{project.pmName}</span>
      </div>

      <div className={styles.progressWrap}>
        <div className={styles.progressTrack}>
          <div 
            className={styles.progressFill} 
            style={{ width: `${project.progress}%`, backgroundColor: getProgressColor(project.progress) }}
          />
        </div>
        <span className={styles.progressLabel}>{project.completedTasks}/{project.totalTasks} tasks done</span>
      </div>

      <div className={styles.phaseChip}>{project.phase}</div>

      <div className={styles.bottomRow}>
        <span className={styles.value}>{project.value}</span>
        <span className={project.overdue ? styles.dateOverdue : styles.date}>
          {project.targetDate}
        </span>
      </div>
    </div>
  );
}
