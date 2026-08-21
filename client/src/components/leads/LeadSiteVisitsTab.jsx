/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';
import { useConfirm } from '../../store/confirmContext';
import { Button, Badge, Input, Textarea, Modal } from '../ui';
import styles from './LeadSiteVisitsTab.module.css';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

export default function LeadSiteVisitsTab({ leadId, onLeadUpdated }) {
  const toast = useToast();
  const { confirm } = useConfirm();
  
  const parseChecklist = (checklist) => {
    if (!checklist) return [];
    if (typeof checklist === 'string') {
      try {
        const parsed = JSON.parse(checklist);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }
    return Array.isArray(checklist) ? checklist : [];
  };

  const [siteVisits, setSiteVisits] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State - Schedule Visit
  const [form, setForm] = useState({
    date: '',
    time: '',
    assignee_id: '',
    notes: '',
    client_invited: false,
    checklist: ['Confirm layout alignments', 'Verify electrical points', 'Check plumbing and levels']
  });
  const [newChecklistItem, setNewChecklistItem] = useState('');

  // Outcomes State
  const [outcomesVisitId, setOutcomesVisitId] = useState(null);
  const [outcomesForm, setOutcomesForm] = useState({
    status: 'completed',
    notes: '',
    client_feedback: '',
    next_steps: '',
    completed_at: ''
  });

  const fetchSiteVisits = async () => {
    try {
      const res = await api.get(`/site-visits/lead/${leadId}`);
      if (res.data.success) {
        setSiteVisits(res.data.data || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load site visits');
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users?limit=100');
      if (res.data.success) {
        setUsers(res.data.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchSiteVisits(), fetchUsers()])
      .finally(() => setLoading(false));
  }, [leadId]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.date || !form.time) {
      toast.error('Date and time are required.');
      return;
    }

    setSubmitting(true);
    try {
      const scheduledAt = new Date(`${form.date}T${form.time}`).toISOString();
      const payload = {
        scheduled_at: scheduledAt,
        assignee_id: form.assignee_id || null,
        notes: form.notes,
        client_invited: form.client_invited,
        checklist: form.checklist
      };

      const res = await api.post(`/site-visits/lead/${leadId}`, payload);
      if (res.data.success) {
        toast.success('Site visit scheduled successfully');
        setShowForm(false);
        setForm({
          date: '',
          time: '',
          assignee_id: '',
          notes: '',
          client_invited: false,
          checklist: ['Confirm layout alignments', 'Verify electrical points', 'Check plumbing and levels']
        });
        fetchSiteVisits();
        if (onLeadUpdated) onLeadUpdated();
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to schedule site visit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleChecklistItem = async (visit, index) => {
    try {
      const updatedChecklist = [...parseChecklist(visit.checklist)];
      if (typeof updatedChecklist[index] === 'string') {
        updatedChecklist[index] = { text: updatedChecklist[index], completed: true };
      } else {
        updatedChecklist[index] = { 
          ...updatedChecklist[index], 
          completed: !updatedChecklist[index].completed 
        };
      }

      const res = await api.patch(`/site-visits/${visit.id}`, { checklist: updatedChecklist });
      if (res.data.success) {
        setSiteVisits(prev => prev.map(v => v.id === visit.id ? { ...v, checklist: updatedChecklist } : v));
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update checklist item');
    }
  };

  const handleAddChecklistItem = async (visit, text) => {
    if (!text.trim()) return;
    try {
      const updatedChecklist = [...parseChecklist(visit.checklist)];
      updatedChecklist.push({ text: text.trim(), completed: false });

      const res = await api.patch(`/site-visits/${visit.id}`, { checklist: updatedChecklist });
      if (res.data.success) {
        setSiteVisits(prev => prev.map(v => v.id === visit.id ? { ...v, checklist: updatedChecklist } : v));
        toast.success('Checklist item added');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to add checklist item');
    }
  };

  const handleDelete = async (visitId) => {
    const isConfirmed = await confirm({
      title: 'Delete Site Visit',
      message: 'Are you sure you want to delete this scheduled site visit?',
      confirmText: 'Delete',
      isDanger: true
    });
    if (!isConfirmed) return;

    try {
      const res = await api.delete(`/site-visits/${visitId}`);
      if (res.data.success) {
        setSiteVisits(prev => prev.filter(v => v.id !== visitId));
        toast.success('Site visit deleted');
        if (onLeadUpdated) onLeadUpdated();
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete site visit');
    }
  };

  const handleOpenOutcomes = (visit) => {
    setOutcomesVisitId(visit.id);
    setOutcomesForm({
      status: visit.status || 'completed',
      notes: visit.notes || '',
      client_feedback: visit.client_feedback || '',
      next_steps: visit.next_steps || '',
      completed_at: visit.completed_at ? new Date(visit.completed_at).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)
    });
  };

  const handleSaveOutcomes = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        status: outcomesForm.status,
        notes: outcomesForm.notes,
        client_feedback: outcomesForm.client_feedback,
        next_steps: outcomesForm.next_steps,
        completed_at: outcomesForm.status === 'completed' ? new Date(outcomesForm.completed_at).toISOString() : null
      };

      const res = await api.patch(`/site-visits/${outcomesVisitId}`, payload);
      if (res.data.success) {
        toast.success('Site visit outcomes updated');
        setOutcomesVisitId(null);
        fetchSiteVisits();
        if (onLeadUpdated) onLeadUpdated();
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to save outcomes');
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500 font-medium animate-pulse">Loading site visits...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleContainer}>
          <h3 className={styles.title}>
            <span>📍</span> Site Visits Registry
          </h3>
          <p className={styles.subtitle}>Schedule and log physical layout checks and measurements.</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className={styles.addBtn}
          >
            <span>+</span> Schedule Visit
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className={styles.formContainer}>
          <div className={styles.formHeader}>
            <h4 className={styles.formTitle}>📅 New Site Visit Details</h4>
            <button 
              type="button" 
              onClick={() => setShowForm(false)} 
              className={styles.closeFormBtn}
            >
              &times;
            </button>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Date *</label>
              <input
                type="date"
                required
                className={styles.formInput}
                value={form.date}
                onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Time *</label>
              <DatePicker
                selected={form.time ? new Date(`2000-01-01T${form.time}`) : null}
                onChange={(date) => {
                  if (date) {
                    const hours = date.getHours().toString().padStart(2, '0');
                    const minutes = date.getMinutes().toString().padStart(2, '0');
                    setForm(prev => ({ ...prev, time: `${hours}:${minutes}` }));
                  } else {
                    setForm(prev => ({ ...prev, time: '' }));
                  }
                }}
                showTimeSelect
                showTimeSelectOnly
                timeIntervals={15}
                timeCaption="Time"
                dateFormat="h:mm aa"
                placeholderText="Select time"
                className={styles.formInput}
                required
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Assign Executive</label>
            <select
              value={form.assignee_id}
              onChange={e => setForm(prev => ({ ...prev, assignee_id: e.target.value }))}
              className={styles.formSelect}
            >
              <option value="">Select Assignee</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role || 'Personnel'})</option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Preparation Notes</label>
            <Textarea
              rows={2}
              placeholder="Provide instructions, checklist items, or site location details..."
              value={form.notes}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>

          <label className={styles.checkboxContainer}>
            <input
              type="checkbox"
              className={styles.formCheckbox}
              checked={form.client_invited}
              onChange={e => setForm(prev => ({ ...prev, client_invited: e.target.checked }))}
            />
            <span className={styles.checkboxLabel}>
              Client Invited (Send calendar invites and reminders)
            </span>
          </label>

          <div className={styles.formActions}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              {submitting ? 'Scheduling...' : 'Schedule Visit'}
            </Button>
          </div>
        </form>
      )}

      <div className={styles.list}>
        {siteVisits.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>📍</span>
            <h4 className={styles.emptyTitle}>No site visits scheduled yet</h4>
            <p className={styles.emptySubtitle}>Get accurate dimensions and address layouts before presenting quotes to the customer.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForm(true)}
              className={styles.emptyBtn}
            >
              Schedule First Visit
            </Button>
          </div>
        ) : (
          siteVisits.map(visit => {
            const formattedDate = new Date(visit.scheduled_at).toLocaleDateString('en-IN', {
              weekday: 'short',
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            });
            const formattedTime = new Date(visit.scheduled_at).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            });

            const statusClass = 
              visit.status === 'completed' ? styles.completed :
              visit.status === 'checked_in' ? styles.checked_in :
              visit.status === 'cancelled' ? styles.cancelled :
              styles.scheduled;

            return (
              <div key={visit.id} className={styles.card}>
                <div className={styles.cardBorderIndicator}></div>

                <div className={styles.cardHeader}>
                  <div className={styles.cardTitleInfo}>
                    <div className={styles.cardTitleWrapper}>
                      <h3 className={styles.cardTitle}>{formattedDate} at {formattedTime}</h3>
                      <span className={`${styles.badge} ${statusClass}`}>
                        {visit.status === 'completed' ? 'Completed' :
                         visit.status === 'checked_in' ? 'Checked In' :
                         visit.status === 'cancelled' ? 'Cancelled' :
                         'Scheduled'}
                      </span>
                    </div>
                    <div className={styles.cardMeta}>
                      <div className={styles.metaItem}>
                        <span>👤 Assignee:</span>
                        <span className="font-semibold text-gray-700">{visit.assignee_name || 'Unassigned'}</span>
                      </div>
                      {visit.client_invited && (
                        <div className={styles.metaItem}>
                          <span className={styles.clientBadge}>
                            Client Invited
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={styles.cardActions}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenOutcomes(visit)}
                    >
                      Update Outcome
                    </Button>
                    <button
                      onClick={() => handleDelete(visit.id)}
                      className={styles.deleteBtn}
                      title="Delete site visit"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {visit.notes && (
                  <div className={styles.notesSection}>
                    <span className={styles.notesLabel}>Preparation Notes</span>
                    {visit.notes}
                  </div>
                )}

                {/* Outcomes Details if Logged */}
                {(visit.client_feedback || visit.next_steps) && (
                  <div className={styles.outcomesGrid}>
                    {visit.client_feedback && (
                      <div className={`${styles.outcomeBox} ${styles.feedback}`}>
                        <span className={`${styles.outcomeLabel} ${styles.feedback}`}>Client Feedback</span>
                        <p className="text-gray-700 m-0">{visit.client_feedback}</p>
                      </div>
                    )}
                    {visit.next_steps && (
                      <div className={`${styles.outcomeBox} ${styles.nextSteps}`}>
                        <span className={`${styles.outcomeLabel} ${styles.nextSteps}`}>Next Steps</span>
                        <p className="text-gray-700 m-0">{visit.next_steps}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Interactive Checklist */}
                <div className={styles.checklistSection}>
                  <span className={styles.checklistTitle}>Checklist &amp; Steps</span>
                  <div className={styles.checklistList}>
                    {parseChecklist(visit.checklist).map((item, idx) => {
                      const text = typeof item === 'string' ? item : item.text;
                      const completed = typeof item === 'string' ? false : !!item.completed;

                      return (
                        <label key={idx} className={styles.checklistLabel}>
                          <input
                            type="checkbox"
                            checked={completed}
                            onChange={() => handleToggleChecklistItem(visit, idx)}
                            className={styles.checklistInput}
                          />
                          <span className={`${styles.checklistText} ${completed ? styles.completed : ''}`}>{text}</span>
                        </label>
                      );
                    })}
                  </div>

                  <div className={styles.addChecklistWrapper}>
                    <input
                      type="text"
                      placeholder="Add checklist task..."
                      className={styles.formInput}
                      style={{ padding: '6px 10px', fontSize: '11px', width: '100%' }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          handleAddChecklistItem(visit, e.target.value);
                          e.target.value = '';
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Outcome Modal Form */}
      {outcomesVisitId && (
        <Modal
          isOpen={!!outcomesVisitId}
          onClose={() => setOutcomesVisitId(null)}
          title="Update Site Visit Outcome"
        >
          <form onSubmit={handleSaveOutcomes} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Status</label>
              <select
                value={outcomesForm.status}
                onChange={e => setOutcomesForm(prev => ({ ...prev, status: e.target.value }))}
                className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="scheduled">Scheduled</option>
                <option value="checked_in">Checked In</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {outcomesForm.status === 'completed' && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Completion Date &amp; Time</label>
                <input
                  type="datetime-local"
                  required
                  className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white outline-none"
                  value={outcomesForm.completed_at}
                  onChange={e => setOutcomesForm(prev => ({ ...prev, completed_at: e.target.value }))}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Notes &amp; Measurements Summary</label>
              <Textarea
                rows={2}
                placeholder="Log layout observations, kitchen sizes, electrical updates, or window layouts..."
                value={outcomesForm.notes}
                onChange={e => setOutcomesForm(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Customer Feedback</label>
              <Textarea
                rows={2}
                placeholder="What did the customer say or request during the visit?"
                value={outcomesForm.client_feedback}
                onChange={e => setOutcomesForm(prev => ({ ...prev, client_feedback: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Next Steps &amp; Action items</label>
              <Textarea
                rows={2}
                placeholder="E.g., Designer to update initial 3D model, send plumbing layout..."
                value={outcomesForm.next_steps}
                onChange={e => setOutcomesForm(prev => ({ ...prev, next_steps: e.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOutcomesVisitId(null)}
              >
                Close
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                Save Outcome
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
