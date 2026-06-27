import React, { useState, useEffect } from 'react';
import styles from './PortalClaims.module.css';
import { Button, Modal, FormField, Textarea } from '../../components/ui';
import { getPortalWarranties } from '../../api/warranties';
import { getPortalClaims, createPortalClaim } from '../../api/warrantyClaims';
import { useToast } from '../../store/toastContext';

export default function PortalClaims() {
  const toast = useToast();
  const [claims, setClaims] = useState([]);
  const [warranties, setWarranties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    warrantyId: '',
    natureOfDefect: ''
  });

  const fetchData = () => {
    setLoading(true);
    Promise.all([getPortalClaims(), getPortalWarranties()])
      .then(([claimsData, warrantiesData]) => {
        setClaims(claimsData || []);
        setWarranties(warrantiesData || []);
      })
      .catch(err => {
        console.error('Failed to fetch portal claims data:', err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAdd = () => {
    setFormData({
      warrantyId: '',
      natureOfDefect: ''
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.natureOfDefect.trim()) {
      return toast.error('Please describe the defect details.');
    }

    try {
      await createPortalClaim({
        warrantyId: formData.warrantyId || null,
        natureOfDefect: formData.natureOfDefect
      });

      toast.success('Warranty claim submitted successfully. Our team will review it.');
      setModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error('Failed to submit warranty claim.');
    }
  };

  if (loading && claims.length === 0) {
    return <div className={styles.container}><div style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-secondary)' }}>Loading your claims...</div></div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.titleSection}>
        <div className={styles.titleText}>
          <h1 className={styles.title}>Warranty Claims 🔧</h1>
          <p className={styles.subtitle}>Report issues, trace eligibility reviews, and view repair resolutions for items installed in your home.</p>
        </div>
        <Button onClick={handleOpenAdd}>+ File New Claim</Button>
      </div>

      {claims.length > 0 ? (
        <div className={styles.grid}>
          {claims.map(c => {
            let statusBadge = styles.badgeOpen;
            if (c.status === 'in_progress') statusBadge = styles.badgeProgress;
            else if (c.status === 'resolved') statusBadge = styles.badgeResolved;
            else if (c.status === 'closed') statusBadge = styles.badgeClosed;

            let decisionText = 'Under Review';
            let decisionColor = 'var(--color-warning)';
            if (c.eligibility_decision === 'approved') {
              decisionText = 'Approved (In-Warranty)';
              decisionColor = 'var(--color-success)';
            } else if (c.eligibility_decision === 'rejected') {
              decisionText = 'Out of Warranty (Chargeable)';
              decisionColor = 'var(--color-danger)';
            }

            return (
              <div key={c.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.claimNumber}>{c.claim_number}</span>
                  <span className={`${styles.badge} ${statusBadge}`}>
                    {c.status.replace('_', ' ')}
                  </span>
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Product</span>
                    <span className={styles.metaValue}>{c.product_name || 'Untracked Item'}</span>
                  </div>
                  {c.brand && (
                    <div className={styles.metaRow}>
                      <span className={styles.metaLabel}>Brand</span>
                      <span className={styles.metaValue}>{c.brand}</span>
                    </div>
                  )}
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Filed Date</span>
                    <span className={styles.metaValue}>{new Date(c.claim_date).toLocaleDateString('en-IN')}</span>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <div className={styles.defectTitle}>Reported Defect</div>
                    <p className={styles.defectText}>{c.nature_of_defect}</p>
                  </div>
                </div>

                {/* Eligibility Decision Panel */}
                <div className={styles.decisionPanel}>
                  <span className={styles.decisionTitle} style={{ color: decisionColor }}>
                    Status: {decisionText}
                  </span>
                  {c.eligibility_reason && (
                    <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                      Reason: {c.eligibility_reason}
                    </span>
                  )}
                  {c.technician_name && (
                    <span style={{ fontSize: 11, color: 'var(--color-text)', marginTop: 4, fontWeight: 600 }}>
                      🛠️ Assigned Tech: {c.technician_name}
                    </span>
                  )}
                </div>

                {/* Resolution Details panel */}
                {c.resolution_details && (
                  <div className={styles.resolutionPanel}>
                    <strong>🔧 Resolution Summary:</strong>
                    <span>{c.resolution_details}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🔧</div>
          <h2>No warranty claims found</h2>
          <p>If any installed hardware, cabinetry, or appliance is malfunctioning, file a claim on-system to trace its resolution.</p>
          <Button onClick={handleOpenAdd} style={{ marginTop: 12 }}>File Your First Claim</Button>
        </div>
      )}

      {/* File Claim Modal */}
      {modalOpen && (
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title="File Warranty Claim"
        >
          <form onSubmit={handleSubmit} className={styles.modalForm}>
            <FormField label="Select Installed Product">
              <select
                value={formData.warrantyId}
                onChange={(e) => setFormData(prev => ({ ...prev, warrantyId: e.target.value }))}
                className="input"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
              >
                <option value="">-- Other / Untracked Product --</option>
                {warranties.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.product_name} {w.brand ? `(${w.brand})` : ''} - Expires {new Date(w.end_date).toLocaleDateString('en-IN')}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Nature of Defect / Issue *" required>
              <Textarea
                value={formData.natureOfDefect}
                onChange={(e) => setFormData(prev => ({ ...prev, natureOfDefect: e.target.value }))}
                placeholder="Please describe what is broken, malfunctioning, or needs repair (e.g. modular drawer runner jammed, chimney touch control panel unresponsive)..."
                rows={5}
                required
              />
            </FormField>

            <div className={styles.modalFooter}>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit">Submit Claim</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
