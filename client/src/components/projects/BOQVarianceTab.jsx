/* eslint-disable react-hooks/immutability, react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import { getBOQVarianceReport } from '../../api/projects';
import { Spinner, EmptyState } from '../ui';
import styles from './BOQVarianceTab.module.css';

export default function BOQVarianceTab({ projectId }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [subTab, setSubTab] = useState('change-orders'); // 'change-orders' | 'material-revisions' | 'room-breakdown'

  useEffect(() => {
    if (projectId) {
      fetchReport();
    }
  }, [projectId]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await getBOQVarianceReport(projectId);
      if (res.data?.success) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load project BOQ variance report:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loaderWrap}>
        <Spinner />
        <p>Loading detailed BOQ variance report...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState 
        title="Failed to load report" 
        description="There was an error loading the detailed BOQ variance report for this project."
      />
    );
  }

  const { summary, changeOrders = [], materialSubstitutions = [], roomBreakdown = [] } = data;

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

  return (
    <div className={styles.tabContent}>
      {/* Summary Cards Grid */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Original BOQ Value</div>
          <div className={styles.metricValue}>{formatCurrency(summary.originalSubtotal)}</div>
          <div className={styles.metricSub}>Initial approved contract scope</div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Change Orders (Net)</div>
          <div className={styles.metricValue} style={{ color: summary.changeOrderSubtotal > 0 ? 'var(--color-warning)' : 'inherit' }}>
            {formatCurrency(summary.changeOrderSubtotal)}
          </div>
          <div className={styles.metricSub}>Approved scope changes</div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Material Revisions</div>
          <div className={styles.metricValue} style={{ color: summary.materialRevisionSubtotal !== 0 ? 'var(--color-info)' : 'inherit' }}>
            {formatCurrency(summary.materialRevisionSubtotal)}
          </div>
          <div className={styles.metricSub}>Approved substitutions</div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Current Contract Value</div>
          <div className={styles.metricValue} style={{ color: 'var(--color-success)' }}>
            {formatCurrency(summary.currentSubtotal)}
          </div>
          <div className={styles.metricSub}>Total client billing value</div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Variance</div>
          <div className={`${styles.metricValue} ${summary.varianceAmount >= 0 ? styles.positiveText : styles.negativeText}`}>
            {summary.varianceAmount >= 0 ? '+' : ''}{formatCurrency(summary.varianceAmount)}
          </div>
          <div className={styles.metricSub}>
            {summary.variancePercentage.toFixed(1)}% {summary.varianceAmount >= 0 ? 'growth' : 'erosion'}
          </div>
        </div>
      </div>

      {/* Sub-Tabs Selector */}
      <div className={styles.subTabHeader}>
        <button 
          className={`${styles.subTabButton} ${subTab === 'change-orders' ? styles.subTabActive : ''}`}
          onClick={() => setSubTab('change-orders')}
        >
          Approved Change Orders ({changeOrders.filter(co => co.status === 'approved').length})
        </button>
        <button 
          className={`${styles.subTabButton} ${subTab === 'material-revisions' ? styles.subTabActive : ''}`}
          onClick={() => setSubTab('material-revisions')}
        >
          Approved Substitutions ({materialSubstitutions.length})
        </button>
        <button 
          className={`${styles.subTabButton} ${subTab === 'room-breakdown' ? styles.subTabActive : ''}`}
          onClick={() => setSubTab('room-breakdown')}
        >
          Room / Area Breakdown
        </button>
      </div>

      {/* Sub-Tab Contents */}
      <div className={styles.subTabBody}>
        {subTab === 'change-orders' && (
          <div className={styles.section}>
            {changeOrders.filter(co => co.status === 'approved').length === 0 ? (
              <div className={styles.emptyView}>No approved change orders for this project.</div>
            ) : (
              changeOrders.filter(co => co.status === 'approved').map(co => (
                <div key={co.id} className={styles.coCard}>
                  <div className={styles.coCardHeader}>
                    <div>
                      <h4 className={styles.coTitle}>{co.title}</h4>
                      {co.reason && <p className={styles.coReason}><strong>Reason:</strong> {co.reason}</p>}
                    </div>
                    <div className={styles.coStats}>
                      <span className={styles.coBadge}>{formatCurrency(co.amount)}</span>
                      {co.timeline_impact_days > 0 && (
                        <span className={styles.coTimelineBadge}>+{co.timeline_impact_days} Days</span>
                      )}
                      <span className={styles.coDate}>{formatDate(co.created_at)}</span>
                    </div>
                  </div>

                  {co.items && co.items.length > 0 ? (
                    <div className={styles.tableWrap}>
                      <table className={styles.itemTable}>
                        <thead>
                          <tr>
                            <th>Room / Area</th>
                            <th>Item Name</th>
                            <th>Type</th>
                            <th>Qty</th>
                            <th>Unit Price</th>
                            <th>Total Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {co.items.map(item => (
                            <tr key={item.id}>
                              <td>{item.room_or_area || '—'}</td>
                              <td>{item.item_name}</td>
                              <td>
                                <span className={item.scope_type === 'addition' ? styles.badgeAdd : styles.badgeSub}>
                                  {item.scope_type === 'addition' ? 'Addition' : 'Reduction'}
                                </span>
                              </td>
                              <td>{item.quantity} {item.unit}</td>
                              <td>{formatCurrency(item.unit_price)}</td>
                              <td className={item.scope_type === 'addition' ? styles.positiveText : styles.negativeText}>
                                {item.scope_type === 'addition' ? '+' : '-'}{formatCurrency(item.total_price)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className={styles.noItemsMsg}>No item-level BOQ additions/reductions recorded for this change order.</div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {subTab === 'material-revisions' && (
          <div className={styles.section}>
            {materialSubstitutions.length === 0 ? (
              <div className={styles.emptyView}>No approved material substitutions for this project.</div>
            ) : (
              <div className={styles.tableCard}>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.th}>Room</th>
                        <th className={styles.th}>Original Item</th>
                        <th className={styles.th}>Replacement Item</th>
                        <th className={styles.th}>Qty</th>
                        <th className={styles.th}>Price Diff</th>
                        <th className={styles.th}>Cost Impact</th>
                        <th className={styles.th}>Approved Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materialSubstitutions.map(sub => (
                        <tr key={sub.id} className={styles.tr}>
                          <td className={styles.td}>{sub.roomOrArea || '—'}</td>
                          <td className={styles.td}>
                            <div className={styles.itemDetail}>
                              <span className={styles.itemName}>{sub.originalName}</span>
                              <span className={styles.itemSub}>{sub.originalBrand || '—'} | {sub.originalSpecs || '—'}</span>
                              <span className={styles.itemPrice}>{formatCurrency(sub.originalUnitPrice)} / unit</span>
                            </div>
                          </td>
                          <td className={styles.td}>
                            <div className={styles.itemDetail}>
                              <span className={styles.itemName}>{sub.replacementName}</span>
                              <span className={styles.itemSub}>{sub.replacementBrand || '—'} | {sub.replacementSpecs || '—'}</span>
                              <span className={styles.itemPrice}>{formatCurrency(sub.replacementUnitPrice)} / unit</span>
                            </div>
                          </td>
                          <td className={styles.td}>{sub.quantity}</td>
                          <td className={`${styles.td} ${sub.priceDifference >= 0 ? styles.positiveText : styles.negativeText}`}>
                            {sub.priceDifference >= 0 ? '+' : ''}{formatCurrency(sub.priceDifference)}
                          </td>
                          <td className={`${styles.td} ${sub.totalImpact >= 0 ? styles.positiveText : styles.negativeText}`}>
                            {sub.totalImpact >= 0 ? '+' : ''}{formatCurrency(sub.totalImpact)}
                          </td>
                          <td className={styles.td}>{formatDate(sub.clientApprovedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {subTab === 'room-breakdown' && (
          <div className={styles.section}>
            <div className={styles.tableCard}>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.th}>Room / Area</th>
                      <th className={styles.th}>Original Value</th>
                      <th className={styles.th}>Change Orders</th>
                      <th className={styles.th}>Material Revisions</th>
                      <th className={styles.th}>Current Value</th>
                      <th className={styles.th}>Net Variance</th>
                      <th className={styles.th}>Var. %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roomBreakdown.map(room => (
                      <tr key={room.roomOrArea} className={styles.tr}>
                        <td className={styles.td}>
                          <strong>{room.roomOrArea}</strong>
                        </td>
                        <td className={styles.td}>{formatCurrency(room.originalValue)}</td>
                        <td className={styles.td}>{formatCurrency(room.changeOrderValue)}</td>
                        <td className={styles.td}>{formatCurrency(room.materialRevisionValue)}</td>
                        <td className={styles.td}>{formatCurrency(room.currentValue)}</td>
                        <td className={`${styles.td} ${room.varianceAmount >= 0 ? styles.positiveText : styles.negativeText}`}>
                          {room.varianceAmount >= 0 ? '+' : ''}{formatCurrency(room.varianceAmount)}
                        </td>
                        <td className={`${styles.td} ${room.varianceAmount >= 0 ? styles.positiveText : styles.negativeText}`}>
                          {room.varianceAmount >= 0 ? '+' : ''}{room.variancePercentage.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
