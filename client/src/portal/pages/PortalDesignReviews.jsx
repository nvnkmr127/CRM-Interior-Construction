/* eslint-disable react-hooks/immutability, react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import styles from './PortalDesignReviews.module.css';
import { useToast } from '../../store/toastContext';
import api from '../../api/axios';
import { Spinner } from '../../components/ui';
import { useConfirm } from '../../store/confirmContext';

export default function PortalDesignReviews() {
  const { confirm } = useConfirm();
  const toast = useToast();
  const [rounds, setRounds] = useState([]);
  const [drawings, setDrawings] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  // Active round selection
  const [selectedRound, setSelectedRound] = useState(null);

  // UI state for drawing revisions
  const [rejectingDocId, setRejectingDocId] = useState(null);
  const [revisionNote, setRevisionNote] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Drawing comments
  const [commentsByDocId, setCommentsByDocId] = useState({});
  const [newCommentText, setNewCommentText] = useState({});

  // Fullscreen Zoom Preview
  const [zoomImageUrl, setZoomImageUrl] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [roundsRes, projRes] = await Promise.all([
        api.get('/portal/design-reviews/rounds'),
        api.get('/portal/project')
      ]);

      if (roundsRes.data?.success) {
        setRounds(roundsRes.data.data || []);
      }
      
      const project = projRes.data?.data;
      if (project) {
        setIsLocked(!!project.is_scope_locked);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load design review records.');
    } finally {
      setLoading(false);
    }
  };

  const selectRound = async (round) => {
    setSelectedRound(round);
    setLoading(true);
    try {
      const res = await api.get(`/portal/design-reviews/rounds/${round.id}/drawings`);
      if (res.data?.success) {
        setDrawings(res.data.data || []);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load round drawings.');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveDrawing = async (docId) => {
    setSubmittingAction(true);
    try {
      const res = await api.post(`/portal/design-reviews/drawings/${docId}/approve`);
      if (res.data?.success) {
        setDrawings(drawings.map(d => d.id === docId ? { ...d, status: 'approved', revision_note: null } : d));
        toast.success('✓ Drawing approved!');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to approve drawing.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleRequestRevision = async (docId) => {
    if (!revisionNote.trim()) return toast.error('Please specify what changes are required.');
    setSubmittingAction(true);
    try {
      const res = await api.post(`/portal/design-reviews/drawings/${docId}/revision`, { note: revisionNote.trim() });
      if (res.data?.success) {
        setDrawings(drawings.map(d => d.id === docId ? { ...d, status: 'revision_requested', revision_note: revisionNote.trim() } : d));
        setRejectingDocId(null);
        setRevisionNote('');
        toast.success('Revision request submitted.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to request revision.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleFreezeDesign = async () => {
    if (!await confirm('Confirming the design scope locks the project structure. Further revisions to drawings cannot be requested without project reopening. Do you wish to confirm?')) return;
    
    try {
      const res = await api.post('/portal/design-reviews/freeze-design');
      if (res.data?.success) {
        setIsLocked(true);
        toast.success('🔒 Design scope frozen and locked successfully!');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to lock design scope.');
    }
  };

  const fetchComments = async (docId) => {
    try {
      const res = await api.get(`/portal/design-reviews/drawings/${docId}/comments`);
      if (res.data?.success) {
        setCommentsByDocId(prev => ({ ...prev, [docId]: res.data.data || [] }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddComment = async (docId) => {
    const text = newCommentText[docId];
    if (!text || !text.trim()) return;

    try {
      const res = await api.post(`/portal/design-reviews/drawings/${docId}/comments`, { comment: text.trim() });
      if (res.data?.success) {
        setCommentsByDocId(prev => ({
          ...prev,
          [docId]: [...(prev[docId] || []), res.data.data]
        }));
        setNewCommentText(prev => ({ ...prev, [docId]: '' }));
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to send comment.');
    }
  };

  const ensureCommentsLoaded = (docId) => {
    if (!commentsByDocId[docId]) {
      fetchComments(docId);
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'approved': return 'Approved ✓';
      case 'pending_review': return 'Awaiting Review';
      case 'revision_requested': return 'Revision Requested';
      case 'superseded': return 'Superseded';
      default: return status;
    }
  };

  if (loading && rounds.length === 0) {
    return (
      <div className={styles.loadingContainer}>
        <Spinner size="lg" />
        <div>Loading design reviews...</div>
      </div>
    );
  }

  // DETAILED ROUND VIEW
  if (selectedRound) {
    return (
      <div className={styles.detailContainer}>
        <button className={styles.backBtn} onClick={() => { setSelectedRound(null); setDrawings([]); }}>
          ← Back to Design Reviews
        </button>

        <div className={styles.detailHeader}>
          <div className={styles.roundInfo}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span className={`${styles.statusBadge} ${selectedRound.status === 'completed' ? styles.statusClosed : styles.statusActive}`}>
                {selectedRound.status === 'completed' ? 'Closed' : 'Active Review'}
              </span>
            </div>
            <h2 className={styles.detailTitle}>{selectedRound.name}</h2>
            <p className={styles.detailSubtitle}>
              Created on {new Date(selectedRound.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Drawings lists */}
        <div>
          <h3 className={styles.sectionHeading}>Drawing Sheets & Layout Renders</h3>
          {drawings.length === 0 ? (
            <div className={styles.emptyBox}>
              No drawings shared in this round.
            </div>
          ) : (
            <div className={styles.drawingsList}>
              {drawings.map(doc => (
                <div key={doc.id} className={styles.drawingCard}>
                  <div className={styles.drawingRow}>
                    <div className={styles.drawingInfo}>
                      {doc.storage_key && (doc.mime_type?.startsWith('image/') || doc.name.toLowerCase().endsWith('.png') || doc.name.toLowerCase().endsWith('.jpg') || doc.name.toLowerCase().endsWith('.jpeg')) ? (
                        <img src={doc.downloadUrl} alt={doc.name} className={styles.thumbnail} onClick={() => setZoomImageUrl(doc.downloadUrl)} />
                      ) : (
                        <div className={styles.thumbnail} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', cursor: 'default' }}>
                          📐
                        </div>
                      )}

                      <div className={styles.drawingText}>
                        <div className={styles.drawingTitle}>
                          {doc.name}
                          <span className={styles.versionTag}>
                            v{doc.version}
                          </span>
                        </div>
                        <div className={styles.drawingMeta}>
                          Type: {doc.doc_type === 'render' ? '3D Render' : '2D Layout'} • Shared on {new Date(doc.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                        {doc.revision_note && (
                          <div className={styles.revisionNote}>
                            <strong>You requested changes:</strong> "{doc.revision_note}"
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={styles.actionArea}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                        <span className={`${styles.statusBadge} ${styles[doc.status] || ''}`}>
                          {getStatusText(doc.status)}
                        </span>
                      </div>

                      {doc.downloadUrl && (
                        <a href={doc.downloadUrl} target="_blank" rel="noreferrer" className={styles.downloadLink}>
                          Download File ↗
                        </a>
                      )}

                      {!isLocked && selectedRound.status === 'active' && doc.status === 'pending_review' && (
                        <>
                          <div className={styles.actionRow}>
                            <button className={styles.approveBtn} onClick={() => handleApproveDrawing(doc.id)} disabled={submittingAction}>
                              ✓ Approve
                            </button>
                            <button className={styles.revisionBtn} onClick={() => setRejectingDocId(rejectingDocId === doc.id ? null : doc.id)} disabled={submittingAction}>
                              ✗ Revision
                            </button>
                          </div>

                          {rejectingDocId === doc.id && (
                            <div className={styles.revisionBox}>
                              <textarea
                                placeholder="Describe what adjustments or corrections are needed..."
                                className={styles.textarea}
                                value={revisionNote}
                                onChange={e => setRevisionNote(e.target.value)}
                              />
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                <button className={styles.cancelBtn} onClick={() => { setRejectingDocId(null); setRevisionNote(''); }}>
                                  Cancel
                                </button>
                                <button className={styles.submitBtn} onClick={() => handleRequestRevision(doc.id)}>
                                  Submit
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {doc.status === 'approved' && (
                        <div className={styles.approvedText}>✓ Approved</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lightbox Zoom */}
        {zoomImageUrl && (
          <div className={styles.lightboxBackdrop} onClick={() => setZoomImageUrl(null)}>
            <img src={zoomImageUrl} alt="Full Preview" className={styles.lightboxImg} />
            <button className={styles.lightboxClose} onClick={() => setZoomImageUrl(null)}>✕</button>
          </div>
        )}
      </div>
    );
  }

  // ROUNDS LIST OVERVIEW
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 className={styles.pageTitle}>Design Reviews & Drawings</h1>
            <div className={styles.pageSub}>Review floorplans, 3D renders, and technical drawings organized by review cycles.</div>
          </div>
          {!isLocked && (
            <button className={styles.freezeBtn} onClick={handleFreezeDesign}>
              🔒 Freeze & Confirm Design Scope
            </button>
          )}
          {isLocked && (
            <div className={styles.lockedBadge}>
              🔒 Design Scope Confirmed & Locked
            </div>
          )}
        </div>
      </div>

      {rounds.length === 0 ? (
        <div className={styles.emptyBox}>
          <div style={{ fontSize: '44px', marginBottom: '12px' }}>📐</div>
          <h3 style={{ margin: '0 0 6px 0', fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-text)' }}>No Design Review Rounds Shared</h3>
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>Your design team will publish design rounds here for your review and sign-off.</p>
        </div>
      ) : (
        <div className={styles.roundsGrid}>
          {rounds.map(r => (
            <div key={r.id} className={styles.roundCard} onClick={() => selectRound(r)}>
              <div className={styles.roundCardHeader}>
                <span className={`${styles.statusBadge} ${r.status === 'completed' ? styles.statusClosed : styles.statusActive}`}>
                  {r.status === 'completed' ? 'Closed' : 'Active Review'}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                  {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              </div>
              <div className={styles.roundName}>{r.name}</div>
              <div className={styles.roundDesc}>{r.description || 'Click to view drawing sheets and 3D renders in this review round.'}</div>
              <div className={styles.viewLink}>View Drawing Sheets →</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
