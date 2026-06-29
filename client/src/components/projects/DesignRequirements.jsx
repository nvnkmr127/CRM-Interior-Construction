import React, { useState, useEffect } from 'react';
import { Button, Badge, Card, Modal, Input, Textarea, Select } from '../ui';
import { useToast } from '../../store/toastContext';
import styles from './DesignRequirements.module.css';
import {
  getDesignRequirements,
  updateDesignRequirements,
  createRoomRequirement,
  updateRoomRequirement,
  deleteRoomRequirement,
  createProjectInspiration,
  deleteProjectInspiration
} from '../../api/projects';

const INTERIOR_STYLES = [
  { id: '', label: 'Select Style' },
  { id: 'Modern', label: 'Modern' },
  { id: 'Minimalist', label: 'Minimalist' },
  { id: 'Japandi', label: 'Japandi' },
  { id: 'Traditional', label: 'Traditional' },
  { id: 'Industrial', label: 'Industrial' },
  { id: 'Bohemian', label: 'Bohemian' },
  { id: 'Scandinavian', label: 'Scandinavian' },
  { id: 'Transitional', label: 'Transitional' }
];

const KITCHEN_STYLES = [
  { id: '', label: 'Select Kitchen Style' },
  { id: 'L-Shaped', label: 'L-Shaped' },
  { id: 'U-Shaped', label: 'U-Shaped' },
  { id: 'Parallel', label: 'Parallel' },
  { id: 'Straight', label: 'Straight' },
  { id: 'Island', label: 'Island' }
];

const WARDROBE_STYLES = [
  { id: '', label: 'Select Wardrobe Style' },
  { id: 'Sliding Door', label: 'Sliding Door' },
  { id: 'Hinged Door', label: 'Hinged Door' },
  { id: 'Walk-in Wardrobe', label: 'Walk-in Wardrobe' }
];

const PRIORITIES = [
  { id: 'Must-have', label: 'Must-have' },
  { id: 'Nice-to-have', label: 'Nice-to-have' },
  { id: 'High', label: 'High Priority' },
  { id: 'Medium', label: 'Medium Priority' },
  { id: 'Low', label: 'Low Priority' }
];

const BRAND_FLEXIBILITIES = [
  { id: '', label: 'Select Brand Flexibility' },
  { id: 'Strict Premium', label: 'Strict Premium (Premium/Imported Only)' },
  { id: 'Standard Branded', label: 'Standard Branded (Preferred Standard Brands)' },
  { id: 'Value Centric', label: 'Value Centric (Local/Cost-Effective)' },
  { id: 'Flexible', label: 'Flexible (Open to Designer Recommendations)' }
];

const BUDGET_CATEGORIES = [
  { key: 'woodwork', label: 'Woodwork / Furniture' },
  { key: 'civil', label: 'Civil & Flooring' },
  { key: 'false_ceiling', label: 'False Ceiling' },
  { key: 'painting', label: 'Painting & Wallpaper' },
  { key: 'electrical', label: 'Electrical & Lighting' },
  { key: 'decor', label: 'Decor & Furnishing' },
  { key: 'appliances', label: 'Appliances / Home Automation' }
];

