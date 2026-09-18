/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { Badge, Button } from '../ui';
import styles from './PhaseTimeline.module.css';
import { getPhases, signOffPhase, getMilestones, completeMilestone, applyTemplate } from '../../api/projects';
import { configApi } from '../../api/config';
import { useToast } from '../../store/toastContext';
import SiteReadinessCard from './SiteReadinessCard';

function formatDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function PhaseTimeline({ projectId }) {
  const toast = useToast();
  const [phases, setPhases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [signingOff, setSigningOff] = useState(null);

  // Template Modal State
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [applying, setApplying] = useState(false);

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const data = await configApi.getTemplates();
      const list = Array.isArray(data) ? data : [];
      setTemplates(list);
      if (list.length > 0) {
        setSelectedTemplateId(list[0].id);
      }
    } catch (err) {
      toast.error('Failed to load project templates');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleOpenApplyModal = () => {
    setShowApplyModal(true);
    fetchTemplates();
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplateId) {
      toast.error('Please select a template to apply');
      return;
    }
    setApplying(true);
    try {
      await applyTemplate(projectId, selectedTemplateId);
      toast.success('Project template applied successfully!');
      setShowApplyModal(false);
      loadPhases();
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Failed to apply template');
    } finally {
      setApplying(false);
    }
  };

  const loadPhases = () => {
    setLoading(true);
    getPhases(projectId)
      .then(async res => {
        const _r = res.data?.data || res.data;
        const rawPhases = Array.isArray(_r) ? _r : [];
        // Fetch milestones for each phase in parallel
        const withMilestones = await Promise.all(
          rawPhases.map(async phase => {
            try {
              const mRes = await getMilestones(phase.id);
              const _m = mRes.data?.data || mRes.data;
              const milestones = (Array.isArray(_m) ? _m : []).map(m => ({
                id: m.id,
                name: m.name,
                done: m.status === 'completed' || m.status === 'done',
                triggersPayment: m.triggers_payment || false,
                dueDate: formatDate(m.due_date),
              }));
              return { ...phase, milestones, error: null };
            } catch {
              return { ...phase, milestones: [], error: null };
            }
          })
        );
        setPhases(withMilestones);
      })
      .catch(() => setPhases([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (projectId) {
      loadPhases();
    }
  }, [projectId]);

  const toggleMilestone = async (phaseId, milestoneId) => {
    const phase = phases.find(p => p.id === phaseId);
    const milestone = phase?.milestones.find(m => m.id === milestoneId);
    if (!milestone || phase?.status === 'completed') return;

    const newDone = !milestone.done;
    setPhases(prev => prev.map(p => {
      if (p.id !== phaseId) return p;
      return {
        ...p,
        error: null,
        milestones: p.milestones.map(m => m.id === milestoneId ? { ...m, done: newDone } : m),
      };
    }));

    try {
      if (newDone) {
        await completeMilestone(milestoneId, milestoneId);
      }
    } catch {
      // Revert on failure
      setPhases(prev => prev.map(p => {
        if (p.id !== phaseId) return p;
        return {
          ...p,
          milestones: p.milestones.map(m => m.id === milestoneId ? { ...m, done: milestone.done } : m),
        };
      }));
      toast.error('Failed to update milestone');
    }
  };

  const handleSignOff = async (phase) => {
    const incomplete = phase.milestones.filter(m => !m.done);
    if (incomplete.length > 0) {
      setPhases(prev => prev.map(p =>
        p.id === phase.id
          ? { ...p, error: `⚠ Incomplete: ${incomplete.map(i => i.name).join(', ')}` }
          : p
      ));
      return;
    }

    setSigningOff(phase.id);
    try {
      await signOffPhase(projectId, phase.id);
      setPhases(prev => prev.map((p, i, arr) => {
        if (p.id === phase.id) return { ...p, status: 'completed', error: null };
        if (arr[i - 1]?.id === phase.id && p.status === 'pending') return { ...p, status: 'in_progress' };
        return p;
      }));
      toast.success(`${phase.name} signed off`);
    } catch (err) {
      const msg = err?.response?.data?.error?.message || 'Failed to sign off phase';
      setPhases(prev => prev.map(p => p.id === phase.id ? { ...p, error: msg } : p));
    } finally {
      setSigningOff(null);
    }
  };

  if (loading) {
    return <div style={{ padding: '32px', color: 'var(--color-text-muted)' }}>Loading phases…</div>;
  }

  const executionPhase = phases.find(p => p.is_execution);

  return (
    <div className={styles.timeline}>
      {/* Top Header Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontWeight: 500 }}>
          {phases.length > 0 ? `${phases.length} Phases Active` : 'No phases configured'}
        </div>
        <Button variant="outline" size="sm" onClick={handleOpenApplyModal}>
          ⚡ Apply Project Template
        </Button>
      </div>

      {phases.length === 0 ? (
        <div style={{
          padding: '36px 24px',
          textAlign: 'center',
          background: 'var(--color-surface-hover, #f8fafc)',
          borderRadius: 'var(--radius-lg)',
          border: '1px dashed var(--color-border)',
          margin: '12px 0'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 600, color: 'var(--color-text)' }}>
            No phases defined for this project yet.
          </h4>
          <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--color-text-secondary)', maxWidth: '440px', marginLeft: 'auto', marginRight: 'auto' }}>
            Apply a pre-configured project workflow template (e.g. Living & Dining Room, Full Interior) to directly define execution phases, completion days, and milestones.
          </p>
          <Button variant="primary" size="sm" onClick={handleOpenApplyModal}>
            ⚡ Select & Apply Template
          </Button>
        </div>
      ) : (
        <>
          {executionPhase && (
            <SiteReadinessCard
              projectId={projectId}
              executionPhase={executionPhase}
              onReadinessUpdate={loadPhases}
            />
          )}
          {phases.map((phase, idx) => {
            const isLast = idx === phases.length - 1;
            const allDone = phase.milestones.length > 0 && phase.milestones.every(m => m.done);
            const isCompleted = phase.status === 'completed';
            const isActive = phase.status === 'active' || phase.status === 'in_progress';

            let dotClass = styles.dotPending;
            if (isActive) dotClass = styles.dotActive;
            if (isCompleted) dotClass = styles.dotDone;

            return (
              <div key={phase.id} className={styles.phaseBlock}>
                <div className={styles.rail}>
                  <div className={`${styles.dot} ${dotClass}`} />
                  {!isLast && <div className={styles.line} />}
                </div>
                <div className={styles.phaseContent}>
                  <div className={styles.phaseHeader}>
                    <div className={styles.phaseTitle}>
                      {phase.name}
                      <Badge
                        variant={isCompleted ? 'success' : isActive ? 'warning' : 'neutral'}
                        size="sm"
                      >
                        {phase.status?.toUpperCase()}
                      </Badge>
                    </div>
                    {isActive && (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={!allDone || signingOff === phase.id}
                        title={!allDone ? 'Complete all milestones first' : ''}
                        onClick={() => handleSignOff(phase)}
                      >
                        {signingOff === phase.id ? 'Signing off…' : 'Sign Off'}
                      </Button>
                    )}
                  </div>

                  <div className={styles.phaseMeta}>
                    {phase.sign_off_by && `Sign-off: ${phase.sign_off_by}`}
                    {phase.duration_days && ` · ${phase.duration_days} days`}
                    {phase.starts_at && ` · ${formatDate(phase.starts_at)} → ${formatDate(phase.ends_at)}`}
                    {phase.progress_percentage !== undefined && phase.progress_percentage !== null && (
                      <span style={{ marginLeft: 8, fontWeight: 600, color: 'var(--color-accent)' }}>
                        · {Math.round(phase.progress_percentage)}% Complete
                      </span>
                    )}
                  </div>

                  {phase.progress_percentage !== undefined && phase.progress_percentage !== null && (
                    <div style={{
                      background: 'var(--color-surface-hover, #f1f5f9)',
                      height: 4,
                      width: '100%',
                      borderRadius: 2,
                      marginTop: 4,
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        background: 'var(--color-success, #22c55e)',
                        height: '100%',
                        width: `${phase.progress_percentage}%`,
                        transition: 'width 0.4s ease'
                      }} />
                    </div>
                  )}

                  <div className={styles.milestoneList}>
                    {phase.milestones.length === 0 && (
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', padding: '8px 0' }}>
                        No milestones
                      </div>
                    )}
                    {phase.milestones.map(m => {
                      const hasError = phase.error && !m.done;
                      return (
                        <div
                          key={m.id}
                          className={`${styles.milestoneRow} ${hasError ? styles.milestoneRowIncomplete : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={m.done}
                            onChange={() => toggleMilestone(phase.id, m.id)}
                            disabled={isCompleted}
                          />
                          <span
                            className={styles.milestoneName}
                            style={{ textDecoration: m.done ? 'line-through' : 'none', opacity: m.done ? 0.6 : 1 }}
                          >
                            {m.name}
                          </span>
                          {m.triggersPayment && <span className={styles.paymentIcon}>₹ Payment</span>}
                          {m.dueDate && <span className={styles.dueDate}>{m.dueDate}</span>}
                        </div>
                      );
                    })}
                  </div>

                  {phase.error && <div className={styles.errorMsg}>{phase.error}</div>}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Apply Template Modal */}
      {showApplyModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999
        }}>
          <div style={{
            background: 'var(--color-surface, #fff)',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '520px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--color-text)' }}>
                ⚡ Apply Template to Project
              </h3>
              <button
                onClick={() => setShowApplyModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--color-text-muted)' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: 20, lineHeight: '1.5' }}>
              Select a project workflow template to define all execution phases, completion target days, and milestones directly for this project.
            </p>

            {loadingTemplates ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                Loading templates…
              </div>
            ) : templates.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                No active project templates found. Create one in Settings &gt; Templates first.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                    Select Workflow Template
                  </label>
                  <select
                    value={selectedTemplateId}
                    onChange={e => setSelectedTemplateId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface)',
                      color: 'var(--color-text)',
                      fontSize: '14px'
                    }}
                  >
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({(typeof t.phases === 'string' ? JSON.parse(t.phases || '[]') : (t.phases || [])).length} Phases)
                      </option>
                    ))}
                  </select>
                </div>

                {selectedTemplateId && (
                  <div style={{
                    padding: '12px 16px',
                    background: 'var(--color-surface-hover, #f8fafc)',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    fontSize: '13px',
                    color: 'var(--color-text-secondary)'
                  }}>
                    {(() => {
                      const t = templates.find(item => item.id === selectedTemplateId);
                      if (!t) return null;
                      const parsedPhases = typeof t.phases === 'string' ? JSON.parse(t.phases || '[]') : (t.phases || []);
                      return (
                        <div>
                          <strong>{t.name}</strong>: {parsedPhases.length} Phases defined.
                          <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
                            {parsedPhases.map((p, pIdx) => (
                              <li key={pIdx} style={{ marginBottom: 4 }}>
                                {p.name} ({p.duration || p.duration_days || 0} days, {(p.milestones || []).length} milestones)
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                  <Button variant="outline" onClick={() => setShowApplyModal(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={handleApplyTemplate} disabled={applying}>
                    {applying ? 'Applying Template…' : 'Apply Template'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
