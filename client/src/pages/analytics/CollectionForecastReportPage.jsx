/* eslint-disable react-hooks/immutability */
import { useState, useEffect, useMemo } from 'react';
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
  const [errorMsg, setErrorMsg] = useState(null);

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [segmentFilter, setSegmentFilter] = useState('all'); // 'all' | 'overdue' | 'projected' | 'collected'
  const [agingFilter, setAgingFilter] = useState('all'); // 'all' | '0-30' | '31-60' | '61-90' | '90+'
  const [dateRangeFilter, setDateRangeFilter] = useState('all'); // 'all' | 'next30' | 'next90' | 'thisYear'
  const [selectedPeriod, setSelectedPeriod] = useState('all');

  // Time & Display states
  const [periodType, setPeriodType] = useState('monthly'); // 'weekly' | 'monthly' | 'quarterly'

  // Table sorting & pagination
  const [sortField, setSortField] = useState('dueDate');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await getCollectionForecast();
      setData(res || null);
    } catch (err) {
      console.error('Failed to load collection forecast report:', err);
      setErrorMsg('Failed to load payment collection forecast analytics.');
    } finally {
      setLoading(false);
    }
  };

  // Helper formatting routines
  const formatCurrency = (val) => {
    const num = val !== undefined && val !== null ? Number(val) : 0;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(num);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getAgingDays = (dueDateStr) => {
    if (!dueDateStr) return 0;
    const due = new Date(dueDateStr);
    const today = new Date();
    due.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = today - due;
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  };

  const getAgingBucket = (dueDateStr) => {
    const days = getAgingDays(dueDateStr);
    if (days <= 30) return '0-30';
    if (days <= 60) return '31-60';
    if (days <= 90) return '61-90';
    return '90+';
  };

  const getWeekNumber = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  };

  const getQuarter = (date) => {
    const d = new Date(date);
    const q = Math.floor(d.getMonth() / 3) + 1;
    return `Q${q} ${d.getFullYear()}`;
  };

  const getPeriodKey = (dueDateStr) => {
    if (!dueDateStr) return 'Unscheduled';
    const date = new Date(dueDateStr);
    if (isNaN(date.getTime())) return 'Unscheduled';

    if (periodType === 'weekly') {
      return getWeekNumber(date);
    } else if (periodType === 'quarterly') {
      return getQuarter(date);
    } else {
      return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    }
  };

  // Filtered dataset evaluation
  const { projects = [], milestones = [] } = data || {};

  const filteredMilestones = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return milestones.filter(m => {
      const milestoneName = m.milestoneName || '';
      const clientName = m.clientName || '';
      const projectName = m.projectName || '';

      const matchesSearch = 
        milestoneName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        projectName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesProject = projectFilter === 'all' || m.projectId === projectFilter;
      const matchesSegment = segmentFilter === 'all' || m.inflowSegment === segmentFilter;

      // Aging filter (applies to overdue items)
      let matchesAging = true;
      if (agingFilter !== 'all') {
        if (m.inflowSegment !== 'overdue') {
          matchesAging = false;
        } else {
          matchesAging = getAgingBucket(m.dueDate) === agingFilter;
        }
      }

      // Date range filter
      let matchesDateRange = true;
      if (dateRangeFilter !== 'all' && m.dueDate) {
        const dueDate = new Date(m.dueDate);
        const diffDays = (dueDate - today) / (1000 * 60 * 60 * 24);
        
        if (dateRangeFilter === 'next30') {
          matchesDateRange = diffDays >= 0 && diffDays <= 30;
        } else if (dateRangeFilter === 'next90') {
          matchesDateRange = diffDays >= 0 && diffDays <= 90;
        } else if (dateRangeFilter === 'thisYear') {
          matchesDateRange = dueDate.getFullYear() === today.getFullYear();
        }
      }

      // Period filter selection from chart click
      let matchesPeriod = true;
      if (selectedPeriod !== 'all') {
        matchesPeriod = getPeriodKey(m.dueDate) === selectedPeriod;
      }

      return matchesSearch && matchesProject && matchesSegment && matchesAging && matchesDateRange && matchesPeriod;
    });
  }, [milestones, searchTerm, projectFilter, segmentFilter, agingFilter, dateRangeFilter, selectedPeriod, periodType]);

  // Overall financial summary metrics
  const summaryMetrics = useMemo(() => {
    let overdue = 0;
    let projected = 0;
    let collected = 0;
    let totalContractVal = 0;
    let overdueCount = 0;
    let projectedCount = 0;
    let collectedCount = 0;

    const agingBuckets = {
      '0-30': { amount: 0, count: 0 },
      '31-60': { amount: 0, count: 0 },
      '61-90': { amount: 0, count: 0 },
      '90+': { amount: 0, count: 0 },
    };

    filteredMilestones.forEach(m => {
      const paid = Number(m.paidAmount || 0);
      const outstanding = Number(m.outstandingAmount || 0);
      const amount = Number(m.amount || 0);

      // Accumulate total paid cash and total milestone contract value
      collected += paid;
      totalContractVal += amount;

      if (m.inflowSegment === 'collected' || outstanding <= 0) {
        collectedCount += 1;
      } else if (m.inflowSegment === 'overdue') {
        overdue += outstanding;
        overdueCount += 1;

        const bucket = getAgingBucket(m.dueDate);
        if (agingBuckets[bucket]) {
          agingBuckets[bucket].amount += outstanding;
          agingBuckets[bucket].count += 1;
        }
      } else {
        projected += outstanding;
        projectedCount += 1;
      }
    });

    const expectedPool = overdue + projected;
    const realizationRate = totalContractVal > 0 ? (collected / totalContractVal) * 100 : 0;

    return {
      totalExpectedPool: expectedPool,
      totalOverdue: overdue,
      totalProjected: projected,
      totalCollected: collected,
      totalContractVal,
      realizationRate,
      overdueCount,
      projectedCount,
      collectedCount,
      agingBuckets
    };
  }, [filteredMilestones]);

  // Chart aggregation
  const chartData = useMemo(() => {
    const periodGroups = {};
    
    filteredMilestones.forEach(m => {
      const key = getPeriodKey(m.dueDate);
      if (!periodGroups[key]) {
        periodGroups[key] = { period: key, overdue: 0, projected: 0, collected: 0, total: 0, count: 0 };
      }

      const paid = Number(m.paidAmount || 0);
      const outstanding = Number(m.outstandingAmount || 0);
      periodGroups[key].count += 1;

      if (m.inflowSegment === 'collected') {
        periodGroups[key].collected += paid;
        periodGroups[key].total += paid;
      } else if (m.inflowSegment === 'overdue') {
        periodGroups[key].overdue += outstanding;
        periodGroups[key].total += outstanding;
      } else {
        periodGroups[key].projected += outstanding;
        periodGroups[key].total += outstanding;
      }
    });

    return Object.values(periodGroups).sort((a, b) => {
      if (periodType === 'monthly') {
        return new Date('01 ' + a.period) - new Date('01 ' + b.period);
      }
      return a.period.localeCompare(b.period);
    });
  }, [filteredMilestones, periodType]);

  const maxChartTotal = useMemo(() => {
    return chartData.reduce((max, d) => (d.total > max ? d.total : max), 0) || 1;
  }, [chartData]);

  // Sorted and Paginated Milestones
  const sortedMilestones = useMemo(() => {
    const sorted = [...filteredMilestones];
    sorted.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'dueDate') {
        valA = valA ? new Date(valA).getTime() : 0;
        valB = valB ? new Date(valB).getTime() : 0;
      } else if (['amount', 'paidAmount', 'outstandingAmount'].includes(sortField)) {
        valA = Number(valA || 0);
        valB = Number(valB || 0);
      } else if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = (valB || '').toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredMilestones, sortField, sortOrder]);

  const totalPages = pageSize === 'all' ? 1 : Math.ceil(sortedMilestones.length / Number(pageSize));

  const paginatedMilestones = useMemo(() => {
    if (pageSize === 'all') return sortedMilestones;
    const size = Number(pageSize);
    const start = (currentPage - 1) * size;
    return sortedMilestones.slice(start, start + size);
  }, [sortedMilestones, currentPage, pageSize]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleExportCSV = () => {
    if (filteredMilestones.length === 0) return;

    const headers = ['Milestone Name', 'Project Name', 'Client Name', 'Due Date', 'Segment', 'Total Amount (INR)', 'Paid Amount (INR)', 'Outstanding Amount (INR)', 'Aging Days'];
    const rows = filteredMilestones.map(m => [
      `"${(m.milestoneName || '').replace(/"/g, '""')}"`,
      `"${(m.projectName || '').replace(/"/g, '""')}"`,
      `"${(m.clientName || '').replace(/"/g, '""')}"`,
      `"${formatDate(m.dueDate)}"`,
      `"${m.inflowSegment || ''}"`,
      m.amount || 0,
      m.paidAmount || 0,
      m.outstandingAmount || 0,
      m.inflowSegment === 'overdue' ? getAgingDays(m.dueDate) : 0
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Collection_Forecast_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className={styles.loaderWrap}>
        <Spinner />
        <p>Loading collection forecast analytics...</p>
      </div>
    );
  }

  if (errorMsg || !data) {
    return (
      <div className={styles.page}>
        <EmptyState 
          title="Failed to load collection forecast" 
          description={errorMsg || "There was an issue retrieving liquidity analytics."}
        />
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button className={styles.refreshBtn} onClick={fetchReport}>
            🔄 Try Again
          </button>
        </div>
      </div>
    );
  }

  const getSegmentClass = (seg) => {
    switch (seg) {
      case 'collected': return styles.segCollected;
      case 'overdue': return styles.segOverdue;
      default: return styles.segProjected;
    }
  };

  return (
    <div className={styles.page}>
      {/* Top Header */}
      <div className={styles.headerRow}>
        <div>
          <div className={styles.titleWrap}>
            <h1 className={styles.title}>Payment Collection Forecast</h1>
            <span className={styles.badgeLive}>Real-time Liquidity</span>
          </div>
          <div className={styles.desc}>
            Cash flow planning & liquidity forecasting dashboard for expected collections, milestone milestones, and overdue aging invoices.
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.exportBtn} onClick={handleExportCSV} title="Download CSV report">
            📥 Export CSV
          </button>
          <button className={styles.refreshBtn} onClick={fetchReport}>
            🔄 Refresh Forecast
          </button>
        </div>
      </div>

      {/* Primary Financial Metric Strip */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Total Expected Cash Pool</span>
            <span className={styles.kpiIcon}>💰</span>
          </div>
          <span className={styles.kpiValue}>{formatCurrency(summaryMetrics.totalExpectedPool)}</span>
          <div className={styles.kpiFooter}>
            <span className={styles.kpiSub}>Combined overdue & future projected</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Overdue Outstanding</span>
            <span className={styles.kpiIcon}>🚨</span>
          </div>
          <span className={`${styles.kpiValue} ${styles.textDanger}`}>{formatCurrency(summaryMetrics.totalOverdue)}</span>
          <div className={styles.kpiFooter}>
            <span className={styles.kpiBadgeDanger}>{summaryMetrics.overdueCount} Unpaid Milestones</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Projected Future Inflows</span>
            <span className={styles.kpiIcon}>📈</span>
          </div>
          <span className={`${styles.kpiValue} ${styles.textAccent}`}>{formatCurrency(summaryMetrics.totalProjected)}</span>
          <div className={styles.kpiFooter}>
            <span className={styles.kpiSub}>{summaryMetrics.projectedCount} Upcoming Invoices</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Collected To-Date</span>
            <span className={styles.kpiIcon}>✅</span>
          </div>
          <span className={`${styles.kpiValue} ${styles.textSuccess}`}>{formatCurrency(summaryMetrics.totalCollected)}</span>
          <div className={styles.kpiFooter}>
            <span className={styles.kpiSub}>Realization: <strong>{summaryMetrics.realizationRate.toFixed(1)}%</strong></span>
          </div>
        </div>
      </div>

      {/* Overdue Collections Aging Matrix */}
      <div className={styles.agingSection}>
        <div className={styles.agingHeader}>
          <h3 className={styles.agingTitle}>⏱️ Overdue Collections Aging Matrix</h3>
          <span className={styles.agingSubtitle}>Breakdown of past-due payments by aging duration</span>
        </div>
        <div className={styles.agingGrid}>
          <div 
            className={`${styles.agingCard} ${agingFilter === '0-30' ? styles.agingCardActive : ''}`}
            onClick={() => setAgingFilter(prev => (prev === '0-30' ? 'all' : '0-30'))}
          >
            <div className={styles.agingCardTop}>
              <span className={styles.agingTagAmber}>0 - 30 Days</span>
              <span className={styles.agingCount}>{summaryMetrics.agingBuckets['0-30'].count} items</span>
            </div>
            <div className={styles.agingVal}>{formatCurrency(summaryMetrics.agingBuckets['0-30'].amount)}</div>
            <div className={styles.agingBarBg}>
              <div 
                className={styles.agingBarFillAmber} 
                style={{ width: `${summaryMetrics.totalOverdue > 0 ? (summaryMetrics.agingBuckets['0-30'].amount / summaryMetrics.totalOverdue) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div 
            className={`${styles.agingCard} ${agingFilter === '31-60' ? styles.agingCardActive : ''}`}
            onClick={() => setAgingFilter(prev => (prev === '31-60' ? 'all' : '31-60'))}
          >
            <div className={styles.agingCardTop}>
              <span className={styles.agingTagOrange}>31 - 60 Days</span>
              <span className={styles.agingCount}>{summaryMetrics.agingBuckets['31-60'].count} items</span>
            </div>
            <div className={styles.agingVal}>{formatCurrency(summaryMetrics.agingBuckets['31-60'].amount)}</div>
            <div className={styles.agingBarBg}>
              <div 
                className={styles.agingBarFillOrange} 
                style={{ width: `${summaryMetrics.totalOverdue > 0 ? (summaryMetrics.agingBuckets['31-60'].amount / summaryMetrics.totalOverdue) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div 
            className={`${styles.agingCard} ${agingFilter === '61-90' ? styles.agingCardActive : ''}`}
            onClick={() => setAgingFilter(prev => (prev === '61-90' ? 'all' : '61-90'))}
          >
            <div className={styles.agingCardTop}>
              <span className={styles.agingTagRed}>61 - 90 Days</span>
              <span className={styles.agingCount}>{summaryMetrics.agingBuckets['61-90'].count} items</span>
            </div>
            <div className={styles.agingVal}>{formatCurrency(summaryMetrics.agingBuckets['61-90'].amount)}</div>
            <div className={styles.agingBarBg}>
              <div 
                className={styles.agingBarFillRed} 
                style={{ width: `${summaryMetrics.totalOverdue > 0 ? (summaryMetrics.agingBuckets['61-90'].amount / summaryMetrics.totalOverdue) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div 
            className={`${styles.agingCard} ${agingFilter === '90+' ? styles.agingCardActive : ''}`}
            onClick={() => setAgingFilter(prev => (prev === '90+' ? 'all' : '90+'))}
          >
            <div className={styles.agingCardTop}>
              <span className={styles.agingTagCritical}>90+ Days Critical</span>
              <span className={styles.agingCount}>{summaryMetrics.agingBuckets['90+'].count} items</span>
            </div>
            <div className={styles.agingVal}>{formatCurrency(summaryMetrics.agingBuckets['90+'].amount)}</div>
            <div className={styles.agingBarBg}>
              <div 
                className={styles.agingBarFillCritical} 
                style={{ width: `${summaryMetrics.totalOverdue > 0 ? (summaryMetrics.agingBuckets['90+'].amount / summaryMetrics.totalOverdue) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search Controls */}
      <div className={styles.controlsRow}>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input 
            type="text" 
            placeholder="Search by milestone, project, or client..." 
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className={styles.searchInput}
          />
          {searchTerm && (
            <button className={styles.clearSearchBtn} onClick={() => setSearchTerm('')}>✕</button>
          )}
        </div>

        <div className={styles.filterGroup}>
          <div className={styles.filterBox}>
            <span className={styles.filterLabel}>Project:</span>
            <select 
              value={projectFilter} 
              onChange={(e) => { setProjectFilter(e.target.value); setCurrentPage(1); }}
              className={styles.filterSelect}
            >
              <option value="all">All Projects ({Array.from(new Map(projects.map(p => [p.id, p])).values()).length})</option>
              {Array.from(new Map(projects.map(p => [p.id, p])).values()).map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.clientName ? ` (${p.clientName})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterBox}>
            <span className={styles.filterLabel}>Segment:</span>
            <select 
              value={segmentFilter} 
              onChange={(e) => { setSegmentFilter(e.target.value); setCurrentPage(1); }}
              className={styles.filterSelect}
            >
              <option value="all">All Segments</option>
              <option value="overdue">Overdue Outstanding</option>
              <option value="projected">Future Projected</option>
              <option value="collected">Collected (Paid)</option>
            </select>
          </div>

          <div className={styles.filterBox}>
            <span className={styles.filterLabel}>Time Window:</span>
            <select 
              value={dateRangeFilter} 
              onChange={(e) => { setDateRangeFilter(e.target.value); setCurrentPage(1); }}
              className={styles.filterSelect}
            >
              <option value="all">All Dates</option>
              <option value="next30">Next 30 Days</option>
              <option value="next90">Next 90 Days</option>
              <option value="thisYear">This Calendar Year</option>
            </select>
          </div>
        </div>
      </div>

      {/* Active Filter Badges */}
      {(searchTerm || projectFilter !== 'all' || segmentFilter !== 'all' || agingFilter !== 'all' || dateRangeFilter !== 'all' || selectedPeriod !== 'all') && (
        <div className={styles.activeFiltersBar}>
          <span className={styles.activeFiltersTitle}>Active Filters:</span>
          {searchTerm && <span className={styles.filterBadge}>Search: "{searchTerm}" <button onClick={() => setSearchTerm('')}>✕</button></span>}
          {projectFilter !== 'all' && <span className={styles.filterBadge}>Project Filtered <button onClick={() => setProjectFilter('all')}>✕</button></span>}
          {segmentFilter !== 'all' && <span className={styles.filterBadge}>Segment: {segmentFilter} <button onClick={() => setSegmentFilter('all')}>✕</button></span>}
          {agingFilter !== 'all' && <span className={styles.filterBadge}>Aging: {agingFilter} Days <button onClick={() => setAgingFilter('all')}>✕</button></span>}
          {dateRangeFilter !== 'all' && <span className={styles.filterBadge}>Window: {dateRangeFilter} <button onClick={() => setDateRangeFilter('all')}>✕</button></span>}
          {selectedPeriod !== 'all' && <span className={styles.filterBadge}>Period: {selectedPeriod} <button onClick={() => setSelectedPeriod('all')}>✕</button></span>}
          <button 
            className={styles.resetAllBtn} 
            onClick={() => {
              setSearchTerm('');
              setProjectFilter('all');
              setSegmentFilter('all');
              setAgingFilter('all');
              setDateRangeFilter('all');
              setSelectedPeriod('all');
              setCurrentPage(1);
            }}
          >
            Reset All Filters
          </button>
        </div>
      )}

      {/* Dynamic Forecast Visual Chart Panel */}
      <div className={styles.chartCard}>
        <div className={styles.chartHeader}>
          <div>
            <h3 className={styles.chartTitle}>Inflow Projections & Historical Collections</h3>
            <span className={styles.chartSub}>Stacked period view of payment collections by schedule</span>
          </div>
          <div className={styles.chartControls}>
            {selectedPeriod !== 'all' && (
              <button className={styles.clearPeriodBtn} onClick={() => setSelectedPeriod('all')}>
                Filter: {selectedPeriod} ✕
              </button>
            )}
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
              <button 
                className={`${styles.toggleBtn} ${periodType === 'quarterly' ? styles.toggleActive : ''}`}
                onClick={() => setPeriodType('quarterly')}
              >
                Quarterly
              </button>
            </div>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className={styles.emptyChart}>No collection milestones found in the selected range.</div>
        ) : (
          <div className={styles.chartContainer}>
            <div className={styles.barList}>
              {chartData.map((d, index) => {
                const overdueHeight = (d.overdue / maxChartTotal) * 100;
                const projectedHeight = (d.projected / maxChartTotal) * 100;
                const collectedHeight = (d.collected / maxChartTotal) * 100;
                const isSelected = selectedPeriod === d.period;

                return (
                  <div 
                    key={index} 
                    className={`${styles.barCol} ${isSelected ? styles.barColSelected : ''}`}
                    onClick={() => setSelectedPeriod(prev => (prev === d.period ? 'all' : d.period))}
                  >
                    {/* Hover Popover Tooltip for whole column */}
                    <div className={styles.barTooltip}>
                      <div className={styles.barTooltipTitle}>{d.period} Inflow Summary</div>
                      {d.collected > 0 && <div className={styles.barTooltipRow} style={{ color: 'var(--color-success)' }}>Collected: {formatCurrency(d.collected)}</div>}
                      {d.projected > 0 && <div className={styles.barTooltipRow} style={{ color: 'var(--color-accent)' }}>Projected: {formatCurrency(d.projected)}</div>}
                      {d.overdue > 0 && <div className={styles.barTooltipRow} style={{ color: 'var(--color-danger)' }}>Overdue: {formatCurrency(d.overdue)}</div>}
                      <div className={styles.barTooltipTotal}>Total: {formatCurrency(d.total)}</div>
                    </div>

                    <span className={styles.barTotalLabel}>{formatCurrency(d.total)}</span>
                    <div className={styles.barStack}>
                      {/* Overdue (Red) */}
                      {d.overdue > 0 && (
                        <div 
                          className={styles.barOverdue} 
                          style={{ height: `${overdueHeight}%` }}
                          title={`${d.period} Overdue: ${formatCurrency(d.overdue)}`}
                        />
                      )}
                      {/* Projected (Blue) */}
                      {d.projected > 0 && (
                        <div 
                          className={styles.barProjected} 
                          style={{ height: `${projectedHeight}%` }}
                          title={`${d.period} Projected: ${formatCurrency(d.projected)}`}
                        />
                      )}
                      {/* Collected (Green) */}
                      {d.collected > 0 && (
                        <div 
                          className={styles.barCollected} 
                          style={{ height: `${collectedHeight}%` }}
                          title={`${d.period} Collected: ${formatCurrency(d.collected)}`}
                        />
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
                <span className={styles.legendColor} style={{ background: 'var(--color-danger)' }}></span>
                <span>Overdue Inflows</span>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendColor} style={{ background: 'var(--color-accent)' }}></span>
                <span>Projected Future Inflows</span>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendColor} style={{ background: 'var(--color-success)' }}></span>
                <span>Collected Inflows</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Ledger Table Section */}
      {sortedMilestones.length === 0 ? (
        <EmptyState 
          title="No milestone collections match your filters" 
          description="Try broadening your search criteria or resetting active filters."
        />
      ) : (
        <div className={styles.tableCard}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th} onClick={() => handleSort('milestoneName')}>
                    Milestone {sortField === 'milestoneName' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className={styles.th} onClick={() => handleSort('projectName')}>
                    Project {sortField === 'projectName' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className={styles.th} onClick={() => handleSort('clientName')}>
                    Client {sortField === 'clientName' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className={styles.th} onClick={() => handleSort('dueDate')}>
                    Due Date {sortField === 'dueDate' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className={styles.th} onClick={() => handleSort('inflowSegment')}>
                    Segment {sortField === 'inflowSegment' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className={styles.th} onClick={() => handleSort('amount')}>
                    Total Value {sortField === 'amount' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className={styles.th} onClick={() => handleSort('paidAmount')}>
                    Collected {sortField === 'paidAmount' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className={styles.th} onClick={() => handleSort('outstandingAmount')}>
                    Outstanding Cash Inflow {sortField === 'outstandingAmount' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th className={styles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedMilestones.map(row => {
                  const agingDays = row.inflowSegment === 'overdue' ? getAgingDays(row.dueDate) : 0;
                  return (
                    <tr key={row.id} className={styles.tr}>
                      <td className={styles.td}>
                        <div className={styles.milestoneNameCell}>
                          <span className={styles.milestoneName}>{row.milestoneName}</span>
                          {row.inflowSegment === 'overdue' && (
                            <span className={styles.agingCellTag}>
                              {agingDays > 90 ? '⚠️ 90+d Overdue' : `${agingDays}d Overdue`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={styles.td}>
                        <span className={styles.projectNameText}>{row.projectName}</span>
                      </td>
                      <td className={styles.td}>{row.clientName || '—'}</td>
                      <td className={styles.td}>{formatDate(row.dueDate)}</td>
                      <td className={styles.td}>
                        <span className={`${styles.statusBadge} ${getSegmentClass(row.inflowSegment)}`}>
                          {row.inflowSegment}
                        </span>
                      </td>
                      <td className={styles.td}>{formatCurrency(row.amount)}</td>
                      <td className={styles.td} style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                        {formatCurrency(row.paidAmount)}
                      </td>
                      <td className={`${styles.td} ${row.outstandingAmount > 0 ? styles.outstandingCell : ''}`}>
                        {formatCurrency(row.outstandingAmount)}
                      </td>
                      <td className={styles.td}>
                        <button 
                          className={styles.viewDetailBtn}
                          onClick={() => navigate(`/projects/${row.projectId}?tab=Quotations+%26+Budget`)}
                          title="View project finance schedule"
                        >
                          Project Details →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Footer */}
          <div className={styles.paginationRow}>
            <div className={styles.paginationInfo}>
              Showing <strong>{paginatedMilestones.length}</strong> of <strong>{sortedMilestones.length}</strong> collection milestones
            </div>
            <div className={styles.paginationControls}>
              <div className={styles.pageSizeWrap}>
                <span className={styles.pageSizeLabel}>Rows per page:</span>
                <select 
                  value={pageSize} 
                  onChange={(e) => { setPageSize(e.target.value); setCurrentPage(1); }}
                  className={styles.pageSizeSelect}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value="all">All</option>
                </select>
              </div>
              {pageSize !== 'all' && totalPages > 1 && (
                <div className={styles.pageButtons}>
                  <button 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className={styles.pageBtn}
                  >
                    ◀ Prev
                  </button>
                  <span className={styles.pageIndicator}>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button 
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className={styles.pageBtn}
                  >
                    Next ▶
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
