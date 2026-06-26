import { useState, useEffect } from 'react';
import styles from './PortalDesignReviews.module.css';
import { useToast } from '../../store/toastContext';
import api from '../../api/axios';
import { Spinner } from '../../components/ui';

export default function PortalDesignReviews() {
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
    if (!window.confirm('Confirming the design scope locks the project structure. Further revisions to drawings cannot be requested without project reopening. Do you wish to confirm?')) return;
    
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

  // Drawing-level comments
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

  // Badges helper
  const getBadgeClass = (status) => {
    switch (status) {
      case 'approved': return 'bg-emerald-100 text-emerald-800';
      case 'pending_review': return 'bg-amber-100 text-amber-800';
      case 'revision_requested': return 'bg-rose-100 text-rose-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'approved': return 'Approved';
      case 'pending_review': return 'Awaiting Review';
      case 'revision_requested': return 'Revision Requested';
      case 'superseded': return 'Superseded';
      default: return status;
    }
  };

  if (loading && rounds.length === 0) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <Spinner size="lg" />
        <div style={{ marginTop: '12px', color: 'var(--color-text-muted)' }}>Loading design reviews...</div>
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
              <span className={`px-2 py-0.5 text-xs font-semibold rounded ${selectedRound.status === 'completed' ? 'bg-gray-100 text-gray-800' : 'bg-blue-100 text-blue-800'}`}>
                {selectedRound.status === 'completed' ? 'Closed' : 'Active review'}
              </span>
            </div>
            <h2 className={styles.roundTitle}>{selectedRound.name}</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              Created on {new Date(selectedRound.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Drawings lists */}
        <div>
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Drawing Sheets & Layout Renders</h3>
          {drawings.length === 0 ? (
            <div style={{ padding: '40px', border: '1px dashed var(--color-border)', borderRadius: '8px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
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
                          <span style={{ fontSize: '0.75rem', padding: '1px 6px', background: '#eaeaea', borderRadius: '4px', marginLeft: '8px', fontWeight: 600 }}>
                            v{doc.version}
                          </span>
                        </div>
                        <div className={styles.drawingMeta}>
                          Type: {doc.doc_type === 'render' ? '3D Render' : '2D Layout'} • Shared on {new Date(doc.created_at).toLocaleDateString()}
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
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded ${getBadgeClass(doc.status)}`}>
                          {getStatusText(doc.status)}
                        </span>
                      </div>

                      <a href={doc.downloadUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline mb-2">
                        Download File ↗
                      </a>

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
                                <button className="px-2.5 py-1 text-xs font-medium rounded text-gray-700 bg-gray-100 hover:bg-gray-200" onClick={() => { setRejectingDocId(null); setRevisionNote(''); }}>
                                  Cancel
                                </button>
                                <button className="px-2.5 py-1 text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700" onClick={() => handleRequestRevision(doc.id)}>
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

                  {/* Discussion threads */}
                  <div className={styles.commentsContainer} onMouseEnter={() => ensureCommentsLoaded(doc.id)}>
                    <div className={styles.commentsTitle}>
                      <span>💬</span> Discussion & Element Feedback
                    </div>

                    <div className={styles.commentsList}>
                      {!commentsByDocId[doc.id] ? (
                        <div style={{ fontStyle: 'italic', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          Loading comments...
                        </div>
                      ) : commentsByDocId[doc.id].length === 0 ? (
                        <div style={{ fontStyle: 'italic', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          No comments on this drawing yet.
                        </div>
                      ) : (
                        commentsByDocId[doc.id].map(comment => (
                          <div key={comment.id} className={styles.commentBubble}>
                            <div style={{ fontWeight: 600, fontSize: '0.75rem', color: comment.created_by_client ? 'var(--color-success)' : 'var(--color-text-primary)' }}>
                              {comment.created_by_name} {comment.created_by_client ? '(You)' : ''}
                            </div>
                            <div style={{ marginTop: '2px' }}>{comment.comment}</div>
                            <div className={styles.commentMeta}>
                              <span>{new Date(comment.created_at).toLocaleDateString()} at {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className={styles.commentInputRow}>
                      <input
                        placeholder="Add comments on this layout..."
                        className={styles.commentInput}
                        value={newCommentText[doc.id] || ''}
                        onChange={e => setNewCommentText({ ...newCommentText, [doc.id]: e.target.value })}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddComment(doc.id) }}
                      />
                      <button className={styles.sendBtn} onClick={() => handleAddComment(doc.id)} disabled={!(newCommentText[doc.id] || '').trim()}>
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Zoom Image Overlay */}
        {zoomImageUrl && (
          <div
            onClick={() => setZoomImageUrl(null)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(0, 0, 0, 0.85)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'zoom-out'
            }}
          >
            <img src={zoomImageUrl} alt="Zoom Preview" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', borderRadius: '4px' }} />
          </div>
        )}
      </div>
    );
  }

  // LIST VIEW
  return (
    <div className={styles.page}>
      {/* 1. Frozen Scope Banner */}
      <div className={styles.frozenBanner}>
        <div>
          <div className={styles.frozenTitle}>
            <span>{isLocked ? '🔒' : '🔓'}</span>
            <span>Design Scope Confirmation</span>
          </div>
          <p className={styles.frozenDesc}>
            {isLocked
              ? 'The design scope is locked. The construction/execution phase can now proceed.'
              : 'Once all layouts and 3D renders are approved to your satisfaction, please freeze the design scope to begin execution planning.'}
          </p>
        </div>
        {!isLocked && (
          <button className={styles.freezeBtn} onClick={handleFreezeDesign}>
            🔒 Freeze Design Scope
          </button>
        )}
      </div>

      <div className={styles.header}>
        <h1 className={styles.pageTitle}>2D Layouts & 3D Render Reviews</h1>
        <div className={styles.pageSub}>Review, comment, and sign off on layout plans and render presentation rounds</div>
      </div>

      {/* Rounds Grid */}
      {rounds.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '60px 40px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📐</div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">No design reviews shared yet</h3>
          <p className="text-slate-500 max-w-md mx-auto">Your design team will create design review rounds here when layout sheets or 3D renders are ready for sign-off.</p>
        </div>
      ) : (
        <div className={styles.roundsGrid}>
          {rounds.map(round => (
            <div key={round.id} className={styles.roundCard} onClick={() => selectRound(round)}>
              <div className={styles.roundCardHeader}>
                <span className={styles.roundName}>{round.name}</span>
                <span className={`px-2 py-0.5 text-xs font-semibold rounded ${round.status === 'completed' ? 'bg-gray-100 text-gray-800' : 'bg-blue-100 text-blue-800'}`}>
                  {round.status === 'completed' ? 'Completed' : 'Review open'}
                </span>
              </div>
              <p className={styles.roundDesc}>
                Open this round to view drawings, review details, and add comments or request changes.
              </p>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-accent)', marginTop: '8px' }}>
                Open Review Round →
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
