/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import styles from './CommercialApprovalTab.module.css';
import { getCommercialApprovalChecklist, confirmCommercialApproval } from '../../api/projects';
import { Button } from '../../components/ui';
import { useToast } from '../../store/toastContext';

export default function CommercialApprovalTab({ projectId, projectStatus, onProjectUpdated }) {
  const toast = useToast();
  
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState('');

  const loadChecklist = async () => {
    try {
      setLoading(true);
      const res = await getCommercialApprovalChecklist(projectId);
      const data = res.data?.data || res.data;
      setChecklist(data);
    } catch (err) {
      console.error('[CommercialApprovalTab] Failed to load checklist', err);
      toast.error('Failed to load commercial approval checklist.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadChecklist();
    }
  }, [projectId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!checklist) return;

    if (!checklist.boq_accepted || !checklist.all_revisions_closed || !checklist.payment_schedule_agreed) {
      toast.error('Cannot sign off. Some commercial criteria are still pending.');
      return;
    }

    try {
      setSubmitting(true);
      await confirmCommercialApproval(projectId, { notes });
      toast.success('Commercial approval sign-off completed! Execution kickoff is now unlocked.');
      await loadChecklist();
      if (onProjectUpdated) {
        onProjectUpdated();
      }
    } catch (err) {
      console.error('[CommercialApprovalTab] Failed to submit approval', err);
      toast.error(err.response?.data?.error?.message || 'Failed to submit commercial approval.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading commercial baseline metrics...</div>;
  }

  if (!checklist) {
    return <div className={styles.loading}>Failed to load gate data. Please refresh.</div>;
  }

  // Formatting helpers
  const formatDate = (dStr) => {
    if (!dStr) return '—';
    return new Date(dStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatCurrency = (val) => {
    const num = Number(val || 0);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  const {
    boq_accepted,
    accepted_boq_details,
    all_revisions_closed,
    active_reviews_count,
    payment_schedule_agreed,
    payment_milestones_total_percentage,
    payment_milestones_total_amount,
    contract_value,
    is_approved,
    approval_details
  } = checklist;

  const isSignOffEnabled = boq_accepted && all_revisions_closed && payment_schedule_agreed;

  return (
    <div className={styles.container}>
      <div className={styles.titleSection}>
        <h2 className={styles.title}>Design-to-Execution Commercial Gate</h2>
        <p className={styles.subtitle}>Enforces commercial consensus, design freeze review, and payment alignment before starting physical build phases.</p>
      </div>

      {is_approved ? (
        <div className={styles.successPanel}>
          <span className={styles.successIcon}>✓</span>
          <div>
            <h3 className={styles.successTitle}>Commercial Sign-Off Completed</h3>
            <p className={styles.successDesc}>
              This project has successfully cleared the commercial kickoff gate. Confirmed by <strong>{approval_details.approved_by_name || 'System User'}</strong> on {formatDate(approval_details.approved_at)}.
            </p>
            {approval_details.notes && (
              <p className={styles.successDesc} style={{ marginTop: 12, paddingLeft: 12, borderLeft: '2px solid rgba(16, 185, 129, 0.4)', fontStyle: 'italic' }}>
                &ldquo;{approval_details.notes}&rdquo;
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.infoBanner}>
          <span className={styles.infoIcon}>🛈</span>
          <div>
            <p className={styles.infoText}>
              <strong>Kickoff Gate Enforced:</strong> All three criteria below must be resolved to unlock the "Confirm Commercial Approval" button. Execution phases cannot be set to Active/In-Progress without this gate sign-off.
            </p>
          </div>
        </div>
      )}

      <div className={styles.grid}>
        {/* Card 1: BOQ Acceptance */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>1. Client BOQ Acceptance</h3>
            <span style={{ fontSize: 20 }}>{boq_accepted ? '🟢' : '🔴'}</span>
          </div>
          <div className={styles.cardBody}>
            <p className={styles.cardDesc}>
              Enforces that the final Bill of Quantities (BOQ) is formally presented to and accepted by the client.
            </p>
            <div style={{ marginTop: 'auto', paddingTop: 16 }}>
              {boq_accepted ? (
                <div className={`${styles.cardStatus} ${styles.statusOk}`}>
                  Accepted (Quotation: {accepted_boq_details?.quotation_number})
                </div>
              ) : (
                <div className={`${styles.cardStatus} ${styles.statusPending}`}>
                  Quotation Pending Acceptance
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Revisions Closure */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>2. Design Revision Freeze</h3>
            <span style={{ fontSize: 20 }}>{all_revisions_closed ? '🟢' : '🔴'}</span>
          </div>
          <div className={styles.cardBody}>
            <p className={styles.cardDesc}>
              Confirms that the design freeze milestone has been achieved and all active client review rounds are formally closed.
            </p>
            <div style={{ marginTop: 'auto', paddingTop: 16 }}>
              {all_revisions_closed ? (
                <div className={`${styles.cardStatus} ${styles.statusOk}`}>
                  Revisions Closed
                </div>
              ) : (
                <div className={`${styles.cardStatus} ${styles.statusPending}`}>
                  {active_reviews_count} Design Review(s) Active
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card 3: Payment Schedule Alignment */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>3. Payment Milestones Schedule</h3>
            <span style={{ fontSize: 20 }}>{payment_schedule_agreed ? '🟢' : '🟡'}</span>
          </div>
          <div className={styles.cardBody}>
            <p className={styles.cardDesc}>
              Validates that the scheduled payment milestone percentages total exactly 100% of the project's contract value ({formatCurrency(contract_value)}).
            </p>
            <div style={{ marginTop: 'auto', paddingTop: 16 }}>
              {payment_schedule_agreed ? (
                <div className={`${styles.cardStatus} ${styles.statusOk}`}>
                  Milestones aligned (100%)
                </div>
              ) : (
                <div className={`${styles.cardStatus} ${styles.statusWarning}`}>
                  Current: {payment_milestones_total_percentage}% of contract value
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {!is_approved && (
        <form onSubmit={handleSubmit} className={styles.signOffCard}>
          <div className={styles.signOffHeader}>Submit Commercial Approval Sign-Off</div>
          <div className={styles.signOffBody}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className={styles.notesLabel}>Commercial Gate Notes / Sign-off Comments</label>
              <textarea
                className={styles.notesTextarea}
                placeholder="Include confirmation details, e.g., signed quotation reference, approved payment terms, deviations, or specific instructions for execution kickoff."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                required={isSignOffEnabled}
                disabled={!isSignOffEnabled}
              />
            </div>
          </div>

          <div className={styles.actionArea}>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting || !isSignOffEnabled}
            >
              {submitting ? 'Submitting Sign-Off...' : 'Confirm Commercial Approval'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
