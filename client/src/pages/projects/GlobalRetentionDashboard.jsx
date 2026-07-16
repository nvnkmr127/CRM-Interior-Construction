/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from './GlobalRetentionDashboard.module.css';
import { getRetentionDashboard } from '../../api/handover';
import { useToast } from '../../store/toastContext';

export default function GlobalRetentionDashboard() {
  const toast = useToast();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, scheduled, completed, overdue

  const loadData = async () => {
    try {
      setLoading(true);
      const list = await getRetentionDashboard();
      setData(list || []);
    } catch (err) {
      console.error('[GlobalRetentionDashboard] Error loading data:', err);
      toast.error('Failed to load customer retention dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStageLabel = (stage) => {
    switch (stage) {
      case '30_day': return '30-Day Check-in';
      case '90_day': return '90-Day Quality Check';
      case '180_day': return '180-Day Maintenance';
      case '365_day': return '365-Day Warranty/AMC';
      default: return stage;
    }
  };

  const isOverdue = (item) => {
    if (item.status !== 'scheduled') return false;
    const schedDate = new Date(item.scheduled_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return schedDate < today;
  };

  // Filters and Search logic
  const filteredData = data.filter(item => {
    const matchesSearch =
      (item.project_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.pm_name || '').toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === 'completed') return item.status === 'completed';
    if (filterType === 'scheduled') return item.status === 'scheduled' && !isOverdue(item);
    if (filterType === 'overdue') return isOverdue(item);
    return true;
  });

  // Calculate metrics
  const totalCalls = data.length;
  const completedCalls = data.filter(item => item.status === 'completed').length;
  const overdueCalls = data.filter(item => isOverdue(item)).length;
  const scheduledCalls = data.filter(item => item.status === 'scheduled' && !isOverdue(item)).length;

  const csatItems = data.filter(item => item.status === 'completed' && item.csat_score);
  const averageCsat = csatItems.length > 0
    ? (csatItems.reduce((acc, curr) => acc + curr.csat_score, 0) / csatItems.length).toFixed(1)
    : 'N/A';

  const renderStars = (score) => {
    if (!score) return '—';
    return (
      <div className={styles.starRating}>
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i}>{i < score ? '★' : '☆'}</span>
        ))}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Customer Retention Follow-up Dashboard</h1>
          <p className={styles.subtitle}>Track post-handover relationship touchpoints, measure CSAT satisfaction, and secure renewals.</p>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className={styles.metricsGrid}>
        <div className={`${styles.metricCard} ${styles.metricBlue}`}>
          <div className={styles.metricLabel}>Total Scheduled Touchpoints</div>
          <div className={styles.metricValue}>{totalCalls}</div>
        </div>
        <div className={`${styles.metricCard} ${styles.metricGreen}`}>
          <div className={styles.metricLabel}>Completed Check-ins</div>
          <div className={styles.metricValue}>{completedCalls}</div>
        </div>
        <div className={`${styles.metricCard} ${styles.metricYellow}`}>
          <div className={styles.metricLabel}>Overdue Follow-ups</div>
          <div className={styles.metricValue}>{overdueCalls}</div>
        </div>
        <div className={`${styles.metricCard} ${styles.metricBlue}`}>
          <div className={styles.metricLabel}>Average CSAT Rating</div>
          <div className={styles.metricValue}>{averageCsat} {averageCsat !== 'N/A' ? '★' : ''}</div>
        </div>
      </div>

      {/* Filters and Search toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search projects or PMs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.filterTabs}>
          <button
            className={`${styles.filterTab} ${filterType === 'all' ? styles.activeTab : ''}`}
            onClick={() => setFilterType('all')}
          >
            All Milestones
          </button>
          <button
            className={`${styles.filterTab} ${filterType === 'completed' ? styles.activeTab : ''}`}
            onClick={() => setFilterType('completed')}
          >
            Completed ({completedCalls})
          </button>
          <button
            className={`${styles.filterTab} ${filterType === 'scheduled' ? styles.activeTab : ''}`}
            onClick={() => setFilterType('scheduled')}
          >
            Scheduled ({scheduledCalls})
          </button>
          <button
            className={`${styles.filterTab} ${filterType === 'overdue' ? styles.activeTab : ''}`}
            onClick={() => setFilterType('overdue')}
          >
            Overdue ({overdueCalls})
          </button>
        </div>
      </div>

      {/* Table grid */}
      {loading ? (
        <div className={styles.loading}>Loading dashboard...</div>
      ) : filteredData.length === 0 ? (
        <div className={styles.noData}>No check-in milestones found matching the filter criteria.</div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Project Name</th>
                <th>Check-in Stage</th>
                <th>Scheduled Date</th>
                <th>Project Manager</th>
                <th>Status</th>
                <th>CSAT Rating</th>
                <th>Actual Call Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map(item => {
                const itemOverdue = isOverdue(item);
                return (
                  <tr key={item.id}>
                    <td>
                      <Link to={`/projects/${item.project_id}`} className={styles.projectLink}>
                        {item.project_name}
                      </Link>
                    </td>
                    <td><strong>{getStageLabel(item.stage)}</strong></td>
                    <td>{formatDate(item.scheduled_date)}</td>
                    <td>{item.pm_name || 'Unassigned'}</td>
                    <td>
                      <span className={`${styles.badge} ${
                        itemOverdue ? styles.badgeRed : 
                        item.status === 'completed' ? styles.badgeGreen : 
                        item.status === 'deferred' ? styles.badgeYellow : styles.badgeBlue
                      }`}>
                        {itemOverdue ? 'OVERDUE' : item.status}
                      </span>
                    </td>
                    <td>{renderStars(item.csat_score)}</td>
                    <td>{item.actual_date ? formatDate(item.actual_date) : '—'}</td>
                    <td>
                      <Link to={`/projects/${item.project_id}?tab=Customer%20Retention`} className={styles.actionBtn}>
                        Log Outcome
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
