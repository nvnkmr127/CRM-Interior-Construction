import React from 'react';
import styles from './ApprovalTimeline.module.css';

/**
 * Reusable visual Approval Timeline component
 * 
 * @param {Object} props
 * @param {Array} props.stages - Array of stage objects
 *   {
 *     title: string (e.g. 'Finance Manager Approved'),
 *     role: string,
 *     name: string,
 *     status: 'completed' | 'pending' | 'rejected' | 'current',
 *     date: Date | string,
 *     comments: string,
 *     duration: string (e.g. '2 hours')
 *   }
 */
export default function ApprovalTimeline({ stages = [] }) {
  if (!stages || stages.length === 0) return null;

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const getIcon = (status) => {
    switch (status) {
      case 'completed': return '✓';
      case 'rejected': return '✗';
      case 'current': return '●';
      case 'pending': default: return '○';
    }
  };

  const getIconClass = (status) => {
    switch (status) {
      case 'completed': return styles.iconCompleted;
      case 'rejected': return styles.iconRejected;
      case 'current': return styles.iconCurrent;
      case 'pending': default: return styles.iconPending;
    }
  };

  const getLineClass = (status) => {
    switch (status) {
      case 'completed': return styles.lineCompleted;
      case 'rejected': return styles.lineRejected;
      default: return '';
    }
  };

  const getCommentsClass = (status) => {
    switch (status) {
      case 'completed': return styles.commentsCompleted;
      case 'rejected': return styles.commentsRejected;
      default: return '';
    }
  };

  return (
    <div className={styles.timelineContainer}>
      {stages.map((stage, index) => {
        // Line color is based on current stage status
        const isLast = index === stages.length - 1;
        
        return (
          <div key={index} className={styles.timelineItem}>
            <div className={styles.timelineLeft}>
              <div className={`${styles.timelineIcon} ${getIconClass(stage.status)}`}>
                {getIcon(stage.status)}
              </div>
              {!isLast && (
                <div className={`${styles.timelineLine} ${getLineClass(stage.status)}`}></div>
              )}
            </div>
            
            <div className={styles.timelineContent}>
              <div className={styles.timelineHeader}>
                <div className={styles.userInfo}>
                  {stage.name ? (
                    <div className={styles.avatar} title={stage.name}>
                      {getInitials(stage.name)}
                    </div>
                  ) : (
                    <div className={styles.avatar}>
                      <span className="material-icons" style={{ fontSize: '18px' }}>person_outline</span>
                    </div>
                  )}
                  <div className={styles.nameRole}>
                    <span className={styles.name}>{stage.title || stage.name || 'Pending Approver'}</span>
                    <span className={styles.role}>{stage.role?.replace('finance:', 'Finance ')}</span>
                  </div>
                </div>
                
                {stage.date && (
                  <div className={styles.dateTime}>
                    <span className={styles.date}>
                      {new Date(stage.date).toLocaleDateString()} {new Date(stage.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {stage.duration && (
                      <span className={styles.duration}>{stage.duration}</span>
                    )}
                  </div>
                )}
              </div>
              
              {stage.comments && (
                <div className={`${styles.comments} ${getCommentsClass(stage.status)}`}>
                  {stage.comments}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
