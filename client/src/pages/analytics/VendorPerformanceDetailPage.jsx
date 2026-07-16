/* eslint-disable react-hooks/immutability, react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getVendorPerformanceDetail } from '../../api/analytics';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { Spinner, EmptyState } from '../../components/ui';
import styles from './VendorPerformanceDetailPage.module.css';

export default function VendorPerformanceDetailPage() {
  const { vendorName } = useParams();
  const navigate = useNavigate();

  usePageTitle(vendorName || 'Vendor Evaluation');
  useBreadcrumbs([
    { label: 'Analytics' },
    { label: 'Vendors', to: '/analytics/vendors' },
    { label: vendorName || 'Detail' }
  ]);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('pos'); // 'pos' | 'deliveries' | 'payments' | 'feedback'

  useEffect(() => {
    if (vendorName) {
      fetchDetail();
    }
  }, [vendorName]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await getVendorPerformanceDetail(vendorName);
      setData(res || null);
    } catch (error) {
      console.error('Failed to load vendor performance details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loaderWrap}>
        <Spinner />
        <p>Loading vendor evaluation ledger...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState 
        title="Vendor not found" 
        description="We couldn't retrieve transaction records for this vendor."
      />
    );
  }

  const { summary, purchaseOrders = [], deliveries = [], payments = [], ratings = [] } = data;

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

  const getDelayDays = (expected, actual) => {
    if (!expected || !actual) return null;
    const expDate = new Date(expected);
    const actDate = new Date(actual);
    const diff = Math.ceil((actDate - expDate) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  const getOutstandingBalance = () => {
    return summary.totalDueAmount - summary.totalPaidAmount;
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'received':
      case 'paid':
      case 'delivered':
      case 'inspected':
        return styles.statusSuccess;
      case 'partially received':
      case 'partially paid':
      case 'pending':
      case 'sent':
      case 'confirmed':
        return styles.statusWarning;
      case 'cancelled':
      case 'rejected':
      case 'overdue':
        return styles.statusDanger;
      default:
        return styles.statusDefault;
    }
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.headerRow}>
        <div>
          <button className={styles.backBtn} onClick={() => navigate('/analytics/vendors')}>
            ← Back to Vendor List
          </button>
          <h1 className={styles.title}>{summary.vendorName}</h1>
          <div className={styles.desc}>Complete evaluation profile and transaction history ledger.</div>
        </div>
        <button className={styles.refreshBtn} onClick={fetchDetail}>
          🔄 Refresh Ledger
        </button>
      </div>

      {/* Overview Stat Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>PM Retro Rating</span>
          <span className={styles.statValue}>{renderStars(summary.avgRating)}</span>
          <span className={styles.statSub}>Based on {summary.ratingCount} project reviews</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>On-Time Delivery</span>
          <span className={`${styles.statValue} ${summary.onTimeRate >= 90 ? styles.positiveText : styles.warningText}`}>
            {summary.onTimeRate.toFixed(1)}%
          </span>
          <span className={styles.statSub}>{summary.onTimeDeliveries} of {summary.totalDeliveries} deliveries on-time</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Defect Rate</span>
          <span className={`${styles.statValue} ${summary.defectRate <= 2 ? styles.positiveText : styles.dangerText}`}>
            {summary.defectRate.toFixed(1)}%
          </span>
          <span className={styles.statSub}>
            {summary.totalQtyRejected} units rejected / {summary.totalQtyReceived} received
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Spend (POs)</span>
          <span className={styles.statValue}>{formatCurrency(summary.poTotalAmount)}</span>
          <span className={styles.statSub}>Across {summary.poCount} approved POs</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Outstanding Balance</span>
          <span className={`${styles.statValue} ${getOutstandingBalance() > 0 ? styles.warningText : ''}`}>
            {formatCurrency(getOutstandingBalance())}
          </span>
          <span className={styles.statSub}>
            {summary.overduePaymentsCount > 0 ? `⚠️ ${summary.overduePaymentsCount} milestones overdue` : 'No overdue payments'}
          </span>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className={styles.tabsHeader}>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'pos' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('pos')}
        >
          Purchase Orders ({purchaseOrders.length})
        </button>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'deliveries' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('deliveries')}
        >
          Deliveries & Receipts ({deliveries.length})
        </button>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'payments' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('payments')}
        >
          Payment Milestones ({payments.length})
        </button>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'feedback' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('feedback')}
        >
          Retro Reviews & Ratings ({ratings.length})
        </button>
      </div>

      {/* Tab Panels */}
      <div className={styles.tabBody}>
        {activeTab === 'pos' && (
          <div>
            {purchaseOrders.length === 0 ? (
              <div className={styles.emptyView}>No purchase orders registered for this vendor.</div>
            ) : (
              <div className={styles.tableCard}>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.th}>PO Number</th>
                        <th className={styles.th}>Project</th>
                        <th className={styles.th}>Date Issued</th>
                        <th className={styles.th}>Expected Delivery</th>
                        <th className={styles.th}>Status</th>
                        <th className={styles.th}>Total Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchaseOrders.map(po => (
                        <tr key={po.id} className={styles.tr}>
                          <td className={styles.td}><strong>{po.po_number}</strong></td>
                          <td className={styles.td}>{po.project_name}</td>
                          <td className={styles.td}>{formatDate(po.created_at)}</td>
                          <td className={styles.td}>{formatDate(po.expected_delivery_date)}</td>
                          <td className={styles.td}>
                            <span className={`${styles.statusBadge} ${getStatusClass(po.status)}`}>
                              {po.status}
                            </span>
                          </td>
                          <td className={styles.td}><strong>{formatCurrency(po.total_amount)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'deliveries' && (
          <div>
            {deliveries.length === 0 ? (
              <div className={styles.emptyView}>No delivery records registered for this vendor.</div>
            ) : (
              <div className={styles.tableCard}>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.th}>Delivery Doc</th>
                        <th className={styles.th}>PO Reference</th>
                        <th className={styles.th}>Project</th>
                        <th className={styles.th}>Expected Date</th>
                        <th className={styles.th}>Actual Receipt</th>
                        <th className={styles.th}>Delay (Days)</th>
                        <th className={styles.th}>Status</th>
                        <th className={styles.th}>Inspection (Received / Rejected)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deliveries.map(d => {
                        const delay = getDelayDays(d.expected_delivery_date, d.actual_receipt_date);
                        return (
                          <tr key={d.id} className={styles.tr}>
                            <td className={styles.td}><strong>{d.delivery_number}</strong></td>
                            <td className={styles.td}>{d.po_number}</td>
                            <td className={styles.td}>{d.project_name}</td>
                            <td className={styles.td}>{formatDate(d.expected_delivery_date)}</td>
                            <td className={styles.td}>{formatDate(d.actual_receipt_date)}</td>
                            <td className={styles.td}>
                              {delay > 0 ? (
                                <span className={styles.delayDays}>+{delay} Days</span>
                              ) : (
                                <span className={styles.onTimeText}>On Time</span>
                              )}
                            </td>
                            <td className={styles.td}>
                              <span className={`${styles.statusBadge} ${getStatusClass(d.status)}`}>
                                {d.status}
                              </span>
                            </td>
                            <td className={styles.td}>
                              <span>{d.qty_received} units received</span>
                              {d.rejected_items_count > 0 && (
                                <span className={styles.rejectText}>
                                  <br />⚠️ {d.qty_rejected} units rejected ({d.rejected_items_count} items)
                                </span>
                              )}
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
        )}

        {activeTab === 'payments' && (
          <div>
            {payments.length === 0 ? (
              <div className={styles.emptyView}>No payment milestones tracked for this vendor.</div>
            ) : (
              <div className={styles.tableCard}>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.th}>Milestone</th>
                        <th className={styles.th}>Project</th>
                        <th className={styles.th}>PO Reference</th>
                        <th className={styles.th}>Due Date</th>
                        <th className={styles.th}>Paid Date</th>
                        <th className={styles.th}>Status</th>
                        <th className={styles.th}>Milestone Amount</th>
                        <th className={styles.th}>Paid Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map(pm => (
                        <tr key={pm.id} className={styles.tr}>
                          <td className={styles.td}><strong>{pm.name}</strong></td>
                          <td className={styles.td}>{pm.project_name}</td>
                          <td className={styles.td}>{pm.po_number || '—'}</td>
                          <td className={styles.td}>{formatDate(pm.due_date)}</td>
                          <td className={styles.td}>{formatDate(pm.paid_at)}</td>
                          <td className={styles.td}>
                            <span className={`${styles.statusBadge} ${getStatusClass(pm.status)}`}>
                              {pm.status}
                            </span>
                          </td>
                          <td className={styles.td}>{formatCurrency(pm.amount)}</td>
                          <td className={styles.td} style={{ color: pm.status === 'paid' ? 'var(--color-success)' : 'inherit' }}>
                            {formatCurrency(pm.paid_amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'feedback' && (
          <div>
            {ratings.length === 0 ? (
              <div className={styles.emptyView}>No retrospective rating feedback submitted for this vendor.</div>
            ) : (
              <div className={styles.retroList}>
                {ratings.map((rate, i) => (
                  <div key={i} className={styles.retroCard}>
                    <div className={styles.retroHeader}>
                      <strong>{rate.project_name}</strong>
                      <div className={styles.starsWrapper}>
                        {renderStars(rate.rating)}
                      </div>
                      <span className={styles.retroDate}>{formatDate(rate.created_at)}</span>
                    </div>
                    {rate.feedback && <p className={styles.retroText}>"{rate.feedback}"</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
