/* eslint-disable no-unused-vars, react-hooks/immutability, react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { Button, Modal, Input, Textarea, EmptyState, Spinner } from '../ui';
import { useToast } from '../../store/toastContext';
import styles from './VendorPaymentsTab.module.css';
import {
  getVendorPayments,
  getVendorPayment,
  createVendorPayment,
  updateVendorPayment,
  deleteVendorPayment,
  getProject,
  getPurchaseOrders,
  getMaterialDeliveries
} from '../../api/projects';

export default function VendorPaymentsTab({ projectId }) {
  const toast = useToast();

  // Data States
  const [milestones, setMilestones] = useState([]);
  const [project, setProject] = useState(null);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [deliveries, setDeliveries] = useState([]);

  // Loading States
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Modal States
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [activeMilestone, setActiveMilestone] = useState(null);

  // Form States
  const [scheduleForm, setScheduleForm] = useState({
    vendorId: '',
    purchaseOrderId: '',
    materialDeliveryId: '',
    name: '',
    amount: '',
    percentage: '',
    dueDate: '',
    notes: ''
  });

  const [logForm, setLogForm] = useState({
    paidAmount: '',
    paidAt: '',
    invoiceReference: '',
    paymentMethod: 'Bank Transfer',
    notes: ''
  });

  useEffect(() => {
    if (projectId) {
      fetchData();
    }
  }, [projectId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [paymentsRes, projectRes, posRes, delRes] = await Promise.all([
        getVendorPayments(projectId),
        getProject(projectId),
        getPurchaseOrders(projectId),
        getMaterialDeliveries(projectId)
      ]);

      if (paymentsRes.data?.success) {
        setMilestones(paymentsRes.data.data || []);
      }

      const projData = projectRes.data?.data || projectRes.data;
      if (projData) {
        setProject(projData);
      }

      if (posRes.data?.success) {
        setPurchaseOrders(posRes.data.data || []);
      }

      if (delRes.data?.success) {
        setDeliveries(delRes.data.data || []);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load vendor payments data.');
    } finally {
      setLoading(false);
    }
  };

  // Open Scheduler Modal
  const openScheduleModal = () => {
    setScheduleForm({
      vendorId: '',
      purchaseOrderId: '',
      materialDeliveryId: '',
      name: '',
      amount: '',
      percentage: '',
      dueDate: new Date().toISOString().slice(0, 10),
      notes: ''
    });
    setIsScheduleOpen(true);
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    if (!scheduleForm.vendorId) return toast.error('Please select a vendor.');
    if (!scheduleForm.name.trim()) return toast.error('Milestone name is required.');
    
    if (scheduleForm.percentage) {
      const pct = Number(scheduleForm.percentage);
      if (isNaN(pct) || pct <= 0 || pct > 100) {
        return toast.error('Percentage must be between 1 and 100.');
      }
    } else if (!scheduleForm.amount || Number(scheduleForm.amount) <= 0) {
      return toast.error('Please enter a valid amount.');
    }

    setActionLoading(true);
    try {
      const payload = {
        vendorId: scheduleForm.vendorId,
        purchaseOrderId: scheduleForm.purchaseOrderId || null,
        materialDeliveryId: scheduleForm.materialDeliveryId || null,
        name: scheduleForm.name.trim(),
        amount: scheduleForm.amount ? Number(scheduleForm.amount) : null,
        percentage: scheduleForm.percentage ? Number(scheduleForm.percentage) : null,
        dueDate: scheduleForm.dueDate || null,
        notes: scheduleForm.notes || null
      };

      const res = await createVendorPayment(projectId, payload);
      if (res.data?.success) {
        toast.success('Vendor payment milestone scheduled successfully.');
        setIsScheduleOpen(false);
        fetchData(); // Reload to get fully joined vendor/PO/DN names
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to schedule vendor payment.');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Log Payment Modal
  const openLogModal = (milestone) => {
    setActiveMilestone(milestone);
    const outstanding = Number(milestone.amount) - Number(milestone.paid_amount);
    setLogForm({
      paidAmount: outstanding.toString(),
      paidAt: new Date().toISOString().slice(0, 10),
      invoiceReference: milestone.invoice_reference || '',
      paymentMethod: milestone.payment_method || 'Bank Transfer',
      notes: ''
    });
    setIsLogOpen(true);
  };

  const handleLogSubmit = async (e) => {
    e.preventDefault();
    if (!logForm.paidAmount || Number(logForm.paidAmount) <= 0) {
      return toast.error('Please enter a valid payout amount.');
    }

    setActionLoading(true);
    try {
      const newPaidTotal = Number(activeMilestone.paid_amount) + Number(logForm.paidAmount);
      
      const payload = {
        paidAmount: newPaidTotal,
        paidAt: logForm.paidAt || new Date().toISOString().slice(0, 10),
        invoiceReference: logForm.invoiceReference.trim() || null,
        paymentMethod: logForm.paymentMethod,
        notes: logForm.notes.trim() || null
      };

      const res = await updateVendorPayment(projectId, activeMilestone.id, payload);
      if (res.data?.success) {
        toast.success('Vendor payout recorded successfully.');
        setIsLogOpen(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to record payment.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteMilestone = async (id) => {
    if (!window.confirm('Are you sure you want to remove this vendor payment obligation?')) return;

    setActionLoading(true);
    try {
      const res = await deleteVendorPayment(projectId, id);
      if (res.data?.success) {
        setMilestones(milestones.filter(m => m.id !== id));
        toast.success('Vendor payment obligation deleted.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete milestone.');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badgeClass = `${styles.badge} ${styles[`badge-${status.replace(' ', '_')}`]}`;
    return <span className={badgeClass}>{status}</span>;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // KPI Calculations
  const totalScheduled = milestones.reduce((sum, m) => sum + Number(m.amount), 0);
  const totalPaid = milestones.reduce((sum, m) => sum + Number(m.paid_amount), 0);
  const outstandingDues = totalScheduled - totalPaid;

  const projectVendors = project?.vendors || [];
  
  // Dynamic computed amount helper in schedule form
  const selectedPo = purchaseOrders.find(po => po.id === scheduleForm.purchaseOrderId);
  const computedAmount = selectedPo && scheduleForm.percentage
    ? parseFloat(selectedPo.total_amount) * (Number(scheduleForm.percentage) / 100.0)
    : null;

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <Spinner size="lg" />
        <p>Loading Vendor Payments module...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2>Vendor Payments & Payables</h2>
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
            Schedule and track outgoing cash flows to material suppliers and sub-contractors.
          </span>
        </div>
        <Button variant="primary" onClick={openScheduleModal}>
          + Schedule Payment
        </Button>
      </div>

      {/* KPI Cards */}
      <div className={styles.summaryGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Scheduled Dues</span>
          <span className={styles.kpiValue}>{formatCurrency(totalScheduled)}</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Outflows Paid</span>
          <span className={`${styles.kpiValue} ${styles.paidValue}`}>{formatCurrency(totalPaid)}</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Amount Outstanding</span>
          <span className={`${styles.kpiValue} ${styles.outstandingValue}`}>{formatCurrency(outstandingDues)}</span>
        </div>
      </div>

      {milestones.length === 0 ? (
        <EmptyState
          title="No Vendor Payments Scheduled"
          description="Establish vendor payment schedules tied to procurement milestones or deliveries to keep cash outflows structured."
          actionLabel="Schedule Payment"
          onAction={openScheduleModal}
        />
      ) : (
        <div className={styles.tableSection}>
          <div className={styles.tableWrapper}>
            <table className={styles.milestoneTable}>
              <thead>
                <tr>
                  <th>Milestone / Objective</th>
                  <th>Vendor Partner</th>
                  <th>Linked Doc</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th className={styles.textRight}>Scheduled Amount</th>
                  <th className={styles.textRight}>Paid Amount</th>
                  <th className={styles.textRight}>Outstanding</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {milestones.map(m => {
                  const outstanding = Number(m.amount) - Number(m.paid_amount);
                  return (
                    <tr key={m.id}>
                      <td>
                        <div style={{ fontWeight: '600' }}>{m.name}</div>
                        {m.invoice_reference && (
                          <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                            Invoice Ref: {m.invoice_reference}
                          </div>
                        )}
                      </td>
                      <td>{m.vendor_name || 'General Vendor'}</td>
                      <td>
                        {m.po_number && (
                          <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-primary)' }}>
                            PO: {m.po_number}
                          </span>
                        )}
                        {m.delivery_number && (
                          <span style={{ display: 'block', fontSize: '10px', color: 'var(--color-text-muted)' }}>
                            Delivery: {m.delivery_number}
                          </span>
                        )}
                        {!m.po_number && !m.delivery_number && <span>—</span>}
                      </td>
                      <td>
                        <span style={{ color: m.status === 'overdue' ? 'var(--color-danger)' : 'inherit' }}>
                          {formatDate(m.due_date)}
                        </span>
                      </td>
                      <td>{getStatusBadge(m.status)}</td>
                      <td className={styles.textRight}>{formatCurrency(m.amount)}</td>
                      <td className={styles.textRight}>{formatCurrency(m.paid_amount)}</td>
                      <td className={styles.textRight} style={{ fontWeight: '600' }}>
                        {formatCurrency(outstanding)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {m.status !== 'paid' && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => openLogModal(m)}
                              disabled={actionLoading}
                            >
                              Log Payment
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            style={{ color: 'var(--color-danger)' }}
                            onClick={() => handleDeleteMilestone(m.id)}
                            disabled={actionLoading}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Schedule Payment Modal */}
      <Modal
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        title="Schedule Outgoing Payment"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsScheduleOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleScheduleSubmit} disabled={actionLoading}>
              Schedule Payment
            </Button>
          </>
        }
      >
        <form onSubmit={handleScheduleSubmit} className={styles.modalForm}>
          <div className={styles.formGrid}>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Vendor Recipient
              </label>
              <select
                className={styles.selectField}
                value={scheduleForm.vendorId}
                onChange={e => setScheduleForm({ ...scheduleForm, vendorId: e.target.value })}
                required
              >
                <option value="">Select Vendor</option>
                {projectVendors.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.vendor_name} ({v.scope_of_work || 'General'})
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Payment Objective Name"
              placeholder="e.g. 50% Advance on joinery"
              value={scheduleForm.name}
              onChange={e => setScheduleForm({ ...scheduleForm, name: e.target.value })}
              required
            />

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Link to Purchase Order (Optional)
              </label>
              <select
                className={styles.selectField}
                value={scheduleForm.purchaseOrderId}
                onChange={e => setScheduleForm({ ...scheduleForm, purchaseOrderId: e.target.value })}
              >
                <option value="">No PO Link</option>
                {purchaseOrders.map(po => (
                  <option key={po.id} value={po.id}>
                    {po.po_number} (₹{po.total_amount})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Link to Goods Receipt Note (Optional)
              </label>
              <select
                className={styles.selectField}
                value={scheduleForm.materialDeliveryId}
                onChange={e => setScheduleForm({ ...scheduleForm, materialDeliveryId: e.target.value })}
              >
                <option value="">No Goods Receipt Link</option>
                {deliveries.map(del => (
                  <option key={del.id} value={del.id}>
                    {del.delivery_number} ({formatDate(del.actual_receipt_date)})
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Percentage (%) of Linked PO (Optional)"
              type="number"
              min="1"
              max="100"
              placeholder="e.g. 50"
              value={scheduleForm.percentage}
              onChange={e => setScheduleForm({ ...scheduleForm, percentage: e.target.value, amount: '' })}
              disabled={!scheduleForm.purchaseOrderId}
            />

            <Input
              label="Absolute Payment Amount (₹)"
              type="number"
              placeholder="e.g. 25000"
              value={scheduleForm.amount}
              onChange={e => setScheduleForm({ ...scheduleForm, amount: e.target.value, percentage: '' })}
              disabled={!!scheduleForm.percentage}
              required={!scheduleForm.percentage}
            />

            {computedAmount !== null && (
              <div className={`${styles.fullWidth} text-xs text-blue-600 font-semibold`}>
                Computed Milestone Amount: {formatCurrency(computedAmount)} ({scheduleForm.percentage}% of PO {selectedPo?.po_number})
              </div>
            )}

            <Input
              label="Payment Due Date"
              type="date"
              value={scheduleForm.dueDate}
              onChange={e => setScheduleForm({ ...scheduleForm, dueDate: e.target.value })}
              required
            />

            <div className={styles.fullWidth}>
              <Textarea
                label="Scheduling Notes"
                placeholder="Payment terms notes, account transfer details..."
                value={scheduleForm.notes}
                onChange={e => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Log Payment Outflow Modal */}
      {activeMilestone && (
        <Modal
          isOpen={isLogOpen}
          onClose={() => setIsLogOpen(false)}
          title={`Log Vendor Payment for: ${activeMilestone.name}`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setIsLogOpen(false)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleLogSubmit} disabled={actionLoading}>
                Log Payout
              </Button>
            </>
          }
        >
          <form onSubmit={handleLogSubmit} className={styles.modalForm}>
            <div className={styles.formGrid}>
              <div className={styles.fullWidth}>
                <div style={{ fontSize: '13px', background: 'var(--color-bg-subtle, #f9fafb)', padding: '12px', borderRadius: '4px', marginBottom: '8px' }}>
                  Milestone Amount: <strong>{formatCurrency(activeMilestone.amount)}</strong><br />
                  Already Paid: <strong>{formatCurrency(activeMilestone.paid_amount)}</strong>
                </div>
              </div>

              <Input
                label="Payment Amount Logged (₹)"
                type="number"
                value={logForm.paidAmount}
                onChange={e => setLogForm({ ...logForm, paidAmount: e.target.value })}
                required
              />

              <Input
                label="Date of Payment Transaction"
                type="date"
                value={logForm.paidAt}
                onChange={e => setLogForm({ ...logForm, paidAt: e.target.value })}
                required
              />

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Payment Transfer Method
                </label>
                <select
                  className={styles.selectField}
                  value={logForm.paymentMethod}
                  onChange={e => setLogForm({ ...logForm, paymentMethod: e.target.value })}
                  required
                >
                  <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="UPI">UPI / GPay / PhonePe</option>
                  <option value="Cheque">Bank Cheque</option>
                  <option value="Cash">Cash Handout</option>
                </select>
              </div>

              <Input
                label="Invoice / Transaction Reference"
                placeholder="e.g. INV-10023 or TXN-82012019"
                value={logForm.invoiceReference}
                onChange={e => setLogForm({ ...logForm, invoiceReference: e.target.value })}
              />

              <div className={styles.fullWidth}>
                <Textarea
                  label="Transaction Remarks"
                  placeholder="Logs or remarks regarding bank approvals, transfer delays, or partial payments..."
                  value={logForm.notes}
                  onChange={e => setLogForm({ ...logForm, notes: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
