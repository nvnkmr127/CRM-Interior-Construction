/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import api from '../../api/axios';
import styles from './PortalSiteVisits.module.css';
import { useConfirm } from '../../store/confirmContext';

export default function PortalSiteVisits() {
  const { confirm } = useConfirm();

  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedVisit, setExpandedVisit] = useState(null);

  const fetchVisits = async () => {
    try {
      setLoading(true);
      const res = await api.get('/portal/project/site-visits');
      setVisits(res.data?.data || res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisits();
  }, []);

  const handleAcknowledge = async (visitId) => {
    if (!await confirm('Are you sure you want to acknowledge these site visit outcomes?')) return;
    try {
      await api.post(`/portal/project/site-visits/${visitId}/acknowledge`);
      fetchVisits();
    } catch (err) {
      console.error(err);
      alert('Failed to acknowledge site visit.');
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading site visits...</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Site Visits</h1>
        <div className={styles.pageSub}>View upcoming site visits and review formal outcomes of completed inspections.</div>
      </div>

      {visits.length === 0 ? (
        <div className={styles.emptyState}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📍</div>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-md)', color: 'var(--color-text)' }}>No Site Visits Scheduled</div>
          <div style={{ fontSize: 'var(--text-xs)', marginTop: '4px' }}>There are no scheduled or past site visits to display at this time.</div>
        </div>
      ) : (
        <div className={styles.visitsList}>
          {visits.map(visit => {
            const isCompleted = visit.status === 'completed';
            const isAcknowledged = !!visit.client_acknowledged_at;
            const isExpanded = expandedVisit === visit.id;

            return (
              <div key={visit.id} className={styles.visitCard}>
                <div 
                  className={styles.visitHeader} 
                  onClick={() => setExpandedVisit(isExpanded ? null : visit.id)}
                >
                  <div>
                    <h3 className={styles.visitTitle}>{formatDate(visit.scheduled_at)}</h3>
                    <div className={styles.badgeRow}>
                      <span className={`${styles.statusBadge} ${isCompleted ? styles.completed : styles.pending}`}>
                        {(visit.status || 'scheduled').replace(/_/g, ' ').toUpperCase()}
                      </span>
                      {isCompleted && isAcknowledged && (
                        <span className={styles.ackBadge}>✓ Acknowledged</span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: '18px', color: 'var(--color-text-secondary)' }}>
                    {isExpanded ? '▲' : '▼'}
                  </div>
                </div>

                {isExpanded && (
                  <div className={styles.visitDetails}>
                    {(visit.preparation_notes || visit.notes || visit.agenda) && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Preparation Notes</span>
                        <span className={styles.detailValue}>{visit.preparation_notes || visit.notes || visit.agenda}</span>
                      </div>
                    )}

                    {visit.assignee_name && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Assigned Supervisor</span>
                        <span className={styles.detailValue}>{visit.assignee_name}</span>
                      </div>
                    )}

                    {visit.purpose && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Purpose</span>
                        <span className={styles.detailValue}>{visit.purpose}</span>
                      </div>
                    )}

                    {visit.outcome_summary && visit.outcome_summary !== (visit.preparation_notes || visit.notes) && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Outcome Summary & Next Steps</span>
                        <span className={styles.detailValue}>{visit.outcome_summary}</span>
                      </div>
                    )}

                    {isCompleted && !isAcknowledged && (
                      <button 
                        type="button" 
                        onClick={() => handleAcknowledge(visit.id)}
                        className={styles.ackButton}
                      >
                        Acknowledge Outcomes
                      </button>
                    )}
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
