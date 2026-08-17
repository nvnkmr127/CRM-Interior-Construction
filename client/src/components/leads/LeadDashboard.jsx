/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../../api/dashboard';
import { Card, Button } from '../ui';
import { useAuth } from '../../store/authContext';
import styles from './LeadDashboard.module.css';

export default function LeadDashboard({ leads, loading, onLeadClick, onViewChange }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    dashboardApi.getStats()
      .then(res => setStats(res))
      .catch(err => console.error(err))
      .finally(() => setStatsLoading(false));
  }, []);

  const [myTasks, setMyTasks] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);

  useEffect(() => {
    dashboardApi.getMyTasks(5)
      .then(res => setMyTasks(res))
      .catch(err => console.error(err))
      .finally(() => setActivityLoading(false));
  }, []);

  if (loading || statsLoading || activityLoading) {
    return <div className={styles.loading}>Loading Dashboard...</div>;
  }

  const todayRevenueStr = stats?.wonThisMonth?.value ? `₹ ${(stats.wonThisMonth.value / 100000).toFixed(2)} L` : '₹ 0.00 L';
  const criticalLeadsCount = stats?.activeLeads?.count || 0;
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

  // Real Timeline from tasks
  const timelineEvents = myTasks.map(t => {
    const timeStr = t.due_date ? new Date(t.due_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today';
    return { time: timeStr, title: t.title, type: 'task' };
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

  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.greetingHeader}>
        <h2>{getGreeting()}, {user?.name?.split(' ')[0] || 'Rahul'} 👋</h2>
        <p>Here is your daily focus to move leads closer to booking.</p>
      </header>

      <section className={styles.metricsGrid}>
        <div className={styles.metricCard} onClick={() => navigate('/projects')}>
          <div className={styles.metricLabel}>Won This Month</div>
          <div className={styles.metricValue}>{todayRevenueStr}</div>
        </div>
        <div className={styles.metricCard} onClick={() => onViewChange && onViewChange('list')}>
          <div className={styles.metricLabel}>Active Leads</div>
          <div className={styles.metricValue}>{criticalLeadsCount}</div>
        </div>
        <div className={styles.metricCard} onClick={() => navigate('/projects')}>
          <div className={styles.metricLabel}>Overdue Projects</div>
          <div className={`${styles.metricValue} ${styles.danger}`}>{overdueCount}</div>
        </div>
        <div className={styles.metricCard} onClick={() => navigate('/tasks')}>
          <div className={styles.metricLabel}>Tasks Due Today</div>
          <div className={styles.metricValue}>{meetingsCount}</div>
        </div>
        <div className={styles.metricCard} onClick={() => navigate('/tasks')}>
          <div className={styles.metricLabel}>Site Visits</div>
          <div className={styles.metricValue}>{visitsCount}</div>
        </div>
        <div className={styles.metricCard} onClick={() => navigate('/analytics/leads')}>
          <div className={styles.metricLabel}>Target Revenue</div>
          <div className={styles.metricValue}>{expectedClosures}</div>
        </div>
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
            </div>
          </Card>

          <Card className={`${styles.priorityCard} ${styles.riskCard}`}>
            <div className={styles.cardHeader}>
              <h3>⚠ Leads At Risk</h3>
              <span className={styles.riskBadge}>{atRiskLeadsCount}</span>
            </div>
            <p className={styles.riskHint} style={{ marginBottom: '16px' }}>
              Customers inactive for over 14 days or expressing budget concerns.
            </p>
            {staleLeads.length > 0 ? (
              <div className={styles.priorityList}>
                {staleLeads.map((rl, idx) => (
                  <div key={idx} className={styles.priorityItem} onClick={() => rl.id && onLeadClick && onLeadClick(rl.id)}>
                    <div className={styles.priorityRank} style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)' }}>⚠</div>
                    <div className={styles.priorityInfo}>
                      <h4>{rl.name}</h4>
                      <span className={styles.probability} style={{ color: 'var(--color-danger)' }}>Stale Lead</span>
                    </div>
                    <div className={styles.priorityAction}>
                      <Button variant="outline" size="small" style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}>Re-engage</Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.riskHint} style={{ color: 'var(--color-success)' }}>No at-risk leads found! All clear. 🎉</p>
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
                <div key={idx} className={styles.timelineItem}>
                  <div className={styles.timelineTime}>{ev.time}</div>
                  <div className={styles.timelineDot} />
                  <div className={styles.timelineContent}>{ev.title}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
