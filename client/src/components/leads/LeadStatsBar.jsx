import React from 'react';
import { useAuth } from '../../store/authContext';
import { usePermissions } from '../../hooks/usePermissions';
import styles from '../../pages/leads/LeadsPage.module.css';

export default function LeadStatsBar({ stats, loading }) {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();

  const roleName = (typeof user?.role === 'string' ? user.role : user?.role?.name || '').toLowerCase();
  const permissions = Array.isArray(user?.role?.permissions) ? user.role.permissions : [];

  const isPlatformDeveloperAdmin = (user?.tenant?.slug === 'demo' || user?.email === 'admin@demo.com') && 
    (roleName === 'superadmin' || roleName === 'admin');

  const isAdmin = isPlatformDeveloperAdmin || 
    roleName === 'superadmin' || 
    roleName === 'super admin' || 
    roleName === 'admin' || 
    roleName === 'owner' ||
    permissions.includes('*') || 
    permissions.includes('*:*');

  const isFinanceOrProjectManager = 
    roleName.includes('finance') || 
    roleName.includes('project manager') || 
    roleName.includes('project_manager') ||
    roleName.includes('sales manager') ||
    roleName.includes('sales_manager');

  const hasFinancialPermission = 
    permissions.includes('finance:read') || 
    permissions.includes('dashboards:view_sales_dashboard') || 
    permissions.includes('leads:view_financial_kpis');

  const canViewFinancials = isAdmin || isFinanceOrProjectManager || hasFinancialPermission;

  return (
    <div className={styles.statsBar}>
      <div className={styles.stat}>
        <span className={styles.statLabel}>Total Leads</span>
        <span className={styles.statValue}>{loading ? '—' : stats.total}</span>
      </div>
      {canViewFinancials && (
        <>
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
        </>
      )}
      <div className={styles.statSep} />
      <div className={styles.stat}>
        <span className={styles.statLabel}>Avg Score</span>
        <span className={styles.statValue}>{loading ? '—' : stats.avgScore}</span>
      </div>
    </div>
  );
}
