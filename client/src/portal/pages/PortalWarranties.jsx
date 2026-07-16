/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect */
import React, { useState, useEffect, useMemo } from 'react';
import styles from './PortalWarranties.module.css';
import { getPortalWarranties } from '../../api/warranties';

export default function PortalWarranties() {
  const [warranties, setWarranties] = useState([]);
  const [loading, setLoading] = useState(true);

  const getDownloadUrl = (key) => {
    const base = import.meta.env.VITE_API_URL || '';
    return `${base}/api/local-download?key=${encodeURIComponent(key)}`;
  };

  useEffect(() => {
    setLoading(true);
    getPortalWarranties()
      .then(data => {
        setWarranties(data || []);
      })
      .catch(err => {
        console.error('Failed to fetch warranties:', err);
        setWarranties([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const metrics = useMemo(() => {
    const stats = { active: 0, expired: 0 };
    warranties.forEach(w => {
      if (w.eligibility_status === 'active') stats.active++;
      else if (w.eligibility_status === 'expired') stats.expired++;
    });
    return stats;
  }, [warranties]);

  if (loading) {
    return <div className={styles.container}><div style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-secondary)' }}>Loading your warranties...</div></div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.titleSection}>
        <h1 className={styles.title}>Product Warranties 🛡️</h1>
        <p className={styles.subtitle}>Track coverage, expiry dates, and download warranty documentation for products installed in your residence.</p>
      </div>

      {warranties.length > 0 ? (
        <>
          {/* Summary metrics strip */}
          <div className={styles.metricsRow}>
            <div className={styles.metricCard} style={{ borderLeft: '4px solid var(--color-success)' }}>
              <span className={styles.metricLabel}>Active Warranties</span>
              <span className={styles.metricValue} style={{ color: 'var(--color-success)' }}>{metrics.active}</span>
            </div>
            <div className={styles.metricCard} style={{ borderLeft: '4px solid var(--color-text-secondary)' }}>
              <span className={styles.metricLabel}>Expired Warranties</span>
              <span className={styles.metricValue}>{metrics.expired}</span>
            </div>
          </div>

          {/* Cards grid */}
          <div className={styles.grid}>
            {warranties.map(w => {
              const isActive = w.eligibility_status === 'active';
              const isVoided = w.eligibility_status === 'voided';
              const isExpired = w.eligibility_status === 'expired';

              let badgeClass = styles.badgeActive;
              if (isVoided) badgeClass = styles.badgeVoided;
              else if (isExpired) badgeClass = styles.badgeExpired;

              return (
                <div key={w.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <div>
                      <h3 className={styles.productName}>{w.product_name}</h3>
                      {w.brand && <span className={styles.brand}>{w.brand}</span>}
                    </div>
                    <span className={`${styles.badge} ${badgeClass}`}>
                      {w.eligibility_status}
                    </span>
                  </div>

                  <div className={styles.cardBody}>
                    {w.serial_number && (
                      <div className={styles.metaRow}>
                        <span className={styles.metaLabel}>Serial Number</span>
                        <span className={styles.serialNumber}>{w.serial_number}</span>
                      </div>
                    )}
                    <div className={styles.metaRow}>
                      <span className={styles.metaLabel}>Start Date</span>
                      <span className={styles.metaValue}>{new Date(w.start_date).toLocaleDateString('en-IN')}</span>
                    </div>
                    <div className={styles.metaRow}>
                      <span className={styles.metaLabel}>Expiry Date</span>
                      <span className={styles.metaValue}>{new Date(w.end_date).toLocaleDateString('en-IN')}</span>
                    </div>
                    <div className={styles.metaRow}>
                      <span className={styles.metaLabel}>Warranty Term</span>
                      <span className={styles.metaValue}>
                        Brand: {w.brand_warranty_months || 0}m / Company: {w.company_warranty_months || 0}m
                      </span>
                    </div>
                  </div>

                  {w.notes && (
                    <div className={styles.notes}>
                      <strong>Remarks: </strong> {w.notes}
                    </div>
                  )}

                  {w.warranty_document && (
                    <div className={styles.cardFooter}>
                      <a
                        href={getDownloadUrl(w.warranty_document)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.downloadLink}
                      >
                        📥 Download Warranty Certificate / Manual
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🛡️</div>
          <h2>No warranties registered yet</h2>
          <p>Product warranties will appear here once the site handover checklist and certificates are completed.</p>
        </div>
      )}
    </div>
  );
}
