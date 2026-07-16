/* eslint-disable no-unused-vars, react-hooks/immutability */
import { useState, useEffect } from 'react';
import { getResourceUtilisationReport } from '../../api/analytics';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { Spinner, EmptyState } from '../../components/ui';
import styles from './ResourceUtilisationReportPage.module.css';

export default function ResourceUtilisationReportPage() {
  usePageTitle('Resource Utilisation');
  useBreadcrumbs([{ label: 'Analytics' }, { label: 'Resource Utilisation' }]);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [workloadFilter, setWorkloadFilter] = useState('all'); // 'all' | 'overloaded' | 'optimal' | 'underloaded'

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await getResourceUtilisationReport();
      setData(res || []);
    } catch (error) {
      console.error('Failed to load resource utilisation report:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter list
  const filteredData = data.filter(r => {
    const matchesSearch = 
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.roleName.toLowerCase().includes(searchTerm.toLowerCase());
      
    let matchesRole = true;
    if (roleFilter === 'pm') {
      matchesRole = r.roleName === 'Project Manager';
    } else if (roleFilter === 'designer') {
      matchesRole = r.roleName === 'Designer';
    } else if (roleFilter === 'other') {
      matchesRole = r.roleName !== 'Project Manager' && r.roleName !== 'Designer';
    }

    let matchesWorkload = true;
    if (workloadFilter === 'overloaded') {
      matchesWorkload = r.workloadScore > 100;
    } else if (workloadFilter === 'optimal') {
      matchesWorkload = r.workloadScore >= 70 && r.workloadScore <= 100;
    } else if (workloadFilter === 'underloaded') {
      matchesWorkload = r.workloadScore < 70;
    }

    return matchesSearch && matchesRole && matchesWorkload;
  });

  // Calculate aggregates
  const totalStaff = filteredData.length;
  const totalAllocatedProjects = filteredData.reduce((sum, r) => sum + r.activeProjectsCount, 0);
  const overloadedStaff = filteredData.filter(r => r.workloadScore > 100).length;
  
  const avgWorkloadScore = totalStaff > 0
    ? filteredData.reduce((sum, r) => sum + r.workloadScore, 0) / totalStaff
    : 0;

  const getWorkloadClass = (score) => {
    if (score > 100) return styles.workloadOverloaded;
    if (score >= 70) return styles.workloadOptimal;
    return styles.workloadUnderloaded;
  };

  const getAvailabilityClass = (avail) => {
    if (avail > 5) return styles.availGreen;
    if (avail >= 0) return styles.availYellow;
    return styles.availRed;
  };

  const getInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : '?';
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Resource Utilisation & Capacity</h1>
          <div className={styles.desc}>
            Track PM and designer workloads, task completion rates, and staffing hiring availability.
          </div>
        </div>
        <button className={styles.refreshBtn} onClick={fetchReport}>
          🔄 Refresh Capacity
        </button>
      </div>

      {/* KPI Stats */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Monitored Staff</span>
          <span className={styles.kpiValue}>{totalStaff}</span>
          <span className={styles.kpiSub}>Active PMs & Designers</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Active Assignments</span>
          <span className={styles.kpiValue}>{totalAllocatedProjects}</span>
          <span className={styles.kpiSub}>Projects allocated across team</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Avg. Workload Score</span>
          <span className={`${styles.kpiValue} ${getWorkloadClass(avgWorkloadScore)}`}>
            {avgWorkloadScore.toFixed(1)}%
          </span>
          <span className={styles.kpiSub}>Target allocation: 70% - 100%</span>
        </div>
        <div className={styles.kpiCard} style={{ borderLeft: overloadedStaff > 0 ? '4px solid var(--color-danger)' : '' }}>
          <span className={styles.kpiLabel}>Overloaded staff</span>
          <span className={`${styles.kpiValue} ${overloadedStaff > 0 ? styles.textDanger : ''}`}>
            {overloadedStaff}
          </span>
          <span className={styles.kpiSub}>Workload exceeds capacity</span>
        </div>
      </div>

      {/* Controls */}
      <div className={styles.controlsRow}>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input 
            type="text" 
            placeholder="Search by staff name or role..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.filterGroup}>
          <div className={styles.filterBox}>
            <span className={styles.filterLabel}>Role:</span>
            <select 
              value={roleFilter} 
              onChange={(e) => setRoleFilter(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">All Roles</option>
              <option value="pm">Project Managers</option>
              <option value="designer">Designers</option>
              <option value="other">Other staff</option>
            </select>
          </div>

          <div className={styles.filterBox}>
            <span className={styles.filterLabel}>Workload:</span>
            <select 
              value={workloadFilter} 
              onChange={(e) => setWorkloadFilter(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">All Workloads</option>
              <option value="overloaded">Overloaded (&gt; 100%)</option>
              <option value="optimal">Optimal (70% - 100%)</option>
              <option value="underloaded">Underloaded (&lt; 70%)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Resource Table */}
      {filteredData.length === 0 ? (
        <EmptyState 
          title="No resources found" 
          description="Adjust your search query or filter selection."
        />
      ) : (
        <div className={styles.tableCard}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Staff Member</th>
                  <th className={styles.th}>Role</th>
                  <th className={styles.th}>Active Projects</th>
                  <th className={styles.th}>Hours Committed / Capacity</th>
                  <th className={styles.th}>Workload Score</th>
                  <th className={styles.th}>Task Completion (Assigned)</th>
                  <th className={styles.th}>Availability</th>
                  <th className={styles.th}>Allocation Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map(row => (
                  <tr key={row.id} className={styles.tr}>
                    <td className={styles.td}>
                      <div className={styles.userCell}>
                        <div className={styles.avatar}>
                          {getInitial(row.name)}
                        </div>
                        <div className={styles.userDetail}>
                          <span className={styles.userName}>{row.name}</span>
                          <span className={styles.userEmail}>{row.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className={styles.td}>{row.roleName}</td>
                    <td className={styles.td}>
                      <div className={styles.projectListCell}>
                        <span className={styles.projectCountBadge}>{row.activeProjectsCount} Projects</span>
                        {row.activeProjects.length > 0 && (
                          <div className={styles.hoverProjectsPopup}>
                            <strong>Assigned Active Projects:</strong>
                            <ul>
                              {row.activeProjects.map(p => (
                                <li key={p.id}>{p.name} ({p.hoursAllocated || 0} hrs/wk)</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className={styles.td}>
                      <strong>{row.totalHoursAllocated} hrs</strong> / {row.weeklyCapacity} hrs
                    </td>
                    <td className={styles.td}>
                      <div className={styles.workloadProgressWrapper}>
                        <div className={styles.progressBarBg}>
                          <div 
                            className={`${styles.progressBarFill} ${getWorkloadClass(row.workloadScore)}`}
                            style={{ width: `${Math.min(100, row.workloadScore)}%` }}
                          ></div>
                        </div>
                        <span className={styles.progressScoreVal}>{row.workloadScore.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className={styles.td}>
                      <div className={styles.taskCell}>
                        <span>{row.completedTasks} / {row.totalTasks} Done</span>
                        {row.totalTasks > 0 && (
                          <span className={styles.taskRate}>({row.completionPercentage.toFixed(0)}%)</span>
                        )}
                      </div>
                    </td>
                    <td className={`${styles.td} ${getAvailabilityClass(row.availability)} ${styles.boldCell}`}>
                      {row.availability >= 0 ? `+${row.availability} hrs` : `${row.availability} hrs`}
                    </td>
                    <td className={styles.td}>
                      {row.workloadScore > 100 ? (
                        <span className={styles.badgeDanger}>⚠️ Overloaded</span>
                      ) : row.workloadScore >= 70 ? (
                        <span className={styles.badgeOptimal}>✓ Optimal</span>
                      ) : (
                        <span className={styles.badgeUnder}>Available</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
