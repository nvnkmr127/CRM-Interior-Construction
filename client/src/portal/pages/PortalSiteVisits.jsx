import { useState, useEffect } from 'react';
import api from '../../api/axios';
import styles from './PortalDocuments.module.css'; // Reusing some base styling patterns

export default function PortalSiteVisits() {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedVisit, setExpandedVisit] = useState(null);

  const fetchVisits = async () => {
    try {
      setLoading(true);
      const res = await api.get('/portal/project/site-visits');
      setVisits(res.data.data || []);
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
    if (!window.confirm('Are you sure you want to acknowledge these outcomes?')) return;
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
        <div style={{padding: 24, textAlign: 'center'}}>Loading site visits...</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Site Visits</h1>
        <div className={styles.pageSub}>View upcoming visits and review formal outcomes of completed visits.</div>
      </div>

      {visits.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}>No Site Visits Found</div>
          <div style={{color:'var(--color-text-secondary)', fontSize:'var(--text-sm)'}}>There are no scheduled or past site visits to display.</div>
        </div>
      ) : (
        <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
          {visits.map(visit => {
            const isCompleted = visit.status === 'completed';
            const isAcknowledged = !!visit.client_acknowledged_at;
            const isExpanded = expandedVisit === visit.id;

            return (
              <div key={visit.id} style={{
                background: 'var(--color-surface)',
                borderRadius: 12,
                border: '1px solid var(--color-border)',
                overflow: 'hidden'
              }}>
                <div style={{
                  padding: 20, 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer'
                }} onClick={() => setExpandedVisit(isExpanded ? null : visit.id)}>
                  <div>
                    <h3 style={{margin: '0 0 8px 0', fontSize: 18}}>{formatDate(visit.scheduled_at)}</h3>
                    <div style={{display: 'flex', gap: 12, alignItems: 'center'}}>
                      <span style={{
                        padding: '4px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500,
                        backgroundColor: isCompleted ? 'var(--color-success-bg)' : 'var(--color-primary-bg)',
                        color: isCompleted ? 'var(--color-success)' : 'var(--color-primary)'
                      }}>
                        {visit.status.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      {isCompleted && isAcknowledged && (
                        <span style={{fontSize: 12, color: 'var(--color-success)'}}>✓ Acknowledged</span>
                      )}
                      {isCompleted && !isAcknowledged && (
                        <span style={{fontSize: 12, color: '#856404', backgroundColor: '#fff3cd', padding: '4px 8px', borderRadius: 4}}>
                          Pending Acknowledgement
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span style={{color: 'var(--color-primary)', fontWeight: 500}}>
                      {isExpanded ? 'Hide Details' : 'View Details'}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{
                    padding: 20, 
                    borderTop: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg-subtle)'
                  }}>
                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24}}>
                      <div>
                        <h4 style={{margin: '0 0 8px 0', fontSize: 14, color: 'var(--color-text-secondary)'}}>Supervisor</h4>
                        <p style={{margin: 0}}>{visit.assignee_name || 'Unassigned'}</p>
                      </div>
                      <div>
                        <h4 style={{margin: '0 0 8px 0', fontSize: 14, color: 'var(--color-text-secondary)'}}>Agenda</h4>
                        <p style={{margin: 0, whiteSpace: 'pre-wrap'}}>{visit.agenda || 'No agenda provided.'}</p>
                      </div>
                    </div>

                    {isCompleted && (
                      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24}}>
                        <div>
                          <h4 style={{margin: '0 0 8px 0', fontSize: 14, color: 'var(--color-text-secondary)'}}>Visit Notes</h4>
                          <p style={{margin: 0, whiteSpace: 'pre-wrap'}}>{visit.notes || 'No notes recorded.'}</p>
                        </div>
                        <div>
                          <h4 style={{margin: '0 0 8px 0', fontSize: 14, color: 'var(--color-text-secondary)'}}>Next Steps / Action Items</h4>
                          <p style={{margin: 0, whiteSpace: 'pre-wrap'}}>{visit.next_steps || 'No next steps recorded.'}</p>
                        </div>
                      </div>
                    )}

                    {isCompleted && !isAcknowledged && (
                      <div style={{marginTop: 16, textAlign: 'right'}}>
                        <button 
                          onClick={() => handleAcknowledge(visit.id)}
                          style={{
                            padding: '10px 20px', 
                            backgroundColor: 'var(--color-success)', 
                            color: 'white',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                        >
                          ✓ Acknowledge Outcomes
                        </button>
                      </div>
                    )}
                    {isCompleted && isAcknowledged && (
                      <div style={{marginTop: 16, textAlign: 'right', fontSize: 14, color: 'var(--color-success)'}}>
                        Acknowledged by {visit.client_acknowledged_by} on {new Date(visit.client_acknowledged_at).toLocaleString('en-IN')}
                      </div>
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
