import React, { useState, useEffect } from 'react';
import styles from './CoordinationTab.module.css';
import { getProjectCoordination, updateProjectCoordination } from '../../api/projects';
import { Button } from '../../components/ui';
import { useToast } from '../../store/toastContext';

export default function CoordinationTab({ projectId, projectStatus, onProjectUpdated }) {
  const toast = useToast();
  
  const [coordination, setCoordination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [siteReadinessDate, setSiteReadinessDate] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await getProjectCoordination(projectId);
      const data = res.data?.data || res.data;
      setCoordination(data);
      setSiteReadinessDate(data.siteReadinessDate || '');
    } catch (err) {
      console.error('[CoordinationTab] Failed to load coordination data', err);
      toast.error('Failed to load coordination data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await updateProjectCoordination(projectId, { siteReadinessDate: siteReadinessDate || null });
      toast.success('Site readiness date updated successfully.');
      await loadData();
      if (onProjectUpdated) {
        onProjectUpdated();
      }
    } catch (err) {
      console.error('[CoordinationTab] Failed to update date', err);
      toast.error('Failed to update site readiness date.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading production-site timeline coordination...</div>;
  }

  if (!coordination) {
    return <div className={styles.loading}>Failed to load coordination data. Please refresh.</div>;
  }

  const {
    projectName,
    pmName,
    factoryReadinessDate,
    alertType,
    divergenceDays,
    productionOrders
  } = coordination;

  // Format Helper
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not Scheduled';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div className={styles.container}>
      <div className={styles.titleSection}>
        <h2 className={styles.title}>Production & Site Coordination</h2>
        <p className={styles.subtitle}>Coordinate between factory dispatch readiness dates and site readiness targets to minimize idle time.</p>
      </div>

      {/* Timeline Status Alert Banner */}
      {alertType === 'factory_delay' && (
        <div className={`${styles.alertBanner} ${styles.alertFactory}`}>
          <span className={styles.alertIcon}>🚨</span>
          <div>
            <h4 className={styles.alertTitle}>Factory Dispatch Delay Alert ({divergenceDays} days)</h4>
            <p className={styles.alertDesc}>
              Modular production completion at factory is scheduled for {formatDate(factoryReadinessDate)}, which is {divergenceDays} day(s) AFTER the site readiness date ({formatDate(siteReadinessDate)}). Site execution team may experience idle time or delayed installation.
            </p>
          </div>
        </div>
      )}

      {alertType === 'site_delay' && (
        <div className={`${styles.alertBanner} ${styles.alertSite}`}>
          <span className={styles.alertIcon}>⚠️</span>
          <div>
            <h4 className={styles.alertTitle}>Site Readiness Delay Warning ({divergenceDays} days)</h4>
            <p className={styles.alertDesc}>
              Site readiness date is set for {formatDate(siteReadinessDate)}, which is {divergenceDays} day(s) AFTER modular items completion at the factory ({formatDate(factoryReadinessDate)}). Factory items will be finished and require transit coordination or warehouse storage.
            </p>
          </div>
        </div>
      )}

      {alertType === 'aligned' && (
        <div className={`${styles.alertBanner} ${styles.alertAligned}`}>
          <span className={styles.alertIcon}>✅</span>
          <div>
            <h4 className={styles.alertTitle}>Timeline Aligned</h4>
            <p className={styles.alertDesc}>
              Factory dispatch completion ({formatDate(factoryReadinessDate)}) and site readiness ({formatDate(siteReadinessDate)}) are synchronized within the 3-day buffer window.
            </p>
          </div>
        </div>
      )}

      {alertType === 'pending_setup' && (
        <div className={`${styles.alertBanner} ${styles.alertPending}`}>
          <span className={styles.alertIcon}>ℹ️</span>
          <div>
            <h4 className={styles.alertTitle}>Pending Setup</h4>
            <p className={styles.alertDesc}>
              {!siteReadinessDate ? 'Please set the project site readiness date below. ' : ''}
              {productionOrders.length === 0 ? 'Schedule production orders at the factory to analyze timeline divergence.' : ''}
            </p>
          </div>
        </div>
      )}

      <div className={styles.grid}>
        {/* Coordination Form Column */}
        <div className={styles.formCard}>
          <h3 className={styles.cardHeader}>Coordination Dates</h3>
          <form onSubmit={handleSave} className={styles.cardBody}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Site Readiness Target Date</label>
              <input
                type="date"
                className={styles.input}
                value={siteReadinessDate}
                onChange={(e) => setSiteReadinessDate(e.target.value)}
              />
              <p className={styles.fieldHelp}>Expected date by which the site is ready to receive finished materials (e.g. electrical/wet work complete).</p>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Factory Dispatch Completion Date</label>
              <div className={styles.readOnlyValue}>
                {factoryReadinessDate ? formatDate(factoryReadinessDate) : 'No active production orders scheduled'}
              </div>
              <p className={styles.fieldHelp}>Calculated dynamically from the latest completion date of scheduled production orders.</p>
            </div>

            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Saving...' : 'Update Target Date'}
            </Button>
          </form>
        </div>

        {/* Info / Progress Comparison */}
        <div className={styles.infoCard}>
          <h3 className={styles.cardHeader}>Timeline Comparison</h3>
          <div className={styles.cardBody} style={{ gap: 24 }}>
            <div className={styles.timelineRow}>
              <div className={styles.timelineItem}>
                <span className={styles.timelineIndicator} style={{ backgroundColor: siteReadinessDate ? '#3b82f6' : '#d1d5db' }}></span>
                <div>
                  <h4 className={styles.timelineLabel}>Site Readiness Date</h4>
                  <p className={styles.timelineDate}>{siteReadinessDate ? formatDate(siteReadinessDate) : 'Not Configured'}</p>
                </div>
              </div>

              <div className={styles.timelineItem}>
                <span className={styles.timelineIndicator} style={{ backgroundColor: factoryReadinessDate ? '#10b981' : '#d1d5db' }}></span>
                <div>
                  <h4 className={styles.timelineLabel}>Expected Factory Date</h4>
                  <p className={styles.timelineDate}>{factoryReadinessDate ? formatDate(factoryReadinessDate) : 'Not Configured'}</p>
                </div>
              </div>
            </div>

            {factoryReadinessDate && siteReadinessDate && (
              <div className={styles.divergenceMetrics}>
                <div className={styles.metricItem}>
                  <span className={styles.metricValue}>{divergenceDays} day(s)</span>
                  <span className={styles.metricLabel}>Divergence</span>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricValue} style={{ textTransform: 'uppercase', color: alertType === 'aligned' ? '#10b981' : alertType === 'factory_delay' ? '#ef4444' : '#f59e0b' }}>
                    {alertType.replace('_', ' ')}
                  </span>
                  <span className={styles.metricLabel}>Status</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Production Orders Section */}
      <div className={styles.ordersSection}>
        <h3 className={styles.sectionTitle}>Active Factory Production Orders</h3>
        {productionOrders.length === 0 ? (
          <div className={styles.noOrders}>No active production orders found for this project.</div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Order Number</th>
                  <th>Factory Name</th>
                  <th>Status</th>
                  <th>Expected Completion Date</th>
                  <th>Item Count</th>
                </tr>
              </thead>
              <tbody>
                {productionOrders.map(order => (
                  <tr key={order.id}>
                    <td className={styles.bold}>{order.order_number}</td>
                    <td>{order.factory_name || 'Not Assigned'}</td>
                    <td>
                      <span className={`${styles.badge} ${styles['badge_' + order.status]}`}>
                        {order.status}
                      </span>
                    </td>
                    <td>{formatDate(order.expected_completion_date)}</td>
                    <td>{order.item_count} item(s)</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
