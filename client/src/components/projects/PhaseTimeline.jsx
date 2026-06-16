import React, { useState, useEffect } from 'react';
import { Badge, Button } from '../ui';
import styles from './PhaseTimeline.module.css';
import { getPhases, signOffPhase, getMilestones, completeMilestone } from '../../api/projects';
import { useToast } from '../../store/toastContext';

function formatDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function PhaseTimeline({ projectId }) {
  const toast = useToast();
  const [phases, setPhases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [signingOff, setSigningOff] = useState(null);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);

    getPhases(projectId)
      .then(async res => {
        const rawPhases = res.data?.data || res.data || [];
        // Fetch milestones for each phase in parallel
        const withMilestones = await Promise.all(
          rawPhases.map(async phase => {
            try {
              const mRes = await getMilestones(phase.id);
              const milestones = (mRes.data?.data || mRes.data || []).map(m => ({
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
        if (arr[i - 1]?.id === phase.id && p.status === 'pending') return { ...p, status: 'active' };
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

  if (phases.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        No phases defined for this project yet.
      </div>
    );
  }

  return (
    <div className={styles.timeline}>
      {phases.map((phase, idx) => {
        const isLast = idx === phases.length - 1;
        const allDone = phase.milestones.length > 0 && phase.milestones.every(m => m.done);
        const isCompleted = phase.status === 'completed';
        const isActive = phase.status === 'active';

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
              </div>

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
    </div>
  );
}
