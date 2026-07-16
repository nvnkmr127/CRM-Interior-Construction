/* eslint-disable no-unused-vars */
import React from 'react';
import styles from '../../pages/leads/LeadsPage.module.css';

export default function LeadStatsBar({ stats, loading }) {
  return (
    <div className={styles.statsBar}>
      <div className={styles.stat}>
        <span className={styles.statLabel}>Total Leads</span>
        <span className={styles.statValue}>{loading ? '—' : stats.total}</span>
      </div>
      <div className={styles.statSep} />
      <div className={styles.stat}>
        <span className={styles.statLabel}>Won This Month</span>
        <span className={styles.statValue} style={{ color: 'var(--color-success)' }}>
          {loading ? '—' : stats.wonThisMonth}
        </span>
      </div>
      <div className={styles.statSep} />
      <div className={styles.stat}>
        <span className={styles.statLabel}>Avg Conversion</span>
        <span className={styles.statValue} style={{ color: 'var(--color-accent)' }}>
          {loading ? '—' : `${stats.convPct}%`}
        </span>
      </div>
      <div className={styles.statSep} />
      <div className={styles.stat}>
        <span className={styles.statLabel}>Avg Score</span>
        <span className={styles.statValue}>{loading ? '—' : stats.avgScore}</span>
      </div>
    </div>
  );
}
