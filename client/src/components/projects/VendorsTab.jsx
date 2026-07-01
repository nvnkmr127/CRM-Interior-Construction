import React, { useState, useEffect } from 'react';
import styles from './VendorsTab.module.css';
import { Button, Badge, Modal, Input, Textarea, Select } from '../../components/ui';
import { useToast } from '../../store/toastContext';
import { getVendorCoordination, markVendorDefault, updateVendorRecovery } from '../../api/projects';

export default function VendorsTab({ projectId }) {
  const toast = useToast();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Vendor Default Modal State
  const [isDefaultModalOpen, setIsDefaultModalOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [defaultForm, setDefaultForm] = useState({
    defaultDate: new Date().toISOString().split('T')[0],
    workCompletedAssessment: '',
    outstandingScope: '',
    estimatedRecoveryAmount: ''
  });
  
  // Recovery Modal State
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);
  const [recoveryForm, setRecoveryForm] = useState({
    financialRecoveryStatus: 'pending',
    financialRecoveryAmount: ''
  });

  const loadVendors = async () => {
    try {
      setLoading(true);
      const data = await getVendorCoordination(projectId);
      setVendors(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error('Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) loadVendors();
  }, [projectId]);

  const handleOpenDefaultModal = (vendor) => {
    setSelectedVendor(vendor);
    setDefaultForm({
      defaultDate: new Date().toISOString().split('T')[0],
      workCompletedAssessment: '',
      outstandingScope: '',
      estimatedRecoveryAmount: ''
    });
    setIsDefaultModalOpen(true);
  };

  const handleOpenRecoveryModal = (vendor) => {
    setSelectedVendor(vendor);
    setRecoveryForm({
      financialRecoveryStatus: vendor.financial_recovery_status || 'pending',
      financialRecoveryAmount: vendor.financial_recovery_amount || ''
    });
    setIsRecoveryModalOpen(true);
  };

  const handleSubmitDefault = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        defaultDate: defaultForm.defaultDate,
        workCompletedAssessment: defaultForm.workCompletedAssessment,
        outstandingScope: defaultForm.outstandingScope,
        estimatedRecoveryAmount: defaultForm.estimatedRecoveryAmount ? Number(defaultForm.estimatedRecoveryAmount) : 0
      };
      await markVendorDefault(projectId, selectedVendor.id, payload);
      toast.success('Vendor marked as defaulted');
      setIsDefaultModalOpen(false);
      loadVendors();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to mark vendor as defaulted');
    }
  };

  const handleSubmitRecovery = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        financialRecoveryStatus: recoveryForm.financialRecoveryStatus,
      };
      if (recoveryForm.financialRecoveryAmount !== '') {
        payload.financialRecoveryAmount = Number(recoveryForm.financialRecoveryAmount);
      }
      await updateVendorRecovery(projectId, selectedVendor.id, payload);
      toast.success('Recovery status updated');
      setIsRecoveryModalOpen(false);
      loadVendors();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update recovery');
    }
  };

  if (loading) return <div>Loading vendors...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Project Vendors</h2>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Scope</th>
              <th>Status</th>
              <th>Schedule</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map(v => (
              <tr key={v.id} className={v.current_status === 'defaulted' ? styles.rowDefaulted : ''}>
                <td>
                  <strong>{v.vendor_name}</strong>
                  {v.current_status === 'defaulted' && (
                    <div className={styles.defaultBadge}>DEFAULTED on {v.default_date?.substring(0,10)}</div>
                  )}
                </td>
                <td>{v.scope_of_work}</td>
                <td>
                  <Badge variant={
                    v.current_status === 'completed' ? 'success' :
                    v.current_status === 'blocked' ? 'error' :
                    v.current_status === 'defaulted' ? 'error' : 'default'
                  }>{v.current_status}</Badge>
                </td>
                <td>
                  {v.scheduled_start_date ? new Date(v.scheduled_start_date).toLocaleDateString() : 'TBD'} - 
                  {v.scheduled_finish_date ? new Date(v.scheduled_finish_date).toLocaleDateString() : 'TBD'}
                </td>
                <td className={styles.actions}>
                  {v.current_status !== 'defaulted' && (
                    <Button size="small" variant="danger" onClick={() => handleOpenDefaultModal(v)}>
                      Mark Default
                    </Button>
                  )}
                  {v.current_status === 'defaulted' && (
                    <Button size="small" variant="secondary" onClick={() => handleOpenRecoveryModal(v)}>
                      Update Recovery
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {vendors.length === 0 && (
              <tr>
                <td colSpan="5" className={styles.empty}>No vendors assigned to this project yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={isDefaultModalOpen}
        onClose={() => setIsDefaultModalOpen(false)}
        title={`Mark Vendor Default: ${selectedVendor?.vendor_name}`}
      >
        <form onSubmit={handleSubmitDefault} className={styles.form}>
          <p className={styles.warning}>
            Marking a vendor as defaulted will initiate the financial recovery and replacement workflow.
          </p>
          <Input 
            label="Default Date" 
            type="date"
            required
            value={defaultForm.defaultDate}
            onChange={(e) => setDefaultForm({...defaultForm, defaultDate: e.target.value})}
          />
          <Textarea 
            label="Work Completed Assessment"
            placeholder="Describe what work was actually finished..."
            required
            value={defaultForm.workCompletedAssessment}
            onChange={(e) => setDefaultForm({...defaultForm, workCompletedAssessment: e.target.value})}
          />
          <Textarea 
            label="Outstanding Scope Description"
            placeholder="Describe what is left to do..."
            required
            value={defaultForm.outstandingScope}
            onChange={(e) => setDefaultForm({...defaultForm, outstandingScope: e.target.value})}
          />
          <Input 
            label="Estimated Financial Recovery Amount (₹)" 
            type="number"
            min="0"
            value={defaultForm.estimatedRecoveryAmount}
            onChange={(e) => setDefaultForm({...defaultForm, estimatedRecoveryAmount: e.target.value})}
          />
          <div className={styles.formActions}>
            <Button type="button" variant="ghost" onClick={() => setIsDefaultModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="danger">Confirm Default</Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isRecoveryModalOpen}
        onClose={() => setIsRecoveryModalOpen(false)}
        title={`Update Financial Recovery: ${selectedVendor?.vendor_name}`}
      >
        <form onSubmit={handleSubmitRecovery} className={styles.form}>
          <Select
            label="Recovery Status"
            value={recoveryForm.financialRecoveryStatus}
            onChange={(e) => setRecoveryForm({...recoveryForm, financialRecoveryStatus: e.target.value})}
            options={[
              { value: 'pending', label: 'Pending' },
              { value: 'recovered', label: 'Recovered' },
              { value: 'written_off', label: 'Written Off' }
            ]}
          />
          <Input 
            label="Actual Recovery Amount (₹)" 
            type="number"
            min="0"
            value={recoveryForm.financialRecoveryAmount}
            onChange={(e) => setRecoveryForm({...recoveryForm, financialRecoveryAmount: e.target.value})}
          />
          <div className={styles.formActions}>
            <Button type="button" variant="ghost" onClick={() => setIsRecoveryModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary">Save Recovery</Button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
