import React, { useState, useEffect } from 'react';
import { Badge, Button, Modal, Input, Select } from '../../components/ui';
import styles from './PaymentsTab.module.css';
import { getPaymentMilestones, updatePaymentMilestone } from '../../api/paymentMilestones';
import { getPaymentEscalations } from '../../api/projects';
import { getInvoiceDraft, createInvoice } from '../../api/invoices';
import { getCreditNotes, getRefunds, createCreditNote, createRefund } from '../../api/financials';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';
import PaymentEscalationModal from '../../components/projects/PaymentEscalationModal';

function numberToWords(num) {
  if (num === 0) return 'ZERO RUPEES ONLY';
  const a = ['','ONE ','TWO ','THREE ','FOUR ', 'FIVE ','SIX ','SEVEN ','EIGHT ','NINE ','TEN ','ELEVEN ','TWELVE ','THIRTEEN ','FOURTEEN ','FIFTEEN ','SIXTEEN ','SEVENTEEN ','EIGHTEEN ','NINETEEN '];
  const b = ['', '', 'TWENTY','THIRTY','FORTY','FIFTY', 'SIXTY','SEVENTY','EIGHTY','NINETY'];
  
  if ((num = num.toString()).length > 9) return 'OVERFLOW';
  let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return; 
  let str = '';
  str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'CRORE ' : '';
  str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'LAKH ' : '';
  str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'THOUSAND ' : '';
  str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'HUNDRED ' : '';
  str += (n[5] != 0) ? ((str != '') ? 'AND ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + 'RUPEES ONLY' : 'RUPEES ONLY';
  return str;
}

export default function PaymentsTab({ projectId, project }) {
  const toast = useToast();
  const [payments, setPayments] = useState([]);
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('breakdown'); // breakdown, logs, milestones, credits

  // Payment Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paidDate, setPaidDate] = useState('');
  const [tdsRate, setTdsRate] = useState(0);
  const [tdsAmount, setTdsAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('Bank Transfer');
  const [collectedBy, setCollectedBy] = useState('');

  // Invoice States
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    companyName: '', companyAddress: '', companyGstin: '',
    billingName: '', billingAddress: '', billingGstin: '',
    gstType: 'cgst_sgst', gstRate: 18.00, hsnCode: '', taxTreatment: 'works_contract',
    paymentTerms: '', invoiceDate: '', dueDate: '', amount: 0
  });

  // Credit Note & Refund States
  const [creditNotes, setCreditNotes] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [creditNoteModalOpen, setCreditNoteModalOpen] = useState(false);
  const [creditNoteSubmitting, setCreditNoteSubmitting] = useState(false);
  const [creditNoteForm, setCreditNoteForm] = useState({ subtotal: '', gstType: 'cgst_sgst', gstRate: 18.00, reason: '', notes: '' });

  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundForm, setRefundForm] = useState({ amount: '', paymentMethod: 'Bank Transfer', referenceNumber: '', reason: '', notes: '' });

  const [escalationModalOpen, setEscalationModalOpen] = useState(false);
  const [escalationMilestone, setEscalationMilestone] = useState(null);
  const [escalationDaysOverdue, setEscalationDaysOverdue] = useState(0);

  const loadEscalations = async () => {
    try {
      const res = await getPaymentEscalations(projectId);
      setEscalations(res || []);
    } catch (e) {
      console.error('Failed to load escalations:', e);
    }
  };

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    
    getPaymentMilestones(projectId)
      .then(res => {
        const _r = res.data?.data || res.data; const raw = Array.isArray(_r) ? _r : [];
        setPayments(raw.map(p => ({
          id: p.id,
          milestone: p.title || p.milestone || p.name,
          phase: p.phase_name || p.phase || '—',
          amountValue: Number(p.amount || 0),
          dueDate: p.due_date ? p.due_date.split('T')[0] : null,
          status: p.status || 'scheduled',
          invoiceReference: p.invoice_reference || null,
          tdsRate: Number(p.tds_rate || 0),
          tdsAmount: Number(p.tds_amount || 0),
          paymentMode: p.payment_mode || null,
          collectedByName: p.collected_by_name || null,
          collectedByRole: p.collected_by_role || null,
          paidAt: p.paid_at || null
        })));
      })
      .catch(() => setPayments([]))
      .finally(() => setLoading(false));

    Promise.all([
      getCreditNotes(projectId),
      getRefunds(projectId)
    ]).then(([cnRes, refRes]) => {
      setCreditNotes(cnRes.data?.data || cnRes.data || []);
      setRefunds(refRes.data?.data || refRes.data || []);
    }).catch(err => {
      console.error('Failed to load credit notes or refunds:', err);
    });

    loadEscalations();
  }, [projectId]);

  // Derived Values
  const totalBudget = project?.contract_value || 5953277;
  const totalArea = project?.measurements?.reduce((sum, r) => sum + (Number(r.area) || 0), 0) || 2040;
  const avgRate = totalArea > 0 ? Math.round(totalBudget / totalArea) : 0;
  
  const today = new Date().toISOString().split('T')[0];
  const processedPayments = payments.map(p => {
    let daysOverdue = 0;
    if (p.status !== 'paid' && p.dueDate < today) {
      const diffTime = Math.abs(new Date(today) - new Date(p.dueDate));
      daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const activeEscalation = escalations.find(e => e.payment_milestone_id === p.id && e.status === 'active');
      return { ...p, displayStatus: 'overdue', isOverdue: true, daysOverdue, activeEscalation };
    }
    return { ...p, displayStatus: p.status, isOverdue: false, daysOverdue: 0 };
  });

  const handleMarkPaidClick = (p) => {
    setSelectedPayment(p);
    setTdsRate(0);
    setTdsAmount(0);
    setPaidDate(new Date().toISOString().split('T')[0]);
    setPaymentMode('Bank Transfer');
    setCollectedBy('');
    setModalOpen(true);
  };

  const handleConfirmPaid = async () => {
    if (!collectedBy) {
      toast.error('Please specify who collected the payment');
      return;
    }
    try {
      const netPaid = Number((selectedPayment.amountValue - tdsAmount).toFixed(2));
      const [colName, colRole] = collectedBy.split('|');
      
      await updatePaymentMilestone(selectedPayment.id, { 
        status: 'paid', 
        paid_at: paidDate,
        paid_amount: netPaid,
        tds_rate: tdsRate,
        tds_amount: tdsAmount,
        payment_mode: paymentMode,
        collected_by_name: colName,
        collected_by_role: colRole
      });
      
      setPayments(prev => prev.map(p => p.id === selectedPayment.id ? { 
        ...p, 
        status: 'paid',
        tdsRate,
        tdsAmount,
        paymentMode,
        collectedByName: colName,
        collectedByRole: colRole,
        paidAt: paidDate
      } : p));
      toast.success('Payment marked as paid');
    } catch {
      toast.error('Failed to update payment');
    }
    setModalOpen(false);
  };

  const handleConfirmRefund = async () => {
    if (!refundForm.amount || !refundForm.reason) {
      toast.error('Amount and Reason are required');
      return;
    }
    setRefundSubmitting(true);
    try {
      const data = {
        projectId,
        ...refundForm,
        amount: Number(refundForm.amount)
      };
      const res = await createRefund(data);
      const newRef = res.data?.data || res.data;
      setRefunds(prev => [newRef, ...prev]);
      toast.success(`Refund recorded successfully!`);
      setRefundModalOpen(false);
    } catch (err) {
      console.error('[PaymentsTab] Refund error:', err);
      toast.error(err.response?.data?.error?.message || 'Failed to record Refund');
    } finally {
      setRefundSubmitting(false);
    }
  };

  const handleConfirmCreditNote = async () => {
    if (!creditNoteForm.subtotal || !creditNoteForm.reason) {
      toast.error('Amount and Reason are required');
      return;
    }
    setCreditNoteSubmitting(true);
    try {
      const data = {
        projectId,
        ...creditNoteForm,
        subtotal: Number(creditNoteForm.subtotal),
        gstRate: Number(creditNoteForm.gstRate)
      };
      const res = await createCreditNote(data);
      const newCN = res.data?.data || res.data;
      setCreditNotes(prev => [newCN, ...prev]);
      toast.success(`Credit Note issued successfully!`);
      setCreditNoteModalOpen(false);
    } catch (err) {
      console.error('[PaymentsTab] Credit note error:', err);
      toast.error(err.response?.data?.error?.message || 'Failed to issue Credit Note');
    } finally {
      setCreditNoteSubmitting(false);
    }
  };

  // Mock Cost Breakdown
  const costBreakdown = [
    { label: 'Modular Kitchen (Cabinets, Countertop, Accessories)', value: Math.round(totalBudget * 0.25) },
    { label: 'Wardrobes & Storage (Bedrooms, Living, Foyer)', value: Math.round(totalBudget * 0.28) },
    { label: 'False Ceiling & Lighting', value: Math.round(totalBudget * 0.12) },
    { label: 'Painting & Wallpaper (Premium Finish)', value: Math.round(totalBudget * 0.08) },
    { label: 'Civil & Tiling Work (Bathrooms, Balcony)', value: Math.round(totalBudget * 0.07) },
    { label: 'Electrical & Plumbing Modifications', value: Math.round(totalBudget * 0.05) },
    { label: 'Custom Furniture (Beds, TV Unit, Study)', value: Math.round(totalBudget * 0.10) },
    { label: 'Soft Furnishings & Decor', value: Math.round(totalBudget * 0.03) },
    { label: 'Design & Management Fees', value: totalBudget - Math.round(totalBudget * 0.98) },
  ];

  const paidLogs = payments.filter(p => p.status === 'paid').sort((a, b) => new Date(b.paidAt || 0) - new Date(a.paidAt || 0));

  if (loading) {
    return <div style={{ padding: '32px', color: 'var(--color-text-muted)' }}>Loading payments…</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* Header Section as a standard card */}
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
            Financial Overview
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 0 }}>
          
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Estimated Total Budget
            </div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: '#0284c7' }}>
              ₹{totalBudget.toLocaleString('en-IN')}/-
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 400, marginTop: 2 }}>({numberToWords(totalBudget)})</div>
            </div>
          </div>
          
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Avg. Rate
            </div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text)' }}>
              ₹{avgRate}/sqft
            </div>
          </div>

          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Area
            </div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text)' }}>
              {totalArea} sqft
            </div>
          </div>

        </div>
      </div>

      {/* Sub-Tabs */}
      <div className={styles.subTabsContainer}>
        {['breakdown', 'logs', 'milestones', 'credits'].map(tab => (
          <button
            key={tab}
            className={`${styles.subTab} ${activeSubTab === tab ? styles.subTabActive : ''}`}
            onClick={() => setActiveSubTab(tab)}
          >
            {tab === 'breakdown' ? 'Detailed Cost Breakdown' : 
             tab === 'logs' ? 'Payment History' : 
             tab === 'milestones' ? 'Payment Milestones' : 'Refunds & Credits'}
          </button>
        ))}
      </div>

      {/* Sub-Tab Content */}
      <div className={styles.subTabContent}>
        {activeSubTab === 'breakdown' && (
          <div className={styles.breakdownList}>
            <div className={styles.breakdownHeader}>DETAILED COST BREAKDOWN</div>
            {costBreakdown.map((item, idx) => (
              <div key={idx} className={styles.breakdownRow}>
                <span>{item.label}</span>
                <span className={styles.breakdownValue}>₹{item.value.toLocaleString('en-IN')}</span>
              </div>
            ))}
            <div className={styles.breakdownRow} style={{ borderTop: '2px solid var(--color-border)', fontWeight: 700, marginTop: '8px' }}>
              <span>Total</span>
              <span className={styles.breakdownValue}>₹{totalBudget.toLocaleString('en-IN')}</span>
            </div>
          </div>
        )}

        {activeSubTab === 'logs' && (
          <div className={styles.logsList}>
            {paidLogs.length === 0 ? (
              <div className={styles.emptyState}>No payments have been collected yet.</div>
            ) : (
              paidLogs.map((log) => (
                <div key={log.id} className={styles.logCard}>
                  <div className={styles.logHeader}>
                    <span className={styles.logMilestone}>{log.milestone}</span>
                    <span className={styles.logAmount}>₹{log.amountValue.toLocaleString('en-IN')}</span>
                  </div>
                  <div className={styles.logDetails}>
                    <div className={styles.logDetailItem}>
                      <span className={styles.logIcon}>📅</span>
                      <span>Paid on {log.paidAt ? new Date(log.paidAt).toLocaleDateString('en-IN') : '—'}</span>
                    </div>
                    <div className={styles.logDetailItem}>
                      <span className={styles.logIcon}>💳</span>
                      <span>Mode: {log.paymentMode || '—'}</span>
                    </div>
                    <div className={styles.logDetailItem}>
                      <span className={styles.logIcon}>👤</span>
                      <span>Collected By: {log.collectedByName || '—'} {log.collectedByRole ? `(${log.collectedByRole.replace(/_/g, ' ')})` : ''}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeSubTab === 'milestones' && (
          <div className={styles.milestonesList}>
            {processedPayments.map(p => (
              <div key={p.id} className={`${styles.milestoneCard} ${p.isOverdue ? styles.milestoneOverdue : ''}`}>
                <div className={styles.mCardHeader}>
                  <div className={styles.mCardTitle}>{p.milestone}</div>
                  <Badge variant={p.displayStatus === 'paid' ? 'success' : p.isOverdue ? 'danger' : 'neutral'} size="sm">
                    {p.displayStatus.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
                <div className={styles.mCardBody}>
                  <div className={styles.mCardCol}>
                    <span className={styles.mCardLabel}>Amount</span>
                    <span className={styles.mCardValue}>₹{p.amountValue.toLocaleString('en-IN')}</span>
                  </div>
                  <div className={styles.mCardCol}>
                    <span className={styles.mCardLabel}>Due Date</span>
                    <span className={styles.mCardValue}>{p.dueDate || '—'}</span>
                  </div>
                </div>
                <div className={styles.mCardFooter}>
                  {p.status !== 'paid' && (
                    <Button variant="primary" size="sm" onClick={() => handleMarkPaidClick(p)}>Collect Payment</Button>
                  )}
                  {p.isOverdue && p.daysOverdue >= 15 && (
                    <Button variant="outline" size="sm" style={{ color: 'var(--color-warning)', borderColor: 'var(--color-warning)' }} onClick={() => {
                      setEscalationMilestone(p);
                      setEscalationDaysOverdue(p.daysOverdue);
                      setEscalationModalOpen(true);
                    }}>Escalate</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeSubTab === 'credits' && (
          <div className={styles.creditsList}>
            <div className={styles.creditsSection}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: 0 }}>Refunds</h4>
                <Button variant="outline" size="sm" onClick={() => setRefundModalOpen(true)}>Record Refund</Button>
              </div>
              {refunds.length === 0 ? <div className={styles.emptyState}>No refunds processed.</div> : (
                refunds.map(ref => (
                  <div key={ref.id} className={styles.creditCard}>
                    <div className={styles.cCardHeader}>
                      <span>{ref.refund_number}</span>
                      <span className={styles.cCardAmount}>₹{Number(ref.amount).toLocaleString('en-IN')}</span>
                    </div>
                    <div className={styles.cCardBody}>
                      <span>Date: {new Date(ref.refund_date).toLocaleDateString('en-IN')}</span>
                      <span>Method: {ref.payment_method}</span>
                      <span>Reason: {ref.reason}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className={styles.creditsSection} style={{ marginTop: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: 0 }}>Credit Notes</h4>
                <Button variant="outline" size="sm" onClick={() => setCreditNoteModalOpen(true)}>Issue Credit Note</Button>
              </div>
              {creditNotes.length === 0 ? <div className={styles.emptyState}>No credit notes issued.</div> : (
                creditNotes.map(cn => (
                  <div key={cn.id} className={styles.creditCard}>
                    <div className={styles.cCardHeader}>
                      <span>{cn.credit_note_number}</span>
                      <span className={styles.cCardAmount}>₹{Number(cn.total_amount).toLocaleString('en-IN')}</span>
                    </div>
                    <div className={styles.cCardBody}>
                      <span>Date: {new Date(cn.credit_note_date).toLocaleDateString('en-IN')}</span>
                      <span>Reason: {cn.reason}</span>
                      <span>Status: <Badge variant="neutral" size="sm">{cn.status.toUpperCase()}</Badge></span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Collect Payment Modal */}
      {modalOpen && (
        <Modal isOpen onClose={() => setModalOpen(false)}>
          <div style={{padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '440px', width: '100%'}}>
            <h3 style={{fontSize: 'var(--text-lg)', fontWeight: 700}}>Collect Payment</h3>
            <Input label="Milestone Value" value={`₹${Number(selectedPayment?.amountValue || 0).toLocaleString('en-IN')}`} readOnly />
            
            <Select 
              label="Payment Mode" 
              value={paymentMode} 
              onChange={setPaymentMode} 
              options={[
                { value: 'Bank Transfer', label: 'Bank Transfer' },
                { value: 'UPI', label: 'UPI' },
                { value: 'Cheque', label: 'Cheque' },
                { value: 'Cash', label: 'Cash' }
              ]}
            />

            <Select 
              label="Collected By (Role & Name)" 
              value={collectedBy} 
              onChange={setCollectedBy} 
              options={[
                { value: '', label: 'Select Staff...' },
                ...(project?.pm_name ? [{ value: `${project.pm_name}|project_manager`, label: `${project.pm_name} (Project Manager)` }] : []),
                ...(project?.crm_executive_name ? [{ value: `${project.crm_executive_name}|crm_executive`, label: `${project.crm_executive_name} (CRM Executive)` }] : []),
                { value: 'System Admin|admin', label: 'System Admin (Admin)' }
              ]}
            />

            <Input label="Date Paid" type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)} />
            
            <div style={{display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-4)'}}>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleConfirmPaid}>Confirm Payment</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Invoice Modal (Simplified for space) */}
      {/* Refund Modal (Simplified) */}
      {refundModalOpen && (
        <Modal isOpen onClose={() => setRefundModalOpen(false)}>
          <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '480px', width: '100%' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Record Customer Refund</h3>
            <Input label="Refund Amount (INR)" type="number" value={refundForm.amount} onChange={e => setRefundForm(prev => ({ ...prev, amount: e.target.value }))} required />
            <Select label="Payment Method" value={refundForm.paymentMethod} onChange={val => setRefundForm(prev => ({ ...prev, paymentMethod: val }))} options={[{ value: 'Bank Transfer', label: 'Bank Transfer' }, { value: 'UPI', label: 'UPI' }]} />
            <Input label="Reason for Refund" value={refundForm.reason} onChange={e => setRefundForm(prev => ({ ...prev, reason: e.target.value }))} required />
            <div style={{display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)'}}>
              <Button variant="ghost" onClick={() => setRefundModalOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleConfirmRefund}>Record Refund</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Credit Note Modal (Simplified) */}
      {creditNoteModalOpen && (
        <Modal isOpen onClose={() => setCreditNoteModalOpen(false)}>
          <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '480px', width: '100%' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Issue Credit Note</h3>
            <Input label="Amount" type="number" value={creditNoteForm.subtotal} onChange={e => setCreditNoteForm(prev => ({ ...prev, subtotal: e.target.value }))} required />
            <Input label="Reason" value={creditNoteForm.reason} onChange={e => setCreditNoteForm(prev => ({ ...prev, reason: e.target.value }))} required />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <Button variant="ghost" onClick={() => setCreditNoteModalOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleConfirmCreditNote}>Confirm Issue</Button>
            </div>
          </div>
        </Modal>
      )}

      <PaymentEscalationModal 
        isOpen={escalationModalOpen}
        onClose={() => setEscalationModalOpen(false)}
        onSuccess={loadEscalations}
        projectId={projectId}
        milestone={escalationMilestone}
        daysOverdue={escalationDaysOverdue}
      />
    </div>
  );
}
