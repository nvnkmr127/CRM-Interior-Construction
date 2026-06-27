import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPortfolioBOQVarianceReport } from '../../api/projects';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { Spinner, EmptyState } from '../../components/ui';
import styles from './BOQVarianceReportPage.module.css';

const STATUS_LABELS = {
  active: 'Active',
  completed: 'Completed',
  suspended: 'Suspended',
  cancelled: 'Cancelled',
  draft: 'Draft'
};

export default function BOQVarianceReportPage() {
  usePageTitle('BOQ Variance Report');
  useBreadcrumbs([{ label: 'Analytics' }, { label: 'BOQ Variance' }]);

  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await getPortfolioBOQVarianceReport();
      if (res.data?.success) {
        setData(res.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load portfolio BOQ variance report:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter data based on search and status
  const filteredData = data.filter(item => {
    const matchesSearch = 
      item.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.clientName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.projectStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate Aggregates
  const totalOriginal = filteredData.reduce((sum, item) => sum + item.originalSubtotal, 0);
  const totalChangeOrders = filteredData.reduce((sum, item) => sum + item.changeOrderSubtotal, 0);
  const totalRevisions = filteredData.reduce((sum, item) => sum + item.materialRevisionSubtotal, 0);
  const totalCurrent = filteredData.reduce((sum, item) => sum + item.currentSubtotal, 0);
  const netVariance = totalCurrent - totalOriginal;
  const netVariancePercentage = totalOriginal > 0 ? (netVariance / totalOriginal) * 100 : 0;

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'active': return styles.statusActive;
      case 'completed': return styles.statusCompleted;
      case 'suspended': return styles.statusSuspended;
      default: return styles.statusDefault;
    }
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>BOQ Variance Portfolio Report</h1>
          <div className={styles.desc}>
            Track contract value deviations, scope additions, and material substitutions across your project portfolio.
          </div>
        </div>
        <button className={styles.refreshBtn} onClick={fetchReport} disabled={loading}>
          {loading ? 'Refreshing...' : '🔄 Refresh Data'}
        </button>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Original BOQ Total</span>
          <span className={styles.kpiValue}>{formatCurrency(totalOriginal)}</span>
          <span className={styles.kpiSub}>Approved base quotations</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Scope Additions (Net)</span>
          <span className={styles.kpiValue} style={{ color: totalChangeOrders > 0 ? 'var(--color-warning)' : 'inherit' }}>
            {formatCurrency(totalChangeOrders)}
          </span>
          <span className={styles.kpiSub}>Approved change orders</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Material Revisions</span>
          <span className={styles.kpiValue} style={{ color: totalRevisions !== 0 ? 'var(--color-info)' : 'inherit' }}>
            {formatCurrency(totalRevisions)}
          </span>
          <span className={styles.kpiSub}>Approved substitutions</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Current Contract Value</span>
          <span className={styles.kpiValue} style={{ color: 'var(--color-success)' }}>
            {formatCurrency(totalCurrent)}
          </span>
          <span className={styles.kpiSub}>Net execution value</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Net Variance</span>
          <span className={`${styles.kpiValue} ${netVariance >= 0 ? styles.variancePositive : styles.varianceNegative}`}>
            {netVariance >= 0 ? '+' : ''}{formatCurrency(netVariance)}
          </span>
          <span className={styles.kpiSub}>
            {netVariancePercentage >= 0 ? 'Growth' : 'Erosion'} of {netVariancePercentage.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className={styles.controlsRow}>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input 
            type="text" 
            placeholder="Search by project or client name..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.filterBox}>
          <span className={styles.filterLabel}>Status:</span>
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All Projects</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="suspended">Suspended</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Main Report Table */}
      {loading ? (
        <div className={styles.loaderWrap}>
          <Spinner />
          <p>Loading BOQ variance data...</p>
        </div>
      ) : filteredData.length === 0 ? (
        <EmptyState 
          title="No projects found" 
          description="No projects match your search query or status filter criteria."
        />
      ) : (
        <div className={styles.tableCard}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Project</th>
                  <th className={styles.th}>Client</th>
                  <th className={styles.th}>Status</th>
                  <th className={styles.th}>Original Quote</th>
                  <th className={styles.th}>Change Orders</th>
                  <th className={styles.th}>Material Revisions</th>
                  <th className={styles.th}>Current Value</th>
                  <th className={styles.th}>Net Variance</th>
                  <th className={styles.th}>Var. %</th>
                  <th className={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map(row => (
                  <tr key={row.projectId} className={styles.tr}>
                    <td className={styles.td}>
                      <span className={styles.projectName}>{row.projectName}</span>
                    </td>
                    <td className={styles.td}>{row.clientName}</td>
                    <td className={styles.td}>
                      <span className={`${styles.statusBadge} ${getStatusClass(row.projectStatus)}`}>
                        {STATUS_LABELS[row.projectStatus] || row.projectStatus}
                      </span>
                    </td>
                    <td className={styles.td}>{formatCurrency(row.originalSubtotal)}</td>
                    <td className={styles.td}>{formatCurrency(row.changeOrderSubtotal)}</td>
                    <td className={styles.td}>{formatCurrency(row.materialRevisionSubtotal)}</td>
                    <td className={styles.td}>{formatCurrency(row.currentSubtotal)}</td>
                    <td className={`${styles.td} ${row.varianceAmount >= 0 ? styles.positiveCell : styles.negativeCell}`}>
                      {row.varianceAmount >= 0 ? '+' : ''}{formatCurrency(row.varianceAmount)}
                    </td>
                    <td className={`${styles.td} ${row.varianceAmount >= 0 ? styles.positiveCell : styles.negativeCell}`}>
                      {row.varianceAmount >= 0 ? '+' : ''}{row.variancePercentage.toFixed(1)}%
                    </td>
                    <td className={styles.td}>
                      <button 
                        className={styles.viewDetailBtn}
                        onClick={() => navigate(`/projects/${row.projectId}?tab=BOQ+Variance`)}
                      >
                        Detail →
                      </button>
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
