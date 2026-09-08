/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import styles from './CustomerRetentionTab.module.css';
import { getRetentionSchedules, updateRetentionSchedule, generateRetentionSchedules } from '../../api/handover';
import { Button } from '../../components/ui';
import { useToast } from '../../store/toastContext';

export default function CustomerRetentionTab({ projectId, onNavigateTab }) {
  const toast = useToast();

  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedScheduleId, setExpandedScheduleId] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');

  // Form states
  const [status, setStatus] = useState('completed');
  const [actualDate, setActualDate] = useState('');
  const [feedback, setFeedback] = useState('');
  const [csatScore, setCsatScore] = useState(5);
  const [hoverScore, setHoverScore] = useState(0);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getRetentionSchedules(projectId);
      setSchedules(data || []);
      // Auto-expand first scheduled or completed milestone if available
      if (data && data.length > 0) {
        const nextPending = data.find(s => s.status === 'scheduled') || data[0];
        setExpandedScheduleId(nextPending.id);
        initForm(nextPending);
      }
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

  const handleGenerateSchedules = async () => {
    try {
      setGenerating(true);
      await generateRetentionSchedules(projectId, new Date().toISOString());
      toast.success('Customer retention milestones generated successfully.');
      await loadData();
    } catch (err) {
      console.error('[CustomerRetentionTab] Generate error:', err);
      toast.error(err.response?.data?.message || 'Failed to generate retention schedules.');
    } finally {
      setGenerating(false);
    }
  };

  const initForm = (sched) => {
    setStatus(sched.status || 'completed');
    setActualDate(sched.actual_date || new Date().toISOString().split('T')[0]);
    setFeedback(sched.feedback || '');
    setCsatScore(sched.csat_score || 5);
    setHoverScore(0);
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
      await loadData();
    } catch (err) {
      console.error('[CustomerRetentionTab] Update error:', err);
      toast.error(err.response?.data?.message || 'Failed to update retention milestone.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (currentScore, setScore = null, isInteractive = false) => {
    const activeVal = isInteractive && hoverScore > 0 ? hoverScore : currentScore;
    return (
      <div className={styles.starRatingContainer}>
        <div className={styles.starRating}>
          {[1, 2, 3, 4, 5].map((star) => (
            <span
              key={star}
              className={`${styles.star} ${star <= activeVal ? styles.starFilled : ''}`}
              onClick={() => isInteractive && setScore && setScore(star)}
              onMouseEnter={() => isInteractive && setHoverScore(star)}
              onMouseLeave={() => isInteractive && setHoverScore(0)}
            >
              ★
            </span>
          ))}
        </div>
        {isInteractive && (
          <span className={styles.starLabel}>
            {activeVal === 5 && '5 - Exceeded Expectations'}
            {activeVal === 4 && '4 - Satisfied & Happy'}
            {activeVal === 3 && '3 - Neutral / Room for Improvement'}
            {activeVal === 2 && '2 - Dissatisfied'}
            {activeVal === 1 && '1 - Very Unhappy'}
          </span>
        )}
      </div>
    );
  };

  const getStageInfo = (stage) => {
    switch (stage) {
      case '30_day':
        return {
          title: '30-Day Move-in Check-in',
          desc: 'Initial post-handover call to review move-in experience and resolve minor punch items.',
          icon: '🏠',
          tag: 'Handover Review'
        };
      case '90_day':
        return {
          title: '90-Day Quality & Settling Audit',
          desc: 'Quarterly check-in for woodwork expansion, paint touchups, or hardware adjustments.',
          icon: '🛠️',
          tag: 'Defect Check'
        };
      case '180_day':
        return {
          title: '180-Day Mid-Year Polish & Service',
          desc: 'Six-month courtesy check-in and maintenance health assessment.',
          icon: '✨',
          tag: 'Mid-Year Maintenance'
        };
      case '365_day':
        return {
          title: '365-Day Annual Review & AMC Pitch',
          desc: 'Warranty expiration check, overall client satisfaction review, and AMC renewal pitch.',
          icon: '🛡️',
          tag: 'AMC Contract Pitch'
        };
      default:
        return {
          title: stage,
          desc: 'Post-handover customer check-in milestone.',
          icon: '📅',
          tag: 'Retention'
        };
    }
  };

  // Metric computations
  const totalMilestones = schedules.length;
  const completedMilestones = schedules.filter(s => s.status === 'completed').length;
  const ratedSchedules = schedules.filter(s => s.status === 'completed' && s.csat_score !== null && s.csat_score !== undefined);
  const avgCsat = ratedSchedules.length > 0
    ? (ratedSchedules.reduce((acc, s) => acc + Number(s.csat_score), 0) / ratedSchedules.length).toFixed(1)
    : null;

  const getRetentionHealth = () => {
    if (totalMilestones === 0) return { text: 'Not Scheduled', type: 'secondary' };
    if (!avgCsat) return { text: 'Check-in Pending', type: 'info' };
    const score = parseFloat(avgCsat);
    if (score >= 4.5) return { text: 'Strong Loyalty (High NPS)', type: 'success' };
    if (score >= 3.5) return { text: 'Satisfied Client', type: 'info' };
    return { text: 'Retention Risk', type: 'warning' };
  };

  const health = getRetentionHealth();

  const filteredSchedules = schedules.filter(s => {
    if (activeFilter === 'completed') return s.status === 'completed';
    if (activeFilter === 'scheduled') return s.status === 'scheduled';
    if (activeFilter === 'deferred') return s.status === 'deferred' || s.status === 'cancelled';
    return true;
  });

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p>Loading customer retention check-ins...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header Section */}
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Post-Handover Customer Retention</h2>
          <p className={styles.subtitle}>
            Manage post-handover customer relationships, solicit CSAT ratings, track 30/90/180/365-day check-ins, and convert warranty clients into annual AMC subscribers.
          </p>
        </div>
        {totalMilestones === 0 && (
          <Button
            variant="primary"
            onClick={handleGenerateSchedules}
            disabled={generating}
          >
            {generating ? 'Generating Milestones...' : '⚡ Generate Standard 30/90/180/365 Milestones'}
          </Button>
        )}
      </div>

      {/* KPI Overview Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Scheduled Check-ins</span>
          <span className={styles.kpiValue}>{totalMilestones}</span>
          <span className={styles.kpiSubtext}>Standard 1-Year Journey</span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Completed Follow-ups</span>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>{completedMilestones}</span>
            <span className={styles.kpiBadge}>
              {totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0}% Done
            </span>
          </div>
          <span className={styles.kpiSubtext}>{totalMilestones - completedMilestones} check-ins remaining</span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Average CSAT Score</span>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiValue}>{avgCsat !== null ? avgCsat : 'N/A'}</span>
            {avgCsat !== null && (
              <div className={styles.kpiStars}>
                {renderStars(Math.round(parseFloat(avgCsat)))}
              </div>
            )}
          </div>
          <span className={styles.kpiSubtext}>Based on {ratedSchedules.length} rated check-ins</span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Retention Health Index</span>
          <div className={styles.healthStatusRow}>
            <span className={`${styles.healthBadge} ${styles['health_' + health.type]}`}>
              {health.text}
            </span>
          </div>
          <span className={styles.kpiSubtext}>AMC Renewal Potential: High</span>
        </div>
      </div>

      {/* Visual Journey Progress Bar */}
      {schedules.length > 0 && (
        <div className={styles.journeyCard}>
          <h3 className={styles.sectionTitle}>Client Retention Lifecycle</h3>
          <div className={styles.journeyStepper}>
            {['30_day', '90_day', '180_day', '365_day'].map((stageKey, idx) => {
              const sched = schedules.find(s => s.stage === stageKey);
              const isDone = sched?.status === 'completed';
              const isCurrent = sched?.status === 'scheduled';
              const info = getStageInfo(stageKey);

              return (
                <div
                  key={stageKey}
                  className={`${styles.stepItem} ${isDone ? styles.stepDone : ''} ${isCurrent ? styles.stepCurrent : ''}`}
                  onClick={() => sched && handleToggleExpand(sched)}
                >
                  <div className={styles.stepHeader}>
                    <div className={styles.stepCircle}>{isDone ? '✓' : idx + 1}</div>
                    {idx < 3 && <div className={`${styles.stepConnector} ${isDone ? styles.connectorActive : ''}`} />}
                  </div>
                  <span className={styles.stepIcon}>{info.icon}</span>
                  <span className={styles.stepStageName}>{info.tag}</span>
                  <span className={styles.stepStatusText}>
                    {sched ? (sched.status.charAt(0).toUpperCase() + sched.status.slice(1)) : 'Pending'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      {schedules.length > 0 && (
        <div className={styles.filterRow}>
          <div className={styles.filterTabs}>
            <button
              className={`${styles.filterBtn} ${activeFilter === 'all' ? styles.filterBtnActive : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              All Milestones ({schedules.length})
            </button>
            <button
              className={`${styles.filterBtn} ${activeFilter === 'scheduled' ? styles.filterBtnActive : ''}`}
              onClick={() => setActiveFilter('scheduled')}
            >
              Scheduled ({schedules.filter(s => s.status === 'scheduled').length})
            </button>
            <button
              className={`${styles.filterBtn} ${activeFilter === 'completed' ? styles.filterBtnActive : ''}`}
              onClick={() => setActiveFilter('completed')}
            >
              Completed ({schedules.filter(s => s.status === 'completed').length})
            </button>
            <button
              className={`${styles.filterBtn} ${activeFilter === 'deferred' ? styles.filterBtnActive : ''}`}
              onClick={() => setActiveFilter('deferred')}
            >
              Deferred / Cancelled ({schedules.filter(s => s.status === 'deferred' || s.status === 'cancelled').length})
            </button>
          </div>
        </div>
      )}

      {/* Timeline Section */}
      {schedules.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🔄</div>
          <h3>No Customer Retention Milestones Found</h3>
          <p>Post-handover retention follow-ups help maintain client relationships, gather CSAT feedback, and pitch AMC maintenance contracts.</p>
          <Button
            variant="primary"
            onClick={handleGenerateSchedules}
            disabled={generating}
          >
            {generating ? 'Generating Milestones...' : 'Initialize Retention Journey'}
          </Button>
        </div>
      ) : (
        <div className={styles.timeline}>
          {filteredSchedules.map((sched) => {
            const isExpanded = expandedScheduleId === sched.id;
            const info = getStageInfo(sched.stage);
            const isAmcStage = sched.stage === '365_day';

            return (
              <div
                key={sched.id}
                className={`${styles.milestoneCard} ${styles['cardAccent_' + sched.status]} ${isExpanded ? styles.milestoneCardExpanded : ''}`}
              >
                {/* Milestone Header */}
                <div
                  className={styles.milestoneHeader}
                  onClick={() => handleToggleExpand(sched)}
                >
                  <div className={styles.milestoneHeaderLeft}>
                    <span className={styles.stageIcon}>{info.icon}</span>
                    <div>
                      <div className={styles.milestoneTitleRow}>
                        <h3 className={styles.milestoneTitle}>{info.title}</h3>
                        <span className={styles.tagBadge}>{info.tag}</span>
                      </div>
                      <p className={styles.milestoneDescription}>{info.desc}</p>
                    </div>
                  </div>

                  <div className={styles.milestoneHeaderRight}>
                    <div className={styles.dateBlock}>
                      <span className={styles.dateLabel}>Scheduled Date</span>
                      <span className={styles.dateValue}>
                        {new Date(sched.scheduled_date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                    <span className={`${styles.badge} ${styles['badge_' + sched.status]}`}>
                      {sched.status}
                    </span>
                    <button className={styles.expandToggleBtn} type="button">
                      {isExpanded ? '▲' : '▼'}
                    </button>
                  </div>
                </div>

                {/* Milestone Body */}
                {isExpanded && (
                  <div className={styles.milestoneBody}>
                    {/* AMC Opportunity Callout Banner for 365 Day stage */}
                    {isAmcStage && (
                      <div className={styles.amcCallout}>
                        <div className={styles.amcCalloutContent}>
                          <span className={styles.amcIcon}>🛡️</span>
                          <div>
                            <h4 className={styles.amcTitle}>Annual AMC Contract Pitch Target</h4>
                            <p className={styles.amcDesc}>
                              This 365-day check-in marks the end of standard warranty. Pitch an annual maintenance contract (AMC) package to convert this project into recurring revenue.
                            </p>
                          </div>
                        </div>
                        {onNavigateTab && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onNavigateTab('AMCs')}
                          >
                            Open AMCs Tab →
                          </Button>
                        )}
                      </div>
                    )}

                    <div className={styles.bodyGrid}>
                      {/* Left: Saved Outcome View */}
                      <div className={styles.outcomeView}>
                        <div className={styles.outcomeHeader}>
                          <h4 className={styles.sectionHeaderTitle}>Recorded Check-in Details</h4>
                          {sched.actual_date && (
                            <span className={styles.completedTag}>
                              Completed on {new Date(sched.actual_date).toLocaleDateString('en-IN')}
                            </span>
                          )}
                        </div>

                        <div className={styles.outcomeGrid}>
                          <div className={styles.outcomeField}>
                            <span className={styles.outcomeLabel}>Client Satisfaction Rating</span>
                            <div className={styles.csatDisplayRow}>
                              {sched.csat_score ? (
                                <>
                                  {renderStars(sched.csat_score)}
                                  <span className={styles.csatScoreBadge}>{sched.csat_score} / 5</span>
                                </>
                              ) : (
                                <span className={styles.placeholderText}>Not rated yet</span>
                              )}
                            </div>
                          </div>

                          <div className={styles.outcomeField}>
                            <span className={styles.outcomeLabel}>Actual Follow-up Date</span>
                            <span className={styles.outcomeValue}>
                              {sched.actual_date ? new Date(sched.actual_date).toLocaleDateString('en-IN') : 'Call not recorded'}
                            </span>
                          </div>

                          <div className={`${styles.outcomeField} ${styles.fullWidthField}`}>
                            <span className={styles.outcomeLabel}>Client Feedback & Verbal Response</span>
                            <div className={styles.feedbackQuoteBox}>
                              {sched.feedback ? (
                                <p className={styles.quoteText}>"{sched.feedback}"</p>
                              ) : (
                                <span className={styles.placeholderText}>No client feedback comments recorded.</span>
                              )}
                            </div>
                          </div>

                          <div className={`${styles.outcomeField} ${styles.fullWidthField}`}>
                            <span className={styles.outcomeLabel}>Internal PM / CS Notes</span>
                            <div className={styles.notesBox}>
                              {sched.notes ? (
                                <p>{sched.notes}</p>
                              ) : (
                                <span className={styles.placeholderText}>No internal check-in notes logged.</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right: Update Form Section */}
                      <form onSubmit={(e) => handleSubmit(e, sched.id)} className={styles.formSection}>
                        <h4 className={styles.sectionHeaderTitle}>Update / Log Follow-up Outcome</h4>

                        <div className={styles.formGroup}>
                          <label className={styles.label}>Milestone Status</label>
                          <select
                            className={styles.select}
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                          >
                            <option value="scheduled">Scheduled (Pending)</option>
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
                          <label className={styles.label}>Customer CSAT Rating</label>
                          {renderStars(csatScore, setCsatScore, true)}
                        </div>

                        <div className={styles.formGroup}>
                          <label className={styles.label}>Client Feedback Comments</label>
                          <textarea
                            className={styles.textarea}
                            placeholder="Key comments, compliments, or issues expressed by the client during call..."
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                          />
                        </div>

                        <div className={styles.formGroup}>
                          <label className={styles.label}>Internal Action Notes</label>
                          <textarea
                            className={styles.textarea}
                            placeholder="Follow-up action items, service tickets raised, AMC pitch details..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                          />
                        </div>

                        <div className={styles.formActions}>
                          <Button
                            type="submit"
                            variant="primary"
                            disabled={submitting}
                          >
                            {submitting ? 'Saving Log...' : 'Save Retention Log'}
                          </Button>
                        </div>
                      </form>
                    </div>
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
