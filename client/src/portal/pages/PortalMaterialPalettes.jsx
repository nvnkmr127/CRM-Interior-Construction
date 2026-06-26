import { useState, useEffect } from 'react';
import styles from './PortalMaterialPalettes.module.css';
import { useToast } from '../../store/toastContext';
import api from '../../api/axios';
import { Spinner } from '../../components/ui';

export default function PortalMaterialPalettes() {
  const toast = useToast();
  const [paletteItems, setPaletteItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Revision states
  const [rejectingItemId, setRejectingItemId] = useState(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Zoom image swatches
  const [zoomImageUrl, setZoomImageUrl] = useState(null);

  useEffect(() => {
    fetchPalettes();
  }, []);

  const fetchPalettes = async () => {
    setLoading(true);
    try {
      const res = await api.get('/portal/material-palettes');
      if (res.data?.success) {
        setPaletteItems(res.data.data || []);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load material selections.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    if (!window.confirm('Do you approve this material selection?')) return;
    setSubmittingAction(true);
    try {
      const res = await api.post(`/portal/material-palettes/${id}/approve`);
      if (res.data?.success) {
        setPaletteItems(paletteItems.map(item => item.id === id ? res.data.data : item));
        toast.success('✓ Material selection approved!');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to approve material selection.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleRequestRevision = async (id) => {
    if (!feedbackText.trim()) return toast.error('Feedback comments are required.');
    setSubmittingAction(true);
    try {
      const res = await api.post(`/portal/material-palettes/${id}/revision`, { feedback: feedbackText.trim() });
      if (res.data?.success) {
        setPaletteItems(paletteItems.map(item => item.id === id ? res.data.data : item));
        setRejectingItemId(null);
        setFeedbackText('');
        toast.success('Revision request submitted.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to submit revision request.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Group items by Room
  const groupedByRoom = paletteItems.reduce((acc, item) => {
    const room = item.room_name.trim();
    if (!acc[room]) {
      acc[room] = [];
    }
    acc[room].push(item);
    return acc;
  }, {});

  // Formatting helpers
  const getBadgeClass = (status) => {
    switch (status) {
      case 'approved': return 'bg-emerald-100 text-emerald-800';
      case 'revision_requested': return 'bg-rose-100 text-rose-800';
      default: return 'bg-amber-100 text-amber-800';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'approved': return 'Approved';
      case 'revision_requested': return 'Revision Requested';
      case 'pending_approval': return 'Pending Approval';
      default: return status;
    }
  };

  if (loading && paletteItems.length === 0) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <Spinner size="lg" />
        <div style={{ marginTop: '12px', color: 'var(--color-text-muted)' }}>Loading material selections...</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Material selections & shade codes</h1>
        <div className={styles.pageSub}>Review, comment, and sign off on room-wise paints, laminates, veneer finishes, and hardware selections</div>
      </div>

      {paletteItems.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '60px 40px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🧱</div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">No material palette items loaded yet</h3>
          <p className="text-slate-500 max-w-md mx-auto">Your design team will list finalized room specifications, brands, shade codes, and laminate swatches here for your approval.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {Object.keys(groupedByRoom).map(roomName => (
            <div key={roomName} className={styles.roomSection}>
              <h2 className={styles.roomHeader}>{roomName}</h2>

              <div className={styles.grid}>
                {groupedByRoom[roomName].map(item => (
                  <div key={item.id} className={styles.card}>
                    {/* Swatch image */}
                    <div className={styles.swatchWrapper} onClick={() => item.image_url && setZoomImageUrl(item.image_url)}>
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.item_name} className={styles.swatch} />
                      ) : (
                        <div className={styles.swatchPlaceholder}>
                          <span style={{ fontSize: '24px' }}>🧱</span>
                          <span>No Swatch Image</span>
                        </div>
                      )}
                    </div>

                    {/* Specifications */}
                    <div className={styles.cardContent}>
                      <div className={styles.cardHeader}>
                        <div className={styles.itemName}>{item.item_name}</div>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded ${getBadgeClass(item.status)}`}>
                          {getStatusLabel(item.status)}
                        </span>
                      </div>

                      <div className={styles.specsList}>
                        <div className={styles.specRow}>
                          <span className={styles.specLabel}>Brand:</span>
                          <span className={styles.specVal}>{item.brand || '—'}</span>
                        </div>
                        <div className={styles.specRow}>
                          <span className={styles.specLabel}>Shade Code:</span>
                          <span className={styles.specVal}>{item.shade_code || '—'}</span>
                        </div>
                        <div className={styles.specRow}>
                          <span className={styles.specLabel}>Finish:</span>
                          <span className={styles.specVal}>{item.finish || '—'}</span>
                        </div>
                      </div>

                      {item.status === 'revision_requested' && item.client_feedback && (
                        <div className={styles.feedbackBox}>
                          <strong>Your request:</strong> "{item.client_feedback}"
                        </div>
                      )}
                    </div>

                    {/* Approval Action Box */}
                    <div className={styles.actionArea}>
                      {item.status === 'pending_approval' && (
                        <>
                          {rejectingItemId === item.id ? (
                            <div className={styles.revisionBox}>
                              <textarea
                                placeholder="Describe what adjustments or other shade options you prefer..."
                                className={styles.textarea}
                                value={feedbackText}
                                onChange={e => setFeedbackText(e.target.value)}
                              />
                              <div className={styles.revisionActions}>
                                <button className="px-2.5 py-1 text-xs font-medium rounded text-gray-700 bg-gray-100 hover:bg-gray-200" onClick={() => { setRejectingItemId(null); setFeedbackText(''); }}>
                                  Cancel
                                </button>
                                <button className="px-2.5 py-1 text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700" onClick={() => handleRequestRevision(item.id)}>
                                  Submit
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className={styles.btnGroup}>
                              <button className={styles.approveBtn} onClick={() => handleApprove(item.id)} disabled={submittingAction}>
                                ✓ Approve Selection
                              </button>
                              <button className={styles.revisionBtn} onClick={() => setRejectingItemId(item.id)} disabled={submittingAction}>
                                ✗ Request Change
                              </button>
                            </div>
                          )}
                        </>
                      )}

                      {item.status === 'approved' && (
                        <div className={styles.approvedText}>
                          ✓ Approved on {item.client_approved_at ? new Date(item.client_approved_at).toLocaleDateString() : 'TBD'}
                        </div>
                      )}

                      {item.status === 'revision_requested' && (
                        <div style={{ color: '#b91c1c', fontSize: '0.8rem', fontStyle: 'italic' }}>
                          Revisions requested. Design team is adjusting selections.
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Swatch Zoom overlay */}
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
