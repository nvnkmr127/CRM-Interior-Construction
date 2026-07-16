/* eslint-disable react-hooks/immutability */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCollectionForecast } from '../../api/analytics';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { Spinner, EmptyState } from '../../components/ui';
import styles from './CollectionForecastReportPage.module.css';

export default function CollectionForecastReportPage() {
  usePageTitle('Collection Forecast');
  useBreadcrumbs([{ label: 'Analytics' }, { label: 'Collection Forecast' }]);

  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [periodType, setPeriodType] = useState('monthly'); // 'weekly' | 'monthly'
  const [segmentFilter, setSegmentFilter] = useState('all'); // 'all' | 'overdue' | 'projected' | 'collected'

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await getCollectionForecast();
      setData(res || null);
    } catch (error) {
      console.error('Failed to load collection forecast report:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loaderWrap}>
        <Spinner />
        <p>Loading collection forecast analytics...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState 
        title="Failed to load report" 
        description="There was an error loading the payment collection forecast."
      />
    );
  }

  const { projects = [], milestones = [] } = data;

  // Filter milestones based on user selection
  const filteredMilestones = milestones.filter(m => {
    const matchesSearch = 
      m.milestoneName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.clientName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProject = projectFilter === 'all' || m.projectId === projectFilter;
    const matchesSegment = segmentFilter === 'all' || m.inflowSegment === segmentFilter;
    return matchesSearch && matchesProject && matchesSegment;
  });

  // Calculate metrics for filtered subset
  const totalOverdue = filteredMilestones
    .filter(m => m.inflowSegment === 'overdue')
    .reduce((sum, m) => sum + m.outstandingAmount, 0);

  const totalProjected = filteredMilestones
    .filter(m => m.inflowSegment === 'projected')
    .reduce((sum, m) => sum + m.outstandingAmount, 0);

  const totalCollected = filteredMilestones
    .filter(m => m.inflowSegment === 'collected')
    .reduce((sum, m) => sum + m.paidAmount, 0);

  // Helper to format currency
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Helper to get week key (e.g. "2026-W26")
  const getWeekNumber = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  };

  // Group milestones into periods for chart rendering
  const getPeriodKey = (dueDateStr) => {
    if (!dueDateStr) return 'Unknown';
    const date = new Date(dueDateStr);
    if (periodType === 'monthly') {
      return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    } else {
      return getWeekNumber(date);
    }
  };

  // Build chart periods
  const periodGroups = {};
  filteredMilestones.forEach(m => {
    const key = getPeriodKey(m.dueDate);
    if (!periodGroups[key]) {
      periodGroups[key] = { period: key, overdue: 0, projected: 0, collected: 0, total: 0 };
    }
    
    if (m.inflowSegment === 'collected') {
      periodGroups[key].collected += m.paidAmount;
      periodGroups[key].total += m.paidAmount;
    } else if (m.inflowSegment === 'overdue') {
      periodGroups[key].overdue += m.outstandingAmount;
      periodGroups[key].total += m.outstandingAmount;
    } else {
      periodGroups[key].projected += m.outstandingAmount;
      periodGroups[key].total += m.outstandingAmount;
    }
  });

  const chartData = Object.values(periodGroups).sort((a, b) => {
    if (periodType === 'monthly') {
      return new Date('01 ' + a.period) - new Date('01 ' + b.period);
    }
    return a.period.localeCompare(b.period);
  });

  const maxTotal = chartData.reduce((max, d) => d.total > max ? d.total : max, 0) || 1;

  const getSegmentClass = (seg) => {
    switch (seg) {
      case 'collected': return styles.segCollected;
      case 'overdue': return styles.segOverdue;
      default: return styles.segProjected;
    }
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Payment Collection Forecast</h1>
          <div className={styles.desc}>
            Liquidity planning dashboard indicating expected cash collections and aging overdue invoices across active projects.
          </div>
        </div>
        <button className={styles.refreshBtn} onClick={fetchReport}>
          🔄 Refresh Forecast
        </button>
      </div>

      {/* Summary Cards */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Expected cash pool</span>
          <span className={styles.kpiValue}>{formatCurrency(totalOverdue + totalProjected)}</span>
          <span className={styles.kpiSub}>Outstanding future & overdue inflows</span>
        </div>
        <div className={styles.kpiCard} style={{ borderLeft: '4px solid var(--color-danger)' }}>
          <span className={styles.kpiLabel}>Overdue Inflows</span>
          <span className={`${styles.kpiValue} ${styles.textDanger}`}>{formatCurrency(totalOverdue)}</span>
          <span className={styles.kpiSub}>Past billing milestones unpaid</span>
        </div>
        <div className={styles.kpiCard} style={{ borderLeft: '4px solid var(--color-accent)' }}>
          <span className={styles.kpiLabel}>Projected Inflows (Future)</span>
          <span className={`${styles.kpiValue} ${styles.textAccent}`}>{formatCurrency(totalProjected)}</span>
          <span className={styles.kpiSub}>Expected future collections</span>
        </div>
        <div className={styles.kpiCard} style={{ borderLeft: '4px solid var(--color-success)' }}>
          <span className={styles.kpiLabel}>Collected to-date</span>
          <span className={`${styles.kpiValue} ${styles.textSuccess}`}>{formatCurrency(totalCollected)}</span>
          <span className={styles.kpiSub}>Milestone payments completed</span>
        </div>
      </div>

      {/* Interactive Bar Chart Panel */}
      <div className={styles.chartCard}>
        <div className={styles.chartHeader}>
          <h3 className={styles.chartTitle}>Inflow Projections by Period</h3>
          <div className={styles.chartToggle}>
            <button 
              className={`${styles.toggleBtn} ${periodType === 'weekly' ? styles.toggleActive : ''}`}
              onClick={() => setPeriodType('weekly')}
            >
              Weekly
            </button>
            <button 
              className={`${styles.toggleBtn} ${periodType === 'monthly' ? styles.toggleActive : ''}`}
              onClick={() => setPeriodType('monthly')}
            >
              Monthly
            </button>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className={styles.emptyChart}>No collection milestones scheduled in the active range.</div>
        ) : (
          <div className={styles.chartContainer}>
            <div className={styles.barList}>
              {chartData.map((d, index) => {
                const overdueHeight = (d.overdue / maxTotal) * 100;
                const projectedHeight = (d.projected / maxTotal) * 100;
                const collectedHeight = (d.collected / maxTotal) * 100;

                return (
                  <div key={index} className={styles.barCol}>
                    <div className={styles.barStack}>
                      {/* Overdue (Red) */}
                      {d.overdue > 0 && (
                        <div 
                          className={styles.barOverdue} 
                          style={{ height: `${overdueHeight}%` }}
                        >
                          <span className={styles.tooltip}>
                            <strong>{d.period} Overdue</strong><br />
                            {formatCurrency(d.overdue)}
                          </span>
                        </div>
                      )}
                      {/* Projected (Amber) */}
                      {d.projected > 0 && (
                        <div 
                          className={styles.barProjected} 
                          style={{ height: `${projectedHeight}%` }}
                        >
                          <span className={styles.tooltip}>
                            <strong>{d.period} Projected</strong><br />
                            {formatCurrency(d.projected)}
                          </span>
                        </div>
                      )}
                      {/* Collected (Green) */}
                      {d.collected > 0 && (
                        <div 
                          className={styles.barCollected} 
                          style={{ height: `${collectedHeight}%` }}
                        >
                          <span className={styles.tooltip}>
                            <strong>{d.period} Collected</strong><br />
                            {formatCurrency(d.collected)}
                          </span>
                        </div>
                      )}
                    </div>
                    <span className={styles.periodLabel}>{d.period}</span>
                  </div>
                );
              })}
            </div>
            {/* Chart Legend */}
            <div className={styles.legend}>
              <div className={styles.legendItem}>
                <span className={styles.legendColor} style={{ background: '#ef4444' }}></span>
                <span>Overdue Inflows</span>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendColor} style={{ background: '#3b82f6' }}></span>
                <span>Projected Inflows</span>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendColor} style={{ background: '#10b981' }}></span>
                <span>Collected Inflows</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filters and Controls */}
      <div className={styles.controlsRow}>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input 
            type="text" 
            placeholder="Search by milestone or client name..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.filterGroup}>
          <div className={styles.filterBox}>
            <span className={styles.filterLabel}>Project:</span>
            <select 
              value={projectFilter} 
              onChange={(e) => setProjectFilter(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className={styles.filterBox}>
            <span className={styles.filterLabel}>Segment:</span>
            <select 
              value={segmentFilter} 
              onChange={(e) => setSegmentFilter(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">All Milestones</option>
              <option value="overdue">Overdue Outstanding</option>
              <option value="projected">Future Projected</option>
              <option value="collected">Collected (Paid)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Ledger Table */}
      {filteredMilestones.length === 0 ? (
        <EmptyState 
          title="No milestones match filters" 
          description="Try adjusting your project filter, segment filter, or search keywords."
        />
      ) : (
        <div className={styles.tableCard}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Milestone</th>
                  <th className={styles.th}>Project</th>
                  <th className={styles.th}>Client</th>
                  <th className={styles.th}>Due Date</th>
                  <th className={styles.th}>Segment</th>
                  <th className={styles.th}>Amount</th>
                  <th className={styles.th}>Collected</th>
                  <th className={styles.th}>Outstanding Cash Inflow</th>
                  <th className={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {filteredMilestones.map(row => (
                  <tr key={row.id} className={styles.tr}>
                    <td className={styles.td}>
                      <span className={styles.milestoneName}>{row.milestoneName}</span>
                    </td>
                    <td className={styles.td}>{row.projectName}</td>
                    <td className={styles.td}>{row.clientName}</td>
                    <td className={styles.td}>{formatDate(row.dueDate)}</td>
                    <td className={styles.td}>
                      <span className={`${styles.statusBadge} ${getSegmentClass(row.inflowSegment)}`}>
                        {row.inflowSegment}
                      </span>
                    </td>
                    <td className={styles.td}>{formatCurrency(row.amount)}</td>
                    <td className={styles.td} style={{ color: 'var(--color-success)' }}>
                      {formatCurrency(row.paidAmount)}
                    </td>
                    <td className={`${styles.td} ${row.outstandingAmount > 0 ? styles.outstandingCell : ''}`}>
                      {formatCurrency(row.outstandingAmount)}
                    </td>
                    <td className={styles.td}>
                      <button 
                        className={styles.viewDetailBtn}
                        onClick={() => navigate(`/projects/${row.projectId}?tab=Quotations+%26+BOQ`)}
                      >
                        Project Details →
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
