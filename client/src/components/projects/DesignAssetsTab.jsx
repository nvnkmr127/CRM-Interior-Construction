/* eslint-disable no-unused-vars, react-hooks/immutability, react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { Button, Badge, Modal, Input, Textarea, Select, EmptyState, Spinner } from '../ui';
import { useToast } from '../../store/toastContext';
import styles from './DesignAssetsTab.module.css';
import {
  getDesignAssets,
  createDesignAsset,
  updateDesignAsset,
  deleteDesignAsset,
  addDesignAssetItem,
  deleteDesignAssetItem,
  getProject
} from '../../api/projects';

const ASSET_TYPES = [
  { value: 'mood_board', label: 'Mood Board' },
  { value: 'concept_board', label: 'Concept Board' },
  { value: 'reference_collection', label: 'Reference Collection' }
];

export default function DesignAssetsTab({ projectId }) {
  const toast = useToast();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');

  // Asset Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  
  // Asset Form State
  const [assetForm, setAssetForm] = useState({
    title: '',
    description: '',
    asset_type: 'mood_board',
    is_visible_to_client: false
  });

  // Item Form State
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [itemForm, setItemForm] = useState({
    image_url: '',
    title: '',
    notes: ''
  });
  const [isUploading, setIsUploading] = useState(false);

  // Fullscreen Preview State
  const [previewImageUrl, setPreviewImageUrl] = useState(null);

  useEffect(() => {
    if (projectId) {
      fetchAssets();
      fetchProject();
    }
  }, [projectId]);

  const fetchProject = async () => {
    try {
      const res = await getProject(projectId);
      const projData = res.data?.data || res.data;
      if (projData) {
        setProject(projData);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const res = await getDesignAssets(projectId);
      if (res.data?.success) {
        setAssets(res.data.data || []);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load design assets.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAsset = async (e) => {
    e.preventDefault();
    if (!assetForm.title.trim()) return toast.error('Title is required');

    try {
      const res = await createDesignAsset(projectId, assetForm);
      if (res.data?.success) {
        setAssets([res.data.data, ...assets]);
        setIsCreateModalOpen(false);
        setAssetForm({
          title: '',
          description: '',
          asset_type: 'mood_board',
          is_visible_to_client: false
        });
        toast.success('Design asset created successfully.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to create design asset.');
    }
  };

  const handleUpdateAsset = async (e) => {
    e.preventDefault();
    if (!editingAsset?.title.trim()) return toast.error('Title is required');

    try {
      const res = await updateDesignAsset(projectId, editingAsset.id, editingAsset);
      if (res.data?.success) {
        setAssets(assets.map(a => a.id === editingAsset.id ? { ...a, ...res.data.data } : a));
        if (selectedAsset && selectedAsset.id === editingAsset.id) {
          setSelectedAsset({ ...selectedAsset, ...res.data.data });
        }
        setIsEditModalOpen(false);
        setEditingAsset(null);
        toast.success('Design asset updated successfully.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update design asset.');
    }
  };

  const handleDeleteAsset = async (id, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this design asset? This will delete all items inside it.')) return;

    try {
      const res = await deleteDesignAsset(projectId, id);
      if (res.data?.success) {
        setAssets(assets.filter(a => a.id !== id));
        if (selectedAsset?.id === id) {
          setSelectedAsset(null);
        }
        toast.success('Design asset deleted successfully.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete design asset.');
    }
  };

  const handleToggleVisibility = async (asset, val) => {
    try {
      const res = await updateDesignAsset(projectId, asset.id, { is_visible_to_client: val });
      if (res.data?.success) {
        const updated = { ...asset, ...res.data.data };
        setAssets(assets.map(a => a.id === asset.id ? updated : a));
        if (selectedAsset?.id === asset.id) {
          setSelectedAsset(updated);
        }
        toast.success(val ? 'Asset is now visible to client' : 'Asset is hidden from client');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update client visibility.');
    }
  };

  const handleSubmitForApproval = async (asset) => {
    try {
      const res = await updateDesignAsset(projectId, asset.id, {
        status: 'pending_approval',
        is_visible_to_client: true
      });
      if (res.data?.success) {
        const updated = { ...asset, ...res.data.data };
        setAssets(assets.map(a => a.id === asset.id ? updated : a));
        if (selectedAsset?.id === asset.id) {
          setSelectedAsset(updated);
        }
        toast.success('Submitted to client portal for approval.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit for approval.');
    }
  };

  // Add Item (Base64 file reader or URL)
  const handleItemSubmit = async (e) => {
    e.preventDefault();
    if (!itemForm.image_url.trim()) return toast.error('Image is required');

    try {
      const res = await addDesignAssetItem(projectId, selectedAsset.id, itemForm);
      if (res.data?.success) {
        const updatedItems = [...(selectedAsset.items || []), res.data.data];
        const updatedAsset = { ...selectedAsset, items: updatedItems };
        setSelectedAsset(updatedAsset);
        setAssets(assets.map(a => a.id === selectedAsset.id ? updatedAsset : a));
        setIsAddItemOpen(false);
        setItemForm({ image_url: '', title: '', notes: '' });
        toast.success('Asset item added successfully.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to add asset item.');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Please upload an image file.');

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setItemForm(prev => ({
        ...prev,
        image_url: uploadEvent.target.result
      }));
      setIsUploading(false);
      toast.success('Image loaded successfully.');
    };
    reader.onerror = () => {
      setIsUploading(false);
      toast.error('Failed to read file.');
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Delete this item from the asset?')) return;

    try {
      const res = await deleteDesignAssetItem(projectId, selectedAsset.id, itemId);
      if (res.data?.success) {
        const updatedItems = selectedAsset.items.filter(item => item.id !== itemId);
        const updatedAsset = { ...selectedAsset, items: updatedItems };
        setSelectedAsset(updatedAsset);
        setAssets(assets.map(a => a.id === selectedAsset.id ? updatedAsset : a));
        toast.success('Item deleted successfully.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete item.');
    }
  };

  // Helper getters
  const getBadgeVariant = (status) => {
    switch (status) {
      case 'approved': return 'success';
      case 'pending_approval': return 'warning';
      case 'revision_requested': return 'danger';
      default: return 'neutral';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'approved': return 'Approved';
      case 'pending_approval': return 'Pending Client Approval';
      case 'revision_requested': return 'Revision Requested';
      case 'draft': return 'Draft';
      default: return status;
    }
  };

  const getTypeName = (type) => {
    switch (type) {
      case 'mood_board': return 'Mood Board';
      case 'concept_board': return 'Concept Board';
      case 'reference_collection': return 'Reference Collection';
      default: return type;
    }
  };

  // Filtering
  const filteredAssets = assets.filter(a => {
    if (activeFilter === 'all') return true;
    return a.asset_type === activeFilter;
  });

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <Spinner size="lg" />
        <div style={{ marginTop: '12px', color: 'var(--color-text-muted)' }}>Loading design assets...</div>
      </div>
    );
  }

  const allowedRevisions = project?.allowed_design_revisions ?? 3;
  const currentRevisions = project?.current_design_revisions ?? 0;
  const limitExceeded = currentRevisions >= allowedRevisions;

  // DETAILED VIEW
  if (selectedAsset) {
    return (
      <div className={styles.detailContainer}>
        <button className={styles.backLink} onClick={() => setSelectedAsset(null)}>
          ← Back to Design Assets
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

        <div className={styles.detailHeader}>
          <div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
              <Badge variant="info">{getTypeName(selectedAsset.asset_type)}</Badge>
              <Badge variant={getBadgeVariant(selectedAsset.status)}>{getStatusLabel(selectedAsset.status)}</Badge>
            </div>
            <h2 className={styles.title} style={{ fontSize: '1.5rem' }}>{selectedAsset.title}</h2>
            {selectedAsset.description && <p className={styles.description} style={{ marginTop: '8px' }}>{selectedAsset.description}</p>}
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button variant="outline" size="sm" onClick={() => { setEditingAsset(selectedAsset); setIsEditModalOpen(true); }}>
              ✏️ Edit Details
            </Button>
            
            {selectedAsset.status === 'draft' || selectedAsset.status === 'revision_requested' ? (
              <Button variant="primary" size="sm" onClick={() => handleSubmitForApproval(selectedAsset)} disabled={!selectedAsset.items || selectedAsset.items.length === 0}>
                📤 Submit for Client Approval
              </Button>
            ) : null}

            <Button
              variant={selectedAsset.is_visible_to_client ? 'success' : 'outline'}
              size="sm"
              onClick={() => handleToggleVisibility(selectedAsset, !selectedAsset.is_visible_to_client)}
            >
              {selectedAsset.is_visible_to_client ? '👁 Visible to Client' : '🙈 Hidden from Client'}
            </Button>
          </div>
        </div>

        {/* Client feedback section if revision requested */}
        {selectedAsset.status === 'revision_requested' && selectedAsset.client_feedback && (
          <div className={styles.feedbackBox}>
            <div className={styles.feedbackHeader}>
              <span>⚠️</span> Client Feedback & Revision Notes
            </div>
            <div className={styles.feedbackText}>
              "{selectedAsset.client_feedback}"
            </div>
          </div>
        )}

        {/* Items Grid */}
        <div>
          <div className={styles.itemsHeader}>
            <h3 className={styles.title} style={{ fontSize: '1.1rem' }}>Items & References</h3>
            <Button variant="outline" size="sm" onClick={() => setIsAddItemOpen(true)}>
              ➕ Add Item
            </Button>
          </div>

          <div style={{ marginTop: '16px' }}>
            {!selectedAsset.items || selectedAsset.items.length === 0 ? (
              <div style={{ border: '2px dashed var(--color-border)', borderRadius: '8px', padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                No items added to this board yet. Click "Add Item" above to add pictures and drawings.
              </div>
            ) : (
              <div className={styles.itemsGrid}>
                {selectedAsset.items.map(item => (
                  <div key={item.id} className={styles.itemCard}>
                    <div className={styles.itemImgWrapper} onClick={() => setPreviewImageUrl(item.image_url)}>
                      <img src={item.image_url} alt={item.title || 'Asset Item'} className={styles.itemImg} />
                      <button className={styles.deleteItemBtn} onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }} title="Remove item">
                        ✕
                      </button>
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
        </div>

        {/* Add Item Modal */}
        <Modal isOpen={isAddItemOpen} onClose={() => setIsAddItemOpen(false)} title="Add Design Reference Item">
          <form onSubmit={handleItemSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Option A: Upload Local Image</label>
              <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} id="asset-item-upload" />
              <div className={styles.uploadTrigger} onClick={() => document.getElementById('asset-item-upload').click()}>
                <div className={styles.uploadIcon}>📷</div>
                <div className={styles.uploadText}>{isUploading ? 'Reading image...' : 'Click to select an image from your computer'}</div>
              </div>
            </div>

            <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>— OR —</div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Option B: Image URL</label>
              <Input
                placeholder="https://example.com/image.jpg"
                value={itemForm.image_url}
                onChange={e => setItemForm({ ...itemForm, image_url: e.target.value })}
              />
            </div>

            {itemForm.image_url && (
              <div>
                <div className={styles.formLabel}>Image Preview:</div>
                <img src={itemForm.image_url} alt="Preview" className={styles.imgPreview} />
              </div>
            )}

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Item Title (Optional)</label>
              <Input
                placeholder="e.g. Oak Flooring, Accent Chair"
                value={itemForm.title}
                onChange={e => setItemForm({ ...itemForm, title: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Notes & Remarks (Optional)</label>
              <Textarea
                placeholder="e.g. Matches the primary color palette. Sourced from local supplier."
                value={itemForm.notes}
                onChange={e => setItemForm({ ...itemForm, notes: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <Button type="button" variant="outline" onClick={() => setIsAddItemOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={isUploading || !itemForm.image_url}>Save Item</Button>
            </div>
          </form>
        </Modal>

        {/* Fullscreen Image Preview */}
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
          gap: '16px',
          marginBottom: '20px'
        }}>
          <div>
            <strong>⚠️ Design Revision Limit Exceeded:</strong> The client has requested <strong>{currentRevisions}</strong> revisions, reaching or exceeding the contractual limit of <strong>{allowedRevisions}</strong> revisions. You can raise a Change Order to authorize commercial recovery.
          </div>
        </div>
      )}

      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <h2 className={styles.title}>Mood Boards & Concept Designs</h2>
          <p className={styles.description}>Present design concepts, mood boards, and references to clients and track approvals.</p>
        </div>
        <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
          ➕ Create Design Asset
        </Button>
      </div>

      <div className={styles.filters}>
        <button
          className={`${styles.filterBtn} ${activeFilter === 'all' ? styles.filterBtnActive : ''}`}
          onClick={() => setActiveFilter('all')}
        >
          All Assets ({assets.length})
        </button>
        <button
          className={`${styles.filterBtn} ${activeFilter === 'mood_board' ? styles.filterBtnActive : ''}`}
          onClick={() => setActiveFilter('mood_board')}
        >
          Mood Boards ({assets.filter(a => a.asset_type === 'mood_board').length})
        </button>
        <button
          className={`${styles.filterBtn} ${activeFilter === 'concept_board' ? styles.filterBtnActive : ''}`}
          onClick={() => setActiveFilter('concept_board')}
        >
          Concept Boards ({assets.filter(a => a.asset_type === 'concept_board').length})
        </button>
        <button
          className={`${styles.filterBtn} ${activeFilter === 'reference_collection' ? styles.filterBtnActive : ''}`}
          onClick={() => setActiveFilter('reference_collection')}
        >
          Reference Collections ({assets.filter(a => a.asset_type === 'reference_collection').length})
        </button>
      </div>

      {filteredAssets.length === 0 ? (
        <EmptyState
          icon="🎨"
          title="No Design Assets Found"
          description="Create mood boards or concept presentations to share your creative vision with the client."
          action={{
            label: "Create Design Asset",
            onClick: () => setIsCreateOpen(true)
          }}
        />
      ) : (
        <div className={styles.grid}>
          {filteredAssets.map(asset => (
            <div key={asset.id} className={styles.assetCard} onClick={() => setSelectedAsset(asset)}>
              {/* Image Preview strip */}
              <div className={styles.cardPreview}>
                {asset.items && asset.items.length > 0 ? (
                  asset.items.slice(0, 3).map((item, idx) => (
                    <img key={item.id || idx} src={item.image_url} alt="Preview" className={styles.previewImg} />
                  ))
                ) : (
                  <div className={styles.previewPlaceholder}>
                    <span style={{ fontSize: '24px' }}>🖼️</span>
                    <span>No references added</span>
                  </div>
                )}
                {asset.items && asset.items.length === 1 && <div style={{ height: '100%', background: '#eaeaea' }}></div>}
                {asset.items && asset.items.length === 2 && <div style={{ height: '100%', background: '#eaeaea' }}></div>}
              </div>

              <div className={styles.cardContent}>
                <div className={styles.cardHeader}>
                  <Badge variant="info">{getTypeName(asset.asset_type)}</Badge>
                  <Badge variant={getBadgeVariant(asset.status)}>{getStatusLabel(asset.status)}</Badge>
                </div>
                <div>
                  <h3 className={styles.cardTitle}>{asset.title}</h3>
                  {asset.description && <p className={styles.cardDesc}>{asset.description}</p>}
                </div>
              </div>

              <div className={styles.cardFooter}>
                <span className={styles.itemCount}>
                  📂 {asset.items?.length || 0} reference{asset.items?.length !== 1 ? 's' : ''}
                </span>

                <div style={{ display: 'flex', gap: '8px' }} onClick={e => e.stopPropagation()}>
                  <Button variant="outline" size="sm" onClick={() => handleToggleVisibility(asset, !asset.is_visible_to_client)} title="Toggle Client Visibility">
                    {asset.is_visible_to_client ? '👁️' : '🙈'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setEditingAsset(asset); setIsEditModalOpen(true); }} title="Edit Details">
                    ✏️
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDeleteAsset(asset.id)} title="Delete Asset">
                    🗑️
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create Design Asset">
        <form onSubmit={handleCreateAsset} className={styles.form}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Title</label>
            <Input
              required
              placeholder="e.g. Master Bedroom Mood Board"
              value={assetForm.title}
              onChange={e => setAssetForm({ ...assetForm, title: e.target.value })}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Asset Type</label>
            <Select
              value={assetForm.asset_type}
              onChange={e => setAssetForm({ ...assetForm, asset_type: e.target.value })}
            >
              {ASSET_TYPES.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Description (Optional)</label>
            <Textarea
              placeholder="Describe the concept, themes, materials or lighting for this board..."
              value={assetForm.description}
              onChange={e => setAssetForm({ ...assetForm, description: e.target.value })}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.toggleContainer}>
              <input
                type="checkbox"
                className={styles.toggleInput}
                checked={assetForm.is_visible_to_client}
                onChange={e => setAssetForm({ ...assetForm, is_visible_to_client: e.target.checked })}
              />
              <span className={styles.formLabel} style={{ marginBottom: 0 }}>Publish & make visible to client portal</span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary">Create</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); setEditingAsset(null); }} title="Edit Design Asset details">
        {editingAsset && (
          <form onSubmit={handleUpdateAsset} className={styles.form}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Title</label>
              <Input
                required
                placeholder="e.g. Master Bedroom Mood Board"
                value={editingAsset.title}
                onChange={e => setEditingAsset({ ...editingAsset, title: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Asset Type</label>
              <Select
                value={editingAsset.asset_type}
                onChange={e => setEditingAsset({ ...editingAsset, asset_type: e.target.value })}
              >
                {ASSET_TYPES.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Description</label>
              <Textarea
                placeholder="e.g. Color palette, materials, styling inspirations..."
                value={editingAsset.description || ''}
                onChange={e => setEditingAsset({ ...editingAsset, description: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Status</label>
              <Select
                value={editingAsset.status}
                onChange={e => setEditingAsset({ ...editingAsset, status: e.target.value })}
              >
                <option value="draft">Draft</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="revision_requested">Revision Requested</option>
              </Select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.toggleContainer}>
                <input
                  type="checkbox"
                  className={styles.toggleInput}
                  checked={editingAsset.is_visible_to_client}
                  onChange={e => setEditingAsset({ ...editingAsset, is_visible_to_client: e.target.checked })}
                />
                <span className={styles.formLabel} style={{ marginBottom: 0 }}>Visible to Client Portal</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <Button type="button" variant="outline" onClick={() => { setIsEditModalOpen(false); setEditingAsset(null); }}>Cancel</Button>
              <Button type="submit" variant="primary">Save Changes</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );

  // Helper toggle
  function setIsCreateOpen(val) {
    setIsCreateModalOpen(val);
  }
}
