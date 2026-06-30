import React, { useState, useEffect, useMemo } from 'react';
import styles from './AmcsTab.module.css';
import { Button, Input, Modal, FormField, Textarea } from '../../components/ui';
import { getAmcs, createAmc, updateAmc, deleteAmc, createAmcVisit, updateAmcVisit, deleteAmcVisit } from '../../api/amcs';
import { usersApi } from '../../api/users';
import { useToast } from '../../store/toastContext';

export default function AmcsTab({ projectId }) {
  const toast = useToast();
  const [amcs, setAmcs] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedAmcId, setExpandedAmcId] = useState(null);

  // Modals
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [completeVisitModalOpen, setCompleteVisitModalOpen] = useState(false);

  // Form States
  const [contractForm, setContractForm] = useState({
    contractNumber: '',
    contractValue: 0,
    startDate: '',
    endDate: '',
    coveredScope: '',
    visitFrequency: 'quarterly',
    coveredProducts: '',
    exclusions: '',
    paymentSchedule: '',
    autoRenewalAlertDays: 90,
    generateVisits: true
  });

  const [visitForm, setVisitForm] = useState({
    scheduledDate: '',
    technicianId: '',
    remarks: ''
  });

  const [completeVisitForm, setCompleteVisitForm] = useState({
    completedDate: '',
    technicianId: '',
    remarks: ''
  });

  const [activeAmcId, setActiveAmcId] = useState(null);
  const [activeVisitId, setActiveVisitId] = useState(null);

  const fetchAmcs = () => {
    setLoading(true);
    getAmcs(projectId)
      .then(res => {
        const list = res.data?.data || res.data || [];
        setAmcs(list);
        if (list.length > 0 && !expandedAmcId) {
          setExpandedAmcId(list[0].id);
        }
      })
      .catch(err => {
        console.error(err);
        setAmcs([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!projectId) return;
    fetchAmcs();

    // Fetch technicians (staff/users)
    usersApi.getAll({ status: 'active' })
      .then(res => {
        const raw = res.data?.data || res.data || [];
        setStaffList(raw);
      })
      .catch(() => setStaffList([]));
  }, [projectId]);

  // Compute metrics
  const metrics = useMemo(() => {
    const stats = { totalContracts: amcs.length, totalValue: 0, scheduledVisits: 0, completedVisits: 0 };
    amcs.forEach(a => {
      stats.totalValue += parseFloat(a.contract_value) || 0;
      if (Array.isArray(a.visits)) {
        a.visits.forEach(v => {
          if (v.status === 'scheduled') stats.scheduledVisits++;
          else if (v.status === 'completed') stats.completedVisits++;
        });
      }
    });
    return stats;
  }, [amcs]);

  const handleOpenCreateContract = () => {
    setContractForm({
      contractNumber: `AMC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      contractValue: 25000,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
      coveredScope: 'Annual maintenance and periodic cleaning of interior wall finishes, realignment of modular kitchen cabinets, and hardware greasing.',
      visitFrequency: 'quarterly',
      coveredProducts: '',
      exclusions: 'Consumables like bulbs, deep cleaning of upholstery not included.',
      paymentSchedule: '100% advance on signing.',
      autoRenewalAlertDays: 90,
      generateVisits: true
    });
    setContractModalOpen(true);
  };

  const handleCreateContract = async (e) => {
    e.preventDefault();
    try {
      await createAmc(projectId, {
        contractNumber: contractForm.contractNumber,
        contractValue: parseFloat(contractForm.contractValue) || 0,
        startDate: contractForm.startDate,
        endDate: contractForm.endDate,
        coveredScope: contractForm.coveredScope || null,
        visitFrequency: contractForm.visitFrequency,
        coveredProducts: contractForm.coveredProducts.split(',').map(s => s.trim()).filter(Boolean),
        exclusions: contractForm.exclusions || null,
        paymentSchedule: contractForm.paymentSchedule || null,
        autoRenewalAlertDays: parseInt(contractForm.autoRenewalAlertDays) || 90,
        generateVisits: contractForm.generateVisits
      });

      toast.success('AMC Contract created successfully.');
      setContractModalOpen(false);
      fetchAmcs();
    } catch (err) {
      console.error(err);
      toast.error('Failed to create AMC contract.');
    }
  };

  const handleDeleteContract = async (id, e) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this AMC contract? All visits will be deleted too.')) {
      try {
        await deleteAmc(projectId, id);
        toast.success('AMC contract deleted successfully.');
        if (expandedAmcId === id) setExpandedAmcId(null);
        fetchAmcs();
      } catch (err) {
        toast.error('Failed to delete AMC.');
      }
    }
  };

  const handleOpenAddVisit = (amcId) => {
    setActiveAmcId(amcId);
    setVisitForm({
      scheduledDate: new Date().toISOString().split('T')[0],
      technicianId: staffList[0]?.id || '',
      remarks: ''
    });
    setVisitModalOpen(true);
  };

  const handleAddVisit = async (e) => {
    e.preventDefault();
    try {
      await createAmcVisit(projectId, activeAmcId, {
        scheduledDate: visitForm.scheduledDate,
        technicianId: visitForm.technicianId || null,
        remarks: visitForm.remarks || null
      });

      toast.success('Visit scheduled successfully.');
      setVisitModalOpen(false);
      fetchAmcs();
    } catch (err) {
      toast.error('Failed to schedule visit.');
    }
  };

  const handleOpenCompleteVisit = (amcId, visit) => {
    setActiveAmcId(amcId);
    setActiveVisitId(visit.id);
    setCompleteVisitForm({
      completedDate: new Date().toISOString().split('T')[0],
      technicianId: visit.technician_id || staffList[0]?.id || '',
      remarks: visit.remarks || ''
    });
    setCompleteVisitModalOpen(true);
  };

  const handleCompleteVisit = async (e) => {
    e.preventDefault();
    try {
      await updateAmcVisit(projectId, activeAmcId, activeVisitId, {
        status: 'completed',
        completedDate: completeVisitForm.completedDate,
        technicianId: completeVisitForm.technicianId || null,
        remarks: completeVisitForm.remarks || null
      });

      toast.success('Visit marked as completed.');
      setCompleteVisitModalOpen(false);
      fetchAmcs();
    } catch (err) {
      toast.error('Failed to complete visit.');
    }
  };

  const handleDeleteVisit = async (amcId, visitId) => {
    if (window.confirm('Are you sure you want to delete this scheduled visit?')) {
      try {
        await deleteAmcVisit(projectId, amcId, visitId);
        toast.success('Visit schedule deleted.');
        fetchAmcs();
      } catch (err) {
        toast.error('Failed to delete visit.');
      }
    }
  };

  const toggleExpand = (amcId) => {
    setExpandedAmcId(expandedAmcId === amcId ? null : amcId);
  };

  if (loading && amcs.length === 0) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading maintenance contracts...</div>;
  }

  return (
    <div className={styles.container}>
      {/* Metrics Header */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Active Contracts</span>
          <span className={styles.metricValue}>{metrics.totalContracts}</span>
        </div>
        <div className={styles.metricCard} style={{ borderLeft: '4px solid var(--color-success)' }}>
          <span className={styles.metricLabel}>Total Contract Value</span>
          <span className={styles.metricValue} style={{ color: 'var(--color-success)' }}>
            ₹{metrics.totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className={styles.metricCard} style={{ borderLeft: '4px solid var(--color-accent)' }}>
          <span className={styles.metricLabel}>Scheduled Visits</span>
          <span className={styles.metricValue} style={{ color: 'var(--color-accent)' }}>{metrics.scheduledVisits}</span>
        </div>
        <div className={styles.metricCard} style={{ borderLeft: '4px solid var(--color-info, #0ea5e9)' }}>
          <span className={styles.metricLabel}>Completed Visits</span>
          <span className={styles.metricValue} style={{ color: 'var(--color-info, #0ea5e9)' }}>{metrics.completedVisits}</span>
        </div>
      </div>

      {/* Actions */}
      <div className={styles.actionBar}>
        <Button onClick={handleOpenCreateContract}>+ Create AMC Contract</Button>
      </div>

      {/* Contract Accordion list */}
      {amcs.length > 0 ? (
        <div className={styles.amcList}>
          {amcs.map(a => {
            const isExpanded = expandedAmcId === a.id;
            const amcStatus = a.status;

            let badgeClass = styles.badgeActive;
            if (amcStatus === 'expired') badgeClass = styles.badgeExpired;
            else if (amcStatus === 'cancelled') badgeClass = styles.badgeCancelled;

            return (
              <div key={a.id} className={styles.amcCard}>
                {/* Accordion header */}
                <div className={styles.amcHeader} onClick={() => toggleExpand(a.id)}>
                  <div className={styles.amcTitleArea}>
                    <span style={{ fontSize: 16 }}>{isExpanded ? '▼' : '▶'}</span>
                    <span className={styles.contractNumber}>#{a.contract_number}</span>
                    <span className={styles.contractValue}>
                      ₹{parseFloat(a.contract_value).toLocaleString('en-IN')}
                    </span>
                    <span className={`${styles.badge} ${badgeClass}`}>{amcStatus}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span className={styles.amcDates}>
                      📅 {new Date(a.start_date).toLocaleDateString('en-IN')} → {new Date(a.end_date).toLocaleDateString('en-IN')} 
                      {a.renewal_date && ` (Renewal: ${new Date(a.renewal_date).toLocaleDateString('en-IN')})`}
                    </span>
                    <Button variant="outline" size="sm" style={{ color: 'var(--color-danger)' }} onClick={(e) => handleDeleteContract(a.id, e)}>
                      Delete
                    </Button>
                  </div>
                </div>

                {/* Accordion body */}
                {isExpanded && (
                  <div className={styles.amcBody}>
                    <div className={styles.scopeSection}>
                      <span className={styles.sectionTitle}>Covered Scope & Products</span>
                      <p className={styles.scopeText}>{a.covered_scope || 'No specific maintenance scope documented.'}</p>
                      {a.covered_products && (
                        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                          <strong>Products:</strong> {Array.isArray(a.covered_products) ? a.covered_products.join(', ') : a.covered_products}
                        </div>
                      )}
                      {a.exclusions && (
                        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--color-danger)' }}>
                          <strong>Exclusions:</strong> {a.exclusions}
                        </div>
                      )}
                      {a.payment_schedule && (
                        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                          <strong>Payment Terms:</strong> {a.payment_schedule}
                        </div>
                      )}
                    </div>

                    <div className={styles.visitsSection}>
                      <div className={styles.visitsHeader}>
                        <span className={styles.sectionTitle}>Maintenance Visit Schedule</span>
                        <Button size="sm" onClick={() => handleOpenAddVisit(a.id)}>+ Add Visit</Button>
                      </div>

                      {a.visits && a.visits.length > 0 ? (
                        <div className={styles.visitsGrid}>
                          {a.visits.map((v, i) => {
                            const isScheduled = v.status === 'scheduled';
                            const isCompleted = v.status === 'completed';
                            const tech = staffList.find(s => s.id === v.technician_id);

                            let vBadge = styles.badgeScheduled;
                            if (isCompleted) vBadge = styles.badgeCompleted;
                            else if (v.status === 'missed') vBadge = styles.badgeMissed;
                            else if (v.status === 'cancelled') vBadge = styles.badgeCancelled;

                            return (
                              <div key={v.id || i} className={styles.visitCard}>
                                <div className={styles.visitHeader}>
                                  <span className={styles.visitDate}>
                                    Scheduled: {new Date(v.scheduled_date).toLocaleDateString('en-IN')}
                                  </span>
                                  <span className={`${styles.badge} ${vBadge}`}>{v.status}</span>
                                </div>
                                
                                {tech && (
                                  <div style={{ fontSize: 12, color: 'var(--color-text)' }}>
                                    👨‍🔧 Technician: <strong>{tech.name}</strong>
                                  </div>
                                )}

                                {isCompleted && v.completed_date && (
                                  <div style={{ fontSize: 12, color: 'var(--color-success)' }}>
                                    ✓ Completed on: {new Date(v.completed_date).toLocaleDateString('en-IN')}
                                  </div>
                                )}

                                {v.remarks && (
                                  <div className={styles.visitRemarks}>
                                    {v.remarks}
                                  </div>
                                )}

                                <div className={styles.visitActions}>
                                  {isScheduled && (
                                    <Button variant="outline" size="sm" onClick={() => handleOpenCompleteVisit(a.id, v)}>
                                      Mark Completed
                                    </Button>
                                  )}
                                  <Button variant="outline" size="sm" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={() => handleDeleteVisit(a.id, v.id)}>
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ padding: 16, border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)', textAlign: 'center', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                          No maintenance visits scheduled. Click "+ Add Visit" or generate during contract setup.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🛠️</div>
          <h3>No AMC contracts tracked</h3>
          <p>Create post-warranty Annual Maintenance Contracts to track value, scope, and plan scheduled maintenance visits.</p>
          <Button onClick={handleOpenCreateContract} style={{ marginTop: 12 }}>Create First AMC Contract</Button>
        </div>
      )}

      {/* Create AMC Modal */}
      {contractModalOpen && (
        <Modal
          isOpen={contractModalOpen}
          onClose={() => setContractModalOpen(false)}
          title="Create AMC Contract"
        >
          <form onSubmit={handleCreateContract} className={styles.modalForm}>
            <div className={styles.formGrid}>
              <FormField label="Contract Number *" required>
                <Input
                  value={contractForm.contractNumber}
                  onChange={(e) => setContractForm(prev => ({ ...prev, contractNumber: e.target.value }))}
                  required
                />
              </FormField>
              
              <FormField label="Contract Value (INR) *">
                <Input
                  type="number"
                  value={contractForm.contractValue}
                  onChange={(e) => setContractForm(prev => ({ ...prev, contractValue: parseFloat(e.target.value) || 0 }))}
                  required
                />
              </FormField>
            </div>

            <div className={styles.formGrid}>
              <FormField label="Start Date *" required>
                <Input
                  type="date"
                  value={contractForm.startDate}
                  onChange={(e) => setContractForm(prev => ({ ...prev, startDate: e.target.value }))}
                  required
                />
              </FormField>
              
              <FormField label="End Date *" required>
                <Input
                  type="date"
                  value={contractForm.endDate}
                  onChange={(e) => setContractForm(prev => ({ ...prev, endDate: e.target.value }))}
                  required
                />
              </FormField>
            </div>

            <div className={styles.formGrid}>
              <FormField label="Alert Lead Time (Days before expiry)">
                <Input
                  type="number"
                  value={contractForm.autoRenewalAlertDays}
                  onChange={(e) => setContractForm(prev => ({ ...prev, autoRenewalAlertDays: parseInt(e.target.value) || 90 }))}
                  min="0"
                />
              </FormField>

              <FormField label="Visit Frequency">
                <select
                  value={contractForm.visitFrequency}
                  onChange={(e) => setContractForm(prev => ({ ...prev, visitFrequency: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="bi-annual">Bi-Annual</option>
                  <option value="annual">Annual</option>
                </select>
              </FormField>
            </div>

            <div className={styles.formGrid}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 32 }}>
                <input
                  type="checkbox"
                  id="genVisits"
                  checked={contractForm.generateVisits}
                  onChange={(e) => setContractForm(prev => ({ ...prev, generateVisits: e.target.checked }))}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                <label htmlFor="genVisits" style={{ fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  Auto-schedule visits
                </label>
              </div>
            </div>

            <div className={styles.formGrid}>
              <FormField label="Covered Products (Comma separated)">
                <Input
                  value={contractForm.coveredProducts}
                  onChange={(e) => setContractForm(prev => ({ ...prev, coveredProducts: e.target.value }))}
                  placeholder="AC Units, Sofas, Mattresses..."
                />
              </FormField>

              <FormField label="Payment Schedule">
                <Input
                  value={contractForm.paymentSchedule}
                  onChange={(e) => setContractForm(prev => ({ ...prev, paymentSchedule: e.target.value }))}
                  placeholder="50% Advance, 50% End of year"
                />
              </FormField>
            </div>

            <FormField label="Covered Scope Description">
              <Textarea
                value={contractForm.coveredScope}
                onChange={(e) => setContractForm(prev => ({ ...prev, coveredScope: e.target.value }))}
                placeholder="Detail what plumbing, cabinet alignments, hardware checks or electrical maintenance services are included in this AMC fee..."
                rows={2}
              />
            </FormField>

            <FormField label="Exclusions (What is not covered)">
              <Textarea
                value={contractForm.exclusions}
                onChange={(e) => setContractForm(prev => ({ ...prev, exclusions: e.target.value }))}
                placeholder="Consumables, structural damages, third-party parts..."
                rows={2}
              />
            </FormField>

            <div className={styles.modalFooter}>
              <Button type="button" variant="outline" onClick={() => setContractModalOpen(false)}>Cancel</Button>
              <Button type="submit">Create Contract</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Visit Modal */}
      {visitModalOpen && (
        <Modal
          isOpen={visitModalOpen}
          onClose={() => setVisitModalOpen(false)}
          title="Schedule Maintenance Visit"
        >
          <form onSubmit={handleAddVisit} className={styles.modalForm}>
            <div className={styles.formGrid}>
              <FormField label="Scheduled Date *" required>
                <Input
                  type="date"
                  value={visitForm.scheduledDate}
                  onChange={(e) => setVisitForm(prev => ({ ...prev, scheduledDate: e.target.value }))}
                  required
                />
              </FormField>

              <FormField label="Assign Technician">
                <select
                  value={visitForm.technicianId}
                  onChange={(e) => setVisitForm(prev => ({ ...prev, technicianId: e.target.value }))}
                  className={styles.techSelect}
                >
                  <option value="">-- Unassigned --</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                  ))}
                </select>
              </FormField>
            </div>

            <FormField label="Visit Scheduling Remarks">
              <Textarea
                value={visitForm.remarks}
                onChange={(e) => setVisitForm(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="Special tools required, parts to carry, or instructions from customer..."
                rows={3}
              />
            </FormField>

            <div className={styles.modalFooter}>
              <Button type="button" variant="outline" onClick={() => setVisitModalOpen(false)}>Cancel</Button>
              <Button type="submit">Schedule Visit</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Complete Visit Modal */}
      {completeVisitModalOpen && (
        <Modal
          isOpen={completeVisitModalOpen}
          onClose={() => setCompleteVisitModalOpen(false)}
          title="Mark Maintenance Visit Completed"
        >
          <form onSubmit={handleCompleteVisit} className={styles.modalForm}>
            <div className={styles.formGrid}>
              <FormField label="Actual Completed Date *" required>
                <Input
                  type="date"
                  value={completeVisitForm.completedDate}
                  onChange={(e) => setCompleteVisitForm(prev => ({ ...prev, completedDate: e.target.value }))}
                  required
                />
              </FormField>

              <FormField label="Technician who Performed Service">
                <select
                  value={completeVisitForm.technicianId}
                  onChange={(e) => setCompleteVisitForm(prev => ({ ...prev, technicianId: e.target.value }))}
                  className={styles.techSelect}
                >
                  <option value="">-- None --</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </FormField>
            </div>

            <FormField label="Service Report & Remarks">
              <Textarea
                value={completeVisitForm.remarks}
                onChange={(e) => setCompleteVisitForm(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="What fixes were made? Any details on replacements, general feedback on condition, or next checklist steps..."
                rows={4}
                required
              />
            </FormField>

            <div className={styles.modalFooter}>
              <Button type="button" variant="outline" onClick={() => setCompleteVisitModalOpen(false)}>Cancel</Button>
              <Button type="submit">Complete Visit</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
