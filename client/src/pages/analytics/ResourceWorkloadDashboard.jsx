import { useState, useEffect } from 'react';
import { getResourceUtilisationReport } from '../../api/analytics';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { EmptyState } from '../../components/ui';
import styles from './ResourceUtilisationReportPage.module.css';

export default function ResourceWorkloadDashboard() {
  usePageTitle('Resource Workload Dashboard');
  useBreadcrumbs([{ label: 'Analytics' }, { label: 'Resource Workload Dashboard' }]);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [threshold, setThreshold] = useState(100);

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await getResourceUtilisationReport();
      setData(res || []);
    } catch (error) {
      console.error('Failed to load resource workload report:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = data.filter(r => {
    const matchesSearch = 
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.roleName.toLowerCase().includes(searchTerm.toLowerCase());
      
    let matchesRole = true;
    if (roleFilter === 'pm') {
      matchesRole = r.roleName === 'Project Manager';
    } else if (roleFilter === 'designer') {
      matchesRole = r.roleName === 'Designer';
    } else if (roleFilter === 'site_engineer') {
      matchesRole = r.roleName === 'Site Engineer';
    } else if (roleFilter === 'other') {
      matchesRole = r.roleName !== 'Project Manager' && r.roleName !== 'Designer' && r.roleName !== 'Site Engineer';
    }

    return matchesSearch && matchesRole;
  });

  const totalStaff = filteredData.length;
  const totalAllocatedProjects = filteredData.reduce((sum, r) => sum + r.activeProjectsCount, 0);
  const overloadedStaff = filteredData.filter(r => r.workloadScore > threshold).length;

  const avgWorkloadScore = totalStaff > 0
    ? filteredData.reduce((sum, r) => sum + r.workloadScore, 0) / totalStaff
    : 0;

  const getWorkloadClass = (score) => {
    if (score > threshold) return styles.workloadOverloaded;
    if (score >= (threshold * 0.7)) return styles.workloadOptimal;
    return styles.workloadUnderloaded;
  };

  const getInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : '?';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'None';
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (val) => {
    if (!val) return '₹0';
    return `₹${val.toLocaleString()}`;
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Resource Workload Dashboard</h1>
          <div className={styles.desc}>
            Consolidated view of resource loads, active projects, combined deadline pressure, and scope values.
          </div>
        </div>
        <button className={styles.refreshBtn} onClick={fetchReport}>
          🔄 Refresh Data
        </button>
      </div>

      {/* KPI Stats */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Monitored Staff</span>
          <span className={styles.kpiValue}>{totalStaff}</span>
          <span className={styles.kpiSub}>Active PMs, Designers & Site Engineers</span>
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
          <span className={styles.kpiSub}>Target allocation: {Math.round(threshold * 0.7)}% - {threshold}%</span>
        </div>
        <div className={styles.kpiCard} style={{ borderLeft: overloadedStaff > 0 ? '4px solid var(--color-danger)' : '' }}>
          <span className={styles.kpiLabel}>Overloaded staff</span>
          <span className={`${styles.kpiValue} ${overloadedStaff > 0 ? styles.textDanger : ''}`}>
            {overloadedStaff}
          </span>
          <span className={styles.kpiSub}>Workload exceeds capacity threshold</span>
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
              <option value="site_engineer">Site Engineers</option>
              <option value="other">Other staff</option>
            </select>
          </div>

          <div className={styles.filterBox} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={styles.filterLabel}>Capacity Threshold (%):</span>
            <input 
              type="number"
              min="1"
              max="200"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
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
                  <th className={styles.th}>Total Scope Value</th>
                  <th className={styles.th}>Nearest Deadline</th>
                  <th className={styles.th}>Hours Committed / Capacity</th>
                  <th className={styles.th}>Workload Score</th>
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
                                <li key={p.id}>{p.name} ({p.hoursAllocated || 0} hrs/wk, Due: {formatDate(p.targetDate)})</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className={styles.td}>{formatCurrency(row.totalScopeValue)}</td>
                    <td className={styles.td}>{formatDate(row.nearestDeadline)}</td>
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
                      {row.workloadScore > threshold ? (
                        <span className={styles.badgeDanger} style={{backgroundColor: '#ffebeb', color: '#dc3545', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold'}}>⚠️ Overloaded</span>
                      ) : row.workloadScore >= (threshold * 0.7) ? (
                        <span className={styles.badgeOptimal} style={{backgroundColor: '#e6f4ea', color: '#28a745', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold'}}>✓ Optimal</span>
                      ) : (
                        <span className={styles.badgeUnder} style={{backgroundColor: '#e8f0fe', color: '#0056b3', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold'}}>Available</span>
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
