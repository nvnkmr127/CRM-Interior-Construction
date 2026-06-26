import React, { useState, useEffect } from 'react';
import { Button, Badge, Modal, Input, EmptyState, Spinner } from '../ui';
import { useToast } from '../../store/toastContext';
import styles from './MaterialPalettesTab.module.css';
import {
  getMaterialPalettes,
  createMaterialPalette,
  updateMaterialPalette,
  deleteMaterialPalette
} from '../../api/projects';

export default function MaterialPalettesTab({ projectId }) {
  const toast = useToast();
  const [paletteItems, setPaletteItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Forms
  const [createForm, setCreateForm] = useState({
    room_name: '',
    item_name: '',
    brand: '',
    shade_code: '',
    finish: '',
    image_url: '',
    status: 'pending_approval'
  });
  const [isUploading, setIsUploading] = useState(false);

  // Swatch Zoom overlay
  const [zoomImageUrl, setZoomImageUrl] = useState(null);

  useEffect(() => {
    if (projectId) {
      fetchPalettes();
    }
  }, [projectId]);

  const fetchPalettes = async () => {
    setLoading(true);
    try {
      const res = await getMaterialPalettes(projectId);
      if (res.data?.success) {
        setPaletteItems(res.data.data || []);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load material palettes.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.room_name.trim() || !createForm.item_name.trim()) {
      return toast.error('Room name and Item name are required.');
    }

    try {
      const res = await createMaterialPalette(projectId, createForm);
      if (res.data?.success) {
        setPaletteItems([res.data.data, ...paletteItems]);
        setIsCreateOpen(false);
        setCreateForm({
          room_name: '',
          item_name: '',
          brand: '',
          shade_code: '',
          finish: '',
          image_url: '',
          status: 'pending_approval'
        });
        toast.success('Material specification added.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to add material palette item.');
    }
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!editingItem?.room_name.trim() || !editingItem?.item_name.trim()) {
      return toast.error('Room name and Item name are required.');
    }

    try {
      const res = await updateMaterialPalette(projectId, editingItem.id, editingItem);
      if (res.data?.success) {
        setPaletteItems(paletteItems.map(item => item.id === editingItem.id ? res.data.data : item));
        setIsEditOpen(false);
        setEditingItem(null);
        toast.success('Material specification updated.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update material palette item.');
    }
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm('Are you sure you want to delete this material selection?')) return;

    try {
      const res = await deleteMaterialPalette(projectId, id);
      if (res.data?.success) {
        setPaletteItems(paletteItems.filter(item => item.id !== id));
        toast.success('Material specification deleted.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete material palette item.');
    }
  };

  const handleFileUpload = (e, isEdit = false) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Please upload an image file for swatches.');

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const url = uploadEvent.target.result;
      if (isEdit) {
        setEditingItem(prev => ({ ...prev, image_url: url }));
      } else {
        setCreateForm(prev => ({ ...prev, image_url: url }));
      }
      setIsUploading(false);
      toast.success('Swatch loaded.');
    };
    reader.onerror = () => {
      setIsUploading(false);
      toast.error('Failed to read file.');
    };
    reader.readAsDataURL(file);
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
  const getBadgeVariant = (status) => {
    switch (status) {
      case 'approved': return 'success';
      case 'revision_requested': return 'danger';
      default: return 'warning';
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

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <Spinner size="lg" />
        <div style={{ marginTop: '12px', color: 'var(--color-text-muted)' }}>Loading color & material palettes...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <h2 className={styles.title}>Material Selection & Color Palettes</h2>
          <p className={styles.description}>
            Track shade codes, brand names, and finishes for construction materials room-by-room and collect formal client sign-off.
          </p>
        </div>
        <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
          ➕ Add Material Specification
        </Button>
      </div>

      {paletteItems.length === 0 ? (
        <EmptyState
          icon="🎨"
          title="No Material Palette Items Found"
          description="Create room-wise lists of paints, laminates, fabrics, and fittings to lock in material choices."
          action={{
            label: "Add Material Specification",
            onClick: () => setIsCreateOpen(true)
          }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {Object.keys(groupedByRoom).map(roomName => (
            <div key={roomName} className={styles.roomSection}>
              <h3 className={styles.roomHeader}>{roomName}</h3>
              
              <div className={styles.grid}>
                {groupedByRoom[roomName].map(item => (
                  <div key={item.id} className={styles.card}>
                    {/* Color Swatch */}
                    <div className={styles.swatchWrapper}>
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.item_name}
                          className={styles.swatch}
                          onClick={() => setZoomImageUrl(item.image_url)}
                          style={{ cursor: 'zoom-in' }}
                        />
                      ) : (
                        <div className={styles.swatchPlaceholder}>
                          <span style={{ fontSize: '24px' }}>🎨</span>
                          <span>No swatch image</span>
                        </div>
                      )}
                    </div>

                    {/* Card Content */}
                    <div className={styles.cardContent}>
                      <div className={styles.cardHeader}>
                        <div className={styles.itemName}>{item.item_name}</div>
                        <Badge variant={getBadgeVariant(item.status)}>{getStatusLabel(item.status)}</Badge>
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
                          <strong>Feedback:</strong> "{item.client_feedback}"
                        </div>
                      )}
                    </div>

                    {/* Card Footer */}
                    <div className={styles.cardFooter}>
                      <div className={styles.approvalMeta}>
                        {item.status === 'approved' && item.client_approved_at ? (
                          <span>Signed off on {new Date(item.client_approved_at).toLocaleDateString()}</span>
                        ) : (
                          <span>Awaiting client</span>
                        )}
                      </div>

                      <div className={styles.actions}>
                        <Button variant="outline" size="sm" onClick={() => { setEditingItem(item); setIsEditOpen(true); }} title="Edit specification">
                          ✏️
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDeleteItem(item.id)} title="Delete selection">
                          🗑️
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Add Material Selection">
        <form onSubmit={handleCreateSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Room / Category *</label>
            <Input
              required
              placeholder="e.g. Living Room, Master Bedroom, Kitchen"
              value={createForm.room_name}
              onChange={e => setCreateForm({ ...createForm, room_name: e.target.value })}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Item / Product Category *</label>
            <Input
              required
              placeholder="e.g. Wall Paint, Primary Laminate, Sofa Fabric"
              value={createForm.item_name}
              onChange={e => setCreateForm({ ...createForm, item_name: e.target.value })}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Brand</label>
            <Input
              placeholder="e.g. Asian Paints, CenturyPly, Hafele"
              value={createForm.brand}
              onChange={e => setCreateForm({ ...createForm, brand: e.target.value })}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Shade Code / Catalog Ref</label>
            <Input
              placeholder="e.g. AP-8231, Teak Wood 421"
              value={createForm.shade_code}
              onChange={e => setCreateForm({ ...createForm, shade_code: e.target.value })}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Finish</label>
            <Input
              placeholder="e.g. Matte, High Gloss, Satin Veneer"
              value={createForm.finish}
              onChange={e => setCreateForm({ ...createForm, finish: e.target.value })}
            />
          </div>

          {/* Swatch upload */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Option A: Swatch Picture Upload</label>
            <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, false)} style={{ display: 'none' }} id="palette-item-upload" />
            <div className={styles.uploadTrigger} onClick={() => document.getElementById('palette-item-upload').click()}>
              <div className={styles.uploadIcon}>📸</div>
              <div className={styles.uploadText}>{isUploading ? 'Loading...' : 'Select Swatch Picture'}</div>
            </div>
          </div>

          <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>— OR —</div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Option B: Swatch Image URL</label>
            <Input
              placeholder="https://example.com/swatch.jpg"
              value={createForm.image_url}
              onChange={e => setCreateForm({ ...createForm, image_url: e.target.value })}
            />
          </div>

          {createForm.image_url && (
            <div>
              <div className={styles.formLabel}>Swatch Preview:</div>
              <img src={createForm.image_url} alt="Preview" className={styles.imgPreview} />
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={isUploading}>Save Selection</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={isEditOpen} onClose={() => { setIsEditOpen(false); setEditingItem(null); }} title="Edit Material Selection">
        {editingItem && (
          <form onSubmit={handleUpdateSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Room / Category *</label>
              <Input
                required
                placeholder="e.g. Living Room, Master Bedroom, Kitchen"
                value={editingItem.room_name}
                onChange={e => setEditingItem({ ...editingItem, room_name: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Item / Product Category *</label>
              <Input
                required
                placeholder="e.g. Wall Paint, Primary Laminate, Sofa Fabric"
                value={editingItem.item_name}
                onChange={e => setEditingItem({ ...editingItem, item_name: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Brand</label>
              <Input
                placeholder="e.g. Asian Paints, CenturyPly, Hafele"
                value={editingItem.brand || ''}
                onChange={e => setEditingItem({ ...editingItem, brand: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Shade Code</label>
              <Input
                placeholder="e.g. AP-8231, Teak Wood 421"
                value={editingItem.shade_code || ''}
                onChange={e => setEditingItem({ ...editingItem, shade_code: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Finish</label>
              <Input
                placeholder="e.g. Matte, High Gloss, Satin Veneer"
                value={editingItem.finish || ''}
                onChange={e => setEditingItem({ ...editingItem, finish: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Status</label>
              <select
                style={{ padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '0.9rem', outline: 'none' }}
                value={editingItem.status}
                onChange={e => setEditingItem({ ...editingItem, status: e.target.value })}
              >
                <option value="pending_approval">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="revision_requested">Revision Requested</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Swatch Picture Upload</label>
              <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, true)} style={{ display: 'none' }} id="palette-item-upload-edit" />
              <div className={styles.uploadTrigger} onClick={() => document.getElementById('palette-item-upload-edit').click()}>
                <div className={styles.uploadIcon}>📸</div>
                <div className={styles.uploadText}>{isUploading ? 'Loading...' : 'Select Swatch Picture'}</div>
              </div>
            </div>

            <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>— OR —</div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Swatch Image URL</label>
              <Input
                placeholder="https://example.com/swatch.jpg"
                value={editingItem.image_url || ''}
                onChange={e => setEditingItem({ ...editingItem, image_url: e.target.value })}
              />
            </div>

            {editingItem.image_url && (
              <div>
                <div className={styles.formLabel}>Swatch Preview:</div>
                <img src={editingItem.image_url} alt="Preview" className={styles.imgPreview} />
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <Button type="button" variant="outline" onClick={() => { setIsEditOpen(false); setEditingItem(null); }}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={isUploading}>Save Changes</Button>
            </div>
          </form>
        )}
      </Modal>

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
