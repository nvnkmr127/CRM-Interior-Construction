/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../../api/dashboard';
import { Card, Button, Modal } from '../ui';
import { useAuth } from '../../store/authContext';
import { usePermissions } from '../../hooks/usePermissions';
import styles from './LeadDashboard.module.css';

export default function LeadDashboard({ leads, stages = [], loading, statusFilter = 'active', onLeadClick, onViewChange, onSiteVisitsTodayClick }) {
  const { user } = useAuth();
  const { hasPermission, isModuleEnabled, allowedModules } = usePermissions();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [showVisitsModal, setShowVisitsModal] = useState(false);

  const handleSiteVisitsTodayClick = () => {
    const visits = stats?.siteVisits?.visits || [];
    if (visits.length === 0) return;
    if (visits.length === 1) {
      if (onSiteVisitsTodayClick) {
        onSiteVisitsTodayClick(visits[0].lead_id);
      }
    } else {
      setShowVisitsModal(true);
    }
  };

  useEffect(() => {
    dashboardApi.getStats()
      .then(res => setStats(res))
      .catch(err => console.error(err))
      .finally(() => setStatsLoading(false));
  }, []);

  const [myTasks, setMyTasks] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);

  useEffect(() => {
    dashboardApi.getMyTasks(7)
      .then(res => setMyTasks(res))
      .catch(err => console.error(err))
      .finally(() => setActivityLoading(false));
  }, []);

  if (loading || statsLoading || activityLoading) {
    return <div className={styles.loading}>Loading Dashboard...</div>;
  }

  const todayRevenueStr = stats?.wonThisMonth?.value ? `₹ ${(stats.wonThisMonth.value / 100000).toFixed(2)} L` : '₹ 0.00 L';

  const leadsLabel = statusFilter === 'parked'
    ? 'Parked Leads'
    : statusFilter === 'deleted'
      ? 'Deleted Leads'
      : 'Active Leads';

  const leadsCount = statusFilter === 'parked' || statusFilter === 'deleted'
    ? (leads || []).length
    : (stats?.activeLeads?.count !== undefined ? stats.activeLeads.count : (leads || []).length);

  const statusBadgeText = statusFilter === 'parked'
    ? 'Parked'
    : statusFilter === 'deleted'
      ? 'Deleted'
      : 'Active';

  const statusBadgeBg = statusFilter === 'parked'
    ? 'var(--color-warning)'
    : statusFilter === 'deleted'
      ? 'var(--color-danger)'
      : 'var(--color-accent)';

  const overdueCount = stats?.activeProjects?.overdueCount || 0;
  const meetingsCount = stats?.tasksDueToday?.count || 0;
  const visitsCount = stats?.siteVisits?.count || 0;
  const expectedClosures = stats?.salesTargets?.targetRevenue ? `₹ ${(stats.salesTargets.targetRevenue / 100000).toFixed(2)} L` : '₹ 0.00 L';

  // Compute Priority Leads dynamically from the provided `leads` prop
  const priorityLeads = [...(leads || [])]
    .filter(l => !['closed_won', 'closed_lost'].includes(l.status) && l.probability > 60)
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 3)
    .map(l => ({
      id: l.id,
      name: l.name,
      probability: `${l.probability || 0}%`,
      action: 'Follow up',
      revenue: l.estimated_value ? `₹ ${(l.estimated_value / 100000).toFixed(1)} L` : 'TBD'
    }));

  const staleLeads = [...(leads || [])]
    .filter(l => l.status === 'stale')
    .slice(0, 3);

  const atRiskLeadsCount = (leads || []).filter(l => l.status === 'stale').length || 0;

  // Group active leads by stage for distribution graph
  const activeLeads = leads || [];
  const totalActive = activeLeads.length;

  const stageBreakdown = stages.map(stg => {
    const count = activeLeads.filter(l => l.stage_id === stg.id).length;
    const pct = totalActive > 0 ? (count / totalActive) * 100 : 0;
    return {
      id: stg.id,
      name: stg.name,
      color: stg.color || '#cbd5e1',
      count,
      pct
    };
  });

  // Real Timeline from tasks
  const timelineEvents = myTasks.map(t => {
    const timeStr = t.due_date ? new Date(t.due_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today';
    return { 
      time: timeStr, 
      title: t.title, 
      type: 'task',
      leadId: t.lead_id,
      leadName: t.lead_name,
      projectName: t.project_name
    };
  });

  if (timelineEvents.length === 0) {
    timelineEvents.push({ time: 'All Day', title: 'No tasks scheduled for today. Great job!', type: 'info' });
  }

  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return 'Good Morning';
    if (hr < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Role and Permission checks
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

  const isWorkspaceAdmin = isAdmin;

  const canAccessModule = (moduleName) => {
    if (isAdmin || isWorkspaceAdmin) return true;
    if (allowedModules && allowedModules.size > 0 && !allowedModules.has(moduleName)) {
      return false;
    }
    if (isModuleEnabled(moduleName)) return true;
    if (hasPermission(moduleName, 'read') || hasPermission(moduleName, 'view')) return true;
    return permissions.some(p => p === '*' || p === '*:*' || p.startsWith(`${moduleName}:`));
  };

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

  const canViewFinancialKPIs = isAdmin || isFinanceOrProjectManager || hasFinancialPermission;
  const canViewProjects = canAccessModule('projects');
  const canViewTasks = canAccessModule('tasks');
  const canViewLeads = canAccessModule('leads');

  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.greetingHeader}>
        <h2>{getGreeting()}, {user?.name?.split(' ')[0] || 'Rahul'} 👋</h2>
        <p>Here is your daily focus to move leads closer to booking.</p>
      </header>

      <section className={styles.metricsGrid}>
        {canViewFinancialKPIs && canViewProjects && (
          <div className={styles.metricCard} onClick={() => navigate('/projects')}>
            <div className={styles.metricLabel}>Won This Month</div>
            <div className={styles.metricValue}>{todayRevenueStr}</div>
          </div>
        )}
        {canViewLeads && (
          <div className={styles.metricCard} onClick={() => onViewChange && onViewChange('list')}>
            <div className={styles.metricLabel}>{leadsLabel}</div>
            <div className={styles.metricValue}>{leadsCount}</div>
          </div>
        )}
        {canViewProjects && (
          <div className={styles.metricCard} onClick={() => navigate('/projects')}>
            <div className={styles.metricLabel}>Overdue Projects</div>
            <div className={`${styles.metricValue} ${styles.danger}`}>{overdueCount}</div>
          </div>
        )}
        {canViewTasks && (
          <div className={styles.metricCard} onClick={() => navigate('/tasks')}>
            <div className={styles.metricLabel}>Tasks Due Today</div>
            <div className={styles.metricValue}>{meetingsCount}</div>
          </div>
        )}
        {canViewLeads && (
          <div className={styles.metricCard} onClick={handleSiteVisitsTodayClick} style={{ cursor: stats?.siteVisits?.count > 0 ? 'pointer' : 'default' }}>
            <div className={styles.metricLabel}>Site Visits Today</div>
            <div className={styles.metricValue}>{visitsCount}</div>
          </div>
        )}
        {canViewFinancialKPIs && (
          <div className={styles.metricCard} onClick={() => navigate('/analytics/leads')}>
            <div className={styles.metricLabel}>Target Revenue</div>
            <div className={styles.metricValue}>{expectedClosures}</div>
          </div>
        )}
      </section>

      <div className={styles.mainLayout}>
        <div className={styles.leftColumn}>
          <Card className={styles.priorityCard}>
            <div className={styles.cardHeader}>
              <h3>🔥 AI Priority Leads</h3>
            </div>
            <div className={styles.priorityList}>
              {priorityLeads.map((pl, idx) => (
                <div key={idx} className={styles.priorityItem} onClick={() => pl.id && onLeadClick && onLeadClick(pl.id)}>
                  <div className={styles.priorityRank}>{idx + 1}</div>
                  <div className={styles.priorityInfo}>
                    <h4>{pl.name}</h4>
                    <span className={styles.probability}>{pl.probability} Close Probability</span>
                  </div>
                  <div className={styles.priorityAction}>
                    <Button variant="outline" size="small">{pl.action}</Button>
                  </div>
                </div>
              ))}
              {priorityLeads.length === 0 && (
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', margin: 0 }}>No high probability leads currently.</p>
              )}
            </div>
          </Card>

          <Card className={styles.pipelineCard}>
            <div className={styles.cardHeader}>
              <h3>📊 Pipeline Stage Distribution</h3>
              <span className={styles.riskBadge} style={{ background: statusBadgeBg }}>{totalActive} {statusBadgeText}</span>
            </div>
            <div className={styles.pipelineProgressList}>
              {stageBreakdown.map((item, idx) => (
                <div key={idx} className={styles.pipelineProgressItem}>
                  <div className={styles.pipelineProgressHeader}>
                    <span className={styles.stageName}>{item.name}</span>
                    <span className={styles.stageCount}>{item.count} leads ({Math.round(item.pct)}%)</span>
                  </div>
                  <div className={styles.progressBarContainer}>
                    <div 
                      className={styles.progressBar} 
                      style={{ 
                        width: `${item.pct}%`, 
                        backgroundColor: item.color 
                      }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className={`${styles.priorityCard} ${styles.riskCard}`}>
            <div className={styles.cardHeader}>
              <h3>⚠ Leads At Risk</h3>
              <span className={styles.riskBadge}>{atRiskLeadsCount}</span>
            </div>
            <p className={styles.riskHint}>
              Customers inactive for over 14 days or expressing budget concerns.
            </p>
            {staleLeads.length > 0 ? (
              <div className={styles.priorityList}>
                {staleLeads.map((rl, idx) => (
                  <div key={idx} className={styles.priorityItem} onClick={() => rl.id && onLeadClick && onLeadClick(rl.id)}>
                    <div className={styles.priorityRank} style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)' }}>⚠</div>
                    <div className={styles.priorityInfo}>
                      <h4>{rl.name}</h4>
                      <span className={styles.probability} style={{ color: 'var(--color-danger)', background: 'rgba(239, 68, 68, 0.1)' }}>Stale Lead</span>
                    </div>
                    <div className={styles.priorityAction}>
                      <Button variant="outline" size="small" style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}>Re-engage</Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.riskHint} style={{ color: 'var(--color-success)', margin: 0 }}>No at-risk leads found! All clear. 🎉</p>
            )}
          </Card>
        </div>

        <div className={styles.rightColumn}>
          <Card className={styles.timelineCard}>
            <div className={styles.cardHeader}>
              <h3>Today's Timeline</h3>
            </div>
            <div className={styles.timelineList}>
              {timelineEvents.map((ev, idx) => (
                <div 
                  key={idx} 
                  className={styles.timelineItem}
                  onClick={() => ev.leadId && onLeadClick && onLeadClick(ev.leadId)}
                >
                  <div className={styles.timelineTime}>{ev.time}</div>
                  <div className={styles.timelineDot} />
                  <div className={styles.timelineContent}>
                    <div>{ev.title}</div>
                    {ev.leadName && (
                      <span className={styles.timelineMeta}>Lead: {ev.leadName}</span>
                    )}
                    {ev.projectName && canViewProjects && (
                      <span className={styles.timelineMeta}>Project: {ev.projectName}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {showVisitsModal && (
        <Modal
          isOpen={showVisitsModal}
          onClose={() => setShowVisitsModal(false)}
          title="📍 Today's Scheduled Site Visits"
        >
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            <p className="text-sm text-gray-500 mb-4">Click on any site visit below to open the lead details directly on the Site Visits tab.</p>
            {stats?.siteVisits?.visits?.map((visit) => {
              const formattedTime = new Date(visit.scheduled_at).toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              });
              return (
                <div
                  key={visit.id}
                  onClick={() => {
                    setShowVisitsModal(false);
                    if (onSiteVisitsTodayClick) {
                      onSiteVisitsTodayClick(visit.lead_id);
                    }
                  }}
                  className="p-4 border border-gray-150 rounded-xl hover:border-blue-500 hover:bg-blue-50/30 transition-all cursor-pointer flex justify-between items-center group"
                >
                  <div>
                    <h4 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors text-sm">
                      {visit.lead_name}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      <span>👤 Assignee: </span>
                      <span className="font-medium text-gray-700">{visit.assignee_name || 'Unassigned'}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-100">
                      {formattedTime}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Modal>
      )}
    </div>
  );
}
