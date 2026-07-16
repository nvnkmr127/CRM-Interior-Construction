/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import styles from './HandoverReadinessTab.module.css';
import {
  getHandoverReadiness,
  pmSignOffHandoverReadiness,
  getHandoverAppointments,
  scheduleHandoverAppointment
} from '../../api/handover';
import { Button } from '../../components/ui';
import { useToast } from '../../store/toastContext';

export default function HandoverReadinessTab({ projectId }) {
  const toast = useToast();
  
  const [readiness, setReadiness] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingSignOff, setSubmittingSignOff] = useState(false);
  const [submittingAppt, setSubmittingAppt] = useState(false);

  // Appointment Form state
  const [apptDate, setApptDate] = useState('');
  const [apptNotes, setApptNotes] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [readinessRes, apptsRes] = await Promise.all([
        getHandoverReadiness(projectId),
        getHandoverAppointments(projectId)
      ]);
      setReadiness(readinessRes);
      setAppointments(apptsRes);
    } catch (err) {
      console.error('[HandoverReadinessTab] Load error:', err);
      toast.error('Failed to load handover readiness gates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  const handlePMSignOff = async () => {
    try {
      setSubmittingSignOff(true);
      await pmSignOffHandoverReadiness(projectId);
      toast.success('Handover readiness PM sign-off recorded successfully.');
      await loadData();
    } catch (err) {
      console.error('[HandoverReadinessTab] Sign off error:', err);
      const errorMsg = err.response?.data?.message || err.message || 'PM sign-off failed.';
      toast.error(errorMsg);
    } finally {
      setSubmittingSignOff(false);
    }
  };

  const handleScheduleAppointment = async (e) => {
    e.preventDefault();
    if (!apptDate) {
      toast.warning('Please select a scheduled date and time.');
      return;
    }

    try {
      setSubmittingAppt(true);
      await scheduleHandoverAppointment(projectId, {
        appointmentDate: new Date(apptDate).toISOString(),
        notes: apptNotes || null
      });
      toast.success('Handover appointment scheduled successfully.');
      setApptDate('');
      setApptNotes('');
      await loadData();
    } catch (err) {
      console.error('[HandoverReadinessTab] Schedule error:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Failed to schedule appointment.';
      toast.error(errorMsg);
    } finally {
      setSubmittingAppt(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading handover readiness review...</div>;
  }

  if (!readiness) {
    return <div className={styles.loading}>No checklist/readiness record found. Please ensure project is active.</div>;
  }

  const { overallReady, gates } = readiness;
  const { tasksCompleted, snagsResolved, paymentsCleared, documentsUploaded, pmSignedOff } = gates;

  // Verification helpers
  const canPMSignOff = tasksCompleted.passed && snagsResolved.passed && paymentsCleared.passed && documentsUploaded.passed;

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.titleSection}>
        <h2 className={styles.title}>Handover Readiness Gates</h2>
        <p className={styles.subtitle}>Verify mandatory checks prior to booking the client handover meeting.</p>
      </div>

      {/* Main Status Banner */}
      {overallReady ? (
        <div className={`${styles.readyBanner} ${styles.bannerGreen}`}>
          <span className={styles.bannerIcon}>🎉</span>
          <div>
            <h3 className={styles.bannerTitle}>All Gates Clear & Ready</h3>
            <p className={styles.bannerDesc}>Handover requirements are fully satisfied. You may now book the official client handover appointment.</p>
          </div>
        </div>
      ) : (
        <div className={`${styles.readyBanner} ${styles.bannerRed}`}>
          <span className={styles.bannerIcon}>🔒</span>
          <div>
            <h3 className={styles.bannerTitle}>Handover Gates Pending</h3>
            <p className={styles.bannerDesc}>One or more mandatory readiness gates are incomplete. Scheduling appointments is blocked.</p>
          </div>
        </div>
      )}

      {/* Checklist Grid */}
      <div className={styles.gatesGrid}>
        {/* Gate 1: Tasks */}
        <div className={styles.gateCard}>
          <div className={`${styles.gateIndicator} ${tasksCompleted.passed ? styles.indicatorPass : styles.indicatorFail}`}>
            {tasksCompleted.passed ? '✓' : '✖'}
          </div>
          <div className={styles.gateContent}>
            <h4 className={styles.gateTitle}>1. Task Completion</h4>
            <span className={styles.gateMessage}>{tasksCompleted.message}</span>
          </div>
        </div>

        {/* Gate 2: Snags */}
        <div className={styles.gateCard}>
          <div className={`${styles.gateIndicator} ${snagsResolved.passed ? styles.indicatorPass : styles.indicatorFail}`}>
            {snagsResolved.passed ? '✓' : '✖'}
          </div>
          <div className={styles.gateContent}>
            <h4 className={styles.gateTitle}>2. Snags & Punch Lists</h4>
            <span className={styles.gateMessage}>{snagsResolved.message}</span>
          </div>
        </div>

        {/* Gate 3: Payments */}
        <div className={styles.gateCard}>
          <div className={`${styles.gateIndicator} ${paymentsCleared.passed ? styles.indicatorPass : styles.indicatorFail}`}>
            {paymentsCleared.passed ? '✓' : '✖'}
          </div>
          <div className={styles.gateContent}>
            <h4 className={styles.gateTitle}>3. Financial Clearance</h4>
            <span className={styles.gateMessage}>{paymentsCleared.message}</span>
          </div>
        </div>

        {/* Gate 4: Documents */}
        <div className={styles.gateCard}>
          <div className={`${styles.gateIndicator} ${documentsUploaded.passed ? styles.indicatorPass : styles.indicatorFail}`}>
            {documentsUploaded.passed ? '✓' : '✖'}
          </div>
          <div className={styles.gateContent}>
            <h4 className={styles.gateTitle}>4. Document Approval</h4>
            <span className={styles.gateMessage}>{documentsUploaded.message}</span>
          </div>
        </div>

        {/* Gate 5: PM Sign-off */}
        <div className={styles.gateCard}>
          <div className={`${styles.gateIndicator} ${pmSignedOff.passed ? styles.indicatorPass : styles.indicatorFail}`}>
            {pmSignedOff.passed ? '✓' : '✖'}
          </div>
          <div className={styles.gateContent}>
            <h4 className={styles.gateTitle}>5. PM Sign-off</h4>
            <span className={styles.gateMessage}>{pmSignedOff.message}</span>
          </div>
        </div>
      </div>

      <div className={styles.actionsSection}>
        {/* PM Sign-Off Gate Card */}
        <div className={styles.pmCard}>
          <h3 className={styles.cardHeader}>Project Manager Verification</h3>
          <div className={styles.cardBody}>
            <p className={styles.cardDesc}>
              Once all checklist items, snags, invoices, and drawings are verified and approved, sign off on the handover readiness state below.
            </p>
            {pmSignedOff.passed ? (
              <div style={{ background: '#ecfdf5', color: '#047857', padding: '12px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600 }}>
                ✓ Verification Completed by PM
              </div>
            ) : (
              <Button
                variant="primary"
                disabled={!canPMSignOff || submittingSignOff}
                onClick={handlePMSignOff}
              >
                {submittingSignOff ? 'Verifying...' : 'Sign Off Handover Readiness'}
              </Button>
            )}
            {!canPMSignOff && !pmSignedOff.passed && (
              <span style={{ fontSize: '11px', color: 'var(--color-danger)' }}>
                * Solve tasks, snags, dues, and document approvals to unlock PM verification.
              </span>
            )}
          </div>
        </div>

        {/* Appointment Scheduler Card */}
        <div className={styles.apptCard}>
          <h3 className={styles.cardHeader}>Schedule Client Handover</h3>
          <form onSubmit={handleScheduleAppointment} className={styles.cardBody}>
            <p className={styles.cardDesc}>
              Book the client appointment for site handover and key delivery (disabled until all gates are green).
            </p>

            <div className={styles.formGroup}>
              <label className={styles.label}>Appointment Date & Time</label>
              <input
                type="datetime-local"
                className={styles.input}
                value={apptDate}
                onChange={(e) => setApptDate(e.target.value)}
                disabled={!overallReady || submittingAppt}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Notes / Location instructions</label>
              <textarea
                className={styles.textarea}
                placeholder="e.g. Meet client at site main entrance. Bring physically signed handover checklists and keys."
                value={apptNotes}
                onChange={(e) => setApptNotes(e.target.value)}
                disabled={!overallReady || submittingAppt}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={!overallReady || submittingAppt}
            >
              {submittingAppt ? 'Scheduling...' : 'Schedule Handover Meeting'}
            </Button>
          </form>
        </div>
      </div>

      {/* History of Scheduled Appointments */}
      <div style={{ marginTop: '16px' }}>
        <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-text)', marginBottom: '16px' }}>
          Scheduled Handover Appointments
        </h3>
        {appointments.length === 0 ? (
          <div style={{ padding: '24px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
            No appointments booked yet.
          </div>
        ) : (
          <div className={styles.appointmentsList}>
            {appointments.map(appt => (
              <div key={appt.id} className={styles.appointmentItem}>
                <div className={styles.apptInfo}>
                  <span className={styles.apptDate}>{formatDate(appt.appointment_date)}</span>
                  {appt.notes && <span className={styles.apptNotes}>{appt.notes}</span>}
                  <span className={styles.apptMeta}>Scheduled by {appt.creator_name || 'Project Manager'}</span>
                </div>
                <span className={`${styles.badge} ${styles['badge_' + appt.status] || styles.badgeScheduled}`}>
                  {appt.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
