/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import styles from './CustomerRetentionTab.module.css';
import { getRetentionSchedules, updateRetentionSchedule } from '../../api/handover';
import { Button } from '../../components/ui';
import { useToast } from '../../store/toastContext';

export default function CustomerRetentionTab({ projectId }) {
  const toast = useToast();

  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedScheduleId, setExpandedScheduleId] = useState(null);

  // Form states
  const [status, setStatus] = useState('completed');
  const [actualDate, setActualDate] = useState('');
  const [feedback, setFeedback] = useState('');
  const [csatScore, setCsatScore] = useState(5);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getRetentionSchedules(projectId);
      setSchedules(data || []);
    } catch (err) {
      console.error('[CustomerRetentionTab] Load error:', err);
      toast.error('Failed to load customer retention milestones.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  const initForm = (sched) => {
    setStatus(sched.status || 'completed');
    setActualDate(sched.actual_date || new Date().toISOString().split('T')[0]);
    setFeedback(sched.feedback || '');
    setCsatScore(sched.csat_score || 5);
    setNotes(sched.notes || '');
  };

  const handleToggleExpand = (sched) => {
    if (expandedScheduleId === sched.id) {
      setExpandedScheduleId(null);
    } else {
      setExpandedScheduleId(sched.id);
      initForm(sched);
    }
  };

  const handleSubmit = async (e, scheduleId) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await updateRetentionSchedule(projectId, scheduleId, {
        status,
        actualDate: actualDate || null,
        feedback: feedback || null,
        csatScore: csatScore || null,
        notes: notes || null
      });
      toast.success('Customer retention milestone logged successfully.');
      setExpandedScheduleId(null);
      await loadData();
    } catch (err) {
      console.error('[CustomerRetentionTab] Update error:', err);
      toast.error(err.response?.data?.message || 'Failed to update retention milestone.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (currentScore, setScore = null) => {
    return (
      <div className={styles.starRating}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={`${styles.star} ${star <= currentScore ? styles.starFilled : ''}`}
            onClick={() => setScore && setScore(star)}
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  const getStageLabel = (stage) => {
    switch (stage) {
      case '30_day': return '30-Day Check-in (Handover Review)';
      case '90_day': return '90-Day Quality Audit (Defect Check)';
      case '180_day': return '180-Day Mid-Year Maintenance';
      case '365_day': return '365-Day Warranty Expiry & AMC Review';
      default: return stage;
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading customer retention check-ins...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Post-Handover Customer Retention</h2>
        <p className={styles.subtitle}>Track scheduled customer check-ins, solicit CSAT feedback, and pitch AMC contract renewals.</p>
      </div>

      {schedules.length === 0 ? (
        <div className={styles.emptyState}>
          No customer retention milestones scheduled yet. Completion of project handover will automatically schedule check-in calls.
        </div>
      ) : (
        <div className={styles.timeline}>
          {schedules.map((sched) => {
            const isExpanded = expandedScheduleId === sched.id;
            return (
              <div key={sched.id} className={styles.milestoneCard}>
                <div
                  className={styles.milestoneHeader}
                  onClick={() => handleToggleExpand(sched)}
                >
                  <div className={styles.milestoneTitleSection}>
                    <span className={`${styles.milestoneDot} ${styles['dot_' + sched.status]}`} />
                    <span className={styles.milestoneName}>
                      {getStageLabel(sched.stage)}
                      <span className={styles.milestoneMeta}>
                        (Scheduled: {new Date(sched.scheduled_date).toLocaleDateString('en-IN')})
                      </span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span className={`${styles.badge} ${styles['badge_' + sched.status]}`}>
                      {sched.status}
                    </span>
                    <span>{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className={styles.milestoneBody}>
                    {/* Outcome / Log View */}
                    <div className={styles.outcomeView}>
                      <h4 className={styles.outcomeTitle}>Current Log Outcome</h4>
                      
                      <div className={styles.outcomeRow}>
                        <span className={styles.outcomeLabel}>Actual call date</span>
                        <span className={styles.outcomeVal}>
                          {sched.actual_date ? new Date(sched.actual_date).toLocaleDateString('en-IN') : 'Not called yet'}
                        </span>
                      </div>

                      <div className={styles.outcomeRow}>
                        <span className={styles.outcomeLabel}>Client Satisfaction Rating</span>
                        <span className={styles.outcomeVal}>
                          {sched.csat_score ? renderStars(sched.csat_score) : 'No score recorded'}
                        </span>
                      </div>

                      <div className={styles.outcomeRow}>
                        <span className={styles.outcomeLabel}>Client Feedback Comments</span>
                        <span className={styles.outcomeVal}>
                          {sched.feedback || 'No client feedback registered.'}
                        </span>
                      </div>

                      <div className={styles.outcomeRow}>
                        <span className={styles.outcomeLabel}>Internal check-in notes</span>
                        <span className={styles.outcomeVal}>
                          {sched.notes || 'No internal notes.'}
                        </span>
                      </div>
                    </div>

                    {/* Update Log Form */}
                    <form onSubmit={(e) => handleSubmit(e, sched.id)} className={styles.formSection}>
                      <h4 className={styles.outcomeTitle}>Record Check-in Outcome</h4>

                      <div className={styles.formGroup}>
                        <label className={styles.label}>Milestone Status</label>
                        <select
                          className={styles.select}
                          value={status}
                          onChange={(e) => setStatus(e.target.value)}
                        >
                          <option value="scheduled">Scheduled</option>
                          <option value="completed">Completed</option>
                          <option value="deferred">Deferred / Postponed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>

                      <div className={styles.formGroup}>
                        <label className={styles.label}>Actual Follow-up Date</label>
                        <input
                          type="date"
                          className={styles.input}
                          value={actualDate}
                          onChange={(e) => setActualDate(e.target.value)}
                        />
                      </div>

                      <div className={styles.formGroup}>
                        <label className={styles.label}>CSAT Score (Satisfaction)</label>
                        {renderStars(csatScore, setCsatScore)}
                      </div>

                      <div className={styles.formGroup}>
                        <label className={styles.label}>Customer Feedback Comments</label>
                        <textarea
                          className={styles.textarea}
                          placeholder="What did the customer say during check-in?"
                          value={feedback}
                          onChange={(e) => setFeedback(e.target.value)}
                        />
                      </div>

                      <div className={styles.formGroup}>
                        <label className={styles.label}>Internal Notes</label>
                        <textarea
                          className={styles.textarea}
                          placeholder="e.g. Scheduled a maintenance check, pitched AMC packages..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                        />
                      </div>

                      <Button
                        type="submit"
                        variant="primary"
                        disabled={submitting}
                      >
                        {submitting ? 'Saving Log...' : 'Save Check-in Log'}
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
