import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';
import styles from './DelayNotificationsTab.module.css';

export default function DelayNotificationsTab({ projectId }) {
  const toast = useToast();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [sendingId, setSendingId] = useState(null);

  // Inputs mapped by notification id
  const [formInputs, setFormInputs] = useState({});

  useEffect(() => {
    fetchDelayNotifications();
  }, [projectId]);

  const fetchDelayNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/projects/${projectId}/delay-notifications`);
      if (res.data.success) {
        const list = res.data.data || [];
        setNotifications(list);
        
        // Populate form inputs for drafts
        const inputs = {};
        list.filter(dn => dn.status === 'draft').forEach(dn => {
          const revDate = dn.revised_date ? dn.revised_date.split('T')[0] : '';
          inputs[dn.id] = {
            revised_date: revDate,
            reason: dn.reason || '',
            message_draft: dn.message_draft || ''
          };
        });
        setFormInputs(inputs);
      }
    } catch (err) {
      console.error('Failed to fetch delay notifications:', err);
      toast.error('Could not load delay notifications.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (id, field, value) => {
    setFormInputs(prev => {
      const current = prev[id] || { revised_date: '', reason: '', message_draft: '' };
      const updated = { ...current, [field]: value };
      
      // If we change the revised date or reason, we can auto-update the message draft text template
      if (field === 'revised_date' || field === 'reason') {
        const notif = notifications.find(n => n.id === id);
        if (notif) {
          const nameText = notif.type === 'project_delay' ? `final completion date for your project` : `milestone "${notif.milestone_name || 'Work'}"`;
          const origStr = new Date(notif.original_date).toISOString().split('T')[0];
          const newDateStr = field === 'revised_date' ? value : current.revised_date;
          const reasonStr = field === 'reason' ? value : current.reason;

          updated.message_draft = `Dear Client, we would like to inform you that the ${nameText} originally scheduled for completion on ${origStr} has been delayed. The revised expected completion date is now ${newDateStr || '[Date]'}. Reason for delay: ${reasonStr || '[Specify Reason]'}. We apologize for the delay and appreciate your patience.`;
        }
      }
      
      return { ...prev, [id]: updated };
    });
  };

  const handleSaveDraft = async (id) => {
    const inputs = formInputs[id];
    if (!inputs || !inputs.revised_date) {
      toast.error('Revised expected date is required.');
      return;
    }

    try {
      setSavingId(id);
      const res = await api.patch(`/projects/${projectId}/delay-notifications/${id}`, {
        revised_date: inputs.revised_date,
        reason: inputs.reason,
        message_draft: inputs.message_draft
      });
      if (res.data.success) {
        toast.success('Draft updated successfully.');
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, ...res.data.data } : n));
      }
    } catch (err) {
      console.error('Failed to save draft:', err);
      toast.error('Failed to save draft details.');
    } finally {
      setSavingId(null);
    }
  };

  const handleSendNotification = async (id) => {
    const inputs = formInputs[id];
    if (!inputs || !inputs.revised_date) {
      toast.error('Revised expected date is required.');
      return;
    }

    if (!window.confirm('Send this delay update notification to the client?')) return;

    try {
      setSendingId(id);
      // 1. Save draft details first
      await api.patch(`/projects/${projectId}/delay-notifications/${id}`, {
        revised_date: inputs.revised_date,
        reason: inputs.reason,
        message_draft: inputs.message_draft
      });
      
      // 2. Post Send
      const res = await api.post(`/projects/${projectId}/delay-notifications/${id}/send`);
      if (res.data.success) {
        toast.success('Notification sent to client.');
        // Refresh list
        fetchDelayNotifications();
      }
    } catch (err) {
      console.error('Failed to send notification:', err);
      toast.error('Failed to send notification.');
    } finally {
      setSendingId(null);
    }
  };

  const handleDeleteDraft = async (id) => {
    if (!window.confirm('Dismiss and delete this delay notification draft?')) return;

    try {
      const res = await api.delete(`/projects/${projectId}/delay-notifications/${id}`);
      if (res.data.success) {
        toast.success('Draft dismissed.');
        setNotifications(prev => prev.filter(n => n.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete draft:', err);
      toast.error('Failed to delete draft.');
    }
  };

  const getLabel = (notif) => {
    if (notif.type === 'project_delay') {
      return 'Project Delivery Target Date';
    }
    return `Milestone: ${notif.milestone_name || 'Unnamed Milestone'}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const drafts = notifications.filter(n => n.status === 'draft');
  const sentLogs = notifications.filter(n => n.status === 'sent');

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Project Delay & Rescheduling Notifications</h2>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, margin: 0 }}>
        The system automatically scans for overdue milestones and target dates. Missed dates will generate drafts below. Review and authorize sending notifications to update the client.
      </p>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
          Loading delay records...
        </div>
      ) : (
        <>
          {/* Section: Pending Drafts */}
          <div className={styles.sectionHeader}>Pending Delay Notifications (Drafts Queue)</div>
          {drafts.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No missed dates detected. All active milestones are currently on track!</p>
            </div>
          ) : (
            <div className={styles.list}>
              {drafts.map(dn => {
                const inputs = formInputs[dn.id] || { revised_date: '', reason: '', message_draft: '' };
                return (
                  <div key={dn.id} className={styles.card}>
                    <div className={styles.cardHeader}>
                      <div className={styles.headerInfo}>
                        <h3 className={styles.itemTitle}>{getLabel(dn)}</h3>
                        <span className={`${styles.badge} ${styles.draft}`}>
                          Missed Deadline Alert
                        </span>
                      </div>
                    </div>

                    <div className={styles.metaGrid}>
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Original Due Date</span>
                        <span className={styles.metaValue}>{formatDate(dn.original_date)}</span>
                      </div>
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Status</span>
                        <span className={styles.metaValue} style={{ color: 'var(--color-danger)', fontWeight: 600 }}>Overdue</span>
                      </div>
                    </div>

                    <div className={styles.formGrid}>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Revised Expected Completion Date</label>
                        <input
                          type="date"
                          className={styles.input}
                          required
                          value={inputs.revised_date}
                          onChange={e => handleInputChange(dn.id, 'revised_date', e.target.value)}
                        />
                      </div>

                      <div className={styles.formGroup}>
                        <label className={styles.label}>Reason for Delay</label>
                        <input
                          type="text"
                          className={styles.input}
                          placeholder="e.g. Material delivery logistics delayed, Labor shortage, Client layout approvals pending..."
                          value={inputs.reason}
                          onChange={e => handleInputChange(dn.id, 'reason', e.target.value)}
                        />
                      </div>

                      <div className={styles.formGroup}>
                        <label className={styles.label}>Client Communication Message (Draft)</label>
                        <textarea
                          className={styles.textarea}
                          rows={4}
                          value={inputs.message_draft}
                          onChange={e => handleInputChange(dn.id, 'message_draft', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className={styles.cardFooter}>
                      <button
                        className={styles.deleteBtn}
                        onClick={() => handleDeleteDraft(dn.id)}
                      >
                        Dismiss / Delete
                      </button>
                      <button
                        className={styles.saveBtn}
                        onClick={() => handleSaveDraft(dn.id)}
                        disabled={savingId === dn.id}
                      >
                        {savingId === dn.id ? 'Saving...' : 'Save Draft'}
                      </button>
                      <button
                        className={styles.sendBtn}
                        onClick={() => handleSendNotification(dn.id)}
                        disabled={sendingId === dn.id}
                      >
                        {sendingId === dn.id ? 'Sending...' : 'Send Notification'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Section: Sent Logs */}
          <div className={styles.sectionHeader}>Sent Notifications Log (History)</div>
          {sentLogs.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No delay notifications have been sent to the client for this project.</p>
            </div>
          ) : (
            <div className={styles.list}>
              {sentLogs.map(dn => (
                <div key={dn.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <div className={styles.headerInfo}>
                      <h3 className={styles.itemTitle}>{getLabel(dn)}</h3>
                      <span className={`${styles.badge} ${styles.sent}`}>
                        Sent to Client
                      </span>
                    </div>
                  </div>

                  <div className={styles.metaGrid}>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Original Due Date</span>
                      <span className={styles.metaValue}>{formatDate(dn.original_date)}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Revised expected Date</span>
                      <span className={styles.metaValue} style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                        {formatDate(dn.revised_date)}
                      </span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Reason for Delay</span>
                      <span className={styles.metaValue}>{dn.reason}</span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Sent On</span>
                      <span className={styles.metaValue}>{formatDate(dn.sent_at)}</span>
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Sent Message Content</label>
                    <div className={styles.sentMessageArea}>
                      {dn.message_draft}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
