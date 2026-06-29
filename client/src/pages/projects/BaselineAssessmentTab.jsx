import React, { useState, useEffect } from 'react';
import styles from './BaselineAssessmentTab.module.css';
import { Button, Input, Select } from '../../components/ui';
import { useToast } from '../../store/toastContext';
import api from '../../api/axios';

const DEFAULT_ROOMS = ['Living Room', 'Kitchen', 'Master Bedroom', 'Balcony'];
const DEFAULT_AREAS = ['walls', 'flooring', 'electrical', 'plumbing', 'civil'];

const STATUS_OPTIONS = [
  { value: 'ok', label: 'OK (No Issues)' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'defect', label: 'Pre-existing Defect' },
  { value: 'n_a', label: 'N/A' }
];

export default function BaselineAssessmentTab({ projectId }) {
  const toast = useToast();
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states
  const [overallNotes, setOverallNotes] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [rooms, setRooms] = useState([]);

  useEffect(() => {
    fetchAssessment();
  }, [projectId]);

  const fetchAssessment = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/projects/${projectId}/baseline-assessment`);
      if (res.data?.success && res.data.data) {
        const data = res.data.data;
        setAssessment(data);
        setOverallNotes(data.overall_notes || '');
        setVideoUrl(data.video_walkthrough_url || '');
        
        // Group items by room name
        const grouped = {};
        if (data.items && data.items.length > 0) {
          data.items.forEach(item => {
            if (!grouped[item.room_name]) {
              grouped[item.room_name] = {
                room_name: item.room_name,
                areas: {},
                photos: item.photos || []
              };
            }
            grouped[item.room_name].areas[item.area_checked] = {
              status: item.condition_status,
              notes: item.notes || ''
            };
          });
        }
        setRooms(Object.values(grouped));
      } else {
        setAssessment(null);
        // Initialize default empty assessment structure
        initializeDefaults();
      }
    } catch (err) {
      console.error('Failed to fetch baseline assessment:', err);
      initializeDefaults();
    } finally {
      setLoading(false);
    }
  };

  const initializeDefaults = () => {
    setOverallNotes('');
    setVideoUrl('');
    const initialRooms = DEFAULT_ROOMS.map(name => {
      const areas = {};
      DEFAULT_AREAS.forEach(area => {
        areas[area] = { status: 'ok', notes: '' };
      });
      return { room_name: name, areas, photos: [] };
    });
    setRooms(initialRooms);
  };

  const handleAddRoom = () => {
    const name = window.prompt('Enter Room/Area Name:');
    if (!name || name.trim() === '') return;
    
    const areas = {};
    DEFAULT_AREAS.forEach(area => {
      areas[area] = { status: 'ok', notes: '' };
    });
    
    setRooms([...rooms, { room_name: name.trim(), areas, photos: [] }]);
  };

  const handleRemoveRoom = (idx) => {
    if (window.confirm(`Are you sure you want to remove ${rooms[idx].room_name}?`)) {
      setRooms(rooms.filter((_, i) => i !== idx));
    }
  };

  const handleAreaStatusChange = (roomIdx, area, status) => {
    const updated = [...rooms];
    updated[roomIdx].areas[area].status = status;
    setRooms(updated);
  };

  const handleAreaNotesChange = (roomIdx, area, notes) => {
    const updated = [...rooms];
    updated[roomIdx].areas[area].notes = notes;
    setRooms(updated);
  };

  const handlePhotosChange = (roomIdx, val) => {
    const updated = [...rooms];
    // Split by comma and filter empty
    updated[roomIdx].photos = val.split(',').map(s => s.trim()).filter(Boolean);
    setRooms(updated);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Flatten rooms state back into project_baseline_items format
      const items = [];
      rooms.forEach(room => {
        Object.keys(room.areas).forEach(area => {
          items.push({
            room_name: room.room_name,
            area_checked: area,
            condition_status: room.areas[area].status,
            notes: room.areas[area].notes || null,
            photos: room.photos
          });
        });
      });

      const payload = {
        overall_notes: overallNotes || null,
        video_walkthrough_url: videoUrl || null,
        items
      };

      const res = await api.post(`/projects/${projectId}/baseline-assessment`, payload);
      if (res.data?.success) {
        toast.success('Site baseline assessment saved successfully!');
        setIsEditing(false);
        fetchAssessment();
      } else {
        toast.error('Failed to save assessment');
      }
    } catch (err) {
      console.error('Failed to save baseline assessment:', err);
      toast.error('Error saving site assessment details.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 20, color: 'var(--color-text-muted)' }}>Loading baseline assessment…</div>;
  }

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'ok': return `${styles.badge} ${styles.badgeOk}`;
      case 'defect': return `${styles.badge} ${styles.badgeDefect}`;
      case 'damaged': return `${styles.badge} ${styles.badgeDamaged}`;
      default: return `${styles.badge} ${styles.badgeNa}`;
    }
  };

  const getStatusLabel = (status) => {
    const opt = STATUS_OPTIONS.find(o => o.value === status);
    return opt ? opt.label : status;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h3>Site Condition Baseline Assessment</h3>
          <p className={styles.subtitle}>
            Document pre-existing defects, civil issues, and site conditions at project kickoff.
          </p>
        </div>
        <div className={styles.actions}>
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)}>Edit Assessment ✏️</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => { setIsEditing(false); fetchAssessment(); }}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Assessment ✓'}
              </Button>
            </>
          )}
        </div>
      </div>

      {assessment && (
        <div className={styles.metaInfo}>
          <span>👤 Assessed By: <strong>{assessment.assessed_by_name || 'System / Staff'}</strong></span>
          <span>📅 Last Updated: <strong>{new Date(assessment.updated_at).toLocaleString('en-IN')}</strong></span>
          {assessment.video_walkthrough_url && (
            <span>
              🎥 Video Link:{' '}
              <a href={assessment.video_walkthrough_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline', fontWeight: 600 }}>
                Play Walkthrough Video
              </a>
            </span>
          )}
        </div>
      )}

      {!isEditing ? (
        // VIEW ONLY STATE
        <>
          {overallNotes && (
            <div className={styles.notesCard}>
              <h4>Overall Assessment Summary Notes</h4>
              <div className={styles.notesText}>{overallNotes}</div>
            </div>
          )}

          {rooms.length === 0 ? (
            <div className={styles.emptyState}>
              No rooms documented in this assessment yet. Click "Edit Assessment" to start.
            </div>
          ) : (
            <div className={styles.grid}>
              {rooms.map((room, idx) => (
                <div key={idx} className={styles.roomCard}>
                  <div className={styles.roomHeader}>
                    <span>🚪 {room.room_name}</span>
                  </div>
                  <div className={styles.roomBody}>
                    <div className={styles.checklistGrid}>
                      {Object.entries(room.areas).map(([area, detail]) => (
                        <div key={area} className={styles.checkItem}>
                          <span className={styles.areaLabel}>{area.replace(/_/g, ' ')}</span>
                          <div className={styles.itemDetail}>
                            <span className={getStatusBadgeClass(detail.status)}>
                              {getStatusLabel(detail.status)}
                            </span>
                            {detail.notes && (
                              <span className={styles.itemNotes}>{detail.notes}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {room.photos && room.photos.length > 0 && (
                    <div className={styles.photoGallery}>
                      <div className={styles.photoTitle}>Observed Conditions Photos</div>
                      <div className={styles.photoThumbs}>
                        {room.photos.map((url, pIdx) => (
                          <img 
                            key={pIdx} 
                            src={url} 
                            alt={`${room.room_name} condition thumb`} 
                            className={styles.photoThumb} 
                            onClick={() => window.open(url, '_blank')}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        // EDIT STATE FORM
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className={styles.formSection}>
            <h4 style={{ margin: '0 0 12px 0' }}>Overall Parameters</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Input 
                label="Video Walkthrough URL" 
                placeholder="e.g. YouTube/Drive video link of initial site condition tour" 
                value={videoUrl}
                onChange={e => setVideoUrl(e.target.value)}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Overall Assessment Notes</label>
                <textarea 
                  rows={4}
                  placeholder="Record summary of structural defects, seepages, or handover parameters."
                  value={overallNotes}
                  onChange={e => setOverallNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 12,
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
            </div>
          </div>

          <div className={styles.formSection}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h4 style={{ margin: 0 }}>Room-Wise Checklists</h4>
              <Button type="button" size="sm" variant="outline" onClick={handleAddRoom}>Add Room / Area ➕</Button>
            </div>

            {rooms.map((room, rIdx) => (
              <div key={rIdx} className={styles.roomEditCard}>
                <button type="button" className={styles.removeRoomBtn} onClick={() => handleRemoveRoom(rIdx)}>
                  Remove Room 🗑️
                </button>
                <div style={{ marginBottom: 16, maxWidth: '60%' }}>
                  <Input 
                    label="Room Name" 
                    value={room.room_name}
                    onChange={e => {
                      const updated = [...rooms];
                      updated[rIdx].room_name = e.target.value;
                      setRooms(updated);
                    }}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                    Pre-Existing Condition Checklist
                  </div>
                  {Object.keys(room.areas).map(area => (
                    <div key={area} className={styles.areaEditGrid}>
                      <span className={styles.areaEditGridLabel}>{area.replace(/_/g, ' ')}</span>
                      <Select 
                        options={STATUS_OPTIONS}
                        value={room.areas[area].status}
                        onChange={val => handleAreaStatusChange(rIdx, area, val)}
                      />
                      <Input 
                        placeholder="Detail any observed problems (e.g. wall seepage, tiles cracked)"
                        value={room.areas[area].notes}
                        onChange={e => handleAreaNotesChange(rIdx, area, e.target.value)}
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <Input 
                    label="Observed Conditions Photos (Comma-separated Image URLs)" 
                    placeholder="e.g. https://domain.com/photo1.jpg, https://domain.com/photo2.jpg"
                    value={room.photos.join(', ')}
                    onChange={e => handlePhotosChange(rIdx, e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
