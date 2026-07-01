import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getVendorPerformanceReport } from '../../api/analytics';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { Spinner, EmptyState } from '../../components/ui';
import styles from './VendorPerformanceReportPage.module.css';

export default function VendorPerformanceReportPage() {
  usePageTitle('Vendor Performance');
  useBreadcrumbs([{ label: 'Analytics' }, { label: 'Vendors' }]);

  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [performanceFilter, setPerformanceFilter] = useState('all'); // 'all' | 'high' | 'low' | 'defective'

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await getVendorPerformanceReport();
      setData(res || []);
    } catch (error) {
      console.error('Failed to load vendor performance report:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter based on search term and performance criteria
  const filteredData = data.filter(item => {
    const matchesSearch = item.vendorName.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (performanceFilter === 'high') {
      return matchesSearch && item.onTimeRate >= 90 && item.defectRate <= 2;
    }
    if (performanceFilter === 'low') {
      return matchesSearch && (item.onTimeRate < 80 || item.avgRating < 3);
    }
    if (performanceFilter === 'defective') {
      return matchesSearch && item.defectRate > 5;
    }
    return matchesSearch;
  });

  // Calculate overall metrics
  const totalSpend = filteredData.reduce((sum, item) => sum + item.poTotalAmount, 0);
  const totalPOs = filteredData.reduce((sum, item) => sum + item.poCount, 0);
  
  const avgOnTime = filteredData.length > 0 
    ? filteredData.reduce((sum, item) => sum + item.onTimeRate, 0) / filteredData.length
    : 100;
    
  const avgDefect = filteredData.length > 0
    ? filteredData.reduce((sum, item) => sum + item.defectRate, 0) / filteredData.length
    : 0;

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const renderStars = (rating) => {
    if (!rating || rating === 0) return <span className={styles.noStars}>No ratings</span>;
    const stars = [];
    const floor = Math.floor(rating);
    for (let i = 1; i <= 5; i++) {
      if (i <= floor) {
        stars.push(<span key={i} className={styles.starFilled}>★</span>);
      } else if (i - rating < 1) {
        stars.push(<span key={i} className={styles.starHalf}>★</span>);
      } else {
        stars.push(<span key={i} className={styles.starEmpty}>★</span>);
      }
    }
    return <div className={styles.starsWrapper}>{stars} <span className={styles.ratingNum}>({rating.toFixed(1)})</span></div>;
  };

  const getOnTimeClass = (rate) => {
    if (rate >= 90) return styles.goodMetric;
    if (rate >= 75) return styles.warningMetric;
    return styles.dangerMetric;
  };

  const getDefectClass = (rate) => {
    if (rate <= 2) return styles.goodMetric;
    if (rate <= 5) return styles.warningMetric;
    return styles.dangerMetric;
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Vendor Performance Analysis</h1>
          <div className={styles.desc}>
            Evaluate vendor reliability, delivery compliance timelines, quality defect statistics, and payment history.
          </div>
        </div>
        <button className={styles.refreshBtn} onClick={fetchReport} disabled={loading}>
          {loading ? 'Refreshing...' : '🔄 Refresh Data'}
        </button>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Active Vendors</span>
          <span className={styles.kpiValue}>{filteredData.length}</span>
          <span className={styles.kpiSub}>Tracked in portfolio</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Spend Volume</span>
          <span className={styles.kpiValue}>{formatCurrency(totalSpend)}</span>
          <span className={styles.kpiSub}>Across {totalPOs} Purchase Orders</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Avg. On-Time Delivery</span>
          <span className={`${styles.kpiValue} ${getOnTimeClass(avgOnTime)}`}>
            {avgOnTime.toFixed(1)}%
          </span>
          <span className={styles.kpiSub}>Reliability target: 90%+</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Avg. Defect Rate</span>
          <span className={`${styles.kpiValue} ${getDefectClass(avgDefect)}`}>
            {avgDefect.toFixed(1)}%
          </span>
          <span className={styles.kpiSub}>Target threshold: Under 2%</span>
        </div>
      </div>

      {/* Controls */}
      <div className={styles.controlsRow}>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input 
            type="text" 
            placeholder="Search by vendor name..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.filterBox}>
          <span className={styles.filterLabel}>Evaluate:</span>
          <select 
            value={performanceFilter} 
            onChange={(e) => setPerformanceFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All Performance Levels</option>
            <option value="high">Preferred Vendors (On-Time &ge; 90%, Defects &le; 2%)</option>
            <option value="low">Underperforming (On-Time &lt; 80% or Rating &lt; 3)</option>
            <option value="defective">High Defects (Defect Rate &gt; 5%)</option>
          </select>
        </div>
      </div>

      {/* Main Vendor Table */}
      {loading ? (
        <div className={styles.loaderWrap}>
          <Spinner />
          <p>Loading vendor analytics...</p>
        </div>
      ) : filteredData.length === 0 ? (
        <EmptyState 
          title="No vendors found" 
          description="Try adjusting your filters or search terms."
        />
      ) : (
        <div className={styles.tableCard}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Vendor Name</th>
                  <th className={styles.th}>Rating (Closure Retros)</th>
                  <th className={styles.th}>Active Projects</th>
                  <th className={styles.th}>POs issued</th>
                  <th className={styles.th}>Spend Volume</th>
                  <th className={styles.th}>On-Time Rate</th>
                  <th className={styles.th}>Defect Rate</th>
                  <th className={styles.th}>Overdue Payments</th>
                  <th className={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map(row => (
                  <tr key={row.vendorName} className={styles.tr}>
                    <td className={styles.td}>
                      <span className={styles.vendorName}>{row.vendorName}</span>
                    </td>
                    <td className={styles.td}>{renderStars(row.avgRating)}</td>
                    <td className={styles.td}>{row.activeProjectsCount || 0}</td>
                    <td className={styles.td}>{row.poCount}</td>
                    <td className={styles.td}>{formatCurrency(row.poTotalAmount)}</td>
                    <td className={styles.td}>
                      <span className={`${styles.metricBadge} ${getOnTimeClass(row.onTimeRate)}`}>
                        {row.onTimeRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className={styles.td}>
                      <span className={`${styles.metricBadge} ${getDefectClass(row.defectRate)}`}>
                        {row.defectRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className={styles.td}>
                      {row.overduePaymentsCount > 0 ? (
                        <span className={styles.overdueBadge}>
                          ⚠️ {row.overduePaymentsCount} Milestones
                        </span>
                      ) : (
                        <span className={styles.cleanPayments}>✓ Clear</span>
                      )}
                    </td>
                    <td className={styles.td}>
                      <button 
                        className={styles.viewDetailBtn}
                        onClick={() => navigate(`/analytics/vendors/${encodeURIComponent(row.vendorName)}`)}
                      >
                        Evaluate Ledger →
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
