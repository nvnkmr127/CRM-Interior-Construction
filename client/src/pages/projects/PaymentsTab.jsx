import React, { useState, useEffect } from 'react';
import { Badge, Button, Modal, Input, Select } from '../../components/ui';
import styles from './PaymentsTab.module.css';
import { getPaymentMilestones, updatePaymentMilestone } from '../../api/paymentMilestones';
import { getInvoiceDraft, createInvoice } from '../../api/invoices';
import { getCreditNotes, getRefunds, createCreditNote, createRefund } from '../../api/financials';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';

export default function PaymentsTab({ projectId }) {
  const toast = useToast();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paidDate, setPaidDate] = useState('');
  const [tdsRate, setTdsRate] = useState(0);
  const [tdsAmount, setTdsAmount] = useState(0);

  // Invoice States
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    companyName: '',
    companyAddress: '',
    companyGstin: '',
    billingName: '',
    billingAddress: '',
    billingGstin: '',
    gstType: 'cgst_sgst',
    gstRate: 18.00,
    paymentTerms: '',
    invoiceDate: '',
    dueDate: '',
    amount: 0
  });

  // Credit Note & Refund States
  const [creditNotes, setCreditNotes] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [creditNoteModalOpen, setCreditNoteModalOpen] = useState(false);
  const [creditNoteSubmitting, setCreditNoteSubmitting] = useState(false);
  const [creditNoteForm, setCreditNoteForm] = useState({
    subtotal: '',
    gstType: 'cgst_sgst',
    gstRate: 18.00,
    reason: '',
    notes: ''
  });

  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundForm, setRefundForm] = useState({
    amount: '',
    paymentMethod: 'Bank Transfer',
    referenceNumber: '',
    reason: '',
    notes: ''
  });

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    
    // Fetch milestones
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
          tdsAmount: Number(p.tds_amount || 0)
        })));
      })
      .catch(() => setPayments([]))
      .finally(() => setLoading(false));

    // Fetch credits & refunds
    Promise.all([
      getCreditNotes(projectId),
      getRefunds(projectId)
    ]).then(([cnRes, refRes]) => {
      setCreditNotes(cnRes.data?.data || cnRes.data || []);
      setRefunds(refRes.data?.data || refRes.data || []);
    }).catch(err => {
      console.error('Failed to load credit notes or refunds:', err);
    });
  }, [projectId]);

  // Overdue logic
  const today = new Date().toISOString().split('T')[0];
  
  const processedPayments = payments.map(p => {
    if (p.status !== 'paid' && p.dueDate < today) {
      return { ...p, displayStatus: 'overdue', isOverdue: true };
    }
    return { ...p, displayStatus: p.status, isOverdue: false };
  });

  const overdueCount = processedPayments.filter(p => p.isOverdue).length;

  const totalValue = payments.reduce((sum, p) => sum + p.amountValue, 0);
  const collectedValue = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amountValue, 0);
  const overdueValue = processedPayments.filter(p => p.isOverdue).reduce((sum, p) => sum + p.amountValue, 0);

  // Credits and refunds calculations
  const totalCredits = creditNotes.reduce((sum, cn) => sum + Number(cn.total_amount || 0), 0);
  const totalRefunds = refunds.reduce((sum, ref) => sum + Number(ref.amount || 0), 0);

  // Net sums
  const netBilled = Math.max(0, totalValue - totalCredits);
  const netCollections = Math.max(0, collectedValue - totalRefunds);
  const pendingValue = Math.max(0, netBilled - netCollections);
  const progressPct = netBilled > 0 ? (netCollections / netBilled) * 100 : 0;

  const formatLakhs = (val) => `₹${(val / 100000).toFixed(2)}L`;

  const handleMarkPaidClick = (p) => {
    setSelectedPayment(p);
    setTdsRate(0);
    setTdsAmount(0);
    setPaidDate(new Date().toISOString().split('T')[0]);
    setModalOpen(true);
  };

  const handleConfirmPaid = async () => {
    try {
      const netPaid = Number((selectedPayment.amountValue - tdsAmount).toFixed(2));
      await updatePaymentMilestone(selectedPayment.id, { 
        status: 'paid', 
        paid_at: paidDate,
        paid_amount: netPaid,
        tds_rate: tdsRate,
        tds_amount: tdsAmount
      });
      setPayments(prev => prev.map(p => p.id === selectedPayment.id ? { 
        ...p, 
        status: 'paid',
        tdsRate,
        tdsAmount
      } : p));
      toast.success('Payment marked as paid (TDS recorded)');
    } catch {
      toast.error('Failed to update payment');
    }
    setModalOpen(false);
  };

  // Invoice handlers
  const handleGenerateInvoiceClick = async (p) => {
    setSelectedPayment(p);
    setInvoiceLoading(true);
    try {
      const res = await getInvoiceDraft(p.id);
      const draft = res.data?.data || res.data;
      setInvoiceForm({
        companyName: draft.companyName || 'Demo Company',
        companyAddress: draft.companyAddress || '',
        companyGstin: draft.companyGstin || '',
        billingName: draft.billingName || '',
        billingAddress: draft.billingAddress || '',
        billingGstin: draft.billingGstin || '',
        gstType: draft.gstType || 'cgst_sgst',
        gstRate: draft.gstRate || 18.00,
        paymentTerms: draft.paymentTerms || 'Net 15',
        invoiceDate: draft.invoiceDate || new Date().toISOString().split('T')[0],
        dueDate: draft.dueDate || '',
        amount: draft.amount || 0
      });
      setInvoiceModalOpen(true);
    } catch (err) {
      console.error('[PaymentsTab] Load draft error:', err);
      toast.error('Failed to load invoice details');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleConfirmGenerateInvoice = async () => {
    setInvoiceSubmitting(true);
    try {
      const data = {
        milestoneId: selectedPayment.id,
        ...invoiceForm,
        gstRate: Number(invoiceForm.gstRate)
      };
      const res = await createInvoice(data);
      const invoice = res.data?.data || res.data;
      
      setPayments(prev => prev.map(p => 
        p.id === selectedPayment.id 
          ? { ...p, status: 'invoice_raised', invoiceReference: invoice.invoice_number } 
          : p
      ));
      toast.success(`Invoice ${invoice.invoice_number} generated successfully!`);
      setInvoiceModalOpen(false);
    } catch (err) {
      console.error('[PaymentsTab] Invoice generation error:', err);
      toast.error(err.response?.data?.error?.message || 'Failed to generate invoice');
    } finally {
      setInvoiceSubmitting(false);
    }
  };

  const handleDownloadInvoice = async (milestoneId, invoiceNumber) => {
    try {
      const response = await api.get(`/invoices/milestone/${milestoneId}/download`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${invoiceNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      console.error('[PaymentsTab] Download error:', err);
      toast.error('Failed to download invoice PDF');
    }
  };

  // Credit Note handlers
  const handleOpenCreditNoteModal = () => {
    setCreditNoteForm({
      subtotal: '',
      gstType: 'cgst_sgst',
      gstRate: 18.00,
      reason: '',
      notes: ''
    });
    setCreditNoteModalOpen(true);
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
      toast.success(`Credit Note ${newCN.credit_note_number} generated successfully!`);
      setCreditNoteModalOpen(false);
    } catch (err) {
      console.error('[PaymentsTab] Credit note error:', err);
      toast.error(err.response?.data?.error?.message || 'Failed to issue Credit Note');
    } finally {
      setCreditNoteSubmitting(false);
    }
  };

  // Refund handlers
  const handleOpenRefundModal = () => {
    setRefundForm({
      amount: '',
      paymentMethod: 'Bank Transfer',
      referenceNumber: '',
      reason: '',
      notes: ''
    });
    setRefundModalOpen(true);
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
      toast.success(`Refund ${newRef.refund_number} recorded successfully!`);
      setRefundModalOpen(false);
    } catch (err) {
      console.error('[PaymentsTab] Refund error:', err);
      toast.error(err.response?.data?.error?.message || 'Failed to record Refund');
    } finally {
      setRefundSubmitting(false);
    }
  };

  const getStatusVariant = (st) => {
    if (st === 'paid') return 'success';
    if (st === 'overdue') return 'danger';
    if (st === 'invoice_raised') return 'info';
    return 'neutral';
  };

  if (loading) {
    return <div style={{ padding: '32px', color: 'var(--color-text-muted)' }}>Loading payments…</div>;
  }

  return (
    <div className={styles.tabWrap}>
      {overdueCount > 0 && (
        <div className={styles.overdueNotice}>
          {overdueCount} overdue payment{overdueCount > 1 ? 's' : ''}
        </div>
      )}

      <div className={styles.summaryBar}>
        <div className={styles.summaryStats} style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-6)' }}>
          <div className={styles.stat} style={{ flex: '1 1 150px' }}>
            <span className={styles.statLabel}>Net Collected</span>
            <span className={styles.statValue}>{formatLakhs(netCollections)}</span>
            {totalRefunds > 0 && <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Gross: {formatLakhs(collectedValue)} | Ref: {formatLakhs(totalRefunds)}</span>}
          </div>
          <div className={styles.stat} style={{ flex: '1 1 150px' }}>
            <span className={styles.statLabel}>Net Billed</span>
            <span className={styles.statValue}>{formatLakhs(netBilled)}</span>
            {totalCredits > 0 && <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Gross: {formatLakhs(totalValue)} | Cred: {formatLakhs(totalCredits)}</span>}
          </div>
          <div className={styles.stat} style={{ flex: '1 1 150px' }}>
            <span className={styles.statLabel}>Pending Balance</span>
            <span className={`${styles.statValue} ${overdueCount > 0 ? styles.statDanger : ''}`}>{formatLakhs(pendingValue)}</span>
          </div>
          <div className={styles.stat} style={{ flex: '1 1 120px' }}>
            <span className={styles.statLabel}>Total Credits</span>
            <span className={styles.statValue} style={{ color: 'var(--color-info)' }}>{formatLakhs(totalCredits)}</span>
          </div>
          <div className={styles.stat} style={{ flex: '1 1 120px' }}>
            <span className={styles.statLabel}>Total Refunds</span>
            <span className={styles.statValue} style={{ color: 'var(--color-danger)' }}>{formatLakhs(totalRefunds)}</span>
          </div>
        </div>
        <div className={styles.progressWrap} style={{ marginTop: 'var(--space-2)' }}>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${progressPct.toFixed(1)}%` }} />
          </div>
        </div>
      </div>

      <div style={{background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden'}}>
        <h4 style={{ padding: 'var(--space-4) var(--space-4) 0 var(--space-4)', fontWeight: 700, fontSize: 'var(--text-base)' }}>Payment Milestones</h4>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Milestone</th>
              <th>Linked Phase</th>
              <th>Amount</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Invoice</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {processedPayments.length > 0 ? processedPayments.map(p => (
              <tr key={p.id} className={p.isOverdue ? styles.rowOverdue : ''}>
                <td style={{fontWeight: 500}}>{p.milestone}</td>
                <td>{p.phase}</td>
                <td style={{fontWeight: 600}}>
                  {formatLakhs(p.amountValue)}
                  {Number(p.tdsAmount) > 0 && (
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 'normal' }}>
                      TDS: ₹{Number(p.tdsAmount).toLocaleString('en-IN')} ({p.tdsRate}%)
                    </div>
                  )}
                </td>
                <td style={p.isOverdue ? {color: 'var(--color-danger)', fontWeight: 600} : {}}>{p.dueDate}</td>
                <td><Badge variant={getStatusVariant(p.displayStatus)} size="sm">{p.displayStatus.replace('_', ' ').toUpperCase()}</Badge></td>
                <td>
                  {p.invoiceReference ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-text)' }}>{p.invoiceReference}</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        style={{ padding: '2px 6px', height: 'auto', fontSize: '11px', color: 'var(--color-primary)' }}
                        onClick={() => handleDownloadInvoice(p.id, p.invoiceReference)}
                      >
                        Download
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      style={{ fontSize: '11px', height: '24px', padding: '0 8px' }}
                      disabled={invoiceLoading}
                      onClick={() => handleGenerateInvoiceClick(p)}
                    >
                      {invoiceLoading && selectedPayment?.id === p.id ? 'Loading...' : 'Generate Invoice'}
                    </Button>
                  )}
                </td>
                <td>
                  {p.status !== 'paid' && (
                    <Button variant="outline" size="sm" onClick={() => handleMarkPaidClick(p)}>Mark Paid</Button>
                  )}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '24px' }}>No payment milestones scheduled.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Credit Notes & Refunds Section */}
      <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap', marginTop: 'var(--space-2)' }}>
        
        {/* Credit Notes Card */}
        <div style={{ flex: '1 1 45%', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)' }}>
            <h4 style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>Credit Notes</h4>
            <Button variant="primary" size="sm" onClick={handleOpenCreditNoteModal}>Issue Credit Note</Button>
          </div>
          <div style={{ overflowX: 'auto', flex: 1 }}>
            <table className={styles.table} style={{ margin: 0, border: 'none' }}>
              <thead>
                <tr>
                  <th>CN Number</th>
                  <th>Date</th>
                  <th>Reason</th>
                  <th style={{ textAlign: 'right' }}>Total (INR)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {creditNotes.length > 0 ? creditNotes.map(cn => (
                  <tr key={cn.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{cn.credit_note_number}</td>
                    <td>{new Date(cn.credit_note_date).toLocaleDateString('en-IN')}</td>
                    <td>{cn.reason}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{Number(cn.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td><Badge variant="neutral" size="sm">{cn.status.toUpperCase()}</Badge></td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '24px' }}>No credit notes issued.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Refunds Card */}
        <div style={{ flex: '1 1 45%', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)' }}>
            <h4 style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>Refunds</h4>
            <Button variant="primary" size="sm" onClick={handleOpenRefundModal}>Record Refund</Button>
          </div>
          <div style={{ overflowX: 'auto', flex: 1 }}>
            <table className={styles.table} style={{ margin: 0, border: 'none' }}>
              <thead>
                <tr>
                  <th>Refund Number</th>
                  <th>Date</th>
                  <th>Method</th>
                  <th>Reason</th>
                  <th style={{ textAlign: 'right' }}>Amount (INR)</th>
                </tr>
              </thead>
              <tbody>
                {refunds.length > 0 ? refunds.map(ref => (
                  <tr key={ref.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{ref.refund_number}</td>
                    <td>{new Date(ref.refund_date).toLocaleDateString('en-IN')}</td>
                    <td>{ref.payment_method}</td>
                    <td>{ref.reason}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{Number(ref.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '24px' }}>No refunds processed.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Mark Paid Modal */}
      {modalOpen && (
        <Modal isOpen onClose={() => setModalOpen(false)}>
          <div style={{padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '440px', width: '100%'}}>
            <h3 style={{fontSize: 'var(--text-lg)', fontWeight: 700}}>Mark Payment Paid</h3>
            <Input label="Milestone Value" value={`₹${Number(selectedPayment?.amountValue || 0).toLocaleString('en-IN')}`} readOnly />
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <Input 
                label="TDS Rate (%)" 
                type="number" 
                step="0.1"
                value={tdsRate} 
                onChange={e => {
                  const r = Number(e.target.value);
                  setTdsRate(r);
                  setTdsAmount(Number(((selectedPayment?.amountValue || 0) * r / 100).toFixed(2)));
                }} 
              />
              <Input 
                label="TDS Amount (INR)" 
                type="number" 
                value={tdsAmount} 
                onChange={e => {
                  const a = Number(e.target.value);
                  setTdsAmount(a);
                  const totalVal = selectedPayment?.amountValue || 1;
                  setTdsRate(Number(((a / totalVal) * 100).toFixed(2)));
                }} 
              />
            </div>

            <Input 
              label="Net Received Amount" 
              value={`₹${(Number(selectedPayment?.amountValue || 0) - tdsAmount).toLocaleString('en-IN')}`} 
              readOnly 
            />

            <Input label="Date Paid" type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)} />
            
            <div style={{display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-4)'}}>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleConfirmPaid}>Confirm Payment</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Invoice Modal */}
      {invoiceModalOpen && (
        <Modal isOpen onClose={() => setInvoiceModalOpen(false)}>
          <div style={{
            padding: 'var(--space-6)', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 'var(--space-4)', 
            maxWidth: '550px', 
            width: '100%', 
            maxHeight: '80vh', 
            overflowY: 'auto'
          }}>
            <h3 style={{fontSize: 'var(--text-lg)', fontWeight: 700}}>Generate Tax Invoice</h3>
            
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)'}}>
              <Input 
                label="Invoice Date" 
                type="date" 
                value={invoiceForm.invoiceDate} 
                onChange={e => setInvoiceForm(prev => ({ ...prev, invoiceDate: e.target.value }))} 
              />
              <Input 
                label="Due Date" 
                type="date" 
                value={invoiceForm.dueDate} 
                onChange={e => setInvoiceForm(prev => ({ ...prev, dueDate: e.target.value }))} 
              />
            </div>

            <div style={{borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-2)', marginTop: 'var(--space-2)'}}>
              <h4 style={{fontWeight: 600, fontSize: 'var(--text-sm)'}}>Company Details (Seller)</h4>
            </div>
            
            <Input 
              label="Company Name" 
              value={invoiceForm.companyName} 
              onChange={e => setInvoiceForm(prev => ({ ...prev, companyName: e.target.value }))} 
            />
            
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)'}}>
              <Input 
                label="Company Address" 
                value={invoiceForm.companyAddress} 
                onChange={e => setInvoiceForm(prev => ({ ...prev, companyAddress: e.target.value }))} 
              />
              <Input 
                label="Company GSTIN" 
                value={invoiceForm.companyGstin} 
                onChange={e => setInvoiceForm(prev => ({ ...prev, companyGstin: e.target.value }))} 
              />
            </div>

            <div style={{borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-2)', marginTop: 'var(--space-2)'}}>
              <h4 style={{fontWeight: 600, fontSize: 'var(--text-sm)'}}>Billing Details (Buyer)</h4>
            </div>

            <Input 
              label="Billing Name" 
              value={invoiceForm.billingName} 
              onChange={e => setInvoiceForm(prev => ({ ...prev, billingName: e.target.value }))} 
            />
            
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)'}}>
              <Input 
                label="Billing Address" 
                value={invoiceForm.billingAddress} 
                onChange={e => setInvoiceForm(prev => ({ ...prev, billingAddress: e.target.value }))} 
              />
              <Input 
                label="Billing GSTIN" 
                value={invoiceForm.billingGstin} 
                onChange={e => setInvoiceForm(prev => ({ ...prev, billingGstin: e.target.value }))} 
              />
            </div>

            <div style={{borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-2)', marginTop: 'var(--space-2)'}}>
              <h4 style={{fontWeight: 600, fontSize: 'var(--text-sm)'}}>Tax & Terms</h4>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)'}}>
              <Select 
                label="GST Type" 
                value={invoiceForm.gstType} 
                onChange={val => setInvoiceForm(prev => ({ ...prev, gstType: val }))} 
                options={[
                  { value: 'cgst_sgst', label: 'CGST + SGST (Intra-state)' },
                  { value: 'igst', label: 'IGST (Inter-state)' }
                ]}
              />
              <Input 
                label="GST Rate (%)" 
                type="number" 
                step="0.01" 
                value={invoiceForm.gstRate} 
                onChange={e => setInvoiceForm(prev => ({ ...prev, gstRate: Number(e.target.value) }))} 
              />
            </div>

            <Input 
              label="Payment Terms" 
              value={invoiceForm.paymentTerms} 
              onChange={e => setInvoiceForm(prev => ({ ...prev, paymentTerms: e.target.value }))} 
            />

            <div style={{
              background: 'var(--color-surface-2)', 
              padding: 'var(--space-3)', 
              borderRadius: 'var(--radius-md)', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 'var(--space-1)', 
              marginTop: 'var(--space-2)'
            }}>
              <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)'}}>
                <span>Milestone Amount (Subtotal):</span>
                <strong>₹{invoiceForm.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
              {invoiceForm.gstType === 'cgst_sgst' ? (
                <>
                  <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)'}}>
                    <span>CGST ({(invoiceForm.gstRate / 2).toFixed(2)}%):</span>
                    <span>₹{((invoiceForm.amount * (invoiceForm.gstRate / 2)) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)'}}>
                    <span>SGST ({(invoiceForm.gstRate / 2).toFixed(2)}%):</span>
                    <span>₹{((invoiceForm.amount * (invoiceForm.gstRate / 2)) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </>
              ) : (
                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)'}}>
                  <span>IGST ({invoiceForm.gstRate.toFixed(2)}%):</span>
                  <span>₹{((invoiceForm.amount * invoiceForm.gstRate) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div style={{
                borderTop: '1px solid var(--color-border)', 
                marginTop: 'var(--space-2)', 
                paddingTop: 'var(--space-2)', 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontSize: 'var(--text-base)', 
                fontWeight: 700
              }}>
                <span>Total Amount:</span>
                <span>₹{(invoiceForm.amount + (invoiceForm.amount * invoiceForm.gstRate / 100)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div style={{display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-4)'}}>
              <Button variant="ghost" onClick={() => setInvoiceModalOpen(false)} disabled={invoiceSubmitting}>Cancel</Button>
              <Button variant="primary" onClick={handleConfirmGenerateInvoice} disabled={invoiceSubmitting}>
                {invoiceSubmitting ? 'Generating...' : 'Confirm & Generate Invoice'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Credit Note Modal */}
      {creditNoteModalOpen && (
        <Modal isOpen onClose={() => setCreditNoteModalOpen(false)}>
          <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '480px', width: '100%' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Issue Credit Note</h3>
            
            <Input 
              label="Credit Note Amount (Subtotal)" 
              type="number" 
              placeholder="e.g. 50000" 
              value={creditNoteForm.subtotal} 
              onChange={e => setCreditNoteForm(prev => ({ ...prev, subtotal: e.target.value }))} 
              required
            />
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <Select 
                label="GST Type" 
                value={creditNoteForm.gstType} 
                onChange={val => setCreditNoteForm(prev => ({ ...prev, gstType: val }))} 
                options={[
                  { value: 'cgst_sgst', label: 'CGST + SGST (Intra-state)' },
                  { value: 'igst', label: 'IGST (Inter-state)' }
                ]}
              />
              <Input 
                label="GST Rate (%)" 
                type="number" 
                value={creditNoteForm.gstRate} 
                onChange={e => setCreditNoteForm(prev => ({ ...prev, gstRate: Number(e.target.value) }))} 
              />
            </div>

            <Input 
              label="Reason for Credit" 
              placeholder="e.g. Discount post-quotation, cancelled milestone balance" 
              value={creditNoteForm.reason} 
              onChange={e => setCreditNoteForm(prev => ({ ...prev, reason: e.target.value }))} 
              required
            />
            
            <Input 
              label="Additional Notes" 
              placeholder="Internal bookkeeping details..." 
              value={creditNoteForm.notes} 
              onChange={e => setCreditNoteForm(prev => ({ ...prev, notes: e.target.value }))} 
            />

            <div style={{
              background: 'var(--color-surface-2)', 
              padding: 'var(--space-3)', 
              borderRadius: 'var(--radius-md)', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 'var(--space-1)', 
              marginTop: 'var(--space-2)',
              fontSize: 'var(--text-sm)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal:</span>
                <strong>₹{Number(creditNoteForm.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)' }}>
                <span>Calculated Tax:</span>
                <span>₹{((Number(creditNoteForm.subtotal || 0) * creditNoteForm.gstRate) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                <span>Total Credit Note Value:</span>
                <span>₹{(Number(creditNoteForm.subtotal || 0) * (1 + creditNoteForm.gstRate / 100)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
              <Button variant="ghost" onClick={() => setCreditNoteModalOpen(false)} disabled={creditNoteSubmitting}>Cancel</Button>
              <Button variant="primary" onClick={handleConfirmCreditNote} disabled={creditNoteSubmitting}>
                {creditNoteSubmitting ? 'Issuing...' : 'Confirm & Issue'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Record Refund Modal */}
      {refundModalOpen && (
        <Modal isOpen onClose={() => setRefundModalOpen(false)}>
          <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '480px', width: '100%' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Record Customer Refund</h3>
            
            <Input 
              label="Refund Amount (INR)" 
              type="number" 
              placeholder="e.g. 25000" 
              value={refundForm.amount} 
              onChange={e => setRefundForm(prev => ({ ...prev, amount: e.target.value }))} 
              required
            />
            
            <Select 
              label="Payment Method" 
              value={refundForm.paymentMethod} 
              onChange={val => setRefundForm(prev => ({ ...prev, paymentMethod: val }))} 
              options={[
                { value: 'Bank Transfer', label: 'Bank Transfer (NEFT/RTGS/IMPS)' },
                { value: 'UPI', label: 'UPI / NetBanking' },
                { value: 'Cheque', label: 'Cheque' },
                { value: 'Cash', label: 'Cash' },
                { value: 'Other', label: 'Other' }
              ]}
            />
            
            <Input 
              label="Reference / Transaction Number (UTR)" 
              placeholder="e.g. UTR123456789" 
              value={refundForm.referenceNumber} 
              onChange={e => setRefundForm(prev => ({ ...prev, referenceNumber: e.target.value }))} 
            />

            <Input 
              label="Reason for Refund" 
              placeholder="e.g. Double advance returned, project cancellation advance refund" 
              value={refundForm.reason} 
              onChange={e => setRefundForm(prev => ({ ...prev, reason: e.target.value }))} 
              required
            />
            
            <Input 
              label="Additional Notes" 
              placeholder="Bank account details, approvals etc." 
              value={refundForm.notes} 
              onChange={e => setRefundForm(prev => ({ ...prev, notes: e.target.value }))} 
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
              <Button variant="ghost" onClick={() => setRefundModalOpen(false)} disabled={refundSubmitting}>Cancel</Button>
              <Button variant="primary" onClick={handleConfirmRefund} disabled={refundSubmitting}>
                {refundSubmitting ? 'Recording...' : 'Confirm & Record Refund'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
