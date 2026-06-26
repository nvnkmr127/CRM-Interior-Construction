import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { usersApi } from '../../api/users';
import { useToast } from '../../store/toastContext';
import styles from './SiteVisitsTab.module.css';

export default function SiteVisitsTab({ projectId }) {
  const toast = useToast();
  const [siteVisits, setSiteVisits] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isOutcomesOpen, setIsOutcomesOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [editingVisit, setEditingVisit] = useState(null);

  // Expanded Cards (to load photos/details)
  const [expandedVisitId, setExpandedVisitId] = useState(null);
  const [visitPhotos, setVisitPhotos] = useState({});
  const [loadingPhotos, setLoadingPhotos] = useState({});

  // Lightbox zoom view
  const [lightboxPhoto, setLightboxPhoto] = useState(null);

  // Form State - Schedule Visit
  const [scheduleForm, setScheduleForm] = useState({
    date: '',
    time: '',
    assignee_id: '',
    notes: '',
    client_invited: false,
    checklist: ['Confirm layout alignments', 'Verify electrical points', 'Check plumbing and levels']
  });
  const [newChecklistItem, setNewChecklistItem] = useState('');

  // Form State - Outcomes Form
  const [outcomesForm, setOutcomesForm] = useState({
    status: 'completed',
    notes: '',
    client_feedback: '',
    completed_at: ''
  });

  // Photo uploading state
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoCaption, setPhotoCaption] = useState('');

  useEffect(() => {
    fetchSiteVisits();
    fetchUsers();
  }, [projectId]);

  const fetchSiteVisits = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/site-visits/project/${projectId}`);
      if (res.data.success) {
        setSiteVisits(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch site visits:', err);
      toast.error('Could not load site visits.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await usersApi.getAll({ limit: 100 });
      setUsers(data || []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const fetchPhotos = async (visitId) => {
    try {
      setLoadingPhotos(prev => ({ ...prev, [visitId]: true }));
      const res = await api.get(`/site-visits/${visitId}/photos`);
      if (res.data.success) {
        setVisitPhotos(prev => ({ ...prev, [visitId]: res.data.data || [] }));
      }
    } catch (err) {
      console.error('Failed to fetch photos:', err);
    } finally {
      setLoadingPhotos(prev => ({ ...prev, [visitId]: false }));
    }
  };

  const handleExpandVisit = (visitId) => {
    if (expandedVisitId === visitId) {
      setExpandedVisitId(null);
    } else {
      setExpandedVisitId(visitId);
      if (!visitPhotos[visitId]) {
        fetchPhotos(visitId);
      }
    }
  };

  const handleOpenSchedule = (visit = null) => {
    if (visit) {
      // Edit mode
      setEditingVisit(visit);
      const scheduledDate = new Date(visit.scheduled_at);
      const dateStr = scheduledDate.toISOString().split('T')[0];
      const timeStr = scheduledDate.toTimeString().split(' ')[0].substring(0, 5);

      setScheduleForm({
        date: dateStr,
        time: timeStr,
        assignee_id: visit.assignee_id || '',
        notes: visit.notes || '',
        client_invited: visit.client_invited || false,
        checklist: (visit.checklist || []).map(item => typeof item === 'string' ? item : item.text)
      });
    } else {
      // Create mode
      setEditingVisit(null);
      setScheduleForm({
        date: '',
        time: '',
        assignee_id: '',
        notes: '',
        client_invited: false,
        checklist: ['Confirm layout alignments', 'Verify electrical points', 'Check plumbing and levels']
      });
    }
    setIsScheduleOpen(true);
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    if (!scheduleForm.date || !scheduleForm.time) {
      toast.error('Date and time are required.');
      return;
    }

    const scheduledAt = new Date(`${scheduleForm.date}T${scheduleForm.time}`).toISOString();
    const payload = {
      scheduled_at: scheduledAt,
      assignee_id: scheduleForm.assignee_id || null,
      notes: scheduleForm.notes,
      client_invited: scheduleForm.client_invited,
      checklist: scheduleForm.checklist.map(item => ({ text: item, completed: false }))
    };

    try {
      if (editingVisit) {
        // Edit Visit
        const res = await api.patch(`/site-visits/${editingVisit.id}`, payload);
        if (res.data.success) {
          toast.success('Site visit updated.');
          fetchSiteVisits();
        }
      } else {
        // Create Visit
        const res = await api.post(`/site-visits/project/${projectId}`, payload);
        if (res.data.success) {
          toast.success('Site visit scheduled successfully.');
          fetchSiteVisits();
        }
      }
      setIsScheduleOpen(false);
    } catch (err) {
      console.error('Failed to save scheduled site visit:', err);
      toast.error('Failed to schedule site visit.');
    }
  };

  const handleDeleteVisit = async (visitId) => {
    if (!window.confirm('Are you sure you want to cancel and delete this site visit?')) return;

    try {
      const res = await api.delete(`/site-visits/${visitId}`);
      if (res.data.success) {
        toast.success('Site visit cancelled.');
        setSiteVisits(prev => prev.filter(sv => sv.id !== visitId));
      }
    } catch (err) {
      console.error('Failed to delete site visit:', err);
      toast.error('Failed to delete site visit.');
    }
  };

  const toggleChecklistItem = async (visit, index) => {
    const updatedChecklist = (visit.checklist || []).map((item, idx) => {
      if (idx === index) {
        const text = typeof item === 'string' ? item : item.text;
        const completed = typeof item === 'string' ? false : item.completed;
        return { text, completed: !completed };
      }
      return typeof item === 'string' ? { text: item, completed: false } : item;
    });

    try {
      const res = await api.patch(`/site-visits/${visit.id}`, { checklist: updatedChecklist });
      if (res.data.success) {
        setSiteVisits(prev => prev.map(sv => sv.id === visit.id ? { ...sv, checklist: updatedChecklist } : sv));
      }
    } catch (err) {
      console.error('Failed to update checklist:', err);
      toast.error('Failed to update checklist item status.');
    }
  };

  const handleOpenOutcomes = (visit) => {
    setSelectedVisit(visit);
    setOutcomesForm({
      status: visit.status === 'scheduled' ? 'completed' : visit.status,
      notes: visit.notes || '',
      client_feedback: visit.client_feedback || '',
      completed_at: visit.completed_at ? new Date(visit.completed_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    });
    setIsOutcomesOpen(true);
  };

  const handleSaveOutcomes = async (e) => {
    e.preventDefault();
    if (!selectedVisit) return;

    const payload = {
      status: outcomesForm.status,
      notes: outcomesForm.notes,
      client_feedback: outcomesForm.client_feedback,
      completed_at: outcomesForm.status === 'completed' ? new Date(outcomesForm.completed_at).toISOString() : null
    };

    try {
      const res = await api.patch(`/site-visits/${selectedVisit.id}`, payload);
      if (res.data.success) {
        toast.success('Visit outcomes recorded successfully.');
        setIsOutcomesOpen(false);
        fetchSiteVisits();
      }
    } catch (err) {
      console.error('Failed to save outcomes:', err);
      toast.error('Failed to record visit outcomes.');
    }
  };

  const handlePhotoSelect = async (e, visitId) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('caption', photoCaption || file.name);

    try {
      setUploadingPhoto(true);
      const res = await api.post(`/site-visits/${visitId}/photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        toast.success('Photo added to visit log.');
        setPhotoCaption('');
        fetchPhotos(visitId);
      }
    } catch (err) {
      console.error('Photo upload failed:', err);
      toast.error(err.response?.data?.error?.message || 'Failed to upload photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async (visitId, photoId) => {
    if (!window.confirm('Delete this photo from the visit log?')) return;

    try {
      const res = await api.delete(`/site-visits/${visitId}/photos/${photoId}`);
      if (res.data.success) {
        toast.success('Photo deleted.');
        fetchPhotos(visitId);
      }
    } catch (err) {
      console.error('Photo deletion failed:', err);
      toast.error('Failed to delete photo.');
    }
  };

  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    setScheduleForm(prev => ({
      ...prev,
      checklist: [...prev.checklist, newChecklistItem.trim()]
    }));
    setNewChecklistItem('');
  };

  const removeChecklistItem = (index) => {
    setScheduleForm(prev => ({
      ...prev,
      checklist: prev.checklist.filter((_, i) => i !== index)
    }));
  };

  const getStatusLabel = (status) => {
    return status.replace(/_/g, ' ');
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Project Site Visits</h2>
        <button className={styles.addBtn} onClick={() => handleOpenSchedule(null)}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          Schedule Site Visit
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
          Loading site visits...
        </div>
      ) : siteVisits.length === 0 ? (
        <div className={styles.emptyState}>
          <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: 12, opacity: 0.5 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          <p>No site visits scheduled for this project yet.</p>
          <button className={styles.addBtn} style={{ margin: '12px auto 0' }} onClick={() => handleOpenSchedule(null)}>
            Schedule First Visit
          </button>
        </div>
      ) : (
        <div className={styles.list}>
          {siteVisits.map((visit) => {
            const isExpanded = expandedVisitId === visit.id;
            const photos = visitPhotos[visit.id] || [];
            return (
              <div key={visit.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitleInfo}>
                    <h3 className={styles.cardTitle}>{formatDate(visit.scheduled_at)}</h3>
                    <div className={styles.cardMeta}>
                      <div className={styles.metaItem}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span>Supervisor: {visit.assignee_name || 'Unassigned'}</span>
                      </div>
                      <div className={styles.metaItem}>
                        <span className={`${styles.badge} ${styles[visit.status]}`}>
                          {getStatusLabel(visit.status)}
                        </span>
                      </div>
                      <div className={styles.metaItem}>
                        <span className={`${styles.clientBadge} ${visit.client_invited ? styles.invited : ''}`}>
                          {visit.client_invited ? 'Client Invited' : 'Internal Only'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button className={styles.editBtn} onClick={() => handleExpandVisit(visit.id)}>
                    {isExpanded ? 'Hide Details' : 'View Details & Photos'}
                  </button>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: 16 }}>
                    <div className={styles.sectionDivider} />
                    
                    {/* Checklist/Agenda */}
                    <div className={styles.agendaSection}>
                      <div className={styles.sectionLabel}>Agenda & Checklist</div>
                      {(!visit.checklist || visit.checklist.length === 0) ? (
                        <p className={styles.emptyText}>No checklist items defined.</p>
                      ) : (
                        <div className={styles.agendaList}>
                          {visit.checklist.map((item, idx) => {
                            const text = typeof item === 'string' ? item : item.text;
                            const completed = typeof item === 'string' ? false : item.completed;
                            return (
                              <label key={idx} className={styles.checkboxLabel}>
                                <input
                                  type="checkbox"
                                  className={styles.agendaCheckbox}
                                  checked={completed}
                                  onChange={() => toggleChecklistItem(visit, idx)}
                                  disabled={visit.status === 'cancelled'}
                                />
                                <span className={`${styles.agendaItemText} ${completed ? styles.completed : ''}`}>
                                  {text}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className={styles.sectionDivider} />

                    {/* Visit Notes & Client Feedback */}
                    <div className={styles.notesGrid}>
                      <div className={styles.notesBox}>
                        <div className={styles.sectionLabel}>Visit / Inspection Notes</div>
                        {visit.notes ? (
                          <div className={styles.notesText}>{visit.notes}</div>
                        ) : (
                          <p className={styles.emptyText}>No notes recorded.</p>
                        )}
                      </div>
                      
                      <div className={styles.notesBox}>
                        <div className={styles.sectionLabel}>Client Feedback</div>
                        {visit.client_feedback ? (
                          <div className={styles.notesText}>{visit.client_feedback}</div>
                        ) : (
                          <p className={styles.emptyText}>No client feedback recorded.</p>
                        )}
                      </div>
                    </div>

                    <div className={styles.sectionDivider} />

                    {/* Photos Gallery */}
                    <div className={styles.photosSection}>
                      <div className={styles.sectionLabel}>Photo Log</div>
                      {loadingPhotos[visit.id] ? (
                        <p className={styles.emptyText}>Loading photos...</p>
                      ) : (
                        <div className={styles.photosGrid}>
                          {photos.map(p => (
                            <div key={p.id} className={styles.photoWrapper}>
                              <img
                                src={p.url || p.file_url}
                                className={styles.photoImg}
                                alt={p.caption || 'Site Photo'}
                                onClick={() => setLightboxPhoto(p)}
                              />
                              <button
                                className={styles.photoDeleteOverlay}
                                title="Delete Photo"
                                onClick={() => handleDeletePhoto(visit.id, p.id)}
                              >
                                &times;
                              </button>
                              {p.caption && <span className={styles.photoCaption}>{p.caption}</span>}
                            </div>
                          ))}
                          {visit.status !== 'cancelled' && (
                            <label className={styles.uploadTriggerBtn}>
                              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                              </svg>
                              <span style={{ fontSize: 10 }}>Add Photo</span>
                              <input
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={(e) => handlePhotoSelect(e, visit.id)}
                              />
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className={styles.cardFooter}>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    Last Updated: {new Date(visit.updated_at).toLocaleDateString('en-IN')}
                  </span>
                  {visit.status !== 'cancelled' && (
                    <div className={styles.footerActions}>
                      <button className={styles.editBtn} onClick={() => handleOpenSchedule(visit)}>
                        Edit / Reschedule
                      </button>
                      <button className={styles.recordBtn} onClick={() => handleOpenOutcomes(visit)}>
                        Record Outcomes
                      </button>
                      <button className={styles.cancelBtn} onClick={() => handleDeleteVisit(visit.id)}>
                        Cancel Visit
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: Schedule Site Visit */}
      {isScheduleOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {editingVisit ? 'Reschedule Site Visit' : 'Schedule Site Visit'}
              </h3>
              <button className={styles.closeBtn} onClick={() => setIsScheduleOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleSaveSchedule}>
              <div className={styles.modalBody}>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Date</label>
                    <input
                      type="date"
                      required
                      className={styles.input}
                      value={scheduleForm.date}
                      onChange={e => setScheduleForm(prev => ({ ...prev, date: e.target.value }))}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Time</label>
                    <input
                      type="time"
                      required
                      className={styles.input}
                      value={scheduleForm.time}
                      onChange={e => setScheduleForm(prev => ({ ...prev, time: e.target.value }))}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Assign Supervisor / Engineer</label>
                  <select
                    className={styles.select}
                    value={scheduleForm.assignee_id}
                    onChange={e => setScheduleForm(prev => ({ ...prev, assignee_id: e.target.value }))}
                  >
                    <option value="">Select Supervisor</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role_name || 'User'})</option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Brief / Internal Notes</label>
                  <textarea
                    className={styles.textarea}
                    placeholder="Brief description of the visit's primary objective..."
                    value={scheduleForm.notes}
                    onChange={e => setScheduleForm(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      className={styles.checkboxInput}
                      checked={scheduleForm.client_invited}
                      onChange={e => setScheduleForm(prev => ({ ...prev, client_invited: e.target.checked }))}
                    />
                    <span>Invite Client (Sends notification & adds meeting note option)</span>
                  </label>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Agenda Items</label>
                  <div className={styles.agendaItemInputRow}>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="Add an agenda item (e.g. Inspect plaster finish)"
                      value={newChecklistItem}
                      onChange={e => setNewChecklistItem(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem(); } }}
                    />
                    <button type="button" className={styles.addBtn} onClick={addChecklistItem}>
                      Add
                    </button>
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {scheduleForm.checklist.map((item, idx) => (
                      <div key={idx} className={styles.agendaItemInputRow}>
                        <div style={{ flex: 1, fontSize: 13, color: 'var(--color-text)' }}>• {item}</div>
                        <button type="button" className={styles.removeRowBtn} onClick={() => removeChecklistItem(idx)}>
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.closeFormBtn} onClick={() => setIsScheduleOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.saveBtn}>
                  {editingVisit ? 'Reschedule' : 'Schedule Visit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Record Outcomes */}
      {isOutcomesOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Record Visit Outcomes</h3>
              <button className={styles.closeBtn} onClick={() => setIsOutcomesOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleSaveOutcomes}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Visit Status</label>
                  <select
                    className={styles.select}
                    value={outcomesForm.status}
                    onChange={e => setOutcomesForm(prev => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="checked_in">Checked In / Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                {outcomesForm.status === 'completed' && (
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Completion Date</label>
                    <input
                      type="date"
                      required
                      className={styles.input}
                      value={outcomesForm.completed_at}
                      onChange={e => setOutcomesForm(prev => ({ ...prev, completed_at: e.target.value }))}
                    />
                  </div>
                )}

                <div className={styles.formGroup}>
                  <label className={styles.label}>Visit Outcome / Issues Observed</label>
                  <textarea
                    className={styles.textarea}
                    placeholder="Enter detailed observations, items resolved, or issues logged..."
                    rows={4}
                    value={outcomesForm.notes}
                    onChange={e => setOutcomesForm(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Client Feedback / Discussion Points</label>
                  <textarea
                    className={styles.textarea}
                    placeholder="Client feedback, requests, or approvals obtained during the visit..."
                    rows={3}
                    value={outcomesForm.client_feedback}
                    onChange={e => setOutcomesForm(prev => ({ ...prev, client_feedback: e.target.value }))}
                  />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.closeFormBtn} onClick={() => setIsOutcomesOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.saveBtn}>
                  Save Outcomes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIGHTBOX FOR PHOTO ZOOM */}
      {lightboxPhoto && (
        <div className={styles.lightboxOverlay} onClick={() => setLightboxPhoto(null)}>
          <button className={styles.lightboxClose} onClick={() => setLightboxPhoto(null)}>&times;</button>
          <img src={lightboxPhoto.url || lightboxPhoto.file_url} className={styles.lightboxImg} alt="Zoomed View" />
          {lightboxPhoto.caption && (
            <div className={styles.lightboxCaption}>{lightboxPhoto.caption}</div>
          )}
        </div>
      )}
    </div>
  );
}
