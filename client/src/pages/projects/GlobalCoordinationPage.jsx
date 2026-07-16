/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from './GlobalCoordinationPage.module.css';
import { getCoordinationDashboard } from '../../api/projects';
import { useToast } from '../../store/toastContext';

export default function GlobalCoordinationPage() {
  const toast = useToast();
  
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, alerts, aligned, pending

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await getCoordinationDashboard();
      const list = res.data?.data || res.data || [];
      setData(list);
    } catch (err) {
      console.error('[GlobalCoordinationPage] Error loading dashboard data', err);
      toast.error('Failed to load coordination dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Format Helper
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Filter and Search logic
  const filteredData = data.filter(item => {
    const matchesSearch = 
      (item.projectName || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.pmName || '').toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === 'alerts') {
      return item.alertType === 'factory_delay' || item.alertType === 'site_delay';
    } else if (filterType === 'aligned') {
      return item.alertType === 'aligned';
    } else if (filterType === 'pending') {
      return item.alertType === 'pending_setup';
    }
    return true;
  });

  // Calculate high-level metrics
  const totalProjects = data.length;
  const factoryDelaysCount = data.filter(i => i.alertType === 'factory_delay').length;
  const siteDelaysCount = data.filter(i => i.alertType === 'site_delay').length;
  const alignedCount = data.filter(i => i.alertType === 'aligned').length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Production & Site Coordination Dashboard</h1>
          <p className={styles.subtitle}>Unified PM panel tracking factory dispatch readiness vs. site execution readiness across active projects.</p>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Total Projects</div>
          <div className={styles.metricValue}>{totalProjects}</div>
        </div>
        <div className={`${styles.metricCard} ${styles.metricRed}`}>
          <div className={styles.metricLabel}>Factory Delays</div>
          <div className={styles.metricValue}>{factoryDelaysCount}</div>
        </div>
        <div className={`${styles.metricCard} ${styles.metricOrange}`}>
          <div className={styles.metricLabel}>Site Delays</div>
          <div className={styles.metricValue}>{siteDelaysCount}</div>
        </div>
        <div className={`${styles.metricCard} ${styles.metricGreen}`}>
          <div className={styles.metricLabel}>Aligned Timelines</div>
          <div className={styles.metricValue}>{alignedCount}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
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
            All Projects
          </button>
          <button
            className={`${styles.filterTab} ${filterType === 'alerts' ? styles.activeTab : ''}`}
            onClick={() => setFilterType('alerts')}
          >
            Delays / Mismatches ({factoryDelaysCount + siteDelaysCount})
          </button>
          <button
            className={`${styles.filterTab} ${filterType === 'aligned' ? styles.activeTab : ''}`}
            onClick={() => setFilterType('aligned')}
          >
            Aligned ({alignedCount})
          </button>
          <button
            className={`${styles.filterTab} ${filterType === 'pending' ? styles.activeTab : ''}`}
            onClick={() => setFilterType('pending')}
          >
            Pending Setup
          </button>
        </div>
      </div>

      {/* Projects Table */}
      {loading ? (
        <div className={styles.loading}>Loading project timelines...</div>
      ) : filteredData.length === 0 ? (
        <div className={styles.noData}>No projects found matching the filter criteria.</div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Project Name</th>
                <th>Project Manager</th>
                <th>Site Readiness Date</th>
                <th>Expected Factory Date</th>
                <th>Divergence Status</th>
                <th>Divergence Days</th>
                <th>Active Orders</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item, index) => (
                <tr key={item.projectId ? `${item.projectId}-${index}` : index}>
                  <td>
                    <Link to={`/projects/${item.projectId}`} className={styles.projectLink}>
                      {item.projectName}
                    </Link>
                  </td>
                  <td>{item.pmName}</td>
                  <td>{formatDate(item.siteReadinessDate)}</td>
                  <td>{formatDate(item.factoryReadinessDate)}</td>
                  <td>
                    {item.alertType === 'factory_delay' && (
                      <span className={`${styles.badge} ${styles.badgeRed}`}>
                        🚨 Factory Delay
                      </span>
                    )}
                    {item.alertType === 'site_delay' && (
                      <span className={`${styles.badge} ${styles.badgeOrange}`}>
                        ⚠️ Site Delay
                      </span>
                    )}
                    {item.alertType === 'aligned' && (
                      <span className={`${styles.badge} ${styles.badgeGreen}`}>
                        ✓ Aligned
                      </span>
                    )}
                    {item.alertType === 'pending_setup' && (
                      <span className={`${styles.badge} ${styles.badgeGray}`}>
                        Pending Setup
                      </span>
                    )}
                  </td>
                  <td className={styles.bold}>
                    {item.alertType === 'pending_setup' || item.divergenceDays === 0
                      ? '—'
                      : `${item.divergenceDays} day(s)`}
                  </td>
                  <td>{item.activeOrdersCount} order(s)</td>
                  <td>
                    <Link to={`/projects/${item.projectId}`} className={styles.actionBtn}>
                      View Project
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
