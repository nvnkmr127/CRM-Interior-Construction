import React from 'react';
import { Badge } from '../ui';
import ScoreBadge from './ScoreBadge';
import styles from './LeadCard.module.css';

export default function LeadCard({ lead, onClick }) {
  const isOverdue = lead.follow_up_overdue_days > 0;

  return (
    <div className={styles.card} onClick={onClick}>
      <div className={styles.row}>
        <span className={styles.name}>{lead.name}</span>
        <ScoreBadge score={lead.score} />
      </div>
      
      <div className={styles.row}>
        <div className={styles.phone}>
          <span>🇮🇳</span> {lead.phone}
        </div>
        <Badge variant="neutral" size="sm">{lead.source || 'Unknown'}</Badge>
      </div>

      <div className={styles.row}>
        <div className={styles.assignee}>
          {lead.assignee_avatar ? (
             <img src={lead.assignee_avatar} alt="avatar" className={styles.avatar} />
          ) : (
             <div className={styles.avatar}>{(lead.assignee_name || '?').charAt(0).toUpperCase()}</div>
          )}
          <span className={styles.assigneeName}>{lead.assignee_name || 'Unassigned'}</span>
        </div>
        <span className={styles.timeAgo}>{lead.last_activity_time_ago || 'No activity'}</span>
      </div>

      {isOverdue && (
        <div className={styles.overdue}>
          Follow up overdue {lead.follow_up_overdue_days} days
        </div>
      )}
    </div>
  );
}
