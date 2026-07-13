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

// --- Payment Gateway Abstraction ---
class PaymentGatewayService {
  static async initialize(gatewayName, paymentDetails) {
    switch (gatewayName.toLowerCase()) {
      case 'cashfree':
        return this.initCashfree(paymentDetails);
      case 'razorpay':
        return this.initRazorpay(paymentDetails);
      default:
        throw new Error('Unsupported payment gateway');
    }
  }

  static async initCashfree(details) {
    return new Promise((resolve, reject) => {
      // Mocking SDK load and webhook verification for frontend
      console.log('[Cashfree] Initializing gateway...', details);
      setTimeout(() => {
        const isSuccess = window.confirm(`[Cashfree Mock Sandbox]\nAmount: ₹${details.amount}\nMilestone: ${details.milestoneName}\n\nSimulate successful payment webhook verification?`);
        if (isSuccess) {
          resolve({
            success: true,
            reference: 'cf_verify_' + Date.now(),
            mode: 'Cashfree Gateway',
            message: 'Webhook verified successfully'
          });
        } else {
          reject(new Error('Payment cancelled or webhook failed'));
        }
      }, 500);
    });
  }

  static async initRazorpay(details) {
    return new Promise((resolve) => resolve({ success: true, reference: 'rzp_' + Date.now(), mode: 'Razorpay Gateway' }));
  }
}
// -----------------------------------

