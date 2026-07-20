import React from 'react';
import styles from './FinancialApprovalDashboard.module.css';

export default function KPICard({ title, value, description, icon, isLoading, type = 'default', trend }) {
  if (isLoading) {
    return (
      <div className={`${styles.kpiCard} ${styles.skeleton}`}>
        <div className={styles.skeletonIcon}></div>
        <div className={styles.skeletonContent}>
          <div className={styles.skeletonTitle}></div>
          <div className={styles.skeletonValue}></div>
          <div className={styles.skeletonDesc}></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.kpiCard} ${styles[`kpiCard_${type}`]}`}>
      <div className={styles.kpiHeader}>
        <div className={styles.kpiIcon}>{icon}</div>
        <h3 className={styles.kpiTitle}>{title}</h3>
      </div>
      <div className={styles.kpiBody}>
        <div className={styles.kpiValue}>{value}</div>
        {description && <div className={styles.kpiDesc}>{description}</div>}
        {trend && (
          <div className={`${styles.kpiTrend} ${styles['kpiTrend_' + trend.type]}`}>
            {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '–'} 
            {trend.value}% {trend.label}
          </div>
        )}
      </div>
    </div>
  );
}
