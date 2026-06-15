import React, { useState } from 'react';
import { Badge, Button } from '../ui';
import styles from './PhaseTimeline.module.css';

export default function PhaseTimeline({ projectId }) {
  // Mock data
  const [phases, setPhases] = useState([
    {
      id: 1, name: 'Design Concept', status: 'done', duration: '2 weeks', signOffReq: 'Client Approval',
      milestones: [
        { id: 101, name: 'Initial Layout', dueDate: '12 Aug', done: true, triggersPayment: false },
        { id: 102, name: '3D Renders', dueDate: '15 Aug', done: true, triggersPayment: true }
      ]
    },
    {
      id: 2, name: 'Execution', status: 'active', duration: '6 weeks', signOffReq: 'Site Inspection',
      error: null,
      milestones: [
        { id: 201, name: 'Foundation Check', dueDate: '20 Sep', done: true, triggersPayment: false },
        { id: 202, name: 'Site Measurement', dueDate: '25 Sep', done: false, triggersPayment: false }
      ]
    },
    {
      id: 3, name: 'Handover', status: 'pending', duration: '1 week', signOffReq: 'Final Sign-off',
      milestones: [
        { id: 301, name: 'Deep Cleaning', dueDate: '10 Nov', done: false, triggersPayment: false },
        { id: 302, name: 'Keys Handover', dueDate: '15 Nov', done: false, triggersPayment: true }
      ]
    }
  ]);

  const toggleMilestone = (phaseId, mId) => {
    setPhases(phases.map(p => {
      if (p.id !== phaseId) return p;
      return {
        ...p,
        error: null, // clear error on change
        milestones: p.milestones.map(m => m.id === mId ? { ...m, done: !m.done } : m)
      };
    }));
  };

  const handleSignOff = async (phase) => {
    const incomplete = phase.milestones.filter(m => !m.done);
    if (incomplete.length > 0) {
      setPhases(phases.map(p => 
        p.id === phase.id ? { ...p, error: `⚠ Incomplete: ${incomplete.map(i => i.name).join(', ')}` } : p
      ));
      return;
    }

    // Mock API success
    setPhases(phases.map(p => {
      if (p.id === phase.id) return { ...p, status: 'done', error: null };
      if (p.id === phase.id + 1 && p.status === 'pending') return { ...p, status: 'active' };
      return p;
    }));
  };

  return (
    <div className={styles.timeline}>
      {phases.map((phase, idx) => {
        const isLast = idx === phases.length - 1;
        const allDone = phase.milestones.every(m => m.done);
        
        let dotClass = styles.dotPending;
        if (phase.status === 'active') dotClass = styles.dotActive;
        if (phase.status === 'done') dotClass = styles.dotDone;

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
                  <Badge variant={phase.status === 'done' ? 'success' : phase.status === 'active' ? 'warning' : 'neutral'} size="sm">
                    {phase.status.toUpperCase()}
                  </Badge>
                </div>
                {phase.status === 'active' && (
                  <span title={!allDone ? 'Complete all milestones first' : ''}>
                    <Button 
                      variant="primary" size="sm" 
                      onClick={() => handleSignOff(phase)}
                      disabled={!allDone}
                    >
                      Sign Off
                    </Button>
                  </span>
                )}
              </div>
              <div className={styles.phaseMeta}>Req: {phase.signOffReq} &middot; {phase.duration}</div>
              
              <div className={styles.milestoneList}>
                {phase.milestones.map(m => {
                  const hasError = phase.error && !m.done;
                  return (
                    <div key={m.id} className={`${styles.milestoneRow} ${hasError ? styles.milestoneRowIncomplete : ''}`}>
                      <input 
                        type="checkbox" 
                        checked={m.done} 
                        onChange={() => toggleMilestone(phase.id, m.id)} 
                        disabled={phase.status === 'done'}
                      />
                      <span className={styles.milestoneName} style={{ textDecoration: m.done ? 'line-through' : 'none', opacity: m.done ? 0.6 : 1 }}>
                        {m.name}
                      </span>
                      {m.triggersPayment && <span className={styles.paymentIcon}>₹ Payment</span>}
                      <span className={styles.dueDate}>{m.dueDate}</span>
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
