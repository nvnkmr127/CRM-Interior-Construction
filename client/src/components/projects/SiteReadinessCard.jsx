/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps, no-undef */
import React, { useState, useEffect } from 'react';
import { Button } from '../ui';
import { useToast } from '../../store/toastContext';
import { getSiteReadiness, updateSiteReadinessItem, signOffSiteReadiness } from '../../api/siteReadiness';

export default function SiteReadinessCard({ projectId, executionPhase, onReadinessUpdate }) {
  const toast = useToast();
  const [checklist, setChecklist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expandedItem, setExpandedItem] = useState(null);

  const fetchChecklist = async () => {
    try {
      const res = await getSiteReadiness(projectId);
      setChecklist(res.data?.data || res.data || []);
    } catch {
      toast.error('Failed to load site readiness checklist.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchChecklist();
    }
  }, [projectId]);

  const handleToggleItem = async (item) => {
    const nextStatus = !item.is_completed;
    const oldStatus = item.is_completed;

    // Optimistic update
    setChecklist(prev =>
      prev.map(i =>
        i.id === item.id
          ? {
              ...i,
              is_completed: nextStatus,
              completed_at: nextStatus ? new Date().toISOString() : null,
              completed_by_name: nextStatus ? 'You' : null
            }
          : i
      )
    );

    try {
      await updateSiteReadinessItem(projectId, item.id, { is_completed: nextStatus });
      toast.success(`Checklist item marked as ${nextStatus ? 'completed' : 'incomplete'}`);
      if (onReadinessUpdate) onReadinessUpdate();
    } catch {
      // Revert
      setChecklist(prev => prev.map(i => (i.id === item.id ? { ...i, is_completed: oldStatus } : i)));
      toast.error('Failed to update checklist item status.');
    }
  };

  const handleUpdateNotes = async (id, notes) => {
    try {
      await updateSiteReadinessItem(projectId, id, { notes });
    } catch {
      toast.error('Failed to save notes.');
    }
  };

  const handleSignOffAll = async () => {
    if (!window.confirm('Are you sure you want to sign off and complete all site readiness items?')) return;
    setSubmitting(true);
    try {
      const res = await signOffSiteReadiness(projectId);
      setChecklist(res.data?.data || res.data || []);
      toast.success('Site readiness signed off successfully.');
      if (onReadinessUpdate) onReadinessUpdate();
    } catch {
      toast.error('Failed to sign off site readiness.');
    } finally {
      setSubmitting(false);
    }
  };

  const allCompleted = checklist.length > 0 && checklist.every(item => item.is_completed);
  const isExecutionLocked = executionPhase && (executionPhase.status === 'pending' || executionPhase.status === 'todo') && !allCompleted;

  if (loading) {
    return <div style={{ padding: '16px 0', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Loading site readiness status…</div>;
  }

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      marginBottom: 24,
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
    }}>
      {/* Header alert if locked */}
      {isExecutionLocked ? (
        <div style={{
          padding: '16px 20px',
          background: 'var(--color-warning-bg, #fef3c7)',
          color: 'var(--color-warning, #d97706)',
          borderBottom: '1px solid var(--color-border)',
          fontWeight: 600,
          fontSize: 'var(--text-sm)',
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <span style={{ fontSize: 18 }}>🔒</span>
          <div>
            <strong>Execution Phase Locked:</strong> The execution phase cannot start until all site readiness checklist items are completed and signed off.
          </div>
        </div>
      ) : allCompleted ? (
        <div style={{
          padding: '16px 20px',
          background: 'var(--color-success-bg, #f0fdf4)',
          color: 'var(--color-success, #22c55e)',
          borderBottom: '1px solid var(--color-border)',
          fontWeight: 600,
          fontSize: 'var(--text-sm)',
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <div>
            <strong>Site Ready:</strong> All site readiness prerequisites are complete. The execution phase is unlocked.
          </div>
        </div>
      ) : (
        <div style={{
          padding: '16px 20px',
          background: 'var(--color-surface-hover, #f8fafc)',
          borderBottom: '1px solid var(--color-border)',
          fontWeight: 600,
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📋</span>
            <span>Pre-Execution Site Readiness Checklist</span>
          </div>
          <Badge variant="warning">Incomplete</Badge>
        </div>
      )}

      {/* Checklist items list */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {checklist.map((item, index) => {
          const isExpanded = expandedItem === item.id;
          return (
            <div key={item.id} style={{
              padding: '16px 20px',
              borderBottom: index < checklist.length - 1 ? '1px solid var(--color-border)' : 'none',
              background: item.is_completed ? 'var(--color-surface-hover, #fafafa)' : 'var(--color-surface)',
              transition: 'background 0.2s'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <input
                    type="checkbox"
                    checked={item.is_completed}
                    onChange={() => handleToggleItem(item)}
                    style={{
                      marginTop: 4,
                      width: 18,
                      height: 18,
                      cursor: 'pointer',
                      accentColor: 'var(--color-success)'
                    }}
                  />
                  <div>
                    <div style={{
                      fontWeight: 600,
                      fontSize: 'var(--text-sm)',
                      color: item.is_completed ? 'var(--color-text-muted)' : 'var(--color-text)',
                      textDecoration: item.is_completed ? 'line-through' : 'none'
                    }}>
                      {item.label}
                    </div>
                    {item.is_completed && item.completed_at && (
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 2 }}>
                        ✓ Marked ready by {item.completed_by_name || 'PM'} on {new Date(item.completed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                    {item.notes && !isExpanded && (
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 4, fontStyle: 'italic' }}>
                        📝 {item.notes}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-accent)',
                    fontSize: 'var(--text-xs)',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  {isExpanded ? 'Hide Notes' : 'Edit Notes'}
                </button>
              </div>

              {/* Notes expandable textarea */}
              {isExpanded && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <textarea
                    style={{
                      width: '100%',
                      minHeight: 60,
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--text-xs)',
                      fontFamily: 'inherit',
                      background: 'var(--color-surface)'
                    }}
                    placeholder="Enter site verification notes, civil checklist confirmations, or dimensions check details..."
                    value={item.notes || ''}
                    onChange={e => {
                      setChecklist(prev => prev.map(i => (i.id === item.id ? { ...i, notes: e.target.value } : i)));
                    }}
                    onBlur={e => handleUpdateNotes(item.id, e.target.value)}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button variant="outline" size="sm" onClick={() => setExpandedItem(null)}>
                      Save Notes
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bulk action footer */}
      {!allCompleted && (
        <div style={{
          padding: '14px 20px',
          background: 'var(--color-surface-hover, #f8fafc)',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center'
        }}>
          <Button variant="primary" size="sm" onClick={handleSignOffAll} disabled={submitting}>
            {submitting ? 'Signing off...' : 'Sign Off All Items'}
          </Button>
        </div>
      )}
    </div>
  );
}
