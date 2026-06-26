import { useState, useEffect } from 'react';
import styles from './PortalDesignAssets.module.css';
import { useToast } from '../../store/toastContext';
import api from '../../api/axios';
import { Spinner } from '../../components/ui';

export default function PortalDesignAssets() {
  const toast = useToast();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');

  // Revision state
  const [isRevisionOpen, setIsRevisionOpen] = useState(false);
  const [revisionFeedback, setRevisionFeedback] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Fullscreen Preview State
  const [previewImageUrl, setPreviewImageUrl] = useState(null);

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const res = await api.get('/portal/design-assets');
      if (res.data?.success) {
        setAssets(res.data.data || []);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load design concepts.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    if (!window.confirm('Are you sure you approve this design concept?')) return;
    setSubmittingAction(true);
    try {
      const res = await api.post(`/portal/design-assets/${id}/approve`);
      if (res.data?.success) {
        const updated = res.data.data;
        // Keep items nested in UI
        const updatedAsset = { ...selectedAsset, ...updated };
        setSelectedAsset(updatedAsset);
        setAssets(assets.map(a => a.id === id ? { ...a, ...updated } : a));
        toast.success('✓ Design concept approved!');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to approve design concept.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleRequestRevision = async (id) => {
    if (!revisionFeedback.trim()) return toast.error('Please specify what revisions are needed.');
    setSubmittingAction(true);
    try {
      const res = await api.post(`/portal/design-assets/${id}/revision`, { feedback: revisionFeedback });
      if (res.data?.success) {
        const updated = res.data.data;
        const updatedAsset = { ...selectedAsset, ...updated };
        setSelectedAsset(updatedAsset);
        setAssets(assets.map(a => a.id === id ? { ...a, ...updated } : a));
        setIsRevisionOpen(false);
        setRevisionFeedback('');
        toast.success('Revision request sent to the design team.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to submit revision request.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Helper formatting
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'approved': return 'bg-emerald-100 text-emerald-800';
      case 'pending_approval': return 'bg-amber-100 text-amber-800';
      case 'revision_requested': return 'bg-rose-100 text-rose-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'approved': return 'Approved';
      case 'pending_approval': return 'Awaiting Your Approval';
      case 'revision_requested': return 'Revision Requested';
      default: return status;
    }
  };

  const getTypeName = (type) => {
    switch (type) {
      case 'mood_board': return 'Mood Board';
      case 'concept_board': return 'Concept Presentation';
      case 'reference_collection': return 'Reference Material';
      default: return type;
    }
  };

  const filteredAssets = assets.filter(a => {
    if (activeFilter === 'all') return true;
    return a.asset_type === activeFilter;
  });

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <Spinner size="lg" />
        <div style={{ marginTop: '12px', color: 'var(--color-text-muted)' }}>Loading design concepts...</div>
      </div>
    );
  }

  // DETAIL VIEW
  if (selectedAsset) {
    return (
      <div className={styles.detailContainer}>
        <button className={styles.backBtn} onClick={() => { setSelectedAsset(null); setIsRevisionOpen(false); }}>
          ← Back to Design Concepts
        </button>

        <div className={styles.detailHeader}>
          <div className={styles.assetInfo}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
              <span className="px-2 py-0.5 text-xs font-semibold rounded bg-sky-100 text-sky-800">
                {getTypeName(selectedAsset.asset_type)}
              </span>
              <span className={`px-2 py-0.5 text-xs font-semibold rounded ${getStatusBadgeClass(selectedAsset.status)}`}>
                {getStatusLabel(selectedAsset.status)}
              </span>
            </div>
            <h2 className={styles.assetTitle}>{selectedAsset.title}</h2>
            {selectedAsset.description && <p className={styles.assetDesc}>{selectedAsset.description}</p>}
          </div>

          <div className={styles.approvalActions}>
            {selectedAsset.status === 'pending_approval' && (
              <>
                <div className={styles.btnGroup}>
                  <button className={styles.approveBtn} onClick={() => handleApprove(selectedAsset.id)} disabled={submittingAction}>
                    ✓ Approve Concept
                  </button>
                  <button className={styles.revisionBtn} onClick={() => setIsRevisionOpen(!isRevisionOpen)} disabled={submittingAction}>
                    ✗ Request Changes
                  </button>
                </div>

                {isRevisionOpen && (
                  <div className={styles.revisionBox}>
                    <textarea
                      placeholder="Specify colors, layouts, or materials you would like changed..."
                      className={styles.textarea}
                      value={revisionFeedback}
                      onChange={e => setRevisionFeedback(e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button className="px-3 py-1.5 text-xs font-medium rounded text-gray-700 bg-gray-100 hover:bg-gray-200" onClick={() => setIsRevisionOpen(false)}>
                        Cancel
                      </button>
                      <button className="px-3 py-1.5 text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700" onClick={() => handleRequestRevision(selectedAsset.id)}>
                        Submit Request
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {selectedAsset.status === 'approved' && (
              <div className={styles.approvedBanner}>
                <span>✓</span> Approved by you on {selectedAsset.client_approved_at ? new Date(selectedAsset.client_approved_at).toLocaleDateString() : 'TBD'}
              </div>
            )}

            {selectedAsset.status === 'revision_requested' && (
              <div className={styles.feedbackBanner}>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>⚠️ Revision Requested</div>
                <div style={{ fontStyle: 'italic' }}>"{selectedAsset.client_feedback}"</div>
                <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#7f1d1d' }}>
                  Our team is working on updates based on your feedback.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Item view */}
        <div>
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Mood Board & Layout Elements</h3>
          {!selectedAsset.items || selectedAsset.items.length === 0 ? (
            <div style={{ padding: '40px', border: '1px dashed var(--color-border)', borderRadius: '8px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              No images added to this board yet.
            </div>
          ) : (
            <div className={styles.itemsGrid}>
              {selectedAsset.items.map(item => (
                <div key={item.id} className={styles.itemCard}>
                  <div className={styles.itemImgWrapper} onClick={() => setPreviewImageUrl(item.image_url)}>
                    <img src={item.image_url} alt={item.title || 'Mood Board Element'} className={styles.itemImg} />
                  </div>
                  {item.title || item.notes ? (
                    <div className={styles.itemContent}>
                      {item.title && <div className={styles.itemTitle}>{item.title}</div>}
                      {item.notes && <div className={styles.itemNotes}>{item.notes}</div>}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Zoom Overlay */}
        {previewImageUrl && (
          <div
            onClick={() => setPreviewImageUrl(null)}
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
            <img src={previewImageUrl} alt="Preview Zoom" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', borderRadius: '4px' }} />
          </div>
        )}
      </div>
    );
  }

  // LIST VIEW
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Design Concepts & Mood Boards</h1>
        <div className={styles.pageSub}>Review, comment on, and approve design assets shared by your design team</div>
      </div>

      <div className={styles.filters}>
        <button
          className={`${styles.filterBtn} ${activeFilter === 'all' ? styles.filterBtnActive : ''}`}
          onClick={() => setActiveFilter('all')}
        >
          All Concepts
        </button>
        <button
          className={`${styles.filterBtn} ${activeFilter === 'mood_board' ? styles.filterBtnActive : ''}`}
          onClick={() => setActiveFilter('mood_board')}
        >
          Mood Boards
        </button>
        <button
          className={`${styles.filterBtn} ${activeFilter === 'concept_board' ? styles.filterBtnActive : ''}`}
          onClick={() => setActiveFilter('concept_board')}
        >
          Concept Presentations
        </button>
        <button
          className={`${styles.filterBtn} ${activeFilter === 'reference_collection' ? styles.filterBtnActive : ''}`}
          onClick={() => setActiveFilter('reference_collection')}
        >
          Reference Materials
        </button>
      </div>

      {filteredAssets.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '60px 40px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎨</div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">No design concepts shared yet</h3>
          <p className="text-slate-500 max-w-md mx-auto">We will post mood boards, concept presentations, and material references here once they are ready for your review.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredAssets.map(asset => (
            <div key={asset.id} className={styles.card} onClick={() => setSelectedAsset(asset)}>
              <div className={styles.previewStrip}>
                {asset.items && asset.items.length > 0 ? (
                  asset.items.slice(0, 3).map((item, idx) => (
                    <img key={item.id || idx} src={item.image_url} alt="Preview" className={styles.previewImg} />
                  ))
                ) : (
                  <div className={styles.previewPlaceholder}>
                    <span style={{ fontSize: '24px' }}>🖼️</span>
                    <span>No preview images</span>
                  </div>
                )}
                {asset.items && asset.items.length === 1 && <div style={{ height: '100%', background: '#eaeaea' }}></div>}
                {asset.items && asset.items.length === 2 && <div style={{ height: '100%', background: '#eaeaea' }}></div>}
              </div>

              <div className={styles.cardBody}>
                <div className={styles.cardMeta}>
                  <span className="px-2 py-0.5 text-xs font-semibold rounded bg-sky-100 text-sky-800">
                    {getTypeName(asset.asset_type)}
                  </span>
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded ${getStatusBadgeClass(asset.status)}`}>
                    {getStatusLabel(asset.status)}
                  </span>
                </div>
                <div>
                  <h3 className={styles.cardTitle}>{asset.title}</h3>
                  {asset.description && <p className={styles.cardDesc}>{asset.description}</p>}
                </div>
              </div>

              <div className={styles.cardFooter}>
                <span className={styles.itemCount}>
                  📷 {asset.items?.length || 0} picture{asset.items?.length !== 1 ? 's' : ''}
                </span>
                <span className="text-xs font-medium text-blue-600">View Board →</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
