/* eslint-disable react-hooks/immutability, no-useless-assignment */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfitabilityAnalytics } from '../../api/analytics';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { Spinner, EmptyState } from '../../components/ui';

import GlobalFilterBar from '../../components/analytics/GlobalFilterBar';
import { AnalyticsFilterProvider } from '../../context/AnalyticsFilterContext';
import styles from './ProjectProfitabilityReportPage.module.css';


export default function ProjectProfitabilityReportPage() {
  usePageTitle('Project Profitability');
  useBreadcrumbs([{ label: 'Analytics' }, { label: 'Profitability' }]);

  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [costType, setCostType] = useState('actual'); // 'actual' | 'committed'
  const [segmentTab, setSegmentTab] = useState('type'); // 'type' | 'designer' | 'size'
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await getProfitabilityAnalytics();
      setData(res || null);
    } catch (error) {
      console.error('Failed to load profitability analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loaderWrap}>
        <Spinner />
        <p>Loading project profitability analytics...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState 
        title="Failed to load report" 
        description="There was an error loading the project profitability analytics report."
      />
    );
  }

  const { summary = {}, byProjectType = [], byDesigner = [], byProjectSize = [], byCity = [], marginTrend = [], projects = [] } = data;

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  // Helper to determine cost/margin values based on selected costType
  const getProjectCostVal = (p) => (costType === 'actual' ? p.actualCost : p.committedCost) ?? 0;
  const getProjectMarginVal = (p) => (costType === 'actual' ? p.actualMargin : p.committedMargin) ?? 0;
  const getProjectMarginPctVal = (p) => (costType === 'actual' ? p.actualMarginPercent : p.committedMarginPercent) ?? 0;

  // Filter projects by search
  const filteredProjects = projects.filter(p => {
    const term = (searchTerm || '').toLowerCase();
    return p.projectName?.toLowerCase().includes(term) ||
      p.projectType?.toLowerCase().includes(term) ||
      p.designerName?.toLowerCase().includes(term);
  });

  // Calculate metrics for summary cards
  const portfolioRevenue = summary.revenue || 0;
  const portfolioCost = costType === 'actual' ? (summary.actualCost || 0) : (summary.committedCost || 0);
  const portfolioMargin = costType === 'actual' ? (summary.actualMargin || 0) : (summary.committedMargin || 0);
  const portfolioMarginPct = costType === 'actual' ? (summary.actualMarginPercent || 0) : (summary.committedMarginPercent || 0);

  // Segmented chart logic
  let activeSegments = [];
  if (segmentTab === 'type') {
    activeSegments = byProjectType;
  } else if (segmentTab === 'designer') {
    activeSegments = byDesigner;
  } else if (segmentTab === 'city') {
    activeSegments = byCity;
  } else if (segmentTab === 'trend') {
    activeSegments = marginTrend;
  } else {
    activeSegments = byProjectSize;
  }

  // Format segment values for charts
  const chartData = activeSegments.map(s => {
    const cost = (costType === 'actual' ? s.actualCost : s.committedCost) ?? 0;
    const margin = (costType === 'actual' ? s.actualMargin : s.committedMargin) ?? 0;
    const marginPct = (costType === 'actual' ? s.actualMarginPercent : s.committedMarginPercent) ?? 0;
    return {
      name: s.name,
      projectCount: s.projectCount,
      revenue: s.revenue ?? 0,
      cost,
      margin,
      marginPct
    };
  });

  const maxRevenue = chartData.reduce((max, s) => s.revenue > max ? s.revenue : max, 0) || 1;

  const getMarginClass = (pct) => {
    if (pct >= 30) return styles.marginGood;
    if (pct >= 15) return styles.marginWarning;
    return styles.marginDanger;
  };

  const pageContent = (
    <div className={styles.page}>
      <GlobalFilterBar />
      {/* Header */}
      <div className={styles.headerRow}>
        <div>
          <div className={styles.titleGroup}>
            <h1 className={styles.title}>Project Profitability Analysis</h1>
            <span className={styles.headerBadge}>Live Analytics</span>
          </div>
          <div className={styles.desc}>
            Monitor contract revenue, material/labor/vendor costs, gross profit margins, and return percentages across the portfolio.
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.refreshBtn} onClick={fetchReport}>
            🔄 Refresh Data
          </button>
        </div>
      </div>

      {/* Top Configuration & Control Toolbar */}
      <div className={styles.controlToolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.costTypeSelector}>
            <span className={styles.selectorLabel}>Cost Basis:</span>
            <div className={styles.selectorButtonGroup}>
              <button 
                className={`${styles.selectorBtn} ${costType === 'actual' ? styles.selectorActive : ''}`}
                onClick={() => setCostType('actual')}
              >
                Actual Incurred Cost
              </button>
              <button 
                className={`${styles.selectorBtn} ${costType === 'committed' ? styles.selectorActive : ''}`}
                onClick={() => setCostType('committed')}
              >
                Committed Cost (Planned POs)
              </button>
            </div>
          </div>
        </div>

        <div className={styles.toolbarRight}>
          <div className={styles.searchBox}>
            <span className={styles.searchIcon}>🔍</span>
            <input 
              type="text" 
              placeholder="Search project, client, type, or designer..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.quickStatPills}>
            <span className={styles.statPill}>
              Total: <strong>{projects.length}</strong>
            </span>
            <span className={styles.statPill}>
              Filtered: <strong>{filteredProjects.length}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* High-Level Executive KPI Summary Cards */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Portfolio Revenue</span>
            <span className={styles.kpiIcon}>💰</span>
          </div>
          <span className={styles.kpiValue}>{formatCurrency(portfolioRevenue)}</span>
          <span className={styles.kpiSub}>Total contract values</span>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Total Cost ({costType})</span>
            <span className={styles.kpiIcon}>📉</span>
          </div>
          <span className={styles.kpiValue} style={{ color: 'var(--color-text-secondary)' }}>
            {formatCurrency(portfolioCost)}
          </span>
          <span className={styles.kpiSub}>Material, labor & vendor</span>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Gross Profit Margin</span>
            <span className={styles.kpiIcon}>💵</span>
          </div>
          <span className={`${styles.kpiValue} ${portfolioMargin >= 0 ? styles.textSuccess : styles.textDanger}`}>
            {formatCurrency(portfolioMargin)}
          </span>
          <span className={styles.kpiSub}>Net margin pool</span>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>Portfolio Margin %</span>
            <span className={styles.kpiIcon}>🎯</span>
          </div>
          <span className={`${styles.kpiValue} ${getMarginClass(portfolioMarginPct)}`}>
            {portfolioMarginPct.toFixed(1)}%
          </span>
          <span className={styles.kpiSub}>Benchmark: 30%+ gross profit</span>
        </div>
      </div>

      {/* Segment Breakdown Analytics Charts */}
      <div className={styles.chartCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Segment Breakdown & Trends</h2>
        </div>
        <div className={styles.chartHeader}>
          <div className={styles.segmentTabs}>
            <button 
              className={`${styles.segmentTabBtn} ${segmentTab === 'type' ? styles.segmentTabActive : ''}`}
              onClick={() => setSegmentTab('type')}
            >
              🏢 By Project Type
            </button>
            <button 
              className={`${styles.segmentTabBtn} ${segmentTab === 'designer' ? styles.segmentTabActive : ''}`}
              onClick={() => setSegmentTab('designer')}
            >
              🎨 By Designer Performance
            </button>
            <button 
              className={`${styles.segmentTabBtn} ${segmentTab === 'size' ? styles.segmentTabActive : ''}`}
              onClick={() => setSegmentTab('size')}
            >
              📏 By Size Tiers
            </button>
            <button 
              className={`${styles.segmentTabBtn} ${segmentTab === 'city' ? styles.segmentTabActive : ''}`}
              onClick={() => setSegmentTab('city')}
            >
              📍 By City
            </button>
            <button 
              className={`${styles.segmentTabBtn} ${segmentTab === 'trend' ? styles.segmentTabActive : ''}`}
              onClick={() => setSegmentTab('trend')}
            >
              📈 Margin Trend
            </button>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className={styles.emptyChart}>No profitability data registered.</div>
        ) : (
          <div className={styles.chartContainer}>
            <div className={styles.barList}>
              {chartData.map((s, index) => {
                const costHeight = (s.cost / maxRevenue) * 100;
                const marginHeight = (Math.max(0, s.margin) / maxRevenue) * 100;

                return (
                  <div key={index} className={styles.barCol}>
                    <div className={styles.barStack}>
                      {/* Cost Block (Blue) */}
                      {s.cost > 0 && (
                        <div 
                          className={styles.barCost} 
                          style={{ height: `${costHeight}%` }}
                        >
                          <span className={styles.tooltip}>
                            <strong>{s.name} Cost</strong><br />
                            {formatCurrency(s.cost)}
                          </span>
                        </div>
                      )}
                      {/* Margin Block (Green) */}
                      {s.margin > 0 && (
                        <div 
                          className={styles.barMargin} 
                          style={{ height: `${marginHeight}%` }}
                        >
                          <span className={styles.tooltip}>
                            <strong>{s.name} Margin</strong><br />
                            {formatCurrency(s.margin)} ({s.marginPct.toFixed(1)}%)
                          </span>
                        </div>
                      )}
                    </div>
                    <span className={styles.periodLabel}>{s.name}</span>
                    <span className={styles.projectCountLabel}>({s.projectCount} {s.projectCount === 1 ? 'project' : 'projects'})</span>
                  </div>
                );
              })}
            </div>
            
            {/* Legend */}
            <div className={styles.legend}>
              <div className={styles.legendItem}>
                <span className={styles.legendColor} style={{ background: 'var(--color-accent, #3b82f6)' }}></span>
                <span>Project Costs ({costType})</span>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendColor} style={{ background: 'var(--color-success, #10b981)' }}></span>
                <span>Gross Profit Margin</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Project Financial Ledger Section */}
      <div className={styles.ledgerSectionHeader}>
        <h2 className={styles.sectionTitle}>Project Financial Ledger</h2>
        <span className={styles.ledgerCountBadge}>{filteredProjects.length} Projects Listed</span>
      </div>

      {filteredProjects.length === 0 ? (
        <EmptyState 
          title="No projects found" 
          description="Try adjusting your filters or search terms."
        />
      ) : (
        <div className={styles.tableCard}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Project</th>
                  <th className={styles.th}>Type</th>
                  <th className={styles.th}>Designer</th>
                  <th className={styles.th}>Revenue</th>
                  <th className={styles.th}>Cost ({costType})</th>
                  <th className={styles.th}>Gross Margin</th>
                  <th className={styles.th}>Margin %</th>
                  <th className={styles.th}>Profit Status</th>
                  <th className={styles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map(row => {
                  const cost = getProjectCostVal(row);
                  const margin = getProjectMarginVal(row);
                  const marginPct = getProjectMarginPctVal(row);

                  return (
                    <tr key={row.projectId} className={styles.tr}>
                      <td className={styles.td}>
                        <button 
                          className={styles.projectNameLink}
                          onClick={() => navigate(`/projects/${row.projectId}`)}
                        >
                          {row.projectName}
                        </button>
                      </td>
                      <td className={styles.td}>
                        <span className={styles.typeBadge}>{row.projectType || 'Standard'}</span>
                      </td>
                      <td className={styles.td}>
                        <span className={styles.designerName}>{row.designerName || 'Unassigned'}</span>
                      </td>
                      <td className={styles.td}>{formatCurrency(row.revenue)}</td>
                      <td className={styles.td}>{formatCurrency(cost)}</td>
                      <td className={`${styles.td} ${margin >= 0 ? styles.positiveCell : styles.negativeCell}`}>
                        {formatCurrency(margin)}
                      </td>
                      <td className={`${styles.td} ${getMarginClass(marginPct)} ${styles.boldCell}`}>
                        {marginPct.toFixed(1)}%
                      </td>
                      <td className={styles.td}>
                        {marginPct >= 30 ? (
                          <span className={styles.badgeGood}>High Margin</span>
                        ) : marginPct >= 15 ? (
                          <span className={styles.badgeWarning}>Average Margin</span>
                        ) : (
                          <span className={styles.badgeDanger}>Low Margin</span>
                        )}
                      </td>
                      <td className={styles.td}>
                        <button 
                          className={styles.viewDetailBtn}
                          onClick={() => navigate(`/projects/${row.projectId}?tab=Budget`)}
                        >
                          Budget Details →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );

  return (
    <AnalyticsFilterProvider>
      {pageContent}
    </AnalyticsFilterProvider>
  );
}

