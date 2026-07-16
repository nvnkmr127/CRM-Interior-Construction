/* eslint-disable react-hooks/immutability, react-hooks/exhaustive-deps, no-unused-vars */
import { useState, useEffect } from 'react';
import { useAuth } from '../../store/authContext';
import { useToast } from '../../store/toastContext';
import { getLeaves, getLeaveImpact, createLeave } from '../../api/leaveApi';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { Spinner, EmptyState, Modal, Button } from '../../components/ui';
import styles from './ResourceAbsencePage.module.css';

export default function ResourceAbsencePage() {
  usePageTitle('Absence Management');
  useBreadcrumbs([{ label: 'Projects' }, { label: 'Absence Management' }]);

  const { user } = useAuth();
  const toast = useToast();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [impactData, setImpactData] = useState(null);
  const [coverages, setCoverages] = useState({}); // { projectId: { coveringUserId, handoverNotes, clientNotified } }
  const [submitting, setSubmitting] = useState(false);
  const [impactLoading, setImpactLoading] = useState(false);

  useEffect(() => {
    fetchLeaves();
  }, []);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const res = await getLeaves();
      setLeaves(res || []);
    } catch (err) {
      toast.error('Failed to load leaves');
    } finally {
      setLoading(false);
    }
  };

  const handleDatesSelected = async () => {
    if (!startDate || !endDate) {
      toast.error('Please select start and end dates');
      return;
    }
    
    setImpactLoading(true);
    try {
      const res = await getLeaveImpact(user.id);
      setImpactData(res);
      // Initialize coverages state
      const initialCov = {};
      res.affectedProjects.forEach(p => {
        initialCov[p.id] = { coveringUserId: '', handoverNotes: '', clientNotified: false };
      });
      setCoverages(initialCov);
    } catch (error) {
      toast.error('Failed to analyze impact');
    } finally {
      setImpactLoading(false);
    }
  };

  const handleCoverageChange = (projectId, field, value) => {
    setCoverages(prev => ({
      ...prev,
      [projectId]: {
        ...prev[projectId],
        [field]: value
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!startDate || !endDate) return;

    setSubmitting(true);
    try {
      const coverageArray = Object.keys(coverages).map(pid => ({
        projectId: pid,
        ...coverages[pid]
      }));

      await createLeave({
        userId: user.id,
        startDate,
        endDate,
        reason,
        coverages: coverageArray
      });

      toast.success('Leave requested successfully');
      setShowModal(false);
      resetForm();
      fetchLeaves();
    } catch (err) {
      toast.error('Failed to submit leave request');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setStartDate('');
    setEndDate('');
    setReason('');
    setImpactData(null);
    setCoverages({});
  };

  const openModal = () => {
    resetForm();
    setShowModal(true);
  };

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Absence Management</h1>
          <div className={styles.desc}>Plan leaves and manage project coverage.</div>
        </div>
        <Button onClick={openModal}>+ Plan Leave</Button>
      </div>

      {loading ? (
        <Spinner />
      ) : leaves.length === 0 ? (
        <EmptyState title="No leaves recorded" description="You have not requested any leaves yet." />
      ) : (
        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Staff Name</th>
                <th className={styles.th}>Role</th>
                <th className={styles.th}>Start Date</th>
                <th className={styles.th}>End Date</th>
                <th className={styles.th}>Reason</th>
                <th className={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {leaves.map(l => (
                <tr key={l.id} className={styles.tr}>
                  <td className={styles.td}>{l.user_name}</td>
                  <td className={styles.td}>{l.role_name}</td>
                  <td className={styles.td}>{new Date(l.start_date).toLocaleDateString()}</td>
                  <td className={styles.td}>{new Date(l.end_date).toLocaleDateString()}</td>
                  <td className={styles.td}>{l.reason}</td>
                  <td className={styles.td}>
                    <span className={styles.statusBadge}>{l.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal isOpen={showModal} title="Plan Leave" onClose={() => setShowModal(false)} size="lg">
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Start Date</label>
                <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label>End Date</label>
                <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className={styles.formGroup}>
              <label>Reason (Optional)</label>
              <input type="text" value={reason} onChange={e => setReason(e.target.value)} />
            </div>

            {!impactData && (
              <Button type="button" onClick={handleDatesSelected} disabled={impactLoading} variant="secondary">
                {impactLoading ? 'Analyzing...' : 'Next: Check Project Impact'}
              </Button>
            )}

            {impactData && (
              <div className={styles.impactSection}>
                <h3>Project Coverage Plan</h3>
                {impactData.affectedProjects.length === 0 ? (
                  <p>You have no active projects that require coverage.</p>
                ) : (
                  <div className={styles.coverageList}>
                    {impactData.affectedProjects.map(p => (
                      <div key={p.id} className={styles.coverageItem}>
                        <div className={styles.covHeader}>
                          <strong>{p.project_name}</strong> (Client: {p.client_name || 'N/A'})
                        </div>
                        <div className={styles.covControls}>
                          <select 
                            value={coverages[p.id]?.coveringUserId || ''} 
                            onChange={(e) => handleCoverageChange(p.id, 'coveringUserId', e.target.value)}
                            required
                          >
                            <option value="">-- Select Covering Colleague --</option>
                            {impactData.availableCoveringUsers.map(u => (
                              <option key={u.id} value={u.id}>{u.name} ({u.role_name})</option>
                            ))}
                          </select>
                          <input 
                            type="text" 
                            placeholder="Handover notes..."
                            value={coverages[p.id]?.handoverNotes || ''}
                            onChange={(e) => handleCoverageChange(p.id, 'handoverNotes', e.target.value)}
                          />
                          <label className={styles.checkboxLabel}>
                            <input 
                              type="checkbox"
                              checked={coverages[p.id]?.clientNotified || false}
                              onChange={(e) => handleCoverageChange(p.id, 'clientNotified', e.target.checked)}
                            />
                            Notify Client
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className={styles.modalActions}>
                  <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
                  <Button type="submit" loading={submitting}>Submit Leave</Button>
                </div>
              </div>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}
