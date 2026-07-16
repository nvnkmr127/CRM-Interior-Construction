/* eslint-disable no-unused-vars, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import styles from './ProjectClosureTab.module.css';
import { getClosureChecklist, updateClosureChecklist, updateProject } from '../../api/projects';
import { Badge, Button } from '../../components/ui';
import { useToast } from '../../store/toastContext';

export default function ProjectClosureTab({ projectId, projectStatus, onProjectUpdated }) {
  const [checklist, setChecklist] = useState(null);
  const [autoVerification, setAutoVerification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submittingClosure, setSubmittingClosure] = useState(false);
  const toast = useToast();

  // Temporary local state for gates to allow editing notes before saving
  const [formState, setFormState] = useState({
    financial_clearance_completed: false,
    financial_clearance_notes: '',
    task_completion_completed: false,
    task_completion_notes: '',
    snag_closure_completed: false,
    snag_closure_notes: '',
    document_archive_completed: false,
    document_archive_notes: '',
    warranty_activation_completed: false,
    warranty_activation_notes: ''
  });

  const loadChecklist = async () => {
    try {
      setLoading(true);
      const res = await getClosureChecklist(projectId);
      const data = res.data?.data || res.data;
      if (data) {
        setChecklist(data.checklist);
        setAutoVerification(data.autoVerification);
        setFormState({
          financial_clearance_completed: !!data.checklist?.financial_clearance_completed,
          financial_clearance_notes: data.checklist?.financial_clearance_notes || '',
          task_completion_completed: !!data.checklist?.task_completion_completed,
          task_completion_notes: data.checklist?.task_completion_notes || '',
          snag_closure_completed: !!data.checklist?.snag_closure_completed,
          snag_closure_notes: data.checklist?.snag_closure_notes || '',
          document_archive_completed: !!data.checklist?.document_archive_completed,
          document_archive_notes: data.checklist?.document_archive_notes || '',
          warranty_activation_completed: !!data.checklist?.warranty_activation_completed,
          warranty_activation_notes: data.checklist?.warranty_activation_notes || ''
        });
      }
    } catch (err) {
      console.error('[ProjectClosureTab] load error:', err);
      toast.error('Failed to load project closure checklist.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadChecklist();
    }
  }, [projectId]);

  const handleCheckboxChange = (field) => {
    setFormState(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleNotesChange = (field, value) => {
    setFormState(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveChanges = async () => {
    try {
      setSaving(true);
      const res = await updateClosureChecklist(projectId, formState);
      const data = res.data?.data || res.data;
      if (data) {
        setChecklist(data.checklist);
        setAutoVerification(data.autoVerification);
        toast.success('Project closure checklist updated successfully.');
      }
    } catch (err) {
      console.error('[ProjectClosureTab] save error:', err);
      toast.error('Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteClosure = async () => {
    if (projectStatus === 'completed') {
      toast.info('Project is already completed.');
      return;
    }

    if (!window.confirm('Are you sure you want to transition this project to COMPLETED? This will mark the project as closed across all dashboards.')) {
      return;
    }

    try {
      setSubmittingClosure(true);
      await updateProject(projectId, { status: 'completed' });
      toast.success('Project closure completed successfully! Project is now marked as Completed.');
      if (onProjectUpdated) {
        onProjectUpdated();
      }
      loadChecklist();
    } catch (err) {
      console.error('[ProjectClosureTab] complete closure error:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Failed to complete project closure.';
      toast.error(errorMsg);
    } finally {
      setSubmittingClosure(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading project closure status...</div>;
  }

  const allGatesCompleted = 
    formState.financial_clearance_completed &&
    formState.task_completion_completed &&
    formState.snag_closure_completed &&
    formState.document_archive_completed &&
    formState.warranty_activation_completed;

  const getGateAudits = (gate) => {
    const verifiedBy = checklist?.[`${gate}_verified_by`];
    const verifiedAt = checklist?.[`${gate}_verified_at`];
    if (verifiedBy && verifiedAt) {
      return (
        <div className={styles.auditLog}>
          Verified at {new Date(verifiedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      );
    }
    return null;
  };

  return (
    <div className={styles.container}>
      {/* Header Status Panel */}
      {projectStatus === 'completed' ? (
        <div className={`${styles.statusPanel} ${styles.completed}`}>
          <div className={styles.statusIcon}>🏆</div>
          <div>
            <h3 className={styles.statusTitle}>Project Officially Closed</h3>
            <p className={styles.statusDesc}>
              This project is fully closed out. All financial, task, snag, document, and warranty gates have been verified and settled.
            </p>
          </div>
        </div>
      ) : (
        <div className={`${styles.statusPanel} ${styles.active}`}>
          <div className={styles.statusIcon}>📋</div>
          <div>
            <h3 className={styles.statusTitle}>Project Closure Checklist</h3>
            <p className={styles.statusDesc}>
              Verify and sign off all five mandatory project closure gates below. These gates ensure correct handovers, billing clearance, and warranty start dates before a project can be set to Completed status.
            </p>
          </div>
        </div>
      )}

      {/* Grid of 5 Gates */}
      <div className={styles.grid}>
        {/* Gate 1: Financial Clearance */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.gateNumber}>Gate 1</span>
            <h4 className={styles.gateTitle}>Financial Clearance</h4>
          </div>
          <div className={styles.cardBody}>
            <p className={styles.gateDesc}>Verify all client invoices have been fully paid or formally deferred.</p>
            
            {/* Auto check */}
            <div className={styles.autoCheck}>
              <span className={styles.autoCheckLabel}>System Verification:</span>
              {autoVerification?.financialClearance?.passed ? (
                <span className={`${styles.badge} ${styles.badgeSuccess}`}>✓ Verified</span>
              ) : (
                <span className={`${styles.badge} ${styles.badgeWarning}`}>⚠️ Pending</span>
              )}
              <div className={styles.autoCheckMsg}>{autoVerification?.financialClearance?.message}</div>
            </div>

            {/* Manual sign-off */}
            <div className={styles.signOff}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formState.financial_clearance_completed}
                  onChange={() => handleCheckboxChange('financial_clearance_completed')}
                  disabled={projectStatus === 'completed'}
                />
                <span className={styles.checkboxText}>Mark Gate as Verified</span>
              </label>
              
              <div className={styles.notesContainer}>
                <label className={styles.notesLabel}>Verification / Waiver Notes:</label>
                <textarea
                  className={styles.notesInput}
                  value={formState.financial_clearance_notes}
                  onChange={(e) => handleNotesChange('financial_clearance_notes', e.target.value)}
                  placeholder="e.g. All milestone payments settled."
                  disabled={projectStatus === 'completed'}
                  rows={2}
                />
              </div>
              {getGateAudits('financial_clearance')}
            </div>
          </div>
        </div>

        {/* Gate 2: Task Completion */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.gateNumber}>Gate 2</span>
            <h4 className={styles.gateTitle}>Task Completion</h4>
          </div>
          <div className={styles.cardBody}>
            <p className={styles.gateDesc}>Ensure all project tasks, deliveries, and milestones are completed.</p>
            
            {/* Auto check */}
            <div className={styles.autoCheck}>
              <span className={styles.autoCheckLabel}>System Verification:</span>
              {autoVerification?.taskCompletion?.passed ? (
                <span className={`${styles.badge} ${styles.badgeSuccess}`}>✓ Verified</span>
              ) : (
                <span className={`${styles.badge} ${styles.badgeWarning}`}>⚠️ Pending</span>
              )}
              <div className={styles.autoCheckMsg}>{autoVerification?.taskCompletion?.message}</div>
            </div>

            {/* Manual sign-off */}
            <div className={styles.signOff}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formState.task_completion_completed}
                  onChange={() => handleCheckboxChange('task_completion_completed')}
                  disabled={projectStatus === 'completed'}
                />
                <span className={styles.checkboxText}>Mark Gate as Verified</span>
              </label>
              
              <div className={styles.notesContainer}>
                <label className={styles.notesLabel}>Verification / Waiver Notes:</label>
                <textarea
                  className={styles.notesInput}
                  value={formState.task_completion_notes}
                  onChange={(e) => handleNotesChange('task_completion_notes', e.target.value)}
                  placeholder="e.g. All drawings and site work tasks finished."
                  disabled={projectStatus === 'completed'}
                  rows={2}
                />
              </div>
              {getGateAudits('task_completion')}
            </div>
          </div>
        </div>

        {/* Gate 3: Snag Closure */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.gateNumber}>Gate 3</span>
            <h4 className={styles.gateTitle}>Snag & Defect Closure</h4>
          </div>
          <div className={styles.cardBody}>
            <p className={styles.gateDesc}>Verify all snags and punch list items are resolved and verified.</p>
            
            {/* Auto check */}
            <div className={styles.autoCheck}>
              <span className={styles.autoCheckLabel}>System Verification:</span>
              {autoVerification?.snagClosure?.passed ? (
                <span className={`${styles.badge} ${styles.badgeSuccess}`}>✓ Verified</span>
              ) : (
                <span className={`${styles.badge} ${styles.badgeWarning}`}>⚠️ Pending</span>
              )}
              <div className={styles.autoCheckMsg}>{autoVerification?.snagClosure?.message}</div>
            </div>

            {/* Manual sign-off */}
            <div className={styles.signOff}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formState.snag_closure_completed}
                  onChange={() => handleCheckboxChange('snag_closure_completed')}
                  disabled={projectStatus === 'completed'}
                />
                <span className={styles.checkboxText}>Mark Gate as Verified</span>
              </label>
              
              <div className={styles.notesContainer}>
                <label className={styles.notesLabel}>Verification / Waiver Notes:</label>
                <textarea
                  className={styles.notesInput}
                  value={formState.snag_closure_notes}
                  onChange={(e) => handleNotesChange('snag_closure_notes', e.target.value)}
                  placeholder="e.g. No open defects remaining."
                  disabled={projectStatus === 'completed'}
                  rows={2}
                />
              </div>
              {getGateAudits('snag_closure')}
            </div>
          </div>
        </div>

        {/* Gate 4: Document Archive */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.gateNumber}>Gate 4</span>
            <h4 className={styles.gateTitle}>Document Archive</h4>
          </div>
          <div className={styles.cardBody}>
            <p className={styles.gateDesc}>Verify final site drawings, handover forms, and photos are archived.</p>
            
            {/* Auto check */}
            <div className={styles.autoCheck}>
              <span className={styles.autoCheckLabel}>System Verification:</span>
              {autoVerification?.documentArchive?.passed ? (
                <span className={`${styles.badge} ${styles.badgeSuccess}`}>✓ Verified</span>
              ) : (
                <span className={`${styles.badge} ${styles.badgeWarning}`}>⚠️ Pending</span>
              )}
              <div className={styles.autoCheckMsg}>{autoVerification?.documentArchive?.message}</div>
            </div>

            {/* Manual sign-off */}
            <div className={styles.signOff}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formState.document_archive_completed}
                  onChange={() => handleCheckboxChange('document_archive_completed')}
                  disabled={projectStatus === 'completed'}
                />
                <span className={styles.checkboxText}>Mark Gate as Verified</span>
              </label>
              
              <div className={styles.notesContainer}>
                <label className={styles.notesLabel}>Verification / Waiver Notes:</label>
                <textarea
                  className={styles.notesInput}
                  value={formState.document_archive_notes}
                  onChange={(e) => handleNotesChange('document_archive_notes', e.target.value)}
                  placeholder="e.g. Handover certificate and photos archived."
                  disabled={projectStatus === 'completed'}
                  rows={2}
                />
              </div>
              {getGateAudits('document_archive')}
            </div>
          </div>
        </div>

        {/* Gate 5: Warranty Activation */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.gateNumber}>Gate 5</span>
            <h4 className={styles.gateTitle}>Warranty Activation</h4>
          </div>
          <div className={styles.cardBody}>
            <p className={styles.gateDesc}>Ensure product warranties have been registered and activated.</p>
            
            {/* Auto check */}
            <div className={styles.autoCheck}>
              <span className={styles.autoCheckLabel}>System Verification:</span>
              {autoVerification?.warrantyActivation?.passed ? (
                <span className={`${styles.badge} ${styles.badgeSuccess}`}>✓ Verified</span>
              ) : (
                <span className={`${styles.badge} ${styles.badgeWarning}`}>⚠️ Pending</span>
              )}
              <div className={styles.autoCheckMsg}>{autoVerification?.warrantyActivation?.message}</div>
            </div>

            {/* Manual sign-off */}
            <div className={styles.signOff}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formState.warranty_activation_completed}
                  onChange={() => handleCheckboxChange('warranty_activation_completed')}
                  disabled={projectStatus === 'completed'}
                />
                <span className={styles.checkboxText}>Mark Gate as Verified</span>
              </label>
              
              <div className={styles.notesContainer}>
                <label className={styles.notesLabel}>Verification / Waiver Notes:</label>
                <textarea
                  className={styles.notesInput}
                  value={formState.warranty_activation_notes}
                  onChange={(e) => handleNotesChange('warranty_activation_notes', e.target.value)}
                  placeholder="e.g. Warranties activated for modular fittings."
                  disabled={projectStatus === 'completed'}
                  rows={2}
                />
              </div>
              {getGateAudits('warranty_activation')}
            </div>
          </div>
        </div>
      </div>

      {/* Checklist Action Bar */}
      <div className={styles.actionBar}>
        <div className={styles.actionBarLeft}>
          <div className={styles.statusState}>
            <span>Checklist Status: </span>
            {checklist?.status === 'completed' ? (
              <span className={`${styles.badge} ${styles.badgeSuccess}`}>Ready for Closure</span>
            ) : (
              <span className={`${styles.badge} ${styles.badgeWarning}`}>In Progress</span>
            )}
          </div>
          <p className={styles.actionBarDesc}>
            {allGatesCompleted 
              ? 'All gates checked! Save changes to verify, then click Complete Project Closure to close the project.'
              : 'Sign off all 5 gates before you can complete project closure.'
            }
          </p>
        </div>
        <div className={styles.actionBarRight}>
          {projectStatus !== 'completed' && (
            <Button
              variant="secondary"
              onClick={handleSaveChanges}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Checklist Changes'}
            </Button>
          )}

          {projectStatus !== 'completed' && (
            <Button
              variant="primary"
              onClick={handleCompleteClosure}
              disabled={submittingClosure || !allGatesCompleted || checklist?.status !== 'completed'}
            >
              {submittingClosure ? 'Closing Project...' : 'Complete Project Closure'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
