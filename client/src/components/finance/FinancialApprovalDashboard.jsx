import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import KPICard from './KPICard';
import styles from './FinancialApprovalDashboard.module.css';

export default function FinancialApprovalDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await api.get('/financial-approvals/stats');
      setStats(res.data?.data || null);
    } catch (err) {
      setError('Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount || 0);
  };

  const formatTime = (hours) => {
    if (!hours) return '0h';
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    return `${hours.toFixed(1)}h`;
  };

  const getTrend = (today, yesterday, isGoodIfUp = true) => {
    if (yesterday === undefined || yesterday === 0) return null;
    const diff = today - yesterday;
    if (diff === 0) return { label: 'vs yesterday', value: 0, direction: 'neutral', type: 'neutral' };
    const percentage = Math.round(Math.abs(diff) / yesterday * 100);
    const isUp = diff > 0;
    let type = 'neutral';
    if (isUp) type = isGoodIfUp ? 'positive' : 'negative';
    else type = isGoodIfUp ? 'negative' : 'positive';
    return { label: 'vs yesterday', value: percentage, direction: isUp ? 'up' : 'down', type };
  };

  if (error) {
    return <div className={styles.errorState}>{error}</div>;
  }

  // Display skeleton if loading
  if (loading) {
    return (
      <div className={styles.dashboardContainer}>
        <div className={styles.kpiGrid}>
          {Array(8).fill(0).map((_, i) => (
            <KPICard key={i} isLoading={true} />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return <div className={styles.emptyState}>No dashboard data available.</div>;
  }

  return (
    <div className={`${styles.dashboardContainer} ${styles.fadeIn}`}>
      <div className={styles.kpiGrid}>
        <KPICard 
          title="Pending Approvals" 
          value={stats.pendingApprovals} 
          description="Awaiting review"
          icon="⏳"
          type="warning"
        />
        <KPICard 
          title="Pending Amount" 
          value={formatCurrency(stats.pendingAmount)} 
          description="Total value pending"
          icon="💰"
          type="warning"
        />
        <KPICard 
          title="Approved Today" 
          value={stats.approvedToday} 
          description="Cleared today"
          icon="✅"
          type="success"
          trend={getTrend(stats.approvedToday, stats.approvedYesterday, true)}
        />
        <KPICard 
          title="Rejected Today" 
          value={stats.rejectedToday} 
          description="Declined today"
          icon="❌"
          type="danger"
          trend={getTrend(stats.rejectedToday, stats.rejectedYesterday, false)}
        />
        <KPICard 
          title="Total Approved" 
          value={formatCurrency(stats.totalApprovedAmount)} 
          description="All time approved"
          icon="🏦"
          type="success"
        />
        <KPICard 
          title="Total Rejected" 
          value={formatCurrency(stats.totalRejectedAmount)} 
          description="All time rejected"
          icon="🚫"
          type="danger"
        />
        <KPICard 
          title="Avg. Approval Time" 
          value={formatTime(stats.averageApprovalTime)} 
          description="From request to approval"
          icon="⏱️"
          type="info"
        />
        <KPICard 
          title="Overdue Approvals" 
          value={stats.overdueApprovals} 
          description="Pending > 48 hours"
          icon="⚠️"
          type={stats.overdueApprovals > 0 ? "danger" : "success"}
        />
      </div>
    </div>
  );
}
