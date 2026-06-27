import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfitabilityAnalytics } from '../../api/analytics';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { Spinner, EmptyState } from '../../components/ui';
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

  const { summary, byProjectType = [], byDesigner = [], byProjectSize = [], projects = [] } = data;

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  // Helper to determine cost/margin values based on selected costType
  const getProjectCostVal = (p) => costType === 'actual' ? p.actualCost : p.committedCost;
  const getProjectMarginVal = (p) => costType === 'actual' ? p.actualMargin : p.committedMargin;
  const getProjectMarginPctVal = (p) => costType === 'actual' ? p.actualMarginPercent : p.committedMarginPercent;

  // Filter projects by search
  const filteredProjects = projects.filter(p => {
    return p.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.projectType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.designerName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Calculate metrics for summary cards
  const portfolioRevenue = summary.revenue;
  const portfolioCost = costType === 'actual' ? summary.actualCost : summary.committedCost;
  const portfolioMargin = costType === 'actual' ? summary.actualMargin : summary.committedMargin;
  const portfolioMarginPct = costType === 'actual' ? summary.actualMarginPercent : summary.committedMarginPercent;

  // Segmented chart logic
  let activeSegments = [];
  if (segmentTab === 'type') {
    activeSegments = byProjectType;
  } else if (segmentTab === 'designer') {
    activeSegments = byDesigner;
  } else {
    activeSegments = byProjectSize;
  }

  // Format segment values for charts
  const chartData = activeSegments.map(s => {
    const cost = costType === 'actual' ? s.actualCost : s.committedCost;
    const margin = costType === 'actual' ? s.actualMargin : s.committedMargin;
    const marginPct = costType === 'actual' ? s.actualMarginPercent : s.committedMarginPercent;
    return {
      name: s.name,
      projectCount: s.projectCount,
      revenue: s.revenue,
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

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Project Profitability Analysis</h1>
          <div className={styles.desc}>
            Monitor contract revenue, material/labor/vendor costs, gross profit margins, and return percentages across the portfolio.
          </div>
        </div>
        <button className={styles.refreshBtn} onClick={fetchReport}>
          🔄 Refresh Data
        </button>
      </div>

      {/* costType Selection Toggle */}
      <div className={styles.toggleRow}>
        <div className={styles.costTypeSelector}>
          <span className={styles.selectorLabel}>Cost Type Basis:</span>
          <div className={styles.selectorButtonGroup}>
            <button 
              className={`${styles.selectorBtn} ${costType === 'actual' ? styles.selectorActive : ''}`}
              onClick={() => setCostType('actual')}
            >
              Actual Cost Incurred
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

      {/* KPI Cards */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Portfolio Revenue</span>
          <span className={styles.kpiValue}>{formatCurrency(portfolioRevenue)}</span>
          <span className={styles.kpiSub}>Total contract values</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Cost ({costType})</span>
          <span className={styles.kpiValue} style={{ color: 'var(--color-text-secondary)' }}>
            {formatCurrency(portfolioCost)}
          </span>
          <span className={styles.kpiSub}>Material, labor & vendor</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Gross Profit Margin</span>
          <span className={`${styles.kpiValue} ${portfolioMargin >= 0 ? styles.textSuccess : styles.textDanger}`}>
            {formatCurrency(portfolioMargin)}
          </span>
          <span className={styles.kpiSub}>Net margin pool</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Portfolio Margin %</span>
          <span className={`${styles.kpiValue} ${getMarginClass(portfolioMarginPct)}`}>
            {portfolioMarginPct.toFixed(1)}%
          </span>
          <span className={styles.kpiSub}>Target profit benchmark: 30%+</span>
        </div>
      </div>

      {/* Segment Breakdown Charts */}
      <div className={styles.chartCard}>
        <div className={styles.chartHeader}>
          <div className={styles.segmentTabs}>
            <button 
              className={`${styles.segmentTabBtn} ${segmentTab === 'type' ? styles.segmentTabActive : ''}`}
              onClick={() => setSegmentTab('type')}
            >
              By Project Type
            </button>
            <button 
              className={`${styles.segmentTabBtn} ${segmentTab === 'designer' ? styles.segmentTabActive : ''}`}
              onClick={() => setSegmentTab('designer')}
            >
              By Designer Performance
            </button>
            <button 
              className={`${styles.segmentTabBtn} ${segmentTab === 'size' ? styles.segmentTabActive : ''}`}
              onClick={() => setSegmentTab('size')}
            >
              By Project Size Tiers
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
                    <span className={styles.projectCountLabel}>({s.projectCount} projects)</span>
                  </div>
                );
              })}
            </div>
            
            {/* Legend */}
            <div className={styles.legend}>
              <div className={styles.legendItem}>
                <span className={styles.legendColor} style={{ background: '#3b82f6' }}></span>
                <span>Project Costs</span>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendColor} style={{ background: '#10b981' }}></span>
                <span>Gross Profit Margin</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className={styles.controlsRow}>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input 
            type="text" 
            placeholder="Search by project, client, type, or designer..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>

      {/* Table Ledger */}
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
                  <th className={styles.th}></th>
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
                        <span className={styles.projectName}>{row.projectName}</span>
                      </td>
                      <td className={styles.td}>{row.projectType}</td>
                      <td className={styles.td}>{row.designerName}</td>
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
                          Budget details →
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
}
