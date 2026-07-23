import { useState } from 'react';
import { Modal, Button, Badge } from '../ui';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';
import styles from './OffboardingModal.module.css';
import OffboardingStepper from './OffboardingStepper';

export default function OffboardingModal({ record, onClose, onUpdated }) {
  const [loading, setLoading] = useState(false);
  const [checklist, setChecklist] = useState({
    knowledge_transfer_done: record.knowledge_transfer_done || false,
    project_transfer_done: record.project_transfer_done || false,
    task_transfer_done: record.task_transfer_done || false,
    assets_returned: record.assets_returned || false
  });
  const toast = useToast();

  const handleManagerApprove = async () => {
    setLoading(true);
    try {
      await api.put(`/offboarding/${record.id}/manager-approve`);
      toast.success('Manager approved');
      onUpdated();
    } catch (e) {
      toast.error('Failed to approve');
    } finally {
      setLoading(false);
    }
  };

  const handleHrApprove = async () => {
    setLoading(true);
    try {
      await api.put(`/offboarding/${record.id}/hr-approve`);
      toast.success('HR approved');
      onUpdated();
    } catch (e) {
      toast.error('Failed to approve');
    } finally {
      setLoading(false);
    }
  };

  const handleChecklistChange = async (field, value) => {
    const newChecklist = { ...checklist, [field]: value };
    setChecklist(newChecklist);
    try {
      await api.put(`/offboarding/${record.id}/step`, newChecklist);
      onUpdated(); // Refresh status badge and timeline
    } catch (e) {
      toast.error('Failed to update checklist');
      setChecklist({ ...checklist }); // Revert
    }
  };

  const handleFinalize = async () => {
    if (!window.confirm('Are you sure you want to finalize offboarding? This will disable the account and archive the user.')) return;
    setLoading(true);
    try {
      await api.post(`/offboarding/${record.id}/finalize`);
      toast.success('Offboarding finalized and account disabled');
      onUpdated(true);
    } catch (e) {
      toast.error('Failed to finalize');
    } finally {
      setLoading(false);
    }
  };

  const isTransfersDone = checklist.knowledge_transfer_done && checklist.project_transfer_done && checklist.task_transfer_done;
  const isAllDone = isTransfersDone && checklist.assets_returned;

  if (record.status === 'archived') {
    return (
      <Modal isOpen={true} title={`Offboarding Summary: ${record.first_name} ${record.last_name}`} onClose={onClose}>
        <div className={styles.container}>
          <div className={styles.headerInfo}>
            <div>
              <strong>Resignation Date:</strong> {new Date(record.resignation_date).toLocaleDateString()}
            </div>
            <div>
              <strong>Last Working Day:</strong> {new Date(record.last_working_day).toLocaleDateString()}
            </div>
            <div>
              <strong>Status:</strong> <Badge variant="neutral">ARCHIVED</Badge>
            </div>
          </div>

          <OffboardingStepper status={record.status} />

          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            textAlign: 'center', 
            padding: '24px 20px', 
            background: 'linear-gradient(145deg, rgba(34, 197, 94, 0.05) 0%, rgba(34, 197, 94, 0.15) 100%)', 
            borderRadius: '12px', 
            border: '1px solid rgba(34, 197, 94, 0.2)',
            boxShadow: '0 4px 16px rgba(34, 197, 94, 0.08)',
            margin: '16px 0'
          }}>
             <div style={{ 
               display: 'flex',
               alignItems: 'center',
               justifyContent: 'center',
               width: '56px',
               height: '56px',
               background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
               borderRadius: '50%',
               color: 'white',
               marginBottom: '12px',
               boxShadow: '0 6px 12px rgba(34, 197, 94, 0.25)'
             }}>
               <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                 <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                 <polyline points="22 4 12 14.01 9 11.01"></polyline>
               </svg>
             </div>
             <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '700', color: 'var(--color-text-primary)' }}>
               Offboarding Finalized
             </h3>
             <p style={{ color: 'var(--color-text-secondary)', margin: 0, lineHeight: '1.5', fontSize: '14px', maxWidth: '400px' }}>
               All approvals, knowledge transfers, and asset returns were successfully completed. The employee's account has been deactivated and safely archived.
             </p>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <Button variant="secondary" onClick={onClose}>Close Window</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={true} title={`Offboarding: ${record.first_name} ${record.last_name}`} onClose={onClose}>
      <div className={styles.container}>
        <div className={styles.headerInfo}>
          <div>
            <strong>Resignation Date:</strong> {new Date(record.resignation_date).toLocaleDateString()}
          </div>
          <div>
            <strong>Last Working Day:</strong> {new Date(record.last_working_day).toLocaleDateString()}
          </div>
          <div>
            <strong>Status:</strong> <Badge>{record.status.replace('_', ' ').toUpperCase()}</Badge>
          </div>
        </div>

        <OffboardingStepper status={record.status} />

        <div className={styles.section}>
          <h4>1. Approvals</h4>
          <div className={styles.approvalActions}>
            <Button 
              variant="secondary" 
              onClick={handleManagerApprove} 
              disabled={loading || record.manager_approved_at || record.status === 'archived'}
            >
              {record.manager_approved_at ? 'Manager Approved \u2713' : 'Approve as Manager'}
            </Button>
            <Button 
              variant="secondary" 
              onClick={handleHrApprove} 
              disabled={loading || !record.manager_approved_at || record.hr_approved_at || record.status === 'archived'}
            >
              {record.hr_approved_at ? 'HR Approved \u2713' : 'Approve as HR'}
            </Button>
          </div>
        </div>

        <div className={styles.section}>
          <h4>2. Transfer Checklist</h4>
          <div className={styles.checklist}>
            <label className={styles.checkItem}>
              <input 
                type="checkbox" 
                checked={checklist.knowledge_transfer_done}
                onChange={(e) => handleChecklistChange('knowledge_transfer_done', e.target.checked)}
                disabled={record.status === 'pending_manager' || record.status === 'pending_hr' || record.status === 'archived'}
              />
              Knowledge Transfer Completed
            </label>
            <label className={styles.checkItem}>
              <input 
                type="checkbox" 
                checked={checklist.project_transfer_done}
                onChange={(e) => handleChecklistChange('project_transfer_done', e.target.checked)}
                disabled={record.status === 'pending_manager' || record.status === 'pending_hr' || record.status === 'archived'}
              />
              Project Transfer Completed
            </label>
            <label className={styles.checkItem}>
              <input 
                type="checkbox" 
                checked={checklist.task_transfer_done}
                onChange={(e) => handleChecklistChange('task_transfer_done', e.target.checked)}
                disabled={record.status === 'pending_manager' || record.status === 'pending_hr' || record.status === 'archived'}
              />
              Task Transfer Completed
            </label>
          </div>
        </div>

        <div className={styles.section}>
          <h4>3. Asset Return</h4>
          <div className={styles.checklist}>
            <label className={styles.checkItem}>
              <input 
                type="checkbox" 
                checked={checklist.assets_returned}
                onChange={(e) => handleChecklistChange('assets_returned', e.target.checked)}
                disabled={!isTransfersDone || record.status === 'archived'}
              />
              All Company Assets Returned
            </label>
          </div>
        </div>

        <div className={styles.section}>
          <h4>4. Finalization</h4>
          <p className={styles.helpText}>Finalizing will lock the employee's account and change their status to inactive.</p>
          <Button 
            variant="danger" 
            onClick={handleFinalize} 
            disabled={loading || record.status !== 'completed'}
          >
            Disable Account & Archive
          </Button>
        </div>

      </div>
    </Modal>
  );
}
