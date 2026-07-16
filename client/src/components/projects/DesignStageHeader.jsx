/* eslint-disable no-unused-vars, react-hooks/immutability, react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { Button, Badge, Textarea } from '../ui';
import { useToast } from '../../store/toastContext';
import styles from './DesignStageHeader.module.css';
import {
  getDesignWorkflow,
  transitionDesignWorkflow,
  confirmDesignWorkflow
} from '../../api/projects';

const STAGES = [
  'Requirement Gathering',
  'Concept Presentation',
  'Concept Approval',
  'Detailed Design',
  'Client Review',
  'Revision Rounds',
  'Design Freeze'
];

const STAGE_DESCRIPTIONS = {
  'Requirement Gathering': 'Gather client style choices, space requirements, category budgets, and existing assets.',
  'Concept Presentation': 'Upload mood boards and concept collections in the Design Assets tab for client inspection.',
  'Concept Approval': 'Awaiting formal client sign-off on the concept direction. Confirming progresses to Detailed Design.',
  'Detailed Design': 'Drafting comprehensive 2D layouts, elevations, modular details, and 3D space renders.',
  'Client Review': 'Presenting detailed drawings and renders to client for detailed feedback.',
  'Revision Rounds': 'Refining design files and drawings in structured review iterations based on client comments.',
  'Design Freeze': 'All designs are locked and frozen. No further changes can be made. Ready for production and construction.'
};

export default function DesignStageHeader({ projectId }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [transitioning, setTransitioning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [comments, setComments] = useState('');

  useEffect(() => {
    if (projectId) {
      fetchWorkflow();
    }
  }, [projectId]);

  const fetchWorkflow = async () => {
    setLoading(true);
    try {
      const res = await getDesignWorkflow(projectId);
      if (res.data?.success) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load design workflow stage.');
    } finally {
      setLoading(false);
    }
  };

  const handleTransition = async (targetStage) => {
    setTransitioning(true);
    try {
      const res = await transitionDesignWorkflow(projectId, {
        to_stage: targetStage,
        comments: comments.trim() || `Transitioned to ${targetStage}`
      });
      if (res.data?.success) {
        toast.success(`Project progressed to: ${targetStage}`);
        setComments('');
        // Reload workflow data
        await fetchWorkflow();
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || 'Transition gate check failed.';
      toast.error(errorMsg);
      console.error(err);
    } finally {
      setTransitioning(false);
    }
  };

  const handleClientConfirm = async () => {
    setConfirming(true);
    try {
      const res = await confirmDesignWorkflow(projectId, {
        comments: comments.trim() || 'Client confirmed design checkpoint'
      });
      if (res.data?.success) {
        toast.success('Design stage checkpoint confirmed successfully.');
        setComments('');
        await fetchWorkflow();
      }
    } catch (err) {
      toast.error('Failed to register client confirmation.');
      console.error(err);
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container} style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
        <span>Loading design stages...</span>
      </div>
    );
  }

  if (!data) return null;

  const currentStage = data.current_stage;
  const currentStageIndex = STAGES.indexOf(currentStage);
  
  // Calculate horizontal progression width
  const progressPercentage = (currentStageIndex / (STAGES.length - 1)) * 100;

  // Compute validation checks for next stage transition
  const getGateChecklist = () => {
    switch (currentStage) {
      case 'Requirement Gathering':
        return [
          { label: 'Design Brief completed & style set', checked: data.gates.brief_completed, description: 'Fill the Interior Style and requirements in the brief tab.' }
        ];
      case 'Concept Presentation':
        return [
          { label: 'At least one Concept/Mood board uploaded & visible', checked: data.gates.concept_uploaded, description: 'Create an asset in the Design Assets tab and check "Visible to client".' }
        ];
      case 'Concept Approval':
        return [
          { label: 'Concept formally approved/confirmed by client', checked: data.gates.concept_approved, description: 'Ask the client to approve or confirm concept boards.' }
        ];
      case 'Detailed Design':
        return [
          { label: 'Detailed drawings or renders uploaded', checked: data.gates.drawings_uploaded, description: 'Upload drawings in the Design Reviews tab.' }
        ];
      case 'Client Review':
        return [
          { label: 'Client review/comments collected', checked: true, description: 'Collect feedback on uploaded drawings.' }
        ];
      case 'Revision Rounds':
        return [
          { label: 'Drawings approved / review round closed', checked: data.gates.drawings_approved, description: 'Check that detailed designs are signed off.' }
        ];
      case 'Design Freeze':
        return [
          { label: 'Design Scope Locked', checked: data.is_scope_locked, description: 'Project design is frozen.' }
        ];
      default:
        return [];
    }
  };

  const checklist = getGateChecklist();
  const nextStage = currentStageIndex < STAGES.length - 1 ? STAGES[currentStageIndex + 1] : null;
  const prevStage = currentStageIndex > 0 ? STAGES[currentStageIndex - 1] : null;
  const isGatesClear = checklist.every(item => item.checked);

  return (
    <div className={styles.container}>
      <div className={styles.titleSection}>
        <div className={styles.titleInfo}>
          <h3>Design Progression workflow</h3>
          <p>Current Stage: <strong>{currentStage}</strong></p>
        </div>
        {data.is_scope_locked && (
          <Badge variant="success">🔒 Design Scope Frozen</Badge>
        )}
      </div>

      {/* Stepper bar */}
      <div className={styles.stepper}>
        <div className={styles.stepperProgress} style={{ width: `${progressPercentage}%` }}></div>
        {STAGES.map((stage, idx) => {
          const isActive = stage === currentStage;
          const isCompleted = idx < currentStageIndex;
          
          let stepClass = '';
          if (isActive) stepClass = styles.activeStep;
          else if (isCompleted) stepClass = styles.completedStep;

          return (
            <div key={stage} className={`${styles.step} ${stepClass}`}>
              <div className={styles.circle}>
                {isCompleted ? '✓' : idx + 1}
              </div>
              <div className={styles.label}>{stage}</div>
            </div>
          );
        })}
      </div>

      {/* Detail / Gate Controls */}
      <div className={styles.workflowPanel}>
        <div className={styles.panelLeft}>
          <div className={styles.stageBanner}>
            <div className={styles.stageBannerTitle}>
              <span>📍 {currentStage}</span>
            </div>
            <p className={styles.stageBannerDesc}>{STAGE_DESCRIPTIONS[currentStage]}</p>
          </div>

          <div className={styles.checklistSection}>
            <h4 className={styles.checklistTitle}>⚠️ Stage Transition Gates</h4>
            {checklist.map((item, idx) => (
              <div key={idx} className={styles.checkItem}>
                <span className={item.checked ? styles.checkIconSuccess : styles.checkIconPending}>
                  {item.checked ? '✓' : '✗'}
                </span>
                <div>
                  <strong>{item.label}</strong>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{item.description}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ width: '100%' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', display: 'block', marginBottom: '6px' }}>
              Transition / Review remarks
            </label>
            <input
              type="text"
              placeholder="Add transition notes or client feedback summary..."
              className={styles.transitionComments}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '13px',
                border: '1px solid var(--color-border)',
                borderRadius: '4px',
                background: 'var(--color-surface)'
              }}
              value={comments}
              onChange={e => setComments(e.target.value)}
            />
          </div>

          <div className={styles.actionSection}>
            {/* Backwards transition */}
            {prevStage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTransition(prevStage)}
                disabled={transitioning}
              >
                ← Back to {prevStage}
              </Button>
            )}

            {/* Client Confirmation signoff */}
            {currentStage !== 'Design Freeze' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleClientConfirm}
                disabled={confirming}
              >
                🤝 Client Confirm / Sign-off
              </Button>
            )}

            {/* Next stage transition button */}
            {nextStage && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleTransition(nextStage)}
                disabled={transitioning || !isGatesClear}
                title={!isGatesClear ? 'Fulfill all checklist requirements to proceed' : ''}
              >
                Proceed to {nextStage} →
              </Button>
            )}
          </div>
        </div>

        {/* History log */}
        <div className={styles.panelRight}>
          <h4 className={styles.historyTitle}>📜 Workflow Timeline History</h4>
          {data.history.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>No stage transition log yet.</div>
          ) : (
            <div className={styles.historyList}>
              {data.history.map(item => (
                <div key={item.id} className={styles.historyItem}>
                  <div className={styles.historyMeta}>
                    <span className={styles.historyStage}>{item.to_stage}</span>
                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span>By: {item.changed_by_name || 'System'}</span>
                    {item.client_confirmed && (
                      <span className={styles.badgeConfirm}>✓ Client Confirmed</span>
                    )}
                  </div>
                  {item.comments && (
                    <p className={styles.historyComments}>{item.comments}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
