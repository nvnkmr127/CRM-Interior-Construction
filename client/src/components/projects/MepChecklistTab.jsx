import React, { useState, useEffect } from 'react';
import { Button, Badge, Spinner, EmptyState } from '../ui';
import { useToast } from '../../store/toastContext';
import styles from './MepChecklistTab.module.css';
import { getMepChecklist, updateMepChecklistItem } from '../../api/projects';

const STATUS_VARIANTS = {
  pending: 'warning',
  in_progress: 'info',
  approved: 'success',
  not_applicable: 'neutral'
};

const STATUS_LABELS = {
  pending: 'Pending',
  in_progress: 'In Progress',
  approved: 'Approved',
  not_applicable: 'Not Applicable'
};

export default function MepChecklistTab({ projectId }) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Track editing state per item
  const [editStates, setEditStates] = useState({});

  const fetchChecklist = async () => {
    setLoading(true);
    try {
      const res = await getMepChecklist(projectId);
      if (res.data?.success) {
        const data = res.data.data || [];
        setItems(data);
        
        // Initialize editing state
        const initialEdits = {};
        data.forEach(item => {
          initialEdits[item.id] = {
            status: item.status,
            notes: item.notes || '',
            saving: false
          };
        });
        setEditStates(initialEdits);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load MEP checklist.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchChecklist();
    }
  }, [projectId]);

  const handleStateChange = (id, field, value) => {
    setEditStates(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  const handleSaveItem = async (id) => {
    const editData = editStates[id];
    if (!editData) return;

    handleStateChange(id, 'saving', true);
    try {
      const res = await updateMepChecklistItem(projectId, id, {
        status: editData.status,
        notes: editData.notes
      });
      if (res.data?.success) {
        toast.success('Checklist item updated successfully!');
        // Update local items array with returned record
        setItems(prev => prev.map(item => item.id === id ? { ...item, ...res.data.data } : item));
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to update checklist item.');
    } finally {
      handleStateChange(id, 'saving', false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>MEP Coordination Checklist</h2>
        <p>Ensure electrical points, plumbing routing, false ceiling alignment, and MEP contractor coordination are approved prior to civil execution.</p>
      </div>

      {loading ? (
        <div className={styles.loadingContainer}>
          <Spinner size="lg" />
          <span>Loading checklist items...</span>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No MEP Checklist Items"
          description="Could not load or initialize MEP coordination checklist for this project."
        />
      ) : (
        <div className={styles.grid}>
          {items.map(item => {
            const edit = editStates[item.id] || { status: item.status, notes: item.notes || '', saving: false };
            const isModified = edit.status !== item.status || edit.notes !== (item.notes || '');

            return (
              <div key={item.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.itemName}>{item.item_name}</h3>
                  <Badge variant={STATUS_VARIANTS[item.status]} size="sm">
                    {STATUS_LABELS[item.status] || item.status}
                  </Badge>
                </div>

                <div className={styles.metaSection}>
                  {item.approved_by_name && (
                    <div>
                      <strong>Signed Off By:</strong> {item.approved_by_name}
                    </div>
                  )}
                  {item.approved_at && (
                    <div>
                      <strong>Approved At:</strong> {new Date(item.approved_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  )}
                  {!item.approved_by_name && (
                    <div><em>Awaiting review sign-off</em></div>
                  )}
                </div>

                <div style={{ marginTop: '12px' }}>
                  <label className={styles.notesLabel}>Status</label>
                  <select
                    value={edit.status}
                    onChange={(e) => handleStateChange(item.id, 'status', e.target.value)}
                    className={styles.select}
                    style={{ width: '100%', marginBottom: '12px' }}
                    disabled={edit.saving}
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="approved">Approved / Signed Off</option>
                    <option value="not_applicable">Not Applicable</option>
                  </select>

                  <label className={styles.notesLabel}>Coordination Notes</label>
                  <textarea
                    value={edit.notes}
                    onChange={(e) => handleStateChange(item.id, 'notes', e.target.value)}
                    placeholder="Enter coordination notes, clash resolution observations, etc."
                    className={styles.textarea}
                    disabled={edit.saving}
                  />
                </div>

                <div className={styles.footer}>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    Last Updated: {new Date(item.updated_at).toLocaleDateString('en-IN')}
                  </span>
                  <Button
                    variant={isModified ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => handleSaveItem(item.id)}
                    loading={edit.saving}
                    disabled={!isModified || edit.saving}
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
