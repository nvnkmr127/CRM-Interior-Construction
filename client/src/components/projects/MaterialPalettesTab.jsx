/* eslint-disable no-unused-vars, react-hooks/immutability, react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { Button, Badge, Modal, Input, EmptyState, Spinner } from '../ui';
import { useToast } from '../../store/toastContext';
import styles from './MaterialPalettesTab.module.css';
import {
  getMaterialPalettes,
  getMaterialPaletteBOQItems,
  createMaterialPalette,
  updateMaterialPalette,
  deleteMaterialPalette
} from '../../api/projects';

const SAMPLE_CATEGORIES = [
  { value: '', label: 'Select Category' },
  { value: 'Paint', label: 'Paint' },
  { value: 'Laminate', label: 'Laminate' },
  { value: 'Veneer', label: 'Veneer' },
  { value: 'Tile / Marble', label: 'Tile / Marble' },
  { value: 'Fabric', label: 'Fabric' },
  { value: 'Hardware / Fittings', label: 'Hardware / Fittings' },
  { value: 'Glass / Mirror', label: 'Glass / Mirror' },
  { value: 'Wallpaper', label: 'Wallpaper' },
  { value: 'Wood / Plywood', label: 'Wood / Plywood' },
  { value: 'Other', label: 'Other' }
];

const DECISIONS = [
  { value: 'deferred', label: 'Deferred / Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' }
];

export default function MaterialPalettesTab({ projectId }) {
  const toast = useToast();
  const [paletteItems, setPaletteItems] = useState([]);
  const [boqItems, setBoqItems] = useState([]);
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
    status: 'pending_approval',
    sample_category: '',
    date_presented: '',
    client_decision: 'deferred',
    approved_by_signature: '',
    boq_item_id: ''
  });
  const [isUploading, setIsUploading] = useState(false);

  // Swatch Zoom overlay
  const [zoomImageUrl, setZoomImageUrl] = useState(null);

  useEffect(() => {
    if (projectId) {
      initTab();
    }
  }, [projectId]);

  const initTab = async () => {
    setLoading(true);
    try {
      const [paletteRes, boqRes] = await Promise.all([
        getMaterialPalettes(projectId),
        getMaterialPaletteBOQItems(projectId)
      ]);
      if (paletteRes.data?.success) {
        setPaletteItems(paletteRes.data.data || []);
      }
      if (boqRes.data?.success) {
        setBoqItems(boqRes.data.data || []);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load material palette or BOQ references.');
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
      const payload = {
        ...createForm,
        date_presented: createForm.date_presented || null,
        boq_item_id: createForm.boq_item_id || null
      };

      const res = await createMaterialPalette(projectId, payload);
      if (res.data?.success) {
        const paletteRes = await getMaterialPalettes(projectId);
        if (paletteRes.data?.success) {
          setPaletteItems(paletteRes.data.data || []);
        }
        setIsCreateOpen(false);
        setCreateForm({
          room_name: '',
          item_name: '',
          brand: '',
          shade_code: '',
          finish: '',
          image_url: '',
          status: 'pending_approval',
          sample_category: '',
          date_presented: '',
          client_decision: 'deferred',
          approved_by_signature: '',
          boq_item_id: ''
        });
        toast.success('Material sample selection added.');
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
      const payload = {
        ...editingItem,
        date_presented: editingItem.date_presented || null,
        boq_item_id: editingItem.boq_item_id || null
      };

      const res = await updateMaterialPalette(projectId, editingItem.id, payload);
      if (res.data?.success) {
        const paletteRes = await getMaterialPalettes(projectId);
        if (paletteRes.data?.success) {
          setPaletteItems(paletteRes.data.data || []);
        }
        setIsEditOpen(false);
        setEditingItem(null);
        toast.success('Material sample specification updated.');
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
  const getBadgeVariant = (decision) => {
    switch (decision) {
      case 'approved': return 'success';
      case 'rejected': return 'danger';
      default: return 'warning';
    }
  };

  const getDecisionLabel = (decision) => {
    switch (decision) {
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'deferred': return 'Deferred / Under Review';
      default: return decision || 'Deferred';
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <span>Loading color & material palettes...</span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <h2 className={styles.title}>Physical Sample & Material approvals</h2>
          <p className={styles.description}>
            Track physical material samples presented to clients, record client decisions (approval/rejection), log sign-offs, and link selections to BOQ items.
          </p>
        </div>
        <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
          ➕ Add Material Sample
        </Button>
      </div>

      {paletteItems.length === 0 ? (
        <EmptyState
          icon="🎨"
          title="No Material Palette Items Found"
          description="Create room-wise lists of paint swatches, laminates, veneer samples, hardware, and fabrics to record client approvals."
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
                  <div key={item.id} className={styles.card} style={{ borderTop: `4px solid ${item.client_decision === 'approved' ? '#10b981' : item.client_decision === 'rejected' ? '#ef4444' : '#f59e0b'}` }}>
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
                        <Badge variant={getBadgeVariant(item.client_decision)}>{getDecisionLabel(item.client_decision)}</Badge>
                      </div>

                      <div className={styles.specsList}>
                        {item.sample_category && (
                          <div className={styles.specRow}>
                            <span className={styles.specLabel}>Category:</span>
                            <span className={styles.specVal} style={{ fontWeight: 600 }}>{item.sample_category}</span>
                          </div>
                        )}
                        <div className={styles.specRow}>
                          <span className={styles.specLabel}>Brand:</span>
                          <span className={styles.specVal}>{item.brand || '—'}</span>
                        </div>
                        <div className={styles.specRow}>
                          <span className={styles.specLabel}>Shade / Code:</span>
                          <span className={styles.specVal}>{item.shade_code || '—'}</span>
                        </div>
                        <div className={styles.specRow}>
                          <span className={styles.specLabel}>Finish:</span>
                          <span className={styles.specVal}>{item.finish || '—'}</span>
                        </div>
                        {item.date_presented && (
                          <div className={styles.specRow}>
                            <span className={styles.specLabel}>Presented:</span>
                            <span className={styles.specVal}>{new Date(item.date_presented).toLocaleDateString('en-IN')}</span>
                          </div>
                        )}
                        {item.boq_item_id && (
                          <div className={styles.specRow} style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed var(--color-border)' }}>
                            <span className={styles.specLabel}>BOQ Line:</span>
                            <span className={styles.specVal} style={{ color: 'var(--color-primary)', fontSize: '11px', fontWeight: 500 }}>
                              📁 {item.boq_room_or_area ? `[${item.boq_room_or_area}] ` : ''}{item.boq_item_name}
                            </span>
                          </div>
                        )}
                      </div>

                      {item.client_feedback && (
                        <div className={styles.feedbackBox}>
                          <strong>Feedback / Reason:</strong> "{item.client_feedback}"
                        </div>
                      )}
                    </div>

                    {/* Card Footer */}
                    <div className={styles.cardFooter}>
                      <div className={styles.approvalMeta}>
                        {item.client_decision === 'approved' && item.approved_by_signature ? (
                          <span style={{ fontSize: '11px', color: '#047857', fontWeight: 600 }}>✍️ Signed by {item.approved_by_signature}</span>
                        ) : item.client_decision === 'approved' && item.client_approved_at ? (
                          <span>Signed off on {new Date(item.client_approved_at).toLocaleDateString()}</span>
                        ) : (
                          <span>Unsigned</span>
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
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Add Material Sample & Decision">
        <form onSubmit={handleCreateSubmit} className={styles.form}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Room / Area *</label>
              <Input
                required
                placeholder="e.g. Living Room, Kitchen"
                value={createForm.room_name}
                onChange={e => setCreateForm({ ...createForm, room_name: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Sample Item Name *</label>
              <Input
                required
                placeholder="e.g. Main Wardrobe Laminate"
                value={createForm.item_name}
                onChange={e => setCreateForm({ ...createForm, item_name: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Sample Category</label>
              <select
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '0.9rem', outline: 'none' }}
                value={createForm.sample_category}
                onChange={e => setCreateForm({ ...createForm, sample_category: e.target.value })}
              >
                {SAMPLE_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Date Presented</label>
              <Input
                type="date"
                value={createForm.date_presented}
                onChange={e => setCreateForm({ ...createForm, date_presented: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Brand</label>
              <Input
                placeholder="e.g. CenturyPly, Hafele"
                value={createForm.brand}
                onChange={e => setCreateForm({ ...createForm, brand: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Shade Code / Catalog Ref</label>
              <Input
                placeholder="e.g. Teak Wood 234"
                value={createForm.shade_code}
                onChange={e => setCreateForm({ ...createForm, shade_code: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Finish</label>
              <Input
                placeholder="e.g. Matte, High Gloss"
                value={createForm.finish}
                onChange={e => setCreateForm({ ...createForm, finish: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Link to BOQ Item</label>
              <select
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '0.9rem', outline: 'none' }}
                value={createForm.boq_item_id}
                onChange={e => setCreateForm({ ...createForm, boq_item_id: e.target.value })}
              >
                <option value="">Do not link / Select BOQ item</option>
                {boqItems.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.room_or_area ? `[${item.room_or_area}] ` : ''}{item.item_name} {item.brand ? `(${item.brand})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Client Decision</label>
              <select
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '0.9rem', outline: 'none' }}
                value={createForm.client_decision}
                onChange={e => setCreateForm({ ...createForm, client_decision: e.target.value })}
              >
                {DECISIONS.map(dec => (
                  <option key={dec.value} value={dec.value}>{dec.label}</option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Approved-By Signature / Acknowledgement</label>
              <Input
                placeholder="e.g. Signed by Jane Doe"
                value={createForm.approved_by_signature}
                onChange={e => setCreateForm({ ...createForm, approved_by_signature: e.target.value })}
              />
            </div>
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

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={isUploading}>Save Selection</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={isEditOpen} onClose={() => { setIsEditOpen(false); setEditingItem(null); }} title="Edit Material Sample & Decision">
        {editingItem && (
          <form onSubmit={handleUpdateSubmit} className={styles.form}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Room / Area *</label>
                <Input
                  required
                  placeholder="e.g. Living Room, Kitchen"
                  value={editingItem.room_name}
                  onChange={e => setEditingItem({ ...editingItem, room_name: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Sample Item Name *</label>
                <Input
                  required
                  placeholder="e.g. Main Wardrobe Laminate"
                  value={editingItem.item_name}
                  onChange={e => setEditingItem({ ...editingItem, item_name: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Sample Category</label>
                <select
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '0.9rem', outline: 'none' }}
                  value={editingItem.sample_category || ''}
                  onChange={e => setEditingItem({ ...editingItem, sample_category: e.target.value })}
                >
                  {SAMPLE_CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Date Presented</label>
                <Input
                  type="date"
                  value={editingItem.date_presented ? editingItem.date_presented.substring(0, 10) : ''}
                  onChange={e => setEditingItem({ ...editingItem, date_presented: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Brand</label>
                <Input
                  placeholder="e.g. CenturyPly, Hafele"
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
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Finish</label>
                <Input
                  placeholder="e.g. Matte, High Gloss"
                  value={editingItem.finish || ''}
                  onChange={e => setEditingItem({ ...editingItem, finish: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Link to BOQ Item</label>
                <select
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '0.9rem', outline: 'none' }}
                  value={editingItem.boq_item_id || ''}
                  onChange={e => setEditingItem({ ...editingItem, boq_item_id: e.target.value })}
                >
                  <option value="">Do not link / Select BOQ item</option>
                  {boqItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.room_or_area ? `[${item.room_or_area}] ` : ''}{item.item_name} {item.brand ? `(${item.brand})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Client Decision</label>
                <select
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '0.9rem', outline: 'none' }}
                  value={editingItem.client_decision || 'deferred'}
                  onChange={e => setEditingItem({ ...editingItem, client_decision: e.target.value })}
                >
                  {DECISIONS.map(dec => (
                    <option key={dec.value} value={dec.value}>{dec.label}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Approved-By Signature / Acknowledgement</label>
                <Input
                  placeholder="e.g. Signed by Jane Doe"
                  value={editingItem.approved_by_signature || ''}
                  onChange={e => setEditingItem({ ...editingItem, approved_by_signature: e.target.value })}
                />
              </div>
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

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Client Feedback</label>
              <Input
                placeholder="e.g. Shade is slightly darker than expected"
                value={editingItem.client_feedback || ''}
                onChange={e => setEditingItem({ ...editingItem, client_feedback: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
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
