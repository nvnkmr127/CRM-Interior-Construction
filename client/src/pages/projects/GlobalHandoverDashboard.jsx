/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from './GlobalHandoverDashboard.module.css';
import { getHandoverReadinessDashboard } from '../../api/handover';
import { useToast } from '../../store/toastContext';

export default function GlobalHandoverDashboard() {
  const toast = useToast();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, ready, blocked

  const loadData = async () => {
    try {
      setLoading(true);
      const list = await getHandoverReadinessDashboard();
      setData(list || []);
    } catch (err) {
      console.error('[GlobalHandoverDashboard] Error loading data:', err);
      toast.error('Failed to load handover readiness dashboard data.');
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

  // Filter and Search logic
  const filteredData = data.filter(item => {
    const matchesSearch =
      (item.projectName || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.pmName || '').toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === 'ready') return item.overallReady === true;
    if (filterType === 'blocked') return item.overallReady === false;
    return true;
  });

  // Calculate metrics
  const totalProjects = data.length;
  const readyProjects = data.filter(item => item.overallReady).length;
  const blockedProjects = totalProjects - readyProjects;
  const scheduledCount = data.filter(item => !!item.nextAppointmentDate).length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Handover Readiness Dashboard</h1>
          <p className={styles.subtitle}>Unified operations command panel ensuring defect-free, fully cleared client handovers.</p>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className={styles.metricsGrid}>
        <div className={`${styles.metricCard} ${styles.metricBlue}`}>
          <div className={styles.metricLabel}>Total Projects in Stage</div>
          <div className={styles.metricValue}>{totalProjects}</div>
        </div>
        <div className={`${styles.metricCard} ${styles.metricGreen}`}>
          <div className={styles.metricLabel}>Ready for Handover</div>
          <div className={styles.metricValue}>{readyProjects}</div>
        </div>
        <div className={`${styles.metricCard} ${styles.metricRed}`}>
          <div className={styles.metricLabel}>Blocked / Incomplete</div>
          <div className={styles.metricValue}>{blockedProjects}</div>
        </div>
        <div className={`${styles.metricCard} ${styles.metricBlue}`}>
          <div className={styles.metricLabel}>Scheduled Handovers</div>
          <div className={styles.metricValue}>{scheduledCount}</div>
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
            All Projects
          </button>
          <button
            className={`${styles.filterTab} ${filterType === 'ready' ? styles.activeTab : ''}`}
            onClick={() => setFilterType('ready')}
          >
            Ready ({readyProjects})
          </button>
          <button
            className={`${styles.filterTab} ${filterType === 'blocked' ? styles.activeTab : ''}`}
            onClick={() => setFilterType('blocked')}
          >
            Blocked ({blockedProjects})
          </button>
        </div>
      </div>

      {/* Table grid */}
      {loading ? (
        <div className={styles.loading}>Loading dashboard...</div>
      ) : filteredData.length === 0 ? (
        <div className={styles.noData}>No projects found matching the filter criteria.</div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Project Name</th>
                <th>Project Manager</th>
                <th style={{ textAlign: 'center' }}>Tasks</th>
                <th style={{ textAlign: 'center' }}>Snags</th>
                <th style={{ textAlign: 'center' }}>Payments</th>
                <th style={{ textAlign: 'center' }}>Documents</th>
                <th style={{ textAlign: 'center' }}>PM Sign-Off</th>
                <th>Handover Ready</th>
                <th>Appointment Date</th>
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
                  
                  {/* Gate 1: Tasks */}
                  <td style={{ textAlign: 'center' }}>
                    <span 
                      className={`${styles.gateDot} ${item.gates?.tasksCompleted?.passed ? styles.dotPass : styles.dotFail}`}
                      title={`Task Gate: ${item.gates?.tasksCompleted?.detail || 'No data'}`}
                    >
                      {item.gates?.tasksCompleted?.passed ? '✓' : '✖'}
                    </span>
                  </td>

                  {/* Gate 2: Snags */}
                  <td style={{ textAlign: 'center' }}>
                    <span 
                      className={`${styles.gateDot} ${item.gates?.snagsResolved?.passed ? styles.dotPass : styles.dotFail}`}
                      title={`Snags Gate: ${item.gates?.snagsResolved?.detail || 'No data'}`}
                    >
                      {item.gates?.snagsResolved?.passed ? '✓' : '✖'}
                    </span>
                  </td>

                  {/* Gate 3: Payments */}
                  <td style={{ textAlign: 'center' }}>
                    <span 
                      className={`${styles.gateDot} ${item.gates?.paymentsCleared?.passed ? styles.dotPass : styles.dotFail}`}
                      title={`Payments Gate: ${item.gates?.paymentsCleared?.detail || 'No data'}`}
                    >
                      {item.gates?.paymentsCleared?.passed ? '✓' : '✖'}
                    </span>
                  </td>

                  {/* Gate 4: Documents */}
                  <td style={{ textAlign: 'center' }}>
                    <span 
                      className={`${styles.gateDot} ${item.gates?.documentsUploaded?.passed ? styles.dotPass : styles.dotFail}`}
                      title={`Documents Gate: ${item.gates?.documentsUploaded?.detail || 'No data'}`}
                    >
                      {item.gates?.documentsUploaded?.passed ? '✓' : '✖'}
                    </span>
                  </td>

                  {/* Gate 5: PM Sign-off */}
                  <td style={{ textAlign: 'center' }}>
                    <span 
                      className={`${styles.gateDot} ${item.gates?.pmSignedOff?.passed ? styles.dotPass : styles.dotFail}`}
                      title={`PM Sign-Off: ${item.gates?.pmSignedOff?.detail || 'No data'}`}
                    >
                      {item.gates?.pmSignedOff?.passed ? '✓' : '✖'}
                    </span>
                  </td>

                  <td>
                    <span className={`${styles.badge} ${item.overallReady ? styles.badgeGreen : styles.badgeRed}`}>
                      {item.overallReady ? 'READY' : 'BLOCKED'}
                    </span>
                  </td>

                  <td className={styles.bold}>{formatDate(item.nextAppointmentDate)}</td>

                  <td>
                    <Link to={`/projects/${item.projectId}?tab=Handover%20Readiness`} className={styles.actionBtn}>
                      Manage Gates
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