export default function PaymentsTab({ projectId, project }) {
  const toast = useToast();
  const [payments, setPayments] = useState([]);
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('breakdown'); // breakdown, logs, milestones, credits, approvals
  
  // Finance Approvals Queue State
  const [financeApprovals, setFinanceApprovals] = useState([]);

  // RBAC State
  const defaultPermissions = {
    Admin: ['View', 'Create', 'Edit', 'Delete', 'Approve', 'Refund', 'Export'],
    Finance: ['View', 'Create', 'Edit', 'Delete', 'Approve', 'Refund', 'Export'],
    Accounts: ['View', 'Create', 'Edit', 'Export'],
    Sales: ['View'],
    Designer: ['View'],
    Project_Manager: ['View', 'Create'],
    Branch_Manager: ['View', 'Create', 'Approve', 'Export']
  };
  const [permissionsConfig, setPermissionsConfig] = useState(defaultPermissions);
  const [simulateRole, setSimulateRole] = useState('Admin');

  const hasPermission = (action) => {
    return permissionsConfig[simulateRole]?.includes(action) || false;
  };

  // Ledger States
  const [ledgerFilterType, setLedgerFilterType] = useState('ALL');

  // Payment Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [splitPayments, setSplitPayments] = useState([]);
  const [tdsRate, setTdsRate] = useState(0);
  const [tdsAmount, setTdsAmount] = useState(0);
  const [collectedBy, setCollectedBy] = useState('');

  // Invoice States
  const [invoices, setInvoices] = useState([]);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    type: 'TAX_INVOICE',
    milestoneId: '', 
    invoiceDate: new Date().toISOString().split('T')[0], 
    amount: 0,
    gstType: 'CGST_SGST', // CGST_SGST or IGST
    gstRate: 18,
    hsnSac: '9954',
    customerGst: ''
  });
  const [printingInvoice, setPrintingInvoice] = useState(null);

  // Immutable Audit Logs States
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLogFilter, setAuditLogFilter] = useState('ALL');

  const appendAuditLog = (action, financialObject, oldVal, newVal, reason) => {
    const logEntry = {
      id: 'audit_' + Date.now() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      user: simulateRole,
      ip: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`, // Mock IP
      device: navigator.userAgent.includes('Windows') ? 'Windows PC' : 'Mac/Linux', // Mock Device
      action,
      financialObject,
      oldValue: oldVal,
      newValue: newVal,
      reason: reason || 'System Action'
    };
    setAuditLogs(prev => [logEntry, ...prev]);
  };

  // Receipts State
  const [receipts, setReceipts] = useState([]);
  const [printingReceipt, setPrintingReceipt] = useState(null);

  // Financial Gates State
  const [gateOverrides, setGateOverrides] = useState([]);
  
  const financialGates = React.useMemo(() => {
    const isPaid = (keyword) => payments.some(p => p.milestone?.toLowerCase().includes(keyword) && p.status === 'paid');
    const isOverridden = (gateName) => gateOverrides.some(g => g.gateName === gateName);
    const getStatus = (keyword, gateName) => isOverridden(gateName) ? 'OVERRIDDEN' : (isPaid(keyword) ? 'CLEARED' : 'BLOCKED');
    
    return [
      { id: 'g1', name: 'Production', status: getStatus('production', 'Production'), reason: 'Production payment must be completed before manufacturing begins.' },
      { id: 'g2', name: 'Dispatch', status: getStatus('dispatch', 'Dispatch'), reason: 'Dispatch payment must be completed before materials leave the factory.' },
      { id: 'g3', name: 'Installation', status: getStatus('install', 'Installation'), reason: 'Installation payment must be completed before site work begins.' },
      { id: 'g4', name: 'Handover', status: getStatus('handover', 'Handover'), reason: 'Final payment must be completed before site handover.' }
    ];
  }, [payments, gateOverrides]);

  // Advance Adjustment States
  const [advanceAdjustments, setAdvanceAdjustments] = useState([]);
  const [manualAdjustmentModalOpen, setManualAdjustmentModalOpen] = useState(false);
  const [manualAdjustmentForm, setManualAdjustmentForm] = useState({ invoiceId: '', amount: '', reason: '' });

  const advanceData = React.useMemo(() => {
    // Booking or Advance payments
    const advanceMilestones = payments.filter(p => 
      p.milestone?.toLowerCase().includes('booking') || 
      p.milestone?.toLowerCase().includes('advance') ||
      p.id?.includes('booking')
    );
    const totalAdvance = advanceMilestones.reduce((sum, p) => sum + (Number(p.collectedAmount) || 0), 0);
    
    const totalAdjusted = advanceAdjustments
      .filter(adj => adj.status === 'APPROVED')
      .reduce((sum, adj) => sum + Number(adj.amount), 0);
      
    return {
      totalAdvance,
      totalAdjusted,
      remainingAdvance: totalAdvance - totalAdjusted
    };
  }, [payments, advanceAdjustments]);

  const handleApproveAdjustment = (id) => {
    const adj = advanceAdjustments.find(a => a.id === id);
    if(adj) requestFinanceApproval('Advance Adjustment', adj.amount, adj.reason, { newAdj: {...adj, status: 'APPROVED', id: 'ADJ-' + Date.now()} });
  };

  // Write-off / Discount States
  const [writeOffModalOpen, setWriteOffModalOpen] = useState(false);
  const [writeOffForm, setWriteOffForm] = useState({ milestoneId: '', milestoneName: '', amount: '', reason: '', type: 'Discount' });

  const handleRequestWriteOff = (p) => {
    setWriteOffForm({ milestoneId: p.id, milestoneName: p.milestone, amount: p.remainingAmount, reason: '', type: 'Discount' });
    setWriteOffModalOpen(true);
  };

  const submitWriteOff = () => {
    if (!writeOffForm.amount || !writeOffForm.reason) {
      toast.error('Amount and Reason are required');
      return;
    }
    requestFinanceApproval(writeOffForm.type, writeOffForm.amount, writeOffForm.reason, { ...writeOffForm });
    setWriteOffModalOpen(false);
  };

  const requestFinanceApproval = (type, amount, reason, payload) => {
    const newApproval = {
      id: 'FIN-' + Date.now(),
      type,
      requestedBy: 'Current User',
      amount: Number(amount),
      reason,
      date: new Date().toISOString(),
      status: 'PENDING',
      payload,
      auditTrail: [{ status: 'PENDING', timestamp: new Date().toISOString(), note: 'Request created' }]
    };
    setFinanceApprovals(prev => [newApproval, ...prev]);
    toast.success(`${type} request submitted for Finance Approval.`);
  };

  const executeApprovedAction = async (approval) => {
    const { type, payload } = approval;
    try {
      if (type === 'Refund') {
        const data = { projectId, ...payload.form, amount: Number(payload.form.amount) };
        const res = await createRefund(data);
        setRefunds(prev => [res.data?.data || res.data, ...prev]);
      } else if (type === 'Credit Note') {
        const data = { projectId, ...payload.form, subtotal: Number(payload.form.subtotal), reason: payload.form.reason };
        const res = await createCreditNote(data);
        setCreditNotes(prev => [res.data?.data || res.data, ...prev]);
      } else if (type === 'Debit Note') {
        setDebitNotes(prev => [...prev, payload.newNote]);
      } else if (type === 'Advance Adjustment') {
        setAdvanceAdjustments(prev => prev.map(a => a.id === payload.id ? {...a, status: 'APPROVED'} : a));
        if(!advanceAdjustments.find(a => a.id === payload.id)) {
           setAdvanceAdjustments(prev => [payload.newAdj, ...prev]); // for new ones
        }
      } else if (type === 'Manual Payment') {
        const { selectedPayment, splitPayments, tdsRate, tdsAmount, collectedBy, newEntries, newStatus, newCollected } = payload;
        
        if (!(selectedPayment.id === 'mock_booking_01' || String(selectedPayment.id).startsWith('mock_m_'))) {
          const [colName, colRole] = collectedBy.split('|');
          await updatePaymentMilestone(selectedPayment.id, { 
            status: newStatus, 
            paid_at: splitPayments[0].date,
            paid_amount: newCollected,
            tds_rate: tdsRate,
            tds_amount: selectedPayment.tdsAmount + tdsAmount,
            payment_mode: splitPayments.length > 1 ? 'Split Payment' : splitPayments[0].mode,
            collected_by_name: colName,
            collected_by_role: colRole
          });
        }
        
        setPayments(prev => prev.map(p => p.id === selectedPayment.id ? { 
          ...p, 
          status: newStatus,
          collectedAmount: newCollected,
          remainingAmount: p.amountValue - newCollected,
          paymentEntries: [...(p.paymentEntries || []), ...newEntries],
          tdsRate,
          tdsAmount: p.tdsAmount + tdsAmount
        } : p));
        
        // Auto-generate receipts
        const newReceipts = splitPayments.map((sp, i) => ({
          id: 'REC-' + Date.now() + i,
          receiptDate: new Date().toISOString(),
          milestoneName: selectedPayment.milestone,
          customerName: project?.customer_name || 'Customer',
          amount: sp.amount,
          paymentMode: sp.mode,
          reference: sp.reference || 'N/A',
          status: 'ISSUED'
        }));
        setReceipts(prev => [...newReceipts, ...prev]);

      } else if (type === 'Discount' || type === 'Write-off') {
        setPayments(prev => prev.map(p => p.id === payload.milestoneId ? {
          ...p,
          remainingAmount: p.remainingAmount - payload.amount,
          amountValue: p.amountValue - payload.amount
        } : p));
      } else if (type === 'Gate Override') {
        setGateOverrides(prev => [...prev, payload]);
      }

      setFinanceApprovals(prev => prev.map(a => a.id === approval.id ? {
        ...a,
        status: 'APPROVED',
        auditTrail: [...a.auditTrail, { status: 'APPROVED', timestamp: new Date().toISOString(), note: 'Approved by Finance Admin' }]
      } : a));

      // Append to immutable audit log
      let oldV = 0, newV = approval.amount;
      if (type === 'Manual Payment') {
         oldV = payload.selectedPayment.collectedAmount || 0;
         newV = payload.newCollected;
      }
      appendAuditLog(`Approve ${type}`, type, oldV, newV, approval.reason);

      toast.success(`${type} approved and executed successfully.`);
    } catch (err) {
      console.error(err);
      toast.error(`Failed to execute ${type}`);
    }
  };

  const handleRejectAction = (approvalId) => {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;
    setFinanceApprovals(prev => prev.map(a => a.id === approvalId ? {
      ...a,
      status: 'REJECTED',
      auditTrail: [...a.auditTrail, { status: 'REJECTED', timestamp: new Date().toISOString(), note: reason }]
    } : a));
    toast.info('Approval request rejected.');
  };

  const handleRequestGateOverride = (gate) => {
    const reason = prompt(`Reason for overriding ${gate.name} gate:`);
    if (!reason) return;
    requestFinanceApproval('Gate Override', 0, `Override ${gate.name} block: ${reason}`, { gateName: gate.name, reason });
  };

  const handleManualAdjustment = () => {
    if (!manualAdjustmentForm.invoiceId || !manualAdjustmentForm.amount || !manualAdjustmentForm.reason) {
      toast.error('Invoice, Amount and Reason are required');
      return;
    }
    const amountToAdjust = Number(manualAdjustmentForm.amount);
    if (amountToAdjust > advanceData.remainingAdvance) {
      toast.error('Adjustment amount cannot exceed remaining advance balance');
      return;
    }
    const newAdj = {
      id: 'ADJ-' + Date.now(),
      invoiceId: manualAdjustmentForm.invoiceId,
      amount: amountToAdjust,
      reason: manualAdjustmentForm.reason,
      date: new Date().toISOString(),
      status: 'PENDING_APPROVAL',
      type: 'MANUAL'
    };
    setAdvanceAdjustments(prev => [newAdj, ...prev]);
    setManualAdjustmentModalOpen(false);
    setManualAdjustmentForm({ invoiceId: '', amount: '', reason: '' });
    toast.success('Manual Adjustment submitted for approval.');
  };

  const handleGenerateInvoice = () => {
    if (!invoiceForm.amount || !invoiceForm.type) {
      toast.error('Amount and Type are required');
      return;
    }
    
    // Auto Calculate GST
    const baseAmount = Number(invoiceForm.amount);
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;
    
    if (invoiceForm.type === 'TAX_INVOICE') {
      const taxAmount = baseAmount * (Number(invoiceForm.gstRate) / 100);
      if (invoiceForm.gstType === 'CGST_SGST') {
        cgstAmount = taxAmount / 2;
        sgstAmount = taxAmount / 2;
      } else {
        igstAmount = taxAmount;
      }
    }
    
    const exactTotal = baseAmount + cgstAmount + sgstAmount + igstAmount;
    const grandTotal = Math.round(exactTotal);
    const roundOffAmount = grandTotal - exactTotal;

    const newInvoice = {
      id: 'INV-' + Date.now(),
      type: invoiceForm.type,
      milestoneId: invoiceForm.milestoneId,
      amount: baseAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      exactTotal,
      grandTotal,
      roundOffAmount,
      gstRate: invoiceForm.gstRate,
      gstType: invoiceForm.gstType,
      hsnSac: invoiceForm.hsnSac,
      customerGst: invoiceForm.customerGst,
      date: invoiceForm.invoiceDate,
      status: 'ISSUED',
      version: 1,
      customerName: project?.customer_name || 'Customer',
      projectName: project?.name || 'Project'
    };
    setInvoices(prev => [newInvoice, ...prev]);
    appendAuditLog('Generate Invoice', 'Invoice', 0, newInvoice.grandTotal, `Generated ${newInvoice.type}`);
    toast.success(`${invoiceForm.type.replace('_', ' ')} generated successfully!`);
    
    // Auto Advance Adjustment Logic
    if (invoiceForm.type === 'TAX_INVOICE' && advanceData.remainingAdvance > 0) {
      const adjustmentAmount = Math.min(grandTotal, advanceData.remainingAdvance);
      const newAdjustment = {
        id: 'ADJ-' + Date.now(),
        invoiceId: newInvoice.id,
        amount: adjustmentAmount,
        reason: 'Auto-adjusted against Advance on Invoice Generation',
        date: new Date().toISOString(),
        status: 'APPROVED',
        type: 'AUTO'
      };
      setAdvanceAdjustments(prev => [newAdjustment, ...prev]);
      toast.info(`₹${adjustmentAmount.toLocaleString('en-IN')} automatically adjusted from Advance Balance.`);
    }

    setInvoiceModalOpen(false);
  };

  const handlePrintPDF = (inv) => {
    setPrintingInvoice(inv);
    setTimeout(() => {
      window.print();
      setPrintingInvoice(null);
    }, 500);
  };

  // Payment Links States
  const [paymentLinks, setPaymentLinks] = useState([]);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkForm, setLinkForm] = useState({ expiryDays: 3 });
  const [selectedMilestoneForLink, setSelectedMilestoneForLink] = useState(null);

  // Credit Note & Refund States
  const [creditNotes, setCreditNotes] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [creditNoteModalOpen, setCreditNoteModalOpen] = useState(false);
  const [creditNoteSubmitting, setCreditNoteSubmitting] = useState(false);
  const [creditNoteForm, setCreditNoteForm] = useState({ subtotal: '', gstType: 'cgst_sgst', gstRate: 18.00, reason: '', notes: '' });

  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundForm, setRefundForm] = useState({ amount: '', paymentMethod: 'Bank Transfer', referenceNumber: '', reason: '', notes: '' });

  // Debit Note States
  const [debitNotes, setDebitNotes] = useState([]);
  const [debitNoteModalOpen, setDebitNoteModalOpen] = useState(false);
  const [debitNoteForm, setDebitNoteForm] = useState({ invoiceId: '', amount: '', reason: '', notes: '' });

  const handleIssueDebitNote = () => {
    if (!debitNoteForm.invoiceId || !debitNoteForm.amount || !debitNoteForm.reason) {
      toast.error('Invoice, Amount and Reason are required');
      return;
    }
    const newNote = {
      id: 'DN-' + Date.now(),
      debit_note_number: 'DN-' + Math.floor(1000 + Math.random() * 9000),
      invoice_id: debitNoteForm.invoiceId,
      amount: Number(debitNoteForm.amount),
      reason: debitNoteForm.reason,
      notes: debitNoteForm.notes,
      debit_note_date: new Date().toISOString(),
      status: 'APPROVED'
    };
    requestFinanceApproval('Debit Note', newNote.amount, newNote.reason, { newNote });
    setDebitNoteModalOpen(false);
    setDebitNoteForm({ invoiceId: '', amount: '', reason: '', notes: '' });
  };

  // Customer Portal States
  const [isCustomerPortalView, setIsCustomerPortalView] = useState(false);
  const [isPortalAuthenticated, setIsPortalAuthenticated] = useState(false);
  const [portalPin, setPortalPin] = useState('');

  // Reminder Engine States
  const [reminderLogs, setReminderLogs] = useState([]);

  const handleDispatchReminder = (milestoneId, milestoneName, ruleKey) => {
    // Simulate sending email/sms/whatsapp
    toast.success(`Automated Email, SMS, and WhatsApp dispatched for ${milestoneName} (${ruleKey})`);
    const newLog = {
      id: 'REM-' + Date.now(),
      milestoneId,
      milestoneName,
      ruleKey,
      sentAt: new Date().toISOString(),
      channels: ['Email', 'SMS', 'WhatsApp']
    };
    setReminderLogs(prev => [newLog, ...prev]);
  };

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
        const _r = res.data?.data || res.data; 
        let raw = Array.isArray(_r) ? _r : [];
        
        const totalB = project?.contract_value || 5953277;
        
        const defaultMilestoneConfig = [
          { key: 'booking', name: 'Booking', percentage: 10, enabled: true, dependency: null },
          { key: 'design', name: 'Design Advance', percentage: 15, enabled: true, dependency: 'booking' },
          { key: 'production', name: 'Production', percentage: 40, enabled: true, dependency: 'design advance' },
          { key: 'dispatch', name: 'Dispatch', percentage: 20, enabled: true, dependency: 'production' },
          { key: 'installation', name: 'Installation', percentage: 10, enabled: true, dependency: 'dispatch' },
          { key: 'handover', name: 'Final Handover', percentage: 5, enabled: true, dependency: 'installation' }
        ];

        const adminConfig = project?.milestone_config || defaultMilestoneConfig;
        const activeMilestones = adminConfig.filter(m => m.enabled);

        // Inject missing full lifecycle milestones
        activeMilestones.forEach((mConf, index) => {
          const exists = raw.some(p => (p.title || p.milestone || p.name)?.toLowerCase().includes(mConf.name.toLowerCase()) || p.id?.includes(mConf.key));
          if (!exists) {
            let mockDate = new Date(project?.createdAt || Date.now());
            mockDate.setDate(mockDate.getDate() + (index * 15));
            const mockEntry = {
              id: `mock_m_${mConf.key}_${index}`,
              title: mConf.name || mConf.key,
              phase: 'Project Lifecycle',
              amount: (totalB * mConf.percentage) / 100,
              due_date: mockDate.toISOString().split('T')[0],
              status: index === 0 ? 'pending' : 'scheduled',
              dependency: mConf.dependency
            };
            if (index === 0) raw.unshift(mockEntry); // Booking at top
            else raw.push(mockEntry); // Rest appended
          }
        });

        setPayments(raw.map(p => {
          const entries = p.payment_entries || [];
          if (p.status === 'paid' && entries.length === 0) {
             entries.push({
               id: p.id + '_legacy',
               amount: Number(p.amount || p.paid_amount || 0),
               paidAt: p.paid_at || new Date().toISOString(),
               mode: p.payment_mode || 'Bank Transfer',
               collectedByName: p.collected_by_name,
               collectedByRole: p.collected_by_role
             });
          }
          const collectedAmount = entries.reduce((s, e) => s + Number(e.amount || 0), 0);
          const amountValue = Number(p.amount || 0);
          const remainingAmount = amountValue - collectedAmount;
          let derivedStatus = p.status || 'scheduled';
          if (collectedAmount >= amountValue) derivedStatus = 'paid';
          else if (collectedAmount > 0) derivedStatus = 'partially_paid';

          return {
            id: p.id,
            milestone: p.title || p.milestone || p.name,
            phase: p.phase_name || p.phase || '—',
            amountValue,
            collectedAmount,
            remainingAmount,
            paymentEntries: entries,
            dueDate: p.due_date ? p.due_date.split('T')[0] : null,
            status: derivedStatus,
            dependency: p.dependency || null,
            invoiceReference: p.invoice_reference || null,
            tdsRate: Number(p.tds_rate || 0),
            tdsAmount: Number(p.tds_amount || 0)
          };
        }));
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
  
  const totalPaid = payments.reduce((sum, p) => sum + (p.collectedAmount || 0), 0);
  const outstandingBalance = totalBudget - totalPaid;
  
  const today = new Date().toISOString().split('T')[0];
  const processedPayments = payments.map(p => {
    let daysOverdue = 0;
    
    // Check if dependencies are met
    const dependencyMet = !p.dependency || payments.some(pm => 
      pm.status === 'paid' && (pm.milestone.toLowerCase().includes(p.dependency.toLowerCase()) || pm.id === p.dependency)
    );

    if (p.status !== 'paid' && p.status !== 'cancelled' && p.dueDate && p.dueDate < today) {
      const diffTime = Math.abs(new Date(today) - new Date(p.dueDate));
      daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const activeEscalation = escalations.find(e => e.payment_milestone_id === p.id && e.status === 'active');
      return { ...p, displayStatus: 'overdue', isOverdue: true, daysOverdue, activeEscalation, dependencyMet };
    }
    return { ...p, displayStatus: p.status, isOverdue: false, daysOverdue: 0, dependencyMet };
  });

  const handleMarkPaidClick = (p) => {
    setSelectedPayment(p);
    setTdsRate(0);
    setTdsAmount(0);
    setSplitPayments([{
      id: Date.now(),
      amount: p.remainingAmount || 0,
      mode: 'Bank Transfer',
      date: new Date().toISOString().split('T')[0],
      reference: ''
    }]);
    setCollectedBy('');
    setModalOpen(true);
  };

  const handleAddSplit = () => {
    setSplitPayments(prev => [...prev, {
      id: Date.now(), amount: 0, mode: 'Bank Transfer', date: new Date().toISOString().split('T')[0], reference: ''
    }]);
  };
  
  const handleSplitChange = (id, field, value) => {
    setSplitPayments(prev => prev.map(sp => sp.id === id ? { ...sp, [field]: value } : sp));
  };

  const handleRemoveSplit = (id) => {
    setSplitPayments(prev => prev.filter(sp => sp.id !== id));
  };

  const handleConfirmPaid = async () => {
    if (!collectedBy) {
      toast.error('Please specify who collected the payment');
      return;
    }
    try {
      const totalSplitAmount = splitPayments.reduce((s, sp) => s + Number(sp.amount || 0), 0);
      if (totalSplitAmount <= 0) {
        toast.error('Total payment amount must be greater than zero');
        return;
      }
      if (totalSplitAmount > (selectedPayment.remainingAmount || 0)) {
        toast.error('Total split amount cannot exceed remaining amount');
        return;
      }

      // Intercept for Online Gateways
      const onlineGatewaySplitIndex = splitPayments.findIndex(sp => sp.mode === 'Cashfree Gateway' || sp.mode === 'Razorpay Gateway');
      let processedSplits = [...splitPayments];

      if (onlineGatewaySplitIndex !== -1) {
        const gwSplit = processedSplits[onlineGatewaySplitIndex];
        const gatewayName = gwSplit.mode === 'Cashfree Gateway' ? 'cashfree' : 'razorpay';
        
        try {
          const result = await PaymentGatewayService.initialize(gatewayName, {
            amount: gwSplit.amount,
            milestoneName: selectedPayment.milestone,
            projectId
          });
          
          if (result.success) {
             processedSplits[onlineGatewaySplitIndex] = {
               ...gwSplit,
               reference: result.reference
             };
             toast.success(result.message || 'Payment successful');
          }
        } catch (error) {
          toast.error(error.message || 'Online payment failed');
          return; // Stop processing if payment fails
        }
      }

      const [colName, colRole] = collectedBy.split('|');
      
      const newEntries = processedSplits.map((sp, index) => ({
        id: Date.now().toString() + '-' + index,
        amount: Number(sp.amount),
        paidAt: sp.date,
        mode: sp.mode,
        reference: sp.reference,
        collectedByName: colName,
        collectedByRole: colRole,
        tdsAmount: index === 0 ? tdsAmount : 0
      }));

      const newCollected = selectedPayment.collectedAmount + totalSplitAmount;
      let newStatus = selectedPayment.status;
      if (newCollected >= selectedPayment.amountValue) newStatus = 'paid';
      else if (newCollected > 0) newStatus = 'partially_paid';

      // Send to Finance Approval instead of executing directly
      requestFinanceApproval('Manual Payment', totalSplitAmount, `Payment for ${selectedPayment.milestone}`, {
         selectedPayment,
         splitPayments: processedSplits,
         tdsRate,
         tdsAmount,
         collectedBy,
         newEntries,
         newStatus,
         newCollected
      });
      setModalOpen(false);
    } catch {
      toast.error('Failed to update payment');
    }
  };

  const handleConfirmRefund = async () => {
    if (!refundForm.amount || !refundForm.reason) {
      toast.error('Amount and Reason are required');
      return;
    }
    requestFinanceApproval('Refund', refundForm.amount, refundForm.reason, { form: refundForm });
    setRefundModalOpen(false);
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

  const handleGenerateLinkClick = (p) => {
    setSelectedMilestoneForLink(p);
    setLinkForm({ expiryDays: 3 });
    setLinkModalOpen(true);
  };

  const handleConfirmGenerateLink = () => {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + Number(linkForm.expiryDays));
    
    const newLink = {
      id: 'pl_' + Date.now(),
      milestoneId: selectedMilestoneForLink.id,
      milestoneName: selectedMilestoneForLink.milestone,
      amount: selectedMilestoneForLink.remainingAmount,
      url: `https://pay.crm.com/pay/${Date.now().toString(36)}`,
      status: 'sent', 
      createdAt: new Date().toISOString(),
      expiry: expiryDate.toISOString(),
      customerName: project?.customer_name || 'Customer'
    };
    
    setPaymentLinks(prev => [newLink, ...prev]);
    appendAuditLog('Generate Link', 'Payment Link', 0, newLink.amount, 'System generated secure payment link');
    toast.success('Secure Payment Link Generated and Sent!');
    setLinkModalOpen(false);
  };

  const handleCancelLink = (linkId) => {
    setPaymentLinks(prev => prev.map(l => l.id === linkId ? { ...l, status: 'cancelled' } : l));
    toast.success('Payment link cancelled');
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

  const paidLogs = [];
  payments.forEach(p => {
    (p.paymentEntries || []).forEach(entry => {
      paidLogs.push({ ...entry, milestoneName: p.milestone, milestoneId: p.id });
    });
  });
  paidLogs.sort((a, b) => new Date(b.paidAt || 0) - new Date(a.paidAt || 0));

  // --- Dynamic Ledger Computation ---
  const ledgerData = React.useMemo(() => {
    const entries = [];
    
    invoices.forEach(inv => {
      entries.push({ id: inv.id, date: new Date(inv.date), type: 'Invoice', ref: inv.id, debit: inv.amount, credit: 0 });
    });
    
    paidLogs.forEach(log => {
      entries.push({ id: log.id, date: new Date(log.paidAt), type: 'Payment', ref: log.reference || 'N/A', debit: 0, credit: log.amount });
    });
    
    refunds.forEach(ref => {
      entries.push({ id: ref.id, date: new Date(ref.refund_date), type: 'Refund', ref: ref.refund_number, debit: ref.amount, credit: 0 });
    });
    
    creditNotes.forEach(cn => {
      entries.push({ id: cn.id, date: new Date(cn.credit_note_date), type: 'Credit Note', ref: cn.credit_note_number, debit: 0, credit: cn.total_amount });
    });

    debitNotes.filter(dn => dn.status === 'APPROVED').forEach(dn => {
      entries.push({ id: dn.id, date: new Date(dn.debit_note_date), type: 'Debit Note', ref: dn.debit_note_number, debit: dn.amount, credit: 0 });
    });

    advanceAdjustments.filter(adj => adj.status === 'APPROVED').forEach(adj => {
      entries.push({ id: adj.id, date: new Date(adj.date), type: 'Advance Adjustment', ref: `Inv: ${adj.invoiceId}`, debit: 0, credit: 0 });
    });

    entries.sort((a, b) => a.date - b.date);

    let runningBalance = 0; // Opening balance 0 for demo
    
    const computed = entries.map(entry => {
      runningBalance = runningBalance + entry.debit - entry.credit;
      return { ...entry, balance: runningBalance };
    });
    
    if (ledgerFilterType !== 'ALL') {
      return computed.filter(c => c.type.toUpperCase() === ledgerFilterType);
    }
    
    return computed.reverse(); // Show latest first in UI
  }, [invoices, paidLogs, refunds, creditNotes, debitNotes, advanceAdjustments, ledgerFilterType]);

  const handleExportLedgerCSV = () => {
    const headers = ['Date', 'Type', 'Reference', 'Debit (INR)', 'Credit (INR)', 'Balance (INR)'];
    const rows = ledgerData.map(r => [
      r.date.toLocaleDateString('en-IN'),
      r.type,
      r.ref,
      r.debit,
      r.credit,
      r.balance
    ]);
    
    let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Customer_Ledger_${projectId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  // ----------------------------------

  // --- Receivables Management Computation ---
  const receivablesData = React.useMemo(() => {
    let outstanding = 0;
    let currentDue = 0;
    let overdue = 0;
    let futureDue = 0;
    
    let aging0_30 = 0;
    let aging31_60 = 0;
    let aging61_90 = 0;
    let aging90Plus = 0;
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(today.getDate() + 7);

    const approvedDebitNotesAmount = debitNotes
      .filter(dn => dn.status === 'APPROVED')
      .reduce((sum, dn) => sum + Number(dn.amount), 0);

    outstanding += approvedDebitNotesAmount;
    currentDue += approvedDebitNotesAmount; // Assuming debit notes are due immediately

    const approvedAdjustmentsAmount = advanceAdjustments
      .filter(adj => adj.status === 'APPROVED')
      .reduce((sum, adj) => sum + Number(adj.amount), 0);

    outstanding -= approvedAdjustmentsAmount;
    currentDue -= approvedAdjustmentsAmount; // Reduce current due as well

    payments.forEach(p => {
      const remaining = Number(p.remainingAmount) || 0;
      if (remaining <= 0) return;
      
      outstanding += remaining;
      
      if (!p.dueDate) {
        futureDue += remaining; // Treat no due date as future
        return;
      }
      
      const due = new Date(p.dueDate);
      due.setHours(0,0,0,0);
      
      if (due < today) {
        overdue += remaining;
        // Aging
        const diffTime = Math.abs(today - due);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 30) aging0_30 += remaining;
        else if (diffDays <= 60) aging31_60 += remaining;
        else if (diffDays <= 90) aging61_90 += remaining;
        else aging90Plus += remaining;
      } else if (due >= today && due <= sevenDaysFromNow) {
        currentDue += remaining;
      } else {
        futureDue += remaining;
      }
    });

    return { outstanding, currentDue, overdue, futureDue, aging0_30, aging31_60, aging61_90, aging90Plus };
  }, [payments]);
  // ----------------------------------

  // --- Automated Reminder Engine ---
  const pendingReminders = React.useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const queue = [];

    payments.forEach(p => {
      const remaining = Number(p.remainingAmount) || 0;
      if (remaining <= 0 || !p.dueDate) return;

      const due = new Date(p.dueDate);
      due.setHours(0,0,0,0);
      const diffTime = today - due;
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)); // positive means overdue, negative means future

      const rules = [
        { days: -7, key: '7_DAYS_BEFORE', label: '7 Days Before Due' },
        { days: -3, key: '3_DAYS_BEFORE', label: '3 Days Before Due' },
        { days: -1, key: '1_DAY_BEFORE', label: '1 Day Before Due' },
        { days: 0, key: 'DUE_DATE', label: 'Due Today' },
        { days: 3, key: '3_DAYS_OVERDUE', label: '3 Days Overdue' },
        { days: 7, key: '7_DAYS_OVERDUE', label: '7 Days Overdue' },
        { days: 15, key: '15_DAYS_OVERDUE', label: '15 Days Overdue' },
      ];

      rules.forEach(rule => {
        if (diffDays === rule.days) {
          // Check if already sent
          const alreadySent = reminderLogs.some(log => log.milestoneId === p.id && log.ruleKey === rule.key);
          if (!alreadySent) {
            queue.push({
              milestoneId: p.id,
              milestoneName: p.milestone,
              remainingAmount: remaining,
              ruleKey: rule.key,
              ruleLabel: rule.label,
              dueDate: p.dueDate
            });
          }
        }
      });
    });
    return queue;
  }, [payments, reminderLogs]);

  const handleManualResend = (log) => {
    toast.success(`Resending ${log.ruleKey} reminder for ${log.milestoneName} via Email, SMS & WhatsApp`);
  };
  // ----------------------------------

  if (loading) {
    return <div style={{ padding: '32px', color: 'var(--color-text-muted)' }}>Loading payments…</div>;
  }

  if (isCustomerPortalView) {
    if (!isPortalAuthenticated) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', background: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)', minHeight: '60vh' }}>
           <h2 style={{ marginBottom: '8px' }}>Customer Payment Portal</h2>
           <p style={{ color: 'var(--color-text-muted)', marginBottom: '24px' }}>Please enter your 4-digit security PIN to view your project.</p>
           <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
             <Input type="password" placeholder="PIN" maxLength={4} style={{ width: '120px', textAlign: 'center', letterSpacing: '4px' }} value={portalPin} onChange={e => setPortalPin(e.target.value)} />
           </div>
           <div style={{ display: 'flex', gap: '16px' }}>
             <Button variant="outline" onClick={() => setIsCustomerPortalView(false)}>Exit to Admin</Button>
             <Button onClick={() => {
               if(portalPin === '1234') { setIsPortalAuthenticated(true); toast.success('Securely Authenticated'); }
               else { toast.error('Invalid PIN'); }
             }}>Authenticate Securely</Button>
           </div>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '24px', background: '#f8fafc', borderRadius: '16px', minHeight: '80vh' }}>
        
        {/* Portal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#ffffff', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div>
            <h2 style={{ margin: '0 0 4px 0', color: '#0f172a' }}>Hello, {project?.customer_name || 'Customer'}!</h2>
            <div style={{ color: '#64748b', fontSize: '14px' }}>Project: {project?.name || 'Your Interior Project'}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Outstanding</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#ca8a04' }}>₹{outstandingBalance > 0 ? outstandingBalance.toLocaleString('en-IN') : 0}</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Out of ₹{totalBudget.toLocaleString('en-IN')} Budget</div>
          </div>
        </div>

        {/* Action Bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
           <Button variant="outline" size="sm" onClick={() => { setIsCustomerPortalView(false); setIsPortalAuthenticated(false); setPortalPin(''); }}>Exit Portal (Admin Only)</Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          
          {/* Left Column: Timeline */}
          <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 24px 0', fontSize: '16px', color: '#1e293b' }}>Payment Timeline</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {payments.map((p, idx) => {
                const isPaid = Number(p.remainingAmount) === 0 && Number(p.amount) > 0;
                const isPending = Number(p.remainingAmount) > 0;
                
                return (
                  <div key={p.id} style={{ display: 'flex', gap: '16px', position: 'relative' }}>
                    {/* Timeline Line */}
                    {idx !== payments.length - 1 && (
                      <div style={{ position: 'absolute', left: '11px', top: '24px', bottom: '-20px', width: '2px', background: isPaid ? '#22c55e' : '#e2e8f0' }} />
                    )}
                    
                    {/* Status Dot */}
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: isPaid ? '#22c55e' : (isPending ? '#eab308' : '#e2e8f0'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 }}>
                      {isPaid && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                    </div>
                    
                    {/* Content */}
                    <div style={{ flex: 1, paddingBottom: '16px', borderBottom: idx !== payments.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <div style={{ fontWeight: 600, color: '#334155' }}>{p.milestone}</div>
                         <div style={{ fontWeight: 700, color: '#0f172a' }}>₹{Number(p.amount).toLocaleString('en-IN')}</div>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                         <div style={{ fontSize: '13px', color: '#64748b' }}>
                           {p.dueDate ? `Due: ${new Date(p.dueDate).toLocaleDateString('en-IN')}` : 'TBD'}
                         </div>
                         {isPaid ? (
                           <Badge variant="success" size="sm">Paid</Badge>
                         ) : (
                           isPending && <Button size="sm" onClick={() => toast.info('Redirecting to Cashfree secure checkout...')}>Pay Online Now</Button>
                         )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right Column: Invoices & Receipts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1e293b' }}>My Invoices & Receipts</h3>
              {invoices.length === 0 ? (
                <div style={{ fontSize: '14px', color: '#94a3b8' }}>No documents available yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {invoices.map(inv => (
                    <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>{inv.type.replace('_', ' ')}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>₹{inv.amount.toLocaleString('en-IN')}</div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handlePrintPDF(inv)}>Download PDF</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* Header Section as a standard card */}
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            Financial Overview
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--color-text-muted)' }}>Simulate Role:</span>
              <select value={simulateRole} onChange={e => setSimulateRole(e.target.value)} style={{ padding: '2px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                {Object.keys(permissionsConfig).map(role => (
                   <option key={role} value={role}>{role.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setIsCustomerPortalView(true)}>
            Preview Customer Portal
          </Button>
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

          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Area
            </div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text)' }}>
              {totalArea} sqft
            </div>
          </div>

          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Outstanding Balance
            </div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: '#eab308' }}>
              ₹{outstandingBalance > 0 ? outstandingBalance.toLocaleString('en-IN') : 0}
            </div>
          </div>

        </div>
      </div>

      {/* Sub-Tabs */}
      <div className={styles.subTabsContainer}>
        {['breakdown', 'logs', 'audit_logs', 'milestones', 'gates', 'links', 'invoices', 'receipts', 'ledger', 'receivables', 'reminders', 'credits', 'approvals', ...(simulateRole === 'Admin' ? ['rbac'] : [])].map(tab => (
          <button
            key={tab}
            className={`${styles.subTab} ${activeSubTab === tab ? styles.subTabActive : ''}`}
            onClick={() => setActiveSubTab(tab)}
          >
            {tab === 'breakdown' ? 'Cost Breakdown' : 
             tab === 'logs' ? 'History' : 
             tab === 'audit_logs' ? 'Audit Logs' : 
             tab === 'milestones' ? 'Milestones' : 
             tab === 'gates' ? 'Financial Gates' : 
             tab === 'links' ? 'Links' : 
             tab === 'invoices' ? 'Invoices' :
             tab === 'receipts' ? 'Receipts' :
             tab === 'ledger' ? 'Ledger' : 
             tab === 'receivables' ? 'Receivables' : 
             tab === 'reminders' ? 'Reminders' : 
             tab === 'credits' ? 'Credits/Refunds' :
             tab === 'approvals' ? 'Approvals' : 'RBAC Config'}
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

        {activeSubTab === 'audit_logs' && (
          <div className={styles.logsList}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: 0 }}>Immutable Audit Logs</h4>
                <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
                   <Select value={auditLogFilter} onChange={setAuditLogFilter} options={[
                     {value:'ALL', label:'All Records'},
                     {value:'Invoice', label:'Invoices'},
                     {value:'Payment', label:'Payments'},
                     {value:'Refund', label:'Refunds'},
                     {value:'Credit Note', label:'Credit Notes'},
                     {value:'Debit Note', label:'Debit Notes'}
                   ]} />
                </div>
             </div>
             
             {auditLogs.filter(l => auditLogFilter === 'ALL' || l.financialObject === auditLogFilter || l.action.includes(auditLogFilter)).length === 0 ? (
               <div className={styles.emptyState}>No audit logs found.</div>
             ) : (
               <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                 <thead>
                   <tr style={{ background: 'var(--color-surface-hover)', textAlign: 'left' }}>
                     <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)' }}>Timestamp</th>
                     <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)' }}>User / Role</th>
                     <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)' }}>Action</th>
                     <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)' }}>Object</th>
                     <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)' }}>Old Value</th>
                     <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)' }}>New Value</th>
                     <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)' }}>Network Info</th>
                     <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)' }}>Reason</th>
                   </tr>
                 </thead>
                 <tbody>
                   {auditLogs.filter(l => auditLogFilter === 'ALL' || l.financialObject === auditLogFilter || l.action.includes(auditLogFilter)).map(log => (
                     <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                       <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>{new Date(log.timestamp).toLocaleString('en-IN')}</td>
                       <td style={{ padding: '12px', fontWeight: 600 }}>{log.user.replace('_', ' ')}</td>
                       <td style={{ padding: '12px' }}><Badge size="sm" variant="neutral">{log.action}</Badge></td>
                       <td style={{ padding: '12px' }}>{log.financialObject}</td>
                       <td style={{ padding: '12px', color: 'var(--color-text-muted)' }}>{log.oldValue !== undefined ? `₹${log.oldValue.toLocaleString()}` : '-'}</td>
                       <td style={{ padding: '12px', fontWeight: 600 }}>{log.newValue !== undefined ? `₹${log.newValue.toLocaleString()}` : '-'}</td>
                       <td style={{ padding: '12px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                         IP: {log.ip}<br/>
                         {log.device}
                       </td>
                       <td style={{ padding: '12px' }}>{log.reason}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             )}
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
                    <span className={styles.logMilestone}>{log.milestoneName}</span>
                    <span className={styles.logAmount}>₹{Number(log.amount).toLocaleString('en-IN')}</span>
                  </div>
                  <div className={styles.logDetails}>
                    <div className={styles.logDetailItem}>
                      <span className={styles.logIcon}>📅</span>
                      <span>Paid on {log.paidAt ? new Date(log.paidAt).toLocaleDateString('en-IN') : '—'}</span>
                    </div>
                    <div className={styles.logDetailItem}>
                      <span className={styles.logIcon}>💳</span>
                      <span>Mode: {log.mode || '—'} {log.reference ? `(Ref: ${log.reference})` : ''}</span>
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
            <div style={{ padding: '20px', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', marginBottom: '16px' }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: '16px', color: 'var(--color-text)' }}>Milestone Progress Timeline</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {processedPayments.map((p) => (
                  <div key={`tl-${p.id}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ 
                      height: '6px', 
                      background: p.status === 'paid' ? '#10b981' : (p.status === 'partially_paid' ? '#eab308' : (p.isOverdue ? '#ef4444' : 'var(--color-border)')), 
                      borderRadius: '3px',
                      opacity: (!p.dependencyMet && p.status !== 'paid' && p.status !== 'partially_paid') ? 0.3 : 1
                    }}></div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.milestone}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {processedPayments.map(p => (
              <div key={p.id} className={`${styles.milestoneCard} ${p.isOverdue ? styles.milestoneOverdue : ''}`} style={(!p.dependencyMet && p.status !== 'paid' && p.status !== 'partially_paid') ? { opacity: 0.7 } : {}}>
                <div className={styles.mCardHeader}>
                  <div className={styles.mCardTitle}>
                    {p.milestone} 
                    {!p.dependencyMet && p.status !== 'paid' && p.status !== 'partially_paid' && <span style={{fontSize: '12px', marginLeft: '8px', color: 'var(--color-text-muted)'}}>🔒 (Locked)</span>}
                  </div>
                  <Badge variant={p.displayStatus === 'paid' ? 'success' : (p.displayStatus === 'partially_paid' ? 'warning' : (p.isOverdue ? 'danger' : 'neutral'))} size="sm">
                    {p.displayStatus.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
                <div className={styles.mCardBody}>
                  <div className={styles.mCardCol}>
                    <span className={styles.mCardLabel}>Amount</span>
                    <span className={styles.mCardValue}>₹{p.amountValue.toLocaleString('en-IN')}</span>
                    {p.collectedAmount > 0 && <span style={{fontSize: '12px', color: '#10b981', marginTop: '2px'}}>Collected: ₹{p.collectedAmount.toLocaleString('en-IN')}</span>}
                  </div>
                  <div className={styles.mCardCol}>
                    <span className={styles.mCardLabel}>Due Date</span>
                    <span className={styles.mCardValue}>{p.dueDate || '—'}</span>
                  </div>
                </div>
                <div className={styles.mCardFooter}>
                  {p.status !== 'paid' && hasPermission('Create') && (
                    <Button 
                      variant="primary" 
                      size="sm" 
                      onClick={() => handleMarkPaidClick(p)}
                      disabled={!p.dependencyMet}
                      style={!p.dependencyMet ? {opacity: 0.5, cursor: 'not-allowed'} : {}}
                    >
                      {p.dependencyMet ? 'Collect Payment' : 'Dependency Pending'}
                    </Button>
                  )}
                  {p.status !== 'paid' && p.dependencyMet && hasPermission('Create') && (
                    <Button variant="outline" size="sm" onClick={() => handleGenerateLinkClick(p)}>Generate Link</Button>
                  )}
                  {p.status !== 'paid' && p.dependencyMet && hasPermission('Create') && hasPermission('Refund') && (
                    <Button variant="ghost" size="sm" style={{ color: 'var(--color-text-muted)' }} onClick={() => handleRequestWriteOff(p)}>Write-off</Button>
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

        {activeSubTab === 'gates' && (
          <div className={styles.logsList}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ margin: 0 }}>Financial Project Gates</h4>
              <Badge variant="outline">Automated Blocker</Badge>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {financialGates.map(gate => (
                <div key={gate.id} className={styles.creditCard} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: `4px solid ${gate.status === 'CLEARED' ? '#10b981' : gate.status === 'OVERRIDDEN' ? '#f59e0b' : '#ef4444'}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <h4 style={{ margin: 0, fontSize: '16px' }}>{gate.name} Gate</h4>
                      <Badge variant={gate.status === 'CLEARED' ? 'success' : gate.status === 'OVERRIDDEN' ? 'warning' : 'danger'}>{gate.status}</Badge>
                    </div>
                    <p style={{ margin: '8px 0 0 0', color: 'var(--color-text-muted)', fontSize: '14px' }}>
                      {gate.reason}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {gate.status === 'BLOCKED' && (
                      <Button variant="outline" size="sm" onClick={() => handleRequestGateOverride(gate)}>Admin Override</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSubTab === 'links' && (
          <div className={styles.logsList}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: 0 }}>Payment Links History</h4>
             </div>
             {paymentLinks.length === 0 ? <div className={styles.emptyState}>No payment links generated.</div> : (
                paymentLinks.map(link => (
                  <div key={link.id} className={styles.creditCard}>
                    <div className={styles.cCardHeader}>
                      <span style={{fontWeight: 600}}>{link.milestoneName} - {link.customerName}</span>
                      <span className={styles.cCardAmount}>₹{Number(link.amount).toLocaleString('en-IN')}</span>
                    </div>
                    <div className={styles.cCardBody}>
                      <span>URL: <a href="#" style={{color: 'var(--color-primary)'}}>{link.url}</a></span>
                      <span>Expiry: {new Date(link.expiry).toLocaleDateString('en-IN')}</span>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                        <span>Status: <Badge variant={link.status === 'paid' ? 'success' : link.status === 'cancelled' || link.status === 'expired' ? 'danger' : link.status === 'viewed' ? 'primary' : 'neutral'} size="sm">{link.status.toUpperCase()}</Badge></span>
                        {link.status === 'sent' || link.status === 'viewed' ? (
                          <div style={{display:'flex', gap: '8px'}}>
                            <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(link.url); toast.success('Link copied'); }}>Copy Link</Button>
                            <Button variant="outline" size="sm" onClick={() => handleCancelLink(link.id)} style={{color: 'var(--color-danger)', borderColor: 'var(--color-danger)'}}>Cancel Link</Button>
                          </div>
                        ) : link.status === 'expired' || link.status === 'cancelled' ? (
                          hasPermission('Create') ? <Button variant="outline" size="sm" onClick={() => handleGenerateLinkClick({id: link.milestoneId, milestone: link.milestoneName, remainingAmount: link.amount})}>Regenerate</Button> : null
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
             )}
          </div>
        )}

        {activeSubTab === 'invoices' && (
          <div className={styles.logsList}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: 0 }}>Invoice History</h4>
                <Button variant="primary" size="sm" onClick={() => setInvoiceModalOpen(true)}>Generate Invoice</Button>
             </div>
             {invoices.length === 0 ? <div className={styles.emptyState}>No invoices generated.</div> : (
                invoices.map(inv => (
                  <div key={inv.id} className={styles.creditCard}>
                    <div className={styles.cCardHeader}>
                      <span style={{fontWeight: 600}}>{inv.id} <Badge size="sm">{inv.type.replace('_', ' ')}</Badge></span>
                      <span className={styles.cCardAmount}>₹{Number(inv.amount).toLocaleString('en-IN')}</span>
                    </div>
                    <div className={styles.cCardBody}>
                      <span>Date: {new Date(inv.date).toLocaleDateString('en-IN')}</span>
                      <span>Customer: {inv.customerName}</span>
                      <span>Milestone Ref: {inv.milestoneId || 'General'}</span>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                        <span>Status: <Badge variant="success" size="sm">{inv.status}</Badge> | Version: {inv.version}</span>
                        <Button variant="outline" size="sm" onClick={() => handlePrintPDF(inv)}>Download PDF</Button>
                      </div>
                    </div>
                  </div>
                ))
             )}
          </div>
        )}

        {activeSubTab === 'receipts' && (
          <div className={styles.logsList}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: 0 }}>Payment Receipts</h4>
             </div>
             {receipts.length === 0 ? <div className={styles.emptyState}>No receipts generated yet.</div> : (
                receipts.map(rec => (
                  <div key={rec.id} className={styles.creditCard}>
                    <div className={styles.cCardHeader}>
                      <span style={{fontWeight: 600}}>{rec.id} <Badge size="sm">Receipt</Badge></span>
                      <span className={styles.cCardAmount}>₹{Number(rec.amount).toLocaleString('en-IN')}</span>
                    </div>
                    <div className={styles.cCardBody}>
                      <span>Date: {new Date(rec.receiptDate).toLocaleDateString('en-IN')}</span>
                      <span>Customer: {rec.customerName}</span>
                      <span>Milestone: {rec.milestoneName}</span>
                      <span>Payment Method: {rec.paymentMode}</span>
                      <span>Ref: {rec.reference}</span>
                    </div>
                    <div className={styles.cCardFooter}>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <Button variant="outline" size="sm" onClick={() => {
                          setPrintingReceipt(rec);
                          setTimeout(() => window.print(), 100);
                        }}>Download PDF</Button>
                        <Button variant="outline" size="sm" onClick={() => toast.success('Receipt emailed to customer!')}>Email</Button>
                        <Button variant="outline" size="sm" style={{borderColor: '#25D366', color: '#25D366'}} onClick={() => toast.success('Receipt sent via WhatsApp!')}>WhatsApp</Button>
                      </div>
                    </div>
                  </div>
                ))
             )}
          </div>
        )}

        {activeSubTab === 'ledger' && (
          <div className={styles.logsList}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: 0 }}>Customer Ledger</h4>
                <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
                   <Select value={ledgerFilterType} onChange={setLedgerFilterType} options={[
                     {value:'ALL', label:'All Entries'},
                     {value:'INVOICE', label:'Invoices'},
                     {value:'PAYMENT', label:'Payments'},
                     {value:'REFUND', label:'Refunds'},
                     {value:'CREDIT NOTE', label:'Credit Notes'}
                   ]} />
                   {hasPermission('Export') && <Button variant="outline" size="sm" onClick={handleExportLedgerCSV}>Export CSV</Button>}
                </div>
             </div>
             
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
               <div style={{ background: 'var(--color-surface-hover)', padding: '16px', borderRadius: '8px' }}>
                 <div style={{fontSize: '12px', color:'var(--color-text-muted)'}}>Opening Balance</div>
                 <div style={{fontSize: '18px', fontWeight: 700}}>₹0</div>
               </div>
               <div style={{ background: 'var(--color-surface-hover)', padding: '16px', borderRadius: '8px' }}>
                 <div style={{fontSize: '12px', color:'var(--color-text-muted)'}}>Total Debits (Invoices/Refunds)</div>
                 <div style={{fontSize: '18px', fontWeight: 700, color: 'var(--color-danger)'}}>₹{ledgerData.reduce((s, a) => s + a.debit, 0).toLocaleString('en-IN')}</div>
               </div>
               <div style={{ background: 'var(--color-surface-hover)', padding: '16px', borderRadius: '8px' }}>
                 <div style={{fontSize: '12px', color:'var(--color-text-muted)'}}>Total Credits (Payments/CN)</div>
                 <div style={{fontSize: '18px', fontWeight: 700, color: 'var(--color-success)'}}>₹{ledgerData.reduce((s, a) => s + a.credit, 0).toLocaleString('en-IN')}</div>
               </div>
               <div style={{ background: 'var(--color-surface-hover)', padding: '16px', borderRadius: '8px' }}>
                 <div style={{fontSize: '12px', color:'var(--color-text-muted)'}}>Closing Balance</div>
                 <div style={{fontSize: '18px', fontWeight: 700, color: '#0284c7'}}>₹{ledgerData.reduce((s, a) => s + a.debit - a.credit, 0).toLocaleString('en-IN')}</div>
               </div>
             </div>

             <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
               <thead>
                 <tr style={{ background: 'var(--color-surface-hover)', textAlign: 'left' }}>
                   <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)' }}>Date</th>
                   <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)' }}>Particulars (Type & Ref)</th>
                   <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)', textAlign: 'right' }}>Debit (₹)</th>
                   <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)', textAlign: 'right' }}>Credit (₹)</th>
                   <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)', textAlign: 'right' }}>Balance (₹)</th>
                 </tr>
               </thead>
               <tbody>
                 {ledgerData.length === 0 ? (
                   <tr><td colSpan="5" style={{padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)'}}>No ledger entries found.</td></tr>
                 ) : (
                   ledgerData.map(entry => (
                     <tr key={entry.id + entry.type} style={{ borderBottom: '1px solid var(--color-border)' }}>
                       <td style={{ padding: '12px' }}>{entry.date.toLocaleDateString('en-IN')}</td>
                       <td style={{ padding: '12px' }}>
                         <div style={{ fontWeight: 600 }}>{entry.type}</div>
                         <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Ref: {entry.ref}</div>
                       </td>
                       <td style={{ padding: '12px', textAlign: 'right', color: entry.debit > 0 ? 'var(--color-danger)' : 'inherit' }}>{entry.debit > 0 ? entry.debit.toLocaleString('en-IN') : '-'}</td>
                       <td style={{ padding: '12px', textAlign: 'right', color: entry.credit > 0 ? 'var(--color-success)' : 'inherit' }}>{entry.credit > 0 ? entry.credit.toLocaleString('en-IN') : '-'}</td>
                       <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600 }}>{entry.balance.toLocaleString('en-IN')} {entry.balance > 0 ? 'Dr' : entry.balance < 0 ? 'Cr' : ''}</td>
                     </tr>
                   ))
                 )}
               </tbody>
             </table>
          </div>
        )}

        {activeSubTab === 'receivables' && (
          <div className={styles.logsList}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: 0 }}>Receivable Management Dashboard</h4>
             </div>
             
             {/* Mock Filter Bar */}
             <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                <Select label="Project" value={projectId} options={[{value: projectId, label: project?.name || 'Current Project'}]} disabled />
                <Select label="Designer" value="all" options={[{value:'all', label:'All Designers'}]} disabled />
                <Select label="Manager" value="all" options={[{value:'all', label:'All Managers'}]} disabled />
                <Select label="Branch" value="all" options={[{value:'all', label:'All Branches'}]} disabled />
                <Select label="Customer" value="all" options={[{value:'all', label: project?.customer_name || 'All Customers'}]} disabled />
             </div>

             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
               <div style={{ background: 'var(--color-surface-hover)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #64748b' }}>
                 <div style={{fontSize: '12px', color:'var(--color-text-muted)', textTransform: 'uppercase'}}>Total Outstanding</div>
                 <div style={{fontSize: '24px', fontWeight: 700}}>₹{receivablesData.outstanding.toLocaleString('en-IN')}</div>
               </div>
               <div style={{ background: 'var(--color-surface-hover)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #eab308' }}>
                 <div style={{fontSize: '12px', color:'var(--color-text-muted)', textTransform: 'uppercase'}}>Current Due</div>
                 <div style={{fontSize: '24px', fontWeight: 700, color: '#ca8a04'}}>₹{receivablesData.currentDue.toLocaleString('en-IN')}</div>
               </div>
               <div style={{ background: 'var(--color-surface-hover)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid var(--color-danger)' }}>
                 <div style={{fontSize: '12px', color:'var(--color-text-muted)', textTransform: 'uppercase'}}>Overdue</div>
                 <div style={{fontSize: '24px', fontWeight: 700, color: 'var(--color-danger)'}}>₹{receivablesData.overdue.toLocaleString('en-IN')}</div>
               </div>
               <div style={{ background: 'var(--color-surface-hover)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #0ea5e9' }}>
                 <div style={{fontSize: '12px', color:'var(--color-text-muted)', textTransform: 'uppercase'}}>Future Due</div>
                 <div style={{fontSize: '24px', fontWeight: 700, color: '#0284c7'}}>₹{receivablesData.futureDue.toLocaleString('en-IN')}</div>
               </div>
             </div>

             <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '20px' }}>
               <h5 style={{ margin: '0 0 16px 0', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overdue Aging Analysis</h5>
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                 <div style={{ background: '#fef2f2', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{fontSize: '12px', color: '#991b1b', fontWeight: 600}}>0-30 Days</div>
                    <div style={{fontSize: '18px', fontWeight: 700, color: '#7f1d1d', marginTop: '4px'}}>₹{receivablesData.aging0_30.toLocaleString('en-IN')}</div>
                 </div>
                 <div style={{ background: '#fef2f2', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{fontSize: '12px', color: '#991b1b', fontWeight: 600}}>31-60 Days</div>
                    <div style={{fontSize: '18px', fontWeight: 700, color: '#7f1d1d', marginTop: '4px'}}>₹{receivablesData.aging31_60.toLocaleString('en-IN')}</div>
                 </div>
                 <div style={{ background: '#fef2f2', padding: '12px', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{fontSize: '12px', color: '#991b1b', fontWeight: 600}}>61-90 Days</div>
                    <div style={{fontSize: '18px', fontWeight: 700, color: '#7f1d1d', marginTop: '4px'}}>₹{receivablesData.aging61_90.toLocaleString('en-IN')}</div>
                 </div>
                 <div style={{ background: '#fef2f2', padding: '12px', borderRadius: '6px', textAlign: 'center', border: '1px solid #f87171' }}>
                    <div style={{fontSize: '12px', color: '#991b1b', fontWeight: 600}}>90+ Days</div>
                    <div style={{fontSize: '18px', fontWeight: 700, color: '#7f1d1d', marginTop: '4px'}}>₹{receivablesData.aging90Plus.toLocaleString('en-IN')}</div>
                 </div>
               </div>
             </div>
          </div>
        )}

        {activeSubTab === 'reminders' && (
          <div className={styles.logsList}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: 0 }}>Automated Reminder Engine</h4>
             </div>
             
             <div style={{ marginBottom: '32px' }}>
               <h5 style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Pending Dispatch (Due Today)</h5>
               {pendingReminders.length === 0 ? (
                 <div className={styles.emptyState}>No reminders scheduled for today.</div>
               ) : (
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                   {pendingReminders.map(rem => (
                     <div key={rem.milestoneId + rem.ruleKey} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '16px', borderRadius: '8px' }}>
                       <div>
                         <div style={{ fontWeight: 600 }}>{rem.milestoneName} - ₹{rem.remainingAmount.toLocaleString('en-IN')}</div>
                         <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                           Rule: <Badge size="sm" variant={rem.ruleKey.includes('OVERDUE') ? 'danger' : 'primary'}>{rem.ruleLabel}</Badge>
                         </div>
                       </div>
                       <Button size="sm" onClick={() => handleDispatchReminder(rem.milestoneId, rem.milestoneName, rem.ruleKey)}>Dispatch Now</Button>
                     </div>
                   ))}
                 </div>
               )}
             </div>

             <div>
               <h5 style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Dispatch History Log</h5>
               {reminderLogs.length === 0 ? (
                 <div className={styles.emptyState}>No reminders dispatched yet.</div>
               ) : (
                 <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                   <thead>
                     <tr style={{ background: 'var(--color-surface-hover)', textAlign: 'left' }}>
                       <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)' }}>Date Sent</th>
                       <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)' }}>Milestone</th>
                       <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)' }}>Rule Triggered</th>
                       <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)' }}>Channels</th>
                       <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)', textAlign: 'right' }}>Actions</th>
                     </tr>
                   </thead>
                   <tbody>
                     {reminderLogs.map(log => (
                       <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                         <td style={{ padding: '12px' }}>{new Date(log.sentAt).toLocaleString('en-IN')}</td>
                         <td style={{ padding: '12px', fontWeight: 500 }}>{log.milestoneName}</td>
                         <td style={{ padding: '12px' }}><Badge size="sm">{log.ruleKey.replace(/_/g, ' ')}</Badge></td>
                         <td style={{ padding: '12px' }}>{log.channels.join(', ')}</td>
                         <td style={{ padding: '12px', textAlign: 'right' }}>
                           <Button variant="ghost" size="sm" onClick={() => handleManualResend(log)}>Resend</Button>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               )}
             </div>
          </div>
        )}

        {activeSubTab === 'credits' && (
          <div className={styles.creditsList}>
            <div className={styles.creditsSection}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: 0 }}>Advances & Adjustments</h4>
                {hasPermission('Create') && <Button variant="outline" size="sm" onClick={() => setManualAdjustmentModalOpen(true)}>Manual Override</Button>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
                <div style={{ background: 'var(--color-surface-hover)', padding: '16px', borderRadius: '8px' }}>
                  <div style={{fontSize: '12px', color:'var(--color-text-muted)'}}>Advance Balance</div>
                  <div style={{fontSize: '18px', fontWeight: 700}}>₹{advanceData.totalAdvance.toLocaleString('en-IN')}</div>
                </div>
                <div style={{ background: 'var(--color-surface-hover)', padding: '16px', borderRadius: '8px' }}>
                  <div style={{fontSize: '12px', color:'var(--color-text-muted)'}}>Adjusted Amount</div>
                  <div style={{fontSize: '18px', fontWeight: 700, color: 'var(--color-success)'}}>₹{advanceData.totalAdjusted.toLocaleString('en-IN')}</div>
                </div>
                <div style={{ background: 'var(--color-surface-hover)', padding: '16px', borderRadius: '8px' }}>
                  <div style={{fontSize: '12px', color:'var(--color-text-muted)'}}>Remaining Advance</div>
                  <div style={{fontSize: '18px', fontWeight: 700, color: '#0284c7'}}>₹{advanceData.remainingAdvance.toLocaleString('en-IN')}</div>
                </div>
              </div>

              {advanceAdjustments.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginTop: '16px' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-surface-hover)', textAlign: 'left' }}>
                      <th style={{ padding: '8px', borderBottom: '1px solid var(--color-border)' }}>Date</th>
                      <th style={{ padding: '8px', borderBottom: '1px solid var(--color-border)' }}>Invoice Ref</th>
                      <th style={{ padding: '8px', borderBottom: '1px solid var(--color-border)', textAlign: 'right' }}>Amount (₹)</th>
                      <th style={{ padding: '8px', borderBottom: '1px solid var(--color-border)', textAlign: 'center' }}>Type / Status</th>
                      <th style={{ padding: '8px', borderBottom: '1px solid var(--color-border)' }}>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {advanceAdjustments.map(adj => (
                      <tr key={adj.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '8px' }}>{new Date(adj.date).toLocaleDateString('en-IN')}</td>
                        <td style={{ padding: '8px', fontWeight: 600 }}>{adj.invoiceId}</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: 'var(--color-success)' }}>{adj.amount.toLocaleString('en-IN')}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                             <Badge size="sm" variant={adj.type === 'AUTO' ? 'primary' : 'neutral'}>{adj.type}</Badge>
                             <Badge size="sm" variant={adj.status === 'APPROVED' ? 'success' : 'warning'}>{adj.status.replace('_', ' ')}</Badge>
                             {adj.status === 'PENDING_APPROVAL' && (
                               <Button size="sm" variant="primary" onClick={() => handleApproveAdjustment(adj.id)}>Approve</Button>
                             )}
                          </div>
                        </td>
                        <td style={{ padding: '8px', fontSize: '12px', color: 'var(--color-text-muted)' }}>{adj.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className={styles.creditsSection} style={{ marginTop: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: 0 }}>Refunds</h4>
                {hasPermission('Refund') && <Button variant="outline" size="sm" onClick={() => setRefundModalOpen(true)}>Record Refund</Button>}
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
                {hasPermission('Create') && <Button variant="outline" size="sm" onClick={() => setCreditNoteModalOpen(true)}>Issue Credit Note</Button>}
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

            <div className={styles.creditsSection} style={{ marginTop: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: 0 }}>Debit Notes</h4>
                {hasPermission('Create') && <Button variant="outline" size="sm" onClick={() => setDebitNoteModalOpen(true)}>Issue Debit Note</Button>}
              </div>
              {debitNotes.length === 0 ? <div className={styles.emptyState}>No debit notes issued.</div> : (
                debitNotes.map(dn => (
                  <div key={dn.id} className={styles.creditCard} style={{ borderLeft: '4px solid var(--color-danger)' }}>
                    <div className={styles.cCardHeader}>
                      <span>{dn.debit_note_number}</span>
                      <span className={styles.cCardAmount} style={{ color: 'var(--color-danger)' }}>₹{Number(dn.amount).toLocaleString('en-IN')}</span>
                    </div>
                    <div className={styles.cCardBody}>
                      <span>Date: {new Date(dn.debit_note_date).toLocaleDateString('en-IN')}</span>
                      <span>Ref Invoice: {dn.invoice_id}</span>
                      <span>Reason: {dn.reason}</span>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                         <span>Status: <Badge variant={dn.status === 'APPROVED' ? 'success' : 'warning'} size="sm">{dn.status.replace('_', ' ')}</Badge></span>
                         <div style={{ display: 'flex', gap: '8px' }}>
                           {dn.status === 'APPROVED' && (
                             <Button size="sm" variant="outline" onClick={() => handlePrintPDF({...dn, type: 'DEBIT_NOTE'})}>Download PDF</Button>
                           )}
                         </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeSubTab === 'approvals' && (
          <div className={styles.approvalsList}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ margin: 0 }}>Finance Approvals Queue</h4>
            </div>
            
            {financeApprovals.length === 0 ? (
              <div className={styles.emptyState}>No pending approvals.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: 'var(--color-surface-hover)', textAlign: 'left' }}>
                    <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)' }}>Date</th>
                    <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)' }}>Type</th>
                    <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)' }}>Reason</th>
                    <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)', textAlign: 'right' }}>Amount (₹)</th>
                    <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)' }}>Status</th>
                    <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {financeApprovals.map(approval => (
                    <tr key={approval.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '12px' }}>{new Date(approval.date).toLocaleDateString('en-IN')}</td>
                      <td style={{ padding: '12px', fontWeight: 600 }}>{approval.type}</td>
                      <td style={{ padding: '12px', color: 'var(--color-text-muted)' }}>{approval.reason}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: '#ca8a04' }}>{approval.amount.toLocaleString('en-IN')}</td>
                      <td style={{ padding: '12px' }}>
                        <Badge size="sm" variant={approval.status === 'APPROVED' ? 'success' : (approval.status === 'REJECTED' ? 'danger' : 'warning')}>
                          {approval.status}
                        </Badge>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        {approval.status === 'PENDING' && (
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            {hasPermission('Approve') ? (
                              <>
                                <Button size="sm" variant="outline" onClick={() => handleRejectAction(approval.id)}>Reject</Button>
                                <Button size="sm" variant="primary" onClick={() => executeApprovedAction(approval)}>Approve</Button>
                              </>
                            ) : (
                               <span style={{fontSize: '12px', color: 'var(--color-text-muted)'}}>Requires Approval</span>
                            )}
                          </div>
                        )}
                        {approval.status !== 'PENDING' && (
                          <Button size="sm" variant="ghost" onClick={() => alert(approval.auditTrail.map(a => `${new Date(a.timestamp).toLocaleString()} - ${a.status}: ${a.note}`).join('\n'))}>
                            View Audit Log
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeSubTab === 'rbac' && simulateRole === 'Admin' && (
          <div className={styles.rbacConfigList}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ margin: 0 }}>RBAC Configuration (Admin Only)</h4>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'center' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-hover)' }}>
                  <th style={{ padding: '12px', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>Role</th>
                  {['View', 'Create', 'Edit', 'Delete', 'Approve', 'Refund', 'Export'].map(perm => (
                    <th key={perm} style={{ padding: '12px', borderBottom: '1px solid var(--color-border)' }}>{perm}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.keys(permissionsConfig).map(role => (
                  <tr key={role} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>{role.replace('_', ' ')}</td>
                    {['View', 'Create', 'Edit', 'Delete', 'Approve', 'Refund', 'Export'].map(perm => {
                      const hasPerm = permissionsConfig[role].includes(perm);
                      return (
                        <td key={perm} style={{ padding: '12px' }}>
                          <input 
                            type="checkbox" 
                            checked={hasPerm} 
                            disabled={role === 'Admin'} // Admin always has all
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setPermissionsConfig(prev => ({
                                ...prev,
                                [role]: checked ? [...prev[role], perm] : prev[role].filter(p => p !== perm)
                              }));
                            }}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Adjustment Modal */}
      {manualAdjustmentModalOpen && (
        <Modal isOpen onClose={() => setManualAdjustmentModalOpen(false)}>
          <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '480px', width: '100%' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Manual Advance Adjustment</h3>
            <div style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
               Remaining Advance Balance: <strong style={{ color: '#0284c7' }}>₹{advanceData.remainingAdvance.toLocaleString('en-IN')}</strong>
            </div>
            
            <Select 
              label="Target Invoice" 
              value={manualAdjustmentForm.invoiceId} 
              onChange={val => setManualAdjustmentForm(prev => ({ ...prev, invoiceId: val }))} 
              options={[
                { value: '', label: 'Select an Invoice...' },
                ...invoices.map(inv => ({ value: inv.id, label: `${inv.id} (₹${inv.amount.toLocaleString()})` }))
              ]} 
            />
            
            <Input label="Adjustment Amount (INR)" type="number" value={manualAdjustmentForm.amount} onChange={e => setManualAdjustmentForm(prev => ({ ...prev, amount: e.target.value }))} required />
            <Input label="Reason for Manual Adjustment" value={manualAdjustmentForm.reason} onChange={e => setManualAdjustmentForm(prev => ({ ...prev, reason: e.target.value }))} required />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: '8px' }}>
              <Button variant="ghost" onClick={() => setManualAdjustmentModalOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleManualAdjustment}>Submit for Approval</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Write-off / Discount Modal */}
      {writeOffModalOpen && (
        <Modal isOpen onClose={() => setWriteOffModalOpen(false)}>
          <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '480px', width: '100%' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Request Discount / Write-off</h3>
            <div style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
               Milestone: <strong>{writeOffForm.milestoneName}</strong>
            </div>
            
            <Select 
              label="Type" 
              value={writeOffForm.type} 
              onChange={val => setWriteOffForm(prev => ({ ...prev, type: val }))} 
              options={[
                { value: 'Discount', label: 'Discount (Goodwill)' },
                { value: 'Write-off', label: 'Write-off (Bad Debt)' }
              ]} 
            />
            
            <Input label="Amount (INR)" type="number" value={writeOffForm.amount} onChange={e => setWriteOffForm(prev => ({ ...prev, amount: e.target.value }))} required />
            <Input label="Reason / Justification" value={writeOffForm.reason} onChange={e => setWriteOffForm(prev => ({ ...prev, reason: e.target.value }))} required />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: '8px' }}>
              <Button variant="ghost" onClick={() => setWriteOffModalOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={submitWriteOff}>Submit for Approval</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Collect Payment Modal */}
      {modalOpen && (
        <Modal isOpen onClose={() => setModalOpen(false)}>
          <div style={{padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '540px', width: '100%'}}>
            <h3 style={{fontSize: 'var(--text-lg)', fontWeight: 700}}>Collect Payment</h3>
            <Input label="Remaining Amount" value={`₹${Number(selectedPayment?.remainingAmount || 0).toLocaleString('en-IN')}`} readOnly />
            
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
               <span style={{fontWeight: 600, fontSize: '14px', color: 'var(--color-text)'}}>Payment Methods</span>
               <Button variant="outline" size="sm" onClick={handleAddSplit}>+ Add Split</Button>
            </div>
            
            {splitPayments.map((split, i) => (
               <div key={split.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'var(--color-surface-hover)', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', position: 'relative'}}>
                 <Input type="number" label="Amount" value={split.amount} onChange={e => handleSplitChange(split.id, 'amount', e.target.value)} />
                 <Select label="Mode" value={split.mode} onChange={v => handleSplitChange(split.id, 'mode', v)} options={[{value:'Bank Transfer',label:'Bank Transfer'}, {value:'UPI',label:'UPI'}, {value:'Cash',label:'Cash'}, {value:'Card',label:'Card'}, {value:'Cheque',label:'Cheque'}, {value:'Cashfree Gateway',label:'Cashfree Gateway'}, {value:'Razorpay Gateway',label:'Razorpay Gateway'}]} />
                 <Input label="Date" type="date" value={split.date} onChange={e => handleSplitChange(split.id, 'date', e.target.value)} />
                 <Input label="Reference No." value={split.reference} onChange={e => handleSplitChange(split.id, 'reference', e.target.value)} />
                 {splitPayments.length > 1 && <Button variant="ghost" size="sm" onClick={() => handleRemoveSplit(split.id)} style={{color: 'var(--color-danger)', position: 'absolute', top: '4px', right: '4px', padding: '4px'}}>✕</Button>}
               </div>
            ))}
            
            <div style={{display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid var(--color-border)'}}>
               <span style={{fontWeight: 600, color: 'var(--color-text)'}}>Total Split: ₹{splitPayments.reduce((s, sp) => s + Number(sp.amount || 0), 0).toLocaleString('en-IN')}</span>
               {splitPayments.reduce((s, sp) => s + Number(sp.amount || 0), 0) > (selectedPayment?.remainingAmount || 0) && (
                  <span style={{color: 'var(--color-danger)', fontSize: '12px', fontWeight: 600}}>Exceeds remaining amount!</span>
               )}
            </div>

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
          <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '480px', width: '100%' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Generate Document</h3>
            <Select 
              label="Document Type" 
              value={invoiceForm.type} 
              onChange={val => setInvoiceForm(prev => ({ ...prev, type: val }))} 
              options={[
                { value: 'PROFORMA_INVOICE', label: 'Proforma Invoice' },
                { value: 'TAX_INVOICE', label: 'Tax Invoice' },
                { value: 'PAYMENT_RECEIPT', label: 'Payment Receipt' },
                { value: 'MILESTONE_INVOICE', label: 'Milestone Invoice' }
              ]} 
            />
            <Select
              label="Select Milestone (Optional)"
              value={invoiceForm.milestoneId}
              onChange={val => setInvoiceForm(prev => ({ ...prev, milestoneId: val }))}
              options={[
                { value: '', label: 'General / Advance' },
                ...payments.map(p => ({ value: p.milestone, label: p.milestone }))
              ]}
            />
            <Input label="Base Amount (INR) Before Tax" type="number" value={invoiceForm.amount} onChange={e => setInvoiceForm(prev => ({ ...prev, amount: e.target.value }))} required />
            
            {invoiceForm.type === 'TAX_INVOICE' && (
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                 <Select label="GST Type" value={invoiceForm.gstType} onChange={val => setInvoiceForm(prev => ({ ...prev, gstType: val }))} options={[{value:'CGST_SGST', label:'Intra-state (CGST+SGST)'}, {value:'IGST', label:'Inter-state (IGST)'}]} />
                 <Input label="GST Rate (%)" type="number" value={invoiceForm.gstRate} onChange={e => setInvoiceForm(prev => ({ ...prev, gstRate: e.target.value }))} />
                 <Input label="HSN/SAC" value={invoiceForm.hsnSac} onChange={e => setInvoiceForm(prev => ({ ...prev, hsnSac: e.target.value }))} />
                 <Input label="Customer GSTIN (Optional)" value={invoiceForm.customerGst} onChange={e => setInvoiceForm(prev => ({ ...prev, customerGst: e.target.value }))} />
               </div>
            )}

            <Input label="Date" type="date" value={invoiceForm.invoiceDate} onChange={e => setInvoiceForm(prev => ({ ...prev, invoiceDate: e.target.value }))} required />
            
            <div style={{display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)'}}>
              <Button variant="ghost" onClick={() => setInvoiceModalOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleGenerateInvoice}>Generate</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Print Template (Hidden visually, shown only on print) */}
      {printingInvoice && (
        <div className="print-only-invoice" style={{ display: 'none', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'white', zIndex: 999999, padding: '40px', boxSizing: 'border-box' }}>
           <style>
             {`
               @media print {
                 body * { visibility: hidden; }
                 .print-only-invoice, .print-only-invoice * { visibility: visible; }
                 .print-only-invoice { display: block !important; position: absolute; left: 0; top: 0; width: 100%; font-family: 'Inter', sans-serif; }
               }
             `}
           </style>
           <div style={{ borderBottom: '2px solid #e5e7eb', paddingBottom: '20px', marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                 <h1 style={{ margin: 0, fontSize: '28px', color: '#111827', fontWeight: 800 }}>Digicloudify Interiors</h1>
                 <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '14px' }}>123 Design Avenue, Tech Park, City - 500001<br/>GSTIN: 29ABCDE1234F1Z5</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                 <h2 style={{ margin: 0, fontSize: '24px', color: '#0284c7', textTransform: 'uppercase' }}>{printingInvoice.type.replace('_', ' ')}</h2>
                 <p style={{ margin: '4px 0 0', color: '#374151', fontSize: '14px', fontWeight: 600 }}>{printingInvoice.id || printingInvoice.debit_note_number} {printingInvoice.version && <span style={{color: '#9ca3af', fontWeight: 400}}>(v{printingInvoice.version})</span>}</p>
                 <p style={{ margin: '2px 0 0', color: '#6b7280', fontSize: '14px' }}>Date: {new Date(printingInvoice.date || printingInvoice.debit_note_date).toLocaleDateString('en-IN')}</p>
              </div>
           </div>

           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
             <div>
                <h4 style={{ margin: '0 0 8px', fontSize: '12px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bill To</h4>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#111827' }}>{printingInvoice.customerName}</p>
                <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#4b5563' }}>Project: {printingInvoice.projectName}</p>
                {printingInvoice.customerGst && (
                   <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#4b5563', fontWeight: 600 }}>GSTIN: {printingInvoice.customerGst}</p>
                )}
             </div>
             {printingInvoice.milestoneId && (
               <div style={{ textAlign: 'right' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '12px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Milestone Ref</h4>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: 500, color: '#111827' }}>{printingInvoice.milestoneId}</p>
               </div>
             )}
           </div>

           <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '40px' }}>
              <thead>
                 <tr>
                    <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontSize: '12px', textTransform: 'uppercase' }}>Description</th>
                    {printingInvoice.type !== 'DEBIT_NOTE' && <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontSize: '12px', textTransform: 'uppercase' }}>HSN/SAC</th>}
                    <th style={{ textAlign: 'right', padding: '12px', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontSize: '12px', textTransform: 'uppercase' }}>Amount</th>
                 </tr>
              </thead>
              <tbody>
                 <tr>
                    <td style={{ padding: '16px 12px', borderBottom: '1px solid #f3f4f6', color: '#111827' }}>
                      {printingInvoice.type === 'DEBIT_NOTE' 
                        ? `Debit Note against Invoice ${printingInvoice.invoice_id} - ${printingInvoice.reason}`
                        : `Interior Construction - ${printingInvoice.milestoneId || 'General Services'}`
                      }
                    </td>
                    {printingInvoice.type !== 'DEBIT_NOTE' && <td style={{ padding: '16px 12px', borderBottom: '1px solid #f3f4f6', color: '#111827' }}>{printingInvoice.hsnSac || '-'}</td>}
                    <td style={{ padding: '16px 12px', borderBottom: '1px solid #f3f4f6', color: '#111827', textAlign: 'right' }}>₹{Number(printingInvoice.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                 </tr>
              </tbody>
           </table>

           <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ width: '350px' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', fontSize: '14px', color: '#4b5563' }}>
                    <span>Subtotal</span>
                    <span>₹{Number(printingInvoice.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                 </div>
                 
                 {printingInvoice.type === 'TAX_INVOICE' && printingInvoice.gstType === 'CGST_SGST' && (
                   <>
                     <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', fontSize: '14px', color: '#4b5563' }}>
                        <span>CGST ({(printingInvoice.gstRate/2)}%)</span>
                        <span>₹{Number(printingInvoice.cgstAmount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', fontSize: '14px', color: '#4b5563' }}>
                        <span>SGST ({(printingInvoice.gstRate/2)}%)</span>
                        <span>₹{Number(printingInvoice.sgstAmount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                     </div>
                   </>
                 )}
                 
                 {printingInvoice.type === 'TAX_INVOICE' && printingInvoice.gstType === 'IGST' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', fontSize: '14px', color: '#4b5563' }}>
                       <span>IGST ({printingInvoice.gstRate}%)</span>
                       <span>₹{Number(printingInvoice.igstAmount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                    </div>
                 )}

                 <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', fontSize: '14px', color: '#4b5563', borderBottom: '1px solid #e5e7eb' }}>
                    <span>Round Off</span>
                    <span>{printingInvoice.roundOffAmount > 0 ? '+' : ''}{Number(printingInvoice.roundOffAmount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</span>
                 </div>

                 <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', fontSize: '18px', fontWeight: 700, color: '#111827' }}>
                    <span>Grand Total</span>
                    <span>₹{Number(printingInvoice.grandTotal).toLocaleString('en-IN')}</span>
                 </div>
              </div>
           </div>

           <div style={{ marginTop: '60px', borderTop: '1px solid #e5e7eb', paddingTop: '20px', color: '#6b7280', fontSize: '12px', textAlign: 'center' }}>
              <p>This is a computer generated document. No signature is required.</p>
           </div>
        </div>
      )}

      {/* Printable Receipt Layout */}
      {printingReceipt && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', minHeight: '100vh', background: '#fff', zIndex: 9999, padding: '40px', boxSizing: 'border-box' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #e5e7eb', paddingBottom: '24px', marginBottom: '32px' }}>
              <div>
                 <h1 style={{ margin: 0, fontSize: '28px', color: '#111827', letterSpacing: '-0.02em' }}>PAYMENT RECEIPT</h1>
                 <div style={{ color: '#6b7280', marginTop: '8px' }}>Receipt #{printingReceipt.id}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                 <div style={{ fontSize: '20px', fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' }}>DIGICLOUDIFY INTERIORS</div>
                 <div style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px' }}>123 Design Avenue, Tech Park</div>
                 <div style={{ color: '#6b7280', fontSize: '14px' }}>GSTIN: 29ABCDE1234F1Z5</div>
              </div>
           </div>

           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
              <div style={{ width: '45%' }}>
                 <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Received From</div>
                 <div style={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>{printingReceipt.customerName}</div>
                 <div style={{ color: '#4b5563', marginTop: '4px' }}>Project: {project?.name || 'Project Name'}</div>
              </div>
              <div style={{ width: '45%', textAlign: 'right' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#6b7280' }}>Receipt Date:</span>
                    <span style={{ fontWeight: 500, color: '#111827' }}>{new Date(printingReceipt.receiptDate).toLocaleDateString('en-IN')}</span>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#6b7280' }}>Payment Mode:</span>
                    <span style={{ fontWeight: 500, color: '#111827' }}>{printingReceipt.paymentMode}</span>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280' }}>Reference:</span>
                    <span style={{ fontWeight: 500, color: '#111827' }}>{printingReceipt.reference}</span>
                 </div>
              </div>
           </div>

           <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '32px' }}>
              <thead>
                 <tr>
                    <th style={{ padding: '12px', background: '#f9fafb', color: '#374151', fontSize: '12px', textTransform: 'uppercase', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Description / Milestone</th>
                    <th style={{ padding: '12px', background: '#f9fafb', color: '#374151', fontSize: '12px', textTransform: 'uppercase', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Amount Received</th>
                 </tr>
              </thead>
              <tbody>
                 <tr>
                    <td style={{ padding: '16px 12px', borderBottom: '1px solid #f3f4f6', color: '#111827' }}>
                      Payment for {printingReceipt.milestoneName || 'General Services'}
                    </td>
                    <td style={{ padding: '16px 12px', borderBottom: '1px solid #f3f4f6', color: '#111827', textAlign: 'right' }}>₹{Number(printingReceipt.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                 </tr>
              </tbody>
           </table>

           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ width: '50%', color: '#4b5563', fontSize: '14px', fontStyle: 'italic' }}>
                 Amount in words: Rupees {numberToWords(printingReceipt.amount)}
              </div>
              <div style={{ width: '350px' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', fontSize: '18px', fontWeight: 700, color: '#111827', background: '#f9fafb', borderRadius: '4px' }}>
                    <span>Total Received</span>
                    <span>₹{Number(printingReceipt.amount).toLocaleString('en-IN')}</span>
                 </div>
              </div>
           </div>

           <div style={{ marginTop: '60px', borderTop: '1px solid #e5e7eb', paddingTop: '20px', color: '#6b7280', fontSize: '12px', textAlign: 'center' }}>
              <p>This is a computer generated payment receipt. No signature is required.</p>
           </div>
        </div>
      )}

      {/* Generate Payment Link Modal */}
      {linkModalOpen && (
        <Modal isOpen onClose={() => setLinkModalOpen(false)}>
          <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '480px', width: '100%' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Generate Payment Link</h3>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              Create a secure payment link for {selectedMilestoneForLink?.milestone}. The customer will receive an SMS and Email with this link.
            </div>
            <Input label="Amount to Collect (INR)" value={`₹${Number(selectedMilestoneForLink?.remainingAmount || 0).toLocaleString('en-IN')}`} readOnly />
            <Select 
              label="Link Expiry" 
              value={linkForm.expiryDays} 
              onChange={val => setLinkForm({ expiryDays: val })} 
              options={[
                { value: 1, label: '1 Day' },
                { value: 3, label: '3 Days' },
                { value: 7, label: '7 Days' },
                { value: 15, label: '15 Days' }
              ]} 
            />
            <div style={{display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)'}}>
              <Button variant="ghost" onClick={() => setLinkModalOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleConfirmGenerateLink}>Generate & Send</Button>
            </div>
          </div>
        </Modal>
      )}

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

      {/* Debit Note Modal */}
      {debitNoteModalOpen && (
        <Modal isOpen onClose={() => setDebitNoteModalOpen(false)}>
          <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '480px', width: '100%' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Issue Debit Note</h3>
            
            <Select 
              label="Reference Invoice" 
              value={debitNoteForm.invoiceId} 
              onChange={val => setDebitNoteForm(prev => ({ ...prev, invoiceId: val }))} 
              options={[
                { value: '', label: 'Select an Invoice...' },
                ...invoices.map(inv => ({ value: inv.id, label: `${inv.id} (₹${inv.amount.toLocaleString()})` }))
              ]} 
            />
            
            <Input label="Debit Amount (INR)" type="number" value={debitNoteForm.amount} onChange={e => setDebitNoteForm(prev => ({ ...prev, amount: e.target.value }))} required />
            <Input label="Reason for Debit Note" value={debitNoteForm.reason} onChange={e => setDebitNoteForm(prev => ({ ...prev, reason: e.target.value }))} required />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
               <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>Additional Notes</label>
               <textarea rows={3} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--color-border)', fontFamily: 'inherit' }} value={debitNoteForm.notes} onChange={e => setDebitNoteForm(prev => ({ ...prev, notes: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: '8px' }}>
              <Button variant="ghost" onClick={() => setDebitNoteModalOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleIssueDebitNote}>Issue Debit Note</Button>
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