export default function DesignRequirements({ projectId }) {
  const toast = useToast();
  
  // Data states
  const [stylesData, setStylesData] = useState({
    interior_style: '',
    color_theme: '',
    material_preference: '',
    kitchen_style: '',
    wardrobe_style: '',
    lighting_preference: '',
    flooring_preference: '',
    lifestyle_inputs: '',
    must_haves: '',
    nice_to_haves: '',
    family_size: '',
    usage_patterns: '',
    storage_priorities: '',
    brand_flexibility: '',
    brand_remarks: '',
    existing_furniture: '',
    budget_category_allocation: {}
  });
  
  const [rooms, setRooms] = useState([]);
  const [inspirations, setInspirations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingStyles, setSavingStyles] = useState(false);

  // UI state for Room Modal
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [roomForm, setRoomForm] = useState({
    room_name: '',
    budget_allocation: '',
    priority: 'Must-have',
    functional_requirements: '',
    remarks: ''
  });

  // UI state for Inspiration Add Panel
  const [isAddingInspiration, setIsAddingInspiration] = useState(false);
  const [newInspiration, setNewInspiration] = useState({
    image_url: '',
    room_type: '',
    notes: ''
  });
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getDesignRequirements(projectId);
      if (res.data?.success) {
        const { designRequirements, roomRequirements, inspirations } = res.data.data;
        if (designRequirements) {
          setStylesData({
            interior_style: designRequirements.interior_style || '',
            color_theme: designRequirements.color_theme || '',
            material_preference: designRequirements.material_preference || '',
            kitchen_style: designRequirements.kitchen_style || '',
            wardrobe_style: designRequirements.wardrobe_style || '',
            lighting_preference: designRequirements.lighting_preference || '',
            flooring_preference: designRequirements.flooring_preference || '',
            lifestyle_inputs: designRequirements.lifestyle_inputs || '',
            must_haves: designRequirements.must_haves || '',
            nice_to_haves: designRequirements.nice_to_haves || '',
            family_size: designRequirements.family_size !== null && designRequirements.family_size !== undefined ? String(designRequirements.family_size) : '',
            usage_patterns: designRequirements.usage_patterns || '',
            storage_priorities: designRequirements.storage_priorities || '',
            brand_flexibility: designRequirements.brand_flexibility || '',
            brand_remarks: designRequirements.brand_remarks || '',
            existing_furniture: designRequirements.existing_furniture || '',
            budget_category_allocation: designRequirements.budget_category_allocation || {}
          });
        }
        setRooms(roomRequirements || []);
        setInspirations(inspirations || []);
      }
    } catch (e) {
      toast.error('Failed to load design requirements');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Calculate sum of category budgets
  const getCategoryBudgetTotal = () => {
    const alloc = stylesData.budget_category_allocation || {};
    return Object.values(alloc).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
  };

  // 1. Save style preferences
  const handleSaveStyles = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setSavingStyles(true);
    try {
      const payload = {
        ...stylesData,
        family_size: stylesData.family_size ? parseInt(stylesData.family_size, 10) : null
      };
      const res = await updateDesignRequirements(projectId, payload);
      if (res.data?.success) {
        toast.success('Design brief saved successfully');
      }
    } catch (e) {
      toast.error('Failed to save style preferences');
      console.error(e);
    } finally {
      setSavingStyles(false);
    }
  };

  // 2. Room Action Handlers
  const openAddRoomModal = () => {
    setEditingRoom(null);
    setRoomForm({
      room_name: '',
      budget_allocation: '',
      priority: 'Must-have',
      functional_requirements: '',
      remarks: ''
    });
    setIsRoomModalOpen(true);
  };

  const openEditRoomModal = (room) => {
    setEditingRoom(room);
    setRoomForm({
      room_name: room.room_name || '',
      budget_allocation: room.budget_allocation !== null ? String(room.budget_allocation) : '',
      priority: room.priority || 'Must-have',
      functional_requirements: room.functional_requirements || '',
      remarks: room.remarks || ''
    });
    setIsRoomModalOpen(true);
  };

  const handleRoomSubmit = async (e) => {
    e.preventDefault();
    if (!roomForm.room_name.trim()) return toast.error('Room name is required');
    
    const payload = {
      ...roomForm,
      budget_allocation: roomForm.budget_allocation ? Number(roomForm.budget_allocation) : null
    };

    try {
      if (editingRoom) {
        // Update
        const res = await updateRoomRequirement(projectId, editingRoom.id, payload);
        if (res.data?.success) {
          setRooms(rooms.map(r => r.id === editingRoom.id ? res.data.data : r));
          toast.success('Room requirement updated');
        }
      } else {
        // Create
        const res = await createRoomRequirement(projectId, payload);
        if (res.data?.success) {
          setRooms([...rooms, res.data.data]);
          toast.success('Room requirement added');
        }
      }
      setIsRoomModalOpen(false);
    } catch (e) {
      toast.error('Failed to save room requirement');
      console.error(e);
    }
  };

  const handleRoomDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this room requirement?')) return;
    try {
      await deleteRoomRequirement(projectId, id);
      setRooms(rooms.filter(r => r.id !== id));
      toast.success('Room requirement deleted');
    } catch (e) {
      toast.error('Failed to delete room requirement');
      console.error(e);
    }
  };

  // 3. Inspirations Action Handlers
  const handleInspirationSubmit = async (e) => {
    e.preventDefault();
    if (!newInspiration.image_url.trim()) return toast.error('Image URL or file is required');

    let imageUrl = newInspiration.image_url.trim();
    if (!/^https?:\/\//i.test(imageUrl) && !imageUrl.startsWith('data:image')) {
      imageUrl = `https://${imageUrl}`;
    }

    try {
      const res = await createProjectInspiration(projectId, {
        image_url: imageUrl,
        room_type: newInspiration.room_type,
        notes: newInspiration.notes
      });
      if (res.data?.success) {
        setInspirations([res.data.data, ...inspirations]);
        setIsAddingInspiration(false);
        setNewInspiration({ image_url: '', room_type: '', notes: '' });
        toast.success('Inspiration reference added');
      }
    } catch (e) {
      toast.error('Failed to add inspiration reference');
      console.error(e);
    }
  };

  const handleInspirationDelete = async (id) => {
    if (!window.confirm('Delete this inspiration?')) return;
    try {
      await deleteProjectInspiration(projectId, id);
      setInspirations(inspirations.filter(i => i.id !== id));
      toast.success('Inspiration deleted');
    } catch (e) {
      toast.error('Failed to delete inspiration');
      console.error(e);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      return toast.error('Please upload an image file');
    }
    
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setNewInspiration(prev => ({
        ...prev,
        image_url: uploadEvent.target.result
      }));
      setIsUploading(false);
      toast.success('Image loaded. Click "Save Inspiration" to add.');
    };
    reader.onerror = () => {
      setIsUploading(false);
      toast.error('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return <div style={{ padding: '32px', color: 'var(--color-text-muted)' }}>Loading design requirements…</div>;
  }

  return (
    <div className={styles.container}>
      
      {/* 1. Aesthetic & Style Preferences */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h3 className={styles.sectionTitle}>✨ Aesthetic & Style Preferences</h3>
            <p className={styles.sectionDesc}>Define the overall interior look and feel, layouts, and materials</p>
          </div>
          <Button variant="primary" size="sm" onClick={handleSaveStyles} disabled={savingStyles}>
            {savingStyles ? 'Saving...' : '💾 Save Design Brief'}
          </Button>
        </div>

        <form onSubmit={handleSaveStyles} className={styles.formGrid}>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Interior Style</label>
            <select
              className={styles.select}
              value={stylesData.interior_style}
              onChange={e => setStylesData({ ...stylesData, interior_style: e.target.value })}
            >
              {INTERIOR_STYLES.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.formField}>
            <label className={styles.formLabel}>Color Theme Preferences</label>
            <input
              type="text"
              placeholder="e.g. Earthy neutrals, teal highlights"
              className={styles.input}
              value={stylesData.color_theme}
              onChange={e => setStylesData({ ...stylesData, color_theme: e.target.value })}
            />
          </div>

          <div className={styles.formField}>
            <label className={styles.formLabel}>Kitchen Layout Style</label>
            <select
              className={styles.select}
              value={stylesData.kitchen_style}
              onChange={e => setStylesData({ ...stylesData, kitchen_style: e.target.value })}
            >
              {KITCHEN_STYLES.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.formField}>
            <label className={styles.formLabel}>Wardrobe Mechanism Prefer.</label>
            <select
              className={styles.select}
              value={stylesData.wardrobe_style}
              onChange={e => setStylesData({ ...stylesData, wardrobe_style: e.target.value })}
            >
              {WARDROBE_STYLES.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.formField}>
            <label className={styles.formLabel}>Material Preferences</label>
            <input
              type="text"
              placeholder="e.g. Matte laminates, teak wood accents, quartz tops"
              className={styles.input}
              value={stylesData.material_preference}
              onChange={e => setStylesData({ ...stylesData, material_preference: e.target.value })}
            />
          </div>

          <div className={styles.formField}>
            <label className={styles.formLabel}>Lighting Preferences</label>
            <input
              type="text"
              placeholder="e.g. Warm white LED coves, profiles, smart controls"
              className={styles.input}
              value={stylesData.lighting_preference}
              onChange={e => setStylesData({ ...stylesData, lighting_preference: e.target.value })}
            />
          </div>

          <div className={`${styles.formField} ${styles.fullWidth}`}>
            <label className={styles.formLabel}>Flooring Preferences</label>
            <input
              type="text"
              placeholder="e.g. Vitrified tiles, Italian marble in living room"
              className={styles.input}
              value={stylesData.flooring_preference}
              onChange={e => setStylesData({ ...stylesData, flooring_preference: e.target.value })}
            />
          </div>
        </form>
      </div>

      {/* 2. Family Profile & Space Usage */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h3 className={styles.sectionTitle}>👨‍👩‍👧‍👦 Family Profile & Usage Patterns</h3>
            <p className={styles.sectionDesc}>Details about family size, daily routines, usage of spaces, and lifestyle inputs</p>
          </div>
        </div>

        <form onSubmit={handleSaveStyles} className={styles.formGrid}>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Family Size (No. of Members)</label>
            <input
              type="number"
              placeholder="e.g. 4"
              className={styles.input}
              value={stylesData.family_size}
              onChange={e => setStylesData({ ...stylesData, family_size: e.target.value })}
            />
          </div>

          <div className={styles.formField}>
            <label className={styles.formLabel}>General Lifestyle Inputs</label>
            <input
              type="text"
              placeholder="e.g. Family of 4, has a golden retriever, hosts weekly parties"
              className={styles.input}
              value={stylesData.lifestyle_inputs}
              onChange={e => setStylesData({ ...stylesData, lifestyle_inputs: e.target.value })}
            />
          </div>

          <div className={`${styles.formField} ${styles.fullWidth}`}>
            <label className={styles.formLabel}>Usage Patterns per Space</label>
            <textarea
              placeholder="e.g. Living room requires formal seating for hosting. Master bedroom needs a quiet home-office corner. Kitchen is used heavily for daily cooking."
              className={styles.textarea}
              value={stylesData.usage_patterns}
              onChange={e => setStylesData({ ...stylesData, usage_patterns: e.target.value })}
            />
          </div>
        </form>
      </div>

      {/* 3. Storage Priorities & Key Features */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h3 className={styles.sectionTitle}>📦 Storage Priorities & Must-Haves</h3>
            <p className={styles.sectionDesc}>Specify storage requirements, must-have items, and nice-to-have options</p>
          </div>
        </div>

        <form onSubmit={handleSaveStyles} className={styles.formGrid}>
          <div className={`${styles.formField} ${styles.fullWidth}`}>
            <label className={styles.formLabel}>Storage Priorities</label>
            <textarea
              placeholder="e.g. Heavy storage in kitchen loft, dedicated shoe rack for 30 pairs, walk-in wardrobe layout for Master Bedroom, books storage in living room"
              className={styles.textarea}
              value={stylesData.storage_priorities}
              onChange={e => setStylesData({ ...stylesData, storage_priorities: e.target.value })}
            />
          </div>

          <div className={`${styles.formField} ${styles.fullWidth}`}>
            <label className={styles.formLabel}>Must-Haves (Absolute Requirements)</label>
            <textarea
              placeholder="e.g. Study desk in bedroom, large utility unit, soft close hinges"
              className={styles.textarea}
              value={stylesData.must_haves}
              onChange={e => setStylesData({ ...stylesData, must_haves: e.target.value })}
            />
          </div>

          <div className={`${styles.formField} ${styles.fullWidth}`}>
            <label className={styles.formLabel}>Nice-to-Haves (Optional / Future additions)</label>
            <textarea
              placeholder="e.g. Accent brick wall, smart home hub, wine chiller"
              className={styles.textarea}
              value={stylesData.nice_to_haves}
              onChange={e => setStylesData({ ...stylesData, nice_to_haves: e.target.value })}
            />
          </div>
        </form>
      </div>

      {/* 4. Brands & Existing Assets */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h3 className={styles.sectionTitle}>🛋️ Brands & Existing Assets</h3>
            <p className={styles.sectionDesc}>Brand flexibility and list of existing items to be incorporated into design</p>
          </div>
        </div>

        <form onSubmit={handleSaveStyles} className={styles.formGrid}>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Brand Selection Flexibility</label>
            <select
              className={styles.select}
              value={stylesData.brand_flexibility}
              onChange={e => setStylesData({ ...stylesData, brand_flexibility: e.target.value })}
            >
              {BRAND_FLEXIBILITIES.map(b => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.formField}>
            <label className={styles.formLabel}>Preferred Brands / Remarks</label>
            <input
              type="text"
              placeholder="e.g. Jaquar for bath, Hettich for kitchen fittings, Asian Paints"
              className={styles.input}
              value={stylesData.brand_remarks}
              onChange={e => setStylesData({ ...stylesData, brand_remarks: e.target.value })}
            />
          </div>

          <div className={`${styles.formField} ${styles.fullWidth}`}>
            <label className={styles.formLabel}>Existing Furniture to be Incorporated</label>
            <textarea
              placeholder="e.g. Master Bedroom king-size teak bed (6ft x 6.5ft), Living room 3-seater sofa (7ft x 3.5ft), existing refrigerator (350L, double door) in kitchen"
              className={styles.textarea}
              value={stylesData.existing_furniture}
              onChange={e => setStylesData({ ...stylesData, existing_furniture: e.target.value })}
            />
          </div>
        </form>
      </div>

      {/* 5. Budget Allocation by Category */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h3 className={styles.sectionTitle}>💰 Budget Allocation by Category</h3>
            <p className={styles.sectionDesc}>Specify budgeted costs for different execution categories</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500 }}>Category Budget Total</span>
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--color-primary, #3b82f6)' }}>₹{getCategoryBudgetTotal().toLocaleString('en-IN')}</span>
          </div>
        </div>

        <form onSubmit={handleSaveStyles} className={styles.formGrid}>
          {BUDGET_CATEGORIES.map(cat => (
            <div key={cat.key} className={styles.formField}>
              <label className={styles.formLabel}>{cat.label} (₹)</label>
              <input
                type="number"
                placeholder="e.g. 150000"
                className={styles.input}
                value={stylesData.budget_category_allocation?.[cat.key] || ''}
                onChange={e => {
                  const val = e.target.value;
                  setStylesData(prev => ({
                    ...prev,
                    budget_category_allocation: {
                      ...(prev.budget_category_allocation || {}),
                      [cat.key]: val === '' ? 0 : parseFloat(val)
                    }
                  }));
                }}
              />
            </div>
          ))}
        </form>
      </div>

      {/* 6. Room Budgets & Priorities (Room-by-Room Breakdown) */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h3 className={styles.sectionTitle}>📋 Room Budgets & Priorities</h3>
            <p className={styles.sectionDesc}>Manage priorities and budgets allocated to individual rooms</p>
          </div>
          <Button variant="primary" size="sm" onClick={openAddRoomModal}>
            ➕ Add Room
          </Button>
        </div>

        {rooms.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', border: '1px dashed var(--color-border)', borderRadius: 8 }}>
            No room-level requirements recorded. Click "Add Room" to get started.
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Room</th>
                  <th className={styles.th}>Priority</th>
                  <th className={styles.th}>Budget Allocation</th>
                  <th className={styles.th}>Functional Requirements</th>
                  <th className={styles.th}>Remarks</th>
                  <th className={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map(room => (
                  <tr key={room.id} className={styles.tr}>
                    <td className={styles.td} style={{ fontWeight: 600 }}>{room.room_name}</td>
                    <td className={styles.td}>
                      <Badge variant={room.priority?.includes('Must') || room.priority === 'High' ? 'danger' : 'neutral'}>
                        {room.priority || 'Medium'}
                      </Badge>
                    </td>
                    <td className={styles.td} style={{ fontFamily: 'monospace' }}>
                      {room.budget_allocation !== null ? `₹${Number(room.budget_allocation).toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className={styles.td}>{room.functional_requirements || '—'}</td>
                    <td className={styles.td}>{room.remarks || '—'}</td>
                    <td className={styles.td}>
                      <div className={styles.actions}>
                        <button
                          className={styles.actionBtn}
                          onClick={() => openEditRoomModal(room)}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          className={`${styles.actionBtn} ${styles.deleteBtn}`}
                          onClick={() => handleRoomDelete(room.id)}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 7. Inspirations & Uploads (Style references with images) */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h3 className={styles.sectionTitle}>📸 Inspiration Board</h3>
            <p className={styles.sectionDesc}>References, mood boards, and designs shared by the client</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setIsAddingInspiration(!isAddingInspiration)}>
            {isAddingInspiration ? 'Cancel' : '➕ Add Inspiration'}
          </Button>
        </div>

        {isAddingInspiration && (
          <form onSubmit={handleInspirationSubmit} className={styles.addInspirationForm}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Option A: Upload Image File</label>
                <div className={styles.uploadTrigger} onClick={() => document.getElementById('insp-file').click()}>
                  <input
                    type="file"
                    id="insp-file"
                    style={{ display: 'none' }}
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                  <div>
                    <div className={styles.uploadIcon}>📸</div>
                    <div className={styles.uploadText}>
                      {isUploading ? 'Reading file...' : 'Click to select picture'}
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.formField}>
                <label className={styles.formLabel}>Option B: Paste Image URL</label>
                <input
                  type="text"
                  placeholder="e.g. unsplash.com/photo-xxx or Pinterest link"
                  className={styles.input}
                  style={{ height: '64px' }}
                  value={newInspiration.image_url}
                  onChange={e => setNewInspiration({ ...newInspiration, image_url: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Space / Room Type</label>
                <input
                  type="text"
                  placeholder="e.g. Master Bedroom, Kitchen"
                  className={styles.input}
                  value={newInspiration.room_type}
                  onChange={e => setNewInspiration({ ...newInspiration, room_type: e.target.value })}
                />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Client loves the wooden panels and cove lights"
                  className={styles.input}
                  value={newInspiration.notes}
                  onChange={e => setNewInspiration({ ...newInspiration, notes: e.target.value })}
                />
              </div>
            </div>

            {newInspiration.image_url && (
              <div style={{ position: 'relative', width: '120px', height: '80px', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                <img src={newInspiration.image_url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}

            <div className={styles.btnGroup}>
              <Button variant="primary" size="sm" type="submit" disabled={isUploading || !newInspiration.image_url}>
                Save Inspiration
              </Button>
            </div>
          </form>
        )}

        {inspirations.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)', border: '1px dashed var(--color-border)', borderRadius: 8 }}>
            No inspiration images shared yet. Add URLs or upload files using the button above.
          </div>
        ) : (
          <div className={styles.inspirationGrid}>
            {inspirations.map(insp => (
              <div key={insp.id} className={styles.inspirationCard}>
                <button
                  className={styles.deleteIcon}
                  onClick={() => handleInspirationDelete(insp.id)}
                  title="Delete Inspiration"
                >
                  &times;
                </button>
                <div className={styles.cardImageWrapper}>
                  <img
                    src={insp.image_url}
                    alt={insp.room_type || 'Inspiration Reference'}
                    className={styles.cardImage}
                    onClick={() => window.open(insp.image_url, '_blank')}
                    style={{ cursor: 'pointer' }}
                  />
                </div>
                <div className={styles.cardContent}>
                  {insp.room_type && (
                    <div className={styles.cardRoom}>
                      <Badge variant="secondary">{insp.room_type}</Badge>
                    </div>
                  )}
                  {insp.notes && <p className={styles.cardNotes}>{insp.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal for adding/editing Room requirement */}
      {isRoomModalOpen && (
        <Modal
          title={editingRoom ? 'Edit Room Requirement' : 'Add Room Requirement'}
          isOpen={isRoomModalOpen}
          onClose={() => setIsRoomModalOpen(false)}
        >
          <form onSubmit={handleRoomSubmit} className={styles.modalForm}>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Room / Space Name *</label>
              <Input
                placeholder="e.g. Living Room, Modular Kitchen"
                value={roomForm.room_name}
                onChange={e => setRoomForm({ ...roomForm, room_name: e.target.value })}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className={styles.formField}>
                <label className={styles.formLabel}>Budget Allocation (₹)</label>
                <Input
                  type="number"
                  placeholder="e.g. 150000"
                  value={roomForm.budget_allocation}
                  onChange={e => setRoomForm({ ...roomForm, budget_allocation: e.target.value })}
                />
              </div>

              <div className={styles.formField}>
                <label className={styles.formLabel}>Priority</label>
                <Select
                  value={roomForm.priority}
                  onChange={e => setRoomForm({ ...roomForm, priority: e.target.value })}
                  options={PRIORITIES}
                />
              </div>
            </div>

            <div className={styles.formField}>
              <label className={styles.formLabel}>Functional Requirements</label>
              <Input
                placeholder="e.g. Seating for 6, TV unit with storage"
                value={roomForm.functional_requirements}
                onChange={e => setRoomForm({ ...roomForm, functional_requirements: e.target.value })}
              />
            </div>

            <div className={styles.formField}>
              <label className={styles.formLabel}>Remarks / Specific Requests</label>
              <Textarea
                placeholder="Client requested a clean, clutter-free look with brass fittings"
                value={roomForm.remarks}
                onChange={e => setRoomForm({ ...roomForm, remarks: e.target.value })}
              />
            </div>

            <div className={styles.btnGroup} style={{ marginTop: '12px' }}>
              <Button variant="outline" size="sm" type="button" onClick={() => setIsRoomModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit">
                {editingRoom ? 'Save Changes' : 'Add Room'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}
