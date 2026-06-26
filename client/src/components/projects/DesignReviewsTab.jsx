import React, { useState, useEffect } from 'react';
import { Button, Badge, Modal, Input, EmptyState, Spinner } from '../ui';
import { useToast } from '../../store/toastContext';
import styles from './DesignReviewsTab.module.css';
import {
  getDesignReviewRounds,
  createDesignReviewRound,
  closeDesignReviewRound,
  getDesignReviewDrawings,
  associateDrawingWithRound,
  getDrawingComments,
  addDrawingComment,
  freezeProjectDesign,
  getProject
} from '../../api/projects';

export default function DesignReviewsTab({ projectId }) {
  const toast = useToast();
  const [rounds, setRounds] = useState([]);
  const [drawings, setDrawings] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null);

  // Selection state
  const [selectedRound, setSelectedRound] = useState(null);
  
  // Modals
  const [isCreateRoundOpen, setIsCreateRoundOpen] = useState(false);
  const [newRoundName, setNewRoundName] = useState('');

  // Item comments state
  const [commentsByDocId, setCommentsByDocId] = useState({});
  const [newCommentsText, setNewCommentsText] = useState({});
  const [expandedCommentsDocId, setExpandedCommentsDocId] = useState(null);

  // Zoom image overlay
  const [zoomImageUrl, setZoomImageUrl] = useState(null);

  useEffect(() => {
    if (projectId) {
      initTab();
    }
  }, [projectId]);

  const initTab = async () => {
    setLoading(true);
    try {
      const [roundsRes, drawingsRes, projRes] = await Promise.all([
        getDesignReviewRounds(projectId),
        getDesignReviewDrawings(projectId),
        getProject(projectId)
      ]);

      if (roundsRes.data?.success) {
        setRounds(roundsRes.data.data || []);
      }
      if (drawingsRes.data?.success) {
        setDrawings(drawingsRes.data.data || []);
      }
      
      const projectData = projRes.data?.data || projRes.data;
      if (projectData) {
        setProject(projectData);
        setIsLocked(!!projectData.is_scope_locked);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load design review data.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRound = async (e) => {
    e.preventDefault();
    if (!newRoundName.trim()) return toast.error('Round name is required.');

    try {
      const res = await createDesignReviewRound(projectId, { name: newRoundName.trim() });
      if (res.data?.success) {
        setRounds([...rounds, {
          ...res.data.data,
          total_drawings: 0,
          approved_drawings: 0,
          revision_drawings: 0
        }]);
        setIsCreateRoundOpen(false);
        setNewRoundName('');
        toast.success(`Design review ${res.data.data.name} created.`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to create review round.');
    }
  };

  const handleCloseRound = async (id) => {
    if (!window.confirm('Are you sure you want to close this design review round? This locks drawing associations for this round.')) return;

    try {
      const res = await closeDesignReviewRound(projectId, id);
      if (res.data?.success) {
        setRounds(rounds.map(r => r.id === id ? { ...r, status: 'completed' } : r));
        if (selectedRound?.id === id) {
          setSelectedRound({ ...selectedRound, status: 'completed' });
        }
        toast.success('Design review round closed.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to close round.');
    }
  };

  const handleAssociateDrawing = async (drawingId, roundId) => {
    try {
      const res = await associateDrawingWithRound(projectId, drawingId, { design_review_round_id: roundId });
      if (res.data?.success) {
        // Update drawings list locally
        setDrawings(drawings.map(d => d.id === drawingId ? { ...d, design_review_round_id: roundId } : d));
        
        // Refresh rounds stats
        const refreshedRounds = await getDesignReviewRounds(projectId);
        if (refreshedRounds.data?.success) {
          setRounds(refreshedRounds.data.data || []);
        }

        toast.success(roundId ? 'Drawing associated with review round.' : 'Drawing unassigned from review round.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update drawing association.');
    }
  };

  const handleFreezeDesign = async () => {
    if (!window.confirm('Are you sure you want to lock the design scope? This actions freezes current drawings and confirms the design phase. Transition to execution will now be unlocked.')) return;

    try {
      const res = await freezeProjectDesign(projectId);
      if (res.data?.success) {
        setIsLocked(true);
        toast.success('🔒 Design scope frozen and locked successfully.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to freeze design scope.');
    }
  };

  // Item Comments
  const toggleComments = async (docId) => {
    if (expandedCommentsDocId === docId) {
      setExpandedCommentsDocId(null);
      return;
    }

    setExpandedCommentsDocId(docId);
    if (!commentsByDocId[docId]) {
      fetchComments(docId);
    }
  };

  const fetchComments = async (docId) => {
    try {
      const res = await getDrawingComments(projectId, docId);
      if (res.data?.success) {
        setCommentsByDocId(prev => ({ ...prev, [docId]: res.data.data || [] }));
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load drawing comments.');
    }
  };

  const handleAddComment = async (docId) => {
    const text = newCommentsText[docId];
    if (!text || !text.trim()) return;

    try {
      const res = await addDrawingComment(projectId, docId, text.trim());
      if (res.data?.success) {
        setCommentsByDocId(prev => ({
          ...prev,
          [docId]: [...(prev[docId] || []), res.data.data]
        }));
        setNewCommentsText(prev => ({ ...prev, [docId]: '' }));
        toast.success('Comment added.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to add comment.');
    }
  };

  // Helper formatting
  const getBadgeVariant = (status) => {
    switch (status) {
      case 'approved': return 'success';
      case 'revision_requested': return 'danger';
      case 'pending_review': return 'warning';
      default: return 'neutral';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'approved': return 'Approved';
      case 'revision_requested': return 'Revision Requested';
      case 'pending_review': return 'Awaiting Client Review';
      case 'superseded': return 'Superseded';
      default: return status;
    }
  };

  const unassignedDrawings = drawings.filter(d => !d.design_review_round_id);
  const activeRoundDrawings = selectedRound ? drawings.filter(d => d.design_review_round_id === selectedRound.id) : [];

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <Spinner size="lg" />
        <div style={{ marginTop: '12px', color: 'var(--color-text-muted)' }}>Loading design reviews...</div>
      </div>
    );
  }

  const allowedRevisions = project?.allowed_design_revisions ?? 3;
  const currentRevisions = project?.current_design_revisions ?? 0;
  const limitExceeded = currentRevisions >= allowedRevisions;

  // DETAILED VIEW (ROUND DETAILS)
  if (selectedRound) {
    const currentRound = rounds.find(r => r.id === selectedRound.id) || selectedRound;
    return (
      <div className={styles.detailView}>
        <button className={styles.backBtn} onClick={() => { setSelectedRound(null); setExpandedCommentsDocId(null); }}>
          ← Back to Design Reviews
        </button>

        {limitExceeded && (
          <div style={{
            padding: '16px 20px',
            borderRadius: '8px',
            background: '#fffbeb',
            border: '1px solid #fef3c7',
            color: '#92400e',
            fontSize: '0.875rem',
            marginBottom: '20px',
            marginTop: '12px'
          }}>
            <strong>⚠️ Design Revision Limit Exceeded:</strong> Client has used <strong>{currentRevisions}</strong> of <strong>{allowedRevisions}</strong> allowed revisions. Please raise a Change Order to authorize further revisions.
          </div>
        )}

        <div className={styles.header} style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
              <Badge variant={currentRound.status === 'completed' ? 'neutral' : 'info'}>
                {currentRound.status === 'completed' ? 'Completed' : 'Active Review Round'}
              </Badge>
            </div>
            <h2 className={styles.title} style={{ fontSize: '1.5rem' }}>{currentRound.name}</h2>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {currentRound.status === 'active' && (
              <Button variant="outline" size="sm" onClick={() => handleCloseRound(currentRound.id)}>
                🔒 Close Review Round
              </Button>
            )}
          </div>
        </div>

        <div>
          <h3 className={styles.title} style={{ fontSize: '1.1rem', marginBottom: '12px' }}>Drawings & Renders in this Round</h3>
          
          {activeRoundDrawings.length === 0 ? (
            <div style={{ padding: '30px', border: '1px dashed var(--color-border)', borderRadius: '8px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
              No drawings associated with this round yet. Go back to link drawings.
            </div>
          ) : (
            <div className={styles.drawingsList}>
              {activeRoundDrawings.map(doc => (
                <div key={doc.id} className={styles.drawingCard}>
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div className={styles.drawingInfo}>
                      {doc.mime_type?.startsWith('image/') ? (
                        <img src={doc.downloadUrl} alt={doc.name} className={styles.thumbnail} onClick={() => setZoomImageUrl(doc.downloadUrl)} />
                      ) : (
                        <div className={styles.thumbnail} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', cursor: 'default' }}>
                          📄
                        </div>
                      )}
                      
                      <div className={styles.drawingText}>
                        <div className={styles.drawingTitle}>
                          {doc.name}
                          <span style={{ fontSize: '0.75rem', padding: '1px 6px', background: '#eaeaea', borderRadius: '4px', marginLeft: '8px', fontWeight: 600 }}>
                            v{doc.version}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                          Type: {doc.doc_type === 'render' ? '3D Render' : '2D Layout'} • Uploaded on {new Date(doc.created_at).toLocaleDateString()}
                        </div>
                        {doc.revision_note && (
                          <div style={{ padding: '8px', background: '#fef2f2', borderLeft: '3px solid var(--color-danger)', fontSize: '0.8rem', color: '#991b1b', marginTop: '6px', borderRadius: '4px' }}>
                            <strong>Client Revision Note:</strong> "{doc.revision_note}"
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                      <Badge variant={getBadgeVariant(doc.status)}>{getStatusLabel(doc.status)}</Badge>
                      <a href={doc.downloadUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--color-accent)', textDecoration: 'underline' }}>
                        Open File ↗
                      </a>
                      {currentRound.status === 'active' && (
                        <button
                          style={{ fontSize: '0.75rem', color: 'var(--color-danger)', border: 'none', background: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                          onClick={() => handleAssociateDrawing(doc.id, null)}
                        >
                          Remove from Round
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Comment Section Toggle */}
                  <div className={styles.commentSection}>
                    <button
                      onClick={() => toggleComments(doc.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-primary)', padding: 0 }}
                    >
                      {expandedCommentsDocId === doc.id ? '▼' : '▶'} Client Comments & Discussion
                    </button>

                    {expandedCommentsDocId === doc.id && (
                      <div style={{ marginTop: '8px' }}>
                        <div className={styles.commentList}>
                          {!commentsByDocId[doc.id] || commentsByDocId[doc.id].length === 0 ? (
                            <div style={{ fontStyle: 'italic', color: 'var(--color-text-muted)', fontSize: '0.75rem', padding: '4px 0' }}>
                              No comments yet. Start the conversation below.
                            </div>
                          ) : (
                            commentsByDocId[doc.id].map(comment => (
                              <div key={comment.id} className={styles.commentBubble}>
                                <div style={{ fontWeight: 600, fontSize: '0.75rem', color: comment.created_by_client ? 'var(--color-accent)' : 'var(--color-text-primary)' }}>
                                  {comment.created_by_name} {comment.created_by_client ? '(Client)' : ''}
                                </div>
                                <div style={{ marginTop: '2px' }}>{comment.comment}</div>
                                <div className={styles.commentMeta}>
                                  <span>{new Date(comment.created_at).toLocaleString()}</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        <div className={styles.commentInputGroup}>
                          <Input
                            placeholder="Type a message or design instruction..."
                            value={newCommentsText[doc.id] || ''}
                            onChange={e => setNewCommentsText({ ...newCommentsText, [doc.id]: e.target.value })}
                            style={{ height: '32px', fontSize: '0.8rem' }}
                            onKeyDown={e => { if (e.key === 'Enter') handleAddComment(doc.id) }}
                          />
                          <Button size="sm" onClick={() => handleAddComment(doc.id)} disabled={!(newCommentsText[doc.id] || '').trim()}>
                            Send
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // LIST VIEW
  return (
    <div className={styles.container}>
      {limitExceeded && (
        <div style={{
          padding: '16px 20px',
          borderRadius: '8px',
          background: '#fffbeb',
          border: '1px solid #fef3c7',
          color: '#92400e',
          fontSize: '0.875rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div>
            <strong>⚠️ Design Revision Limit Exceeded:</strong> The client has requested <strong>{currentRevisions}</strong> revisions, reaching or exceeding the contractual limit of <strong>{allowedRevisions}</strong> revisions. You can raise a Change Order to authorize commercial recovery.
          </div>
        </div>
      )}

      {/* 1. Freeze Design scope banner */}
      <div className={`${styles.lockCard} ${isLocked ? styles.lockCardLocked : ''}`}>
        <div>
          <div className={styles.lockTitle}>
            <span>{isLocked ? '🔒' : '🔓'}</span>
            <span>Design Phase: {isLocked ? 'Frozen (Scope Locked)' : 'Drafting/Open'}</span>
          </div>
          <p className={styles.lockDesc}>
            {isLocked
              ? 'The design scope has been finalized and locked. Transition to the execution phases is now unlocked.'
              : 'The design is still flexible. Finalize all layouts and renders, then click freeze to lock the project scope.'}
          </p>
        </div>
        {!isLocked && (
          <Button variant="success" size="sm" onClick={handleFreezeDesign}>
            🔒 Freeze Design & Lock Scope
          </Button>
        )}
      </div>

      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <h2 className={styles.title}>2D Layouts & 3D Renders Approval rounds</h2>
          <p className={styles.description}>Manage named design review rounds, track client feedback loops, and approve individual drawings.</p>
        </div>
        <Button variant="primary" onClick={() => setIsCreateRoundOpen(true)}>
          ➕ Create Review Round
        </Button>
      </div>

      {/* Review Rounds Grid */}
      <div className={styles.roundsSection}>
        <h3 className={styles.title} style={{ fontSize: '1.1rem' }}>Named Review Rounds</h3>
        {rounds.length === 0 ? (
          <div style={{ border: '2px dashed var(--color-border)', borderRadius: '8px', padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            No design review rounds created yet. Click "Create Review Round" to start.
          </div>
        ) : (
          <div className={styles.roundsGrid}>
            {rounds.map(round => (
              <div
                key={round.id}
                className={`${styles.roundCard} ${selectedRound?.id === round.id ? styles.roundCardActive : ''}`}
                onClick={() => setSelectedRound(round)}
              >
                <div className={styles.roundCardTitle}>
                  <span>{round.name}</span>
                  <Badge variant={round.status === 'completed' ? 'neutral' : 'info'}>
                    {round.status === 'completed' ? 'Closed' : 'Active'}
                  </Badge>
                </div>
                
                <div className={styles.roundStats}>
                  <span>📄 Drawings: {round.total_drawings || 0}</span>
                  <span>✅ Approved: {round.approved_drawings || 0}</span>
                  <span>⚠️ Revision Needed: {round.revision_drawings || 0}</span>
                </div>
                
                <div style={{ fontSize: '0.75rem', color: 'var(--color-accent)', fontWeight: 600, marginTop: '8px' }}>
                  Manage Round drawings & comments →
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Unassigned drawings section */}
      <div className={styles.unassignedSection}>
        <h3 className={styles.title} style={{ fontSize: '1.1rem', marginBottom: '4px' }}>Unassigned Drawings & Renders</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
          Assign drawings (type "drawing" or "render") to active review rounds to publish them to the client portal.
        </p>

        {unassignedDrawings.length === 0 ? (
          <div style={{ fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            All layouts and renders are currently assigned to review rounds.
          </div>
        ) : (
          <div className={styles.drawingsList}>
            {unassignedDrawings.map(doc => (
              <div key={doc.id} className={styles.drawingCard} style={{ background: 'white' }}>
                <div className={styles.drawingInfo}>
                  {doc.mime_type?.startsWith('image/') ? (
                    <img src={doc.downloadUrl} alt={doc.name} className={styles.thumbnail} onClick={() => setZoomImageUrl(doc.downloadUrl)} />
                  ) : (
                    <div className={styles.thumbnail} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', cursor: 'default' }}>
                      📄
                    </div>
                  )}

                  <div className={styles.drawingText}>
                    <div className={styles.drawingTitle}>
                      {doc.name}
                      <span style={{ fontSize: '0.75rem', padding: '1px 6px', background: '#eaeaea', borderRadius: '4px', marginLeft: '8px', fontWeight: 600 }}>
                        v{doc.version}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                      Type: {doc.doc_type === 'render' ? '3D Render' : '2D Layout'} • Uploaded on {new Date(doc.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Assign to Round:</span>
                  <select
                    style={{ padding: '6px 12px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '0.8rem', outline: 'none' }}
                    onChange={e => handleAssociateDrawing(doc.id, e.target.value || null)}
                    value=""
                  >
                    <option value="">-- Choose Round --</option>
                    {rounds.filter(r => r.status === 'active').map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Round Modal */}
      <Modal isOpen={isCreateRoundOpen} onClose={() => setIsCreateRoundOpen(false)} title="Create Review Round">
        <form onSubmit={handleCreateRound} className={styles.form} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Round Name</label>
            <Input
              required
              placeholder="e.g. Round 1, Round 2, Final Presentation"
              value={newRoundName}
              onChange={e => setNewRoundName(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <Button type="button" variant="outline" onClick={() => setIsCreateRoundOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary">Create Round</Button>
          </div>
        </form>
      </Modal>

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
