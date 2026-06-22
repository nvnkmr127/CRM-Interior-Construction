import React from 'react';
import styles from './ProjectCard.module.css';

const STATUS_MAP = {
  active:    { label: 'Active',    color: 'var(--color-info)',    bg: 'var(--color-info-bg)' },
  completed: { label: 'Completed', color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
  on_hold:   { label: 'On Hold',   color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
  overdue:   { label: 'Overdue',   color: 'var(--color-danger)',  bg: 'var(--color-danger-bg)' },
  cancelled: { label: 'Cancelled', color: 'var(--color-text-secondary)', bg: 'var(--color-surface-2)' },
};

function getProgressColor(val) {
  if (val >= 80) return 'var(--color-success)';
  if (val >= 50) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

function formatValue(val) {
  if (!val) return null;
  const num = typeof val === 'string' ? parseFloat(val.replace(/[^\d.]/g, '')) : val;
  if (isNaN(num)) return val;
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
  return `₹${num.toLocaleString('en-IN')}`;
}

export default function ProjectCard({ project, onClick }) {
  const displayProject = project || {
    name: "Luxury Villa Interior - Phase 1",
    client_name: "Mr. Sharma",
    pm_name: "Rahul K.",
    type: "Residential",
    status: "active",
    progress: 65,
    completedTasks: 12,
    totalTasks: 20,
    phase: "Execution",
    value: 4500000,
    target_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    overdue: false
  };

  const statusKey = displayProject.overdue ? 'overdue' : (displayProject.status?.toLowerCase() || 'active');
  const statusInfo = STATUS_MAP[statusKey] || STATUS_MAP.active;

  const progress = displayProject.progress || 0;
  const pmName = displayProject.pm_name || displayProject.pmName || '';
  const clientName = displayProject.client_name || displayProject.clientName || '';
  const targetDate = displayProject.target_date || displayProject.targetDate;
  const isResidential = (displayProject.type || '').toLowerCase() === 'residential';

  const deadlineStr = targetDate
    ? new Date(targetDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className={styles.card} onClick={onClick} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onClick?.()}>
      {/* Top row: type icon + status badge */}
      <div className={styles.topRow}>
        <span className={styles.typeIcon} title={displayProject.type || 'Project'}>
          {isResidential ? (
            <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 2L2 8v10h5v-5h6v5h5V8L10 2z" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
              <rect x="2" y="5" width="16" height="13" rx="1" />
              <rect x="6" y="2" width="8" height="4" rx="1" />
              <rect x="5" y="9" width="3" height="3" fill="white" opacity="0.7" />
              <rect x="12" y="9" width="3" height="3" fill="white" opacity="0.7" />
            </svg>
          )}
        </span>

        <span
          className={styles.statusBadge}
          style={{ color: statusInfo.color, background: statusInfo.bg }}
        >
          <span className={styles.statusDot} style={{ background: statusInfo.color }} />
          {statusInfo.label}
        </span>
      </div>

      {/* Project name + client */}
      <div className={styles.titleBlock}>
        <span className={styles.projName}>{displayProject.name}</span>
        {clientName && <span className={styles.clientName}>{clientName}</span>}
      </div>

      {/* PM row */}
      {pmName && (
        <div className={styles.pmRow}>
          <div className={styles.pmAvatar}>{pmName.charAt(0).toUpperCase()}</div>
          <span className={styles.pmName}>{pmName}</span>
          <span className={styles.pmLabel}>PM</span>
        </div>
      )}

      {/* Progress */}
      <div className={styles.progressWrap}>
        <div className={styles.progressTrack}>
          <div
            className={styles.progressFill}
            style={{
              width: `${Math.min(progress, 100)}%`,
              backgroundColor: getProgressColor(progress),
            }}
          />
        </div>
        <div className={styles.progressMeta}>
          <span className={styles.progressLabel}>
            {displayProject.completedTasks != null && displayProject.totalTasks != null
              ? `${displayProject.completedTasks}/${displayProject.totalTasks} tasks`
              : `${progress}% complete`}
          </span>
          <span className={styles.progressPct} style={{ color: getProgressColor(progress) }}>
            {progress}%
          </span>
        </div>
      </div>

      {/* Phase chip */}
      {displayProject.phase && (
        <div className={styles.phaseChip}>{displayProject.phase}</div>
      )}

      {/* Bottom: value + deadline */}
      <div className={styles.bottomRow}>
        <span className={styles.value}>
          {formatValue(displayProject.value) || '—'}
        </span>
        {deadlineStr && (
          <span className={displayProject.overdue ? styles.dateOverdue : styles.date}>
            {displayProject.overdue && <span className={styles.overdueLabel}>OVERDUE · </span>}
            {deadlineStr}
          </span>
        )}
      </div>
    </div>
  );
}
