/* eslint-disable no-unused-vars, no-undef, no-useless-assignment, react-hooks/purity, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Legend, Cell 
} from 'recharts';
import { Badge, Button, Modal, Input, Select, PermissionButton } from '../../components/ui';
import styles from './PaymentsTab.module.css';
import { getPaymentMilestones, updatePaymentMilestone } from '../../api/paymentMilestones';
import { getPaymentEscalations } from '../../api/projects';
import { getInvoiceDraft, createInvoice, getInvoicesByProject, deleteInvoice } from '../../api/invoices';
import { getCreditNotes, getRefunds, createCreditNote, createRefund, getReceiptsByProject } from '../../api/financials';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';
import PaymentEscalationModal from '../../components/projects/PaymentEscalationModal';

import { useConfirm } from '../../store/confirmContext';

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
      setTimeout(async () => {
        const isSuccess = await confirm(`[Cashfree Mock Sandbox]\nAmount: ₹${details.amount}\nMilestone: ${details.milestoneName}\n\nSimulate successful payment webhook verification?`);
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
// ---------------------------------
const PaymentsTab = React.memo(function PaymentsTab({ projectId, project, onProjectUpdated }) {
  const { confirm } = useConfirm();
  const toast = useToast();
  const [payments, setPayments] = useState([]);
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('dashboard'); // breakdown, logs, milestones, credits, approvals
  
  const subTabsRef = useRef(null);

  useEffect(() => {
    if (subTabsRef.current) {
      const activeElement = subTabsRef.current.querySelector(`.${styles.subTabActive}`);
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeSubTab]);

  // Cost Breakdown "Cart" state
  const [selectedCostItems, setSelectedCostItems] = useState([]);
  const [customAvailableItems, setCustomAvailableItems] = useState([]);
  const [costItemModalOpen, setCostItemModalOpen] = useState(false);
  const [editingCostItem, setEditingCostItem] = useState({ id: '', label: '', value: '' });
  const [editingCostItemType, setEditingCostItemType] = useState('selected'); // 'selected' or 'available'
  
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

  // Finance Approvals Queue State
  const [financeApprovals, setFinanceApprovals] = useState([]);
  const [approvalsFilter, setApprovalsFilter] = useState('ALL'); // ALL, PENDING, APPROVED, REJECTED
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [selectedAuditApproval, setSelectedAuditApproval] = useState(null);
  const fetchApprovals = async () => {
    try {
      const res = await api.get('/financial-approvals');
      // Filter for this project only
      const rawData = res.data?.data;
      const approvalsList = Array.isArray(rawData) 
        ? rawData 
        : (rawData && Array.isArray(rawData.data) ? rawData.data : []);
      const projectApprovals = approvalsList.filter(a => a.project_name === project?.name || a.payload?.projectId === projectId);
      setFinanceApprovals(projectApprovals);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, [projectId]);

  useEffect(() => {
    const handleDbChange = () => {
      fetchApprovals();
    };
    window.addEventListener('app:mock-db-change', handleDbChange);
    return () => window.removeEventListener('app:mock-db-change', handleDbChange);
  }, [projectId]);

  const [eligibleUsers, setEligibleUsers] = useState([]);

  useEffect(() => {
    api.get('/users')
      .then(res => {
        const allUsers = res.data?.data || [];
        const ELIGIBLE_ROLES = [
          'superadmin', 'super admin', 'admin', 
          'project_manager', 'pm', 'project manager',
          'crm_executive', 'crm executive',
          'sales', 'sales_rep', 'sales_manager', 'sales_executive', 'sales representative',
          'finance_manager', 'finance_controller', 'finance_executive', 'finance_head', 'finance manager', 'finance controller'
        ];
        const filtered = allUsers.filter(u => {
          const roleName = (u.role_name || u.role?.name || u.role_id || u.role || '').toLowerCase().trim();
          return ELIGIBLE_ROLES.some(r => roleName.includes(r) || r.includes(roleName));
        });
        setEligibleUsers(filtered);
      })
      .catch(err => {
        console.error('Failed to load eligible users', err);
      });
  }, []);

  const getCollectedByOptions = () => {
    const optionsMap = new Map();
    
    // Default option
    optionsMap.set('', { value: '', label: 'Select Staff...' });

    // 1. Add specific project-assigned roles (if they exist)
    if (project?.pm_name) {
      optionsMap.set(project.pm_name, { 
        value: `${project.pm_name}|project_manager`, 
        label: `${project.pm_name} (Project Manager)` 
      });
    }
    if (project?.crm_executive_name) {
      optionsMap.set(project.crm_executive_name, { 
        value: `${project.crm_executive_name}|crm_executive`, 
        label: `${project.crm_executive_name} (CRM Executive)` 
      });
    }
    if (project?.sales_rep_name) {
      optionsMap.set(project.sales_rep_name, { 
        value: `${project.sales_rep_name}|sales_rep`, 
        label: `${project.sales_rep_name} (Sales Representative)` 
      });
    }

    // 2. Add dynamic eligible users fetched from database
    eligibleUsers.forEach(u => {
      if (!optionsMap.has(u.name)) {
        const roleLabel = u.role_name || u.role?.name || u.role_id || u.role || 'Staff';
        optionsMap.set(u.name, {
          value: `${u.name}|${u.role_id || u.role || 'staff'}`,
          label: `${u.name} (${roleLabel})`
        });
      }
    });

    // 3. Add fallback System Admin option
    if (!optionsMap.has('System Admin')) {
      optionsMap.set('System Admin', { 
        value: 'System Admin|admin', 
        label: 'System Admin (Admin)' 
      });
    }

    return Array.from(optionsMap.values());
  };

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
  const initialAuditLogs = [
    {
      id: 'audit_init_1',
      timestamp: new Date(1786536584000 - 86400000 * 2).toISOString(),
      user: 'SYSTEM',
      ip: '127.0.0.1',
      device: 'Server',
      action: 'INITIATED',
      financialObject: 'Project Ledger',
      oldValue: 0,
      newValue: project?.contract_value || 0,
      reason: 'Project financial tracking created'
    },
    {
      id: 'audit_init_2',
      timestamp: new Date(1786536584000 - 86400000).toISOString(),
      user: 'Admin',
      ip: '192.168.1.45',
      device: 'Windows PC',
      action: 'GENERATED',
      financialObject: 'Milestones',
      oldValue: undefined,
      newValue: undefined,
      reason: 'Standard payment schedule generated'
    },
    {
      id: 'audit_init_3',
      timestamp: new Date(1786536584000).toISOString(),
      user: 'Finance Manager',
      ip: '192.168.1.100',
      device: 'Mac/Linux',
      action: 'COLLECTED',
      financialObject: 'Payment',
      oldValue: 0,
      newValue: Number(project?.booking_amount || 120000),
      reason: 'Booking advance auto-collected'
    }
  ];
  const [auditLogs, setAuditLogs] = useState(initialAuditLogs);
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

  // Dashboard Calculations
  const dashboardData = React.useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    let todayCollection = 0;
    let monthlyCollection = 0;
    
    const trendMonths = [];
    const trendCollections = [0, 0, 0, 0, 0, 0, 0];
    const trendOutflows = [0, 0, 0, 0, 0, 0, 0];
    
    for (let i = 6; i >= 0; i--) {
       const d = new Date(currentYear, currentMonth - i, 1);
       trendMonths.push(d.toLocaleString('default', { month: 'short' }));
    }

    payments.forEach(p => {
      (p.paymentEntries || []).forEach(e => {
         const eDate = new Date(e.paidAt || p.dueDate);
         if (eDate.toISOString().split('T')[0] === todayStr) {
           todayCollection += (e.amount || 0);
         }
         if (eDate.getMonth() === currentMonth && eDate.getFullYear() === currentYear) {
           monthlyCollection += (e.amount || 0);
         }
         
         for (let i = 0; i <= 6; i++) {
           const d = new Date(currentYear, currentMonth - (6 - i), 1);
           if (eDate.getMonth() === d.getMonth() && eDate.getFullYear() === d.getFullYear()) {
              trendCollections[i] += (e.amount || 0);
           }
         }
      });
    });

    const outstanding = payments.reduce((acc, p) => acc + (p.remainingAmount || 0), 0);
    const overdue = payments.filter(p => p.status === 'overdue').reduce((acc, p) => acc + (p.remainingAmount || 0), 0);
    const totalRefunds = refunds.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    const totalCreditNotes = creditNotes.reduce((acc, c) => acc + (Number(c.subtotal || c.amount || c.total_amount) || 0), 0);

    // Compute outflows per month (refunds & credit notes)
    refunds.forEach(r => {
       const rDate = new Date(r.refund_date || r.date || r.createdAt);
       for (let i = 0; i <= 6; i++) {
         const d = new Date(currentYear, currentMonth - (6 - i), 1);
         if (rDate.getMonth() === d.getMonth() && rDate.getFullYear() === d.getFullYear()) {
            trendOutflows[i] += (Number(r.amount) || 0);
         }
       }
    });

    creditNotes.forEach(cn => {
       const cDate = new Date(cn.credit_note_date || cn.date || cn.createdAt);
       for (let i = 0; i <= 6; i++) {
         const d = new Date(currentYear, currentMonth - (6 - i), 1);
         if (cDate.getMonth() === d.getMonth() && cDate.getFullYear() === d.getFullYear()) {
            trendOutflows[i] += (Number(cn.total_amount || cn.amount || cn.subtotal) || 0);
         }
       }
    });

    // Seed realistic material/labour expenses (outflow) equal to 45% of collections to present proper comparative chart data
    for (let i = 0; i <= 6; i++) {
       if (trendCollections[i] > 0) {
          trendOutflows[i] += Math.round(trendCollections[i] * 0.45);
       }
    }

    const aging = [
      { label: '0-30 Days', val: 0 },
      { label: '31-60 Days', val: 0 },
      { label: '61-90 Days', val: 0 },
      { label: '90+ Days', val: 0 }
    ];
    const now = new Date();
    payments.forEach(p => {
       if (p.remainingAmount > 0 && p.dueDate) {
          const dDate = new Date(p.dueDate);
          const diffDays = Math.floor((now - dDate) / (1000 * 60 * 60 * 24));
          if (diffDays >= 0) {
             if (diffDays <= 30) aging[0].val += p.remainingAmount;
             else if (diffDays <= 60) aging[1].val += p.remainingAmount;
             else if (diffDays <= 90) aging[2].val += p.remainingAmount;
             else aging[3].val += p.remainingAmount;
          }
       }
    });

    const cashFlowTrend = trendCollections.map((inflow, idx) => ({
      name: trendMonths[idx],
      Inflow: inflow,
      Outflow: trendOutflows[idx]
    }));

    const collectionTrend = trendCollections.map((val, idx) => ({
      name: trendMonths[idx],
      Collection: val
    }));

    // Dynamic Target based on Project Budget
    const fallbackBudget = Number(project?.booking_amount || 0) > 0 ? Number(project.booking_amount) * 10 : 0;
    const collectionTarget = Number(project?.contract_value || 0) || fallbackBudget || 0;
    const currentTotalCollected = payments.reduce((acc, p) => acc + (p.collectedAmount || 0), 0);

    return {
      todayCollection,
      monthlyCollection,
      outstanding,
      overdue,
      totalRefunds,
      totalCreditNotes,
      collectionTarget,
      currentTotalCollected,
      cashFlowTrend,
      collectionTrend,
      aging
    };
  }, [payments, refunds, creditNotes, project]);

  const handleExportDashboard = () => {
    toast.success('Finance Dashboard report exported to PDF successfully!');
  };

  // Bank Reconciliation States
  const [bankStatements, setBankStatements] = useState([]);
  const [reconciledMatches, setReconciledMatches] = useState([]);
  
  const handleImportStatement = () => {
    // Simulating CSV parsing with mock transactions
    const mockTxns = [
      { id: 'TXN-' + Date.now() + '-1', date: new Date().toISOString(), amount: 50000, reference: 'Bank Transfer' },
      { id: 'TXN-' + Date.now() + '-2', date: new Date().toISOString(), amount: 150000, reference: 'RTGS' },
      { id: 'TXN-' + Date.now() + '-3', date: new Date(Date.now() - 86400000).toISOString(), amount: 99999, reference: 'NEFT' }, // Unmatched / Exception
    ];

    // Duplicate detection
    const existingIds = new Set(bankStatements.map(t => t.id));
    const newTxns = mockTxns.filter(t => !existingIds.has(t.id));
    
    if (newTxns.length < mockTxns.length) {
      toast.warning(`${mockTxns.length - newTxns.length} duplicate transactions ignored.`);
    }
    
    if (newTxns.length > 0) {
      setBankStatements(prev => [...prev, ...newTxns]);
      toast.success(`${newTxns.length} bank transactions imported successfully.`);
    }
  };

  const handleAutoReconcile = () => {
    let newMatches = 0;
    const updatedBankStmts = [...bankStatements];
    const unmatchedBankStmts = updatedBankStmts.filter(b => !b.reconciled);
    
    // Find unmatched CRM payments
    const unmatchedCrmPayments = [];
    payments.forEach(p => {
      (p.paymentEntries || []).forEach(e => {
        if (!e.reconciled) {
          unmatchedCrmPayments.push({ ...e, parentMilestoneId: p.id, parentMilestone: p.milestone });
        }
      });
    });

    unmatchedBankStmts.forEach(bankTxn => {
      // Find matching CRM payment by exact amount
      const matchIndex = unmatchedCrmPayments.findIndex(crmTxn => Number(crmTxn.amount) === Number(bankTxn.amount));
      if (matchIndex !== -1) {
        const crmMatch = unmatchedCrmPayments[matchIndex];
        
        // Record match
        setReconciledMatches(prev => [...prev, {
          id: 'REC-MATCH-' + Date.now() + Math.random(),
          bankTxn,
          crmTxn: crmMatch,
          date: new Date().toISOString()
        }]);

        // Mark as reconciled
        bankTxn.reconciled = true;
        crmMatch.reconciled = true;
        
        // Update payments state
        setPayments(prev => prev.map(p => {
          if (p.id === crmMatch.parentMilestoneId) {
            return {
              ...p,
              paymentEntries: p.paymentEntries.map(entry => entry.id === crmMatch.id ? { ...entry, reconciled: true } : entry)
            };
          }
          return p;
        }));

        unmatchedCrmPayments.splice(matchIndex, 1);
        newMatches++;
      }
    });

    setBankStatements(updatedBankStmts);
    if (newMatches > 0) {
      toast.success(`${newMatches} transactions auto-reconciled successfully.`);
    } else {
      toast.info('No new auto-reconciliation matches found.');
    }
  };

  const handleManualReconcile = (bankTxnId, crmTxnId) => {
    // In a real scenario, this would have a full UI to select and map. We simulate an exact pairing here if we had the UI.
    toast.success('Manual reconciliation recorded.');
  };

  // Collections Dashboard States
  const [collectionNotes, setCollectionNotes] = useState([]);
  const [promiseToPays, setPromiseToPays] = useState([]);
  const [selectedCollectionItem, setSelectedCollectionItem] = useState(null);
  const [collectionFilters, setCollectionFilters] = useState({ priority: 'All', owner: 'All' });
  const [collectionActionForm, setCollectionActionForm] = useState({ note: '', callStatus: 'Connected', ptpDate: '' });

  const collectionData = React.useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const next7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const items = payments.filter(p => p.remainingAmount > 0).map(p => {
      const dueDate = new Date(p.dueDate);
      const isOverdue = p.status === 'overdue';
      const isUpcoming = !isOverdue && dueDate <= next7Days;
      
      const daysOverdue = isOverdue ? Math.floor((today - dueDate) / (1000 * 60 * 60 * 24)) : 0;
      
      let priority = 'LOW';
      let score = 0;
      
      if (isOverdue) {
        if (daysOverdue > 30 || p.remainingAmount > 100000) { priority = 'HIGH'; score = 3; }
        else if (daysOverdue > 7 || p.remainingAmount > 50000) { priority = 'MEDIUM'; score = 2; }
        else { priority = 'LOW'; score = 1; }
      } else if (isUpcoming) {
        priority = 'UPCOMING'; score = 0;
      } else {
        priority = 'FUTURE'; score = -1;
      }

      // Find latest PTP
      const ptp = promiseToPays.filter(pt => pt.milestoneId === p.id).sort((a,b) => new Date(b.date) - new Date(a.date))[0];
      
      // Find history
      const history = collectionNotes.filter(n => n.milestoneId === p.id).sort((a,b) => new Date(b.date) - new Date(a.date));
      const todayFollowUps = history.filter(n => new Date(n.date).toDateString() === new Date().toDateString());

      return {
        ...p,
        isOverdue,
        isUpcoming,
        daysOverdue,
        priority,
        score,
        latestPtp: ptp,
        history,
        todayFollowUp: todayFollowUps.length > 0,
        owner: 'Finance Team A' // Mock owner
      };
    });

    const activeItems = items.filter(i => i.score >= 0); // Hide FUTURE unless specifically requested
    
    // Apply filters
    const filtered = activeItems.filter(i => {
      if (collectionFilters.priority !== 'All' && i.priority !== collectionFilters.priority) return false;
      if (collectionFilters.owner !== 'All' && i.owner !== collectionFilters.owner) return false;
      return true;
    }).sort((a,b) => b.score - a.score);

    const overdueCount = activeItems.filter(i => i.isOverdue).length;
    const upcomingCount = activeItems.filter(i => i.isUpcoming).length;
    const ptpCount = activeItems.filter(i => i.latestPtp).length;
    const todayFollowUpCount = activeItems.filter(i => i.todayFollowUp).length;

    return {
      items: filtered,
      kpis: { overdueCount, upcomingCount, ptpCount, todayFollowUpCount }
    };
  }, [payments, collectionNotes, promiseToPays, collectionFilters]);

  const handleLogCollectionAction = () => {
    if (!selectedCollectionItem) return;
    
    if (collectionActionForm.note) {
      setCollectionNotes(prev => [...prev, {
        id: 'CN-' + Date.now(),
        milestoneId: selectedCollectionItem.id,
        date: new Date().toISOString(),
        note: collectionActionForm.note,
        callStatus: collectionActionForm.callStatus,
        loggedBy: simulateRole
      }]);
    }
    
    if (collectionActionForm.ptpDate) {
      setPromiseToPays(prev => [...prev, {
        id: 'PTP-' + Date.now(),
        milestoneId: selectedCollectionItem.id,
        date: new Date().toISOString(),
        ptpDate: collectionActionForm.ptpDate,
        loggedBy: simulateRole
      }]);
    }
    
    toast.success('Collection action logged successfully.');
    setCollectionActionForm({ note: '', callStatus: 'Connected', ptpDate: '' });
  };

  // General Payment Adjustments
  const [paymentAdjustments, setPaymentAdjustments] = useState([]);
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [adjustmentForm, setAdjustmentForm] = useState({
    type: 'OVERPAYMENT',
    sourceMilestoneId: '',
    targetMilestoneId: '',
    amount: '',
    reason: ''
  });

  const handleRequestAdjustment = () => {
    if (!adjustmentForm.sourceMilestoneId || !adjustmentForm.amount || !adjustmentForm.reason) {
      toast.error('Source, Amount, and Reason are required.');
      return;
    }
    if (adjustmentForm.type === 'TRANSFER' && !adjustmentForm.targetMilestoneId) {
      toast.error('Target milestone is required for transfers.');
      return;
    }
    
    // Auto-detect milestone names for context
    const srcM = payments.find(p => p.id === adjustmentForm.sourceMilestoneId)?.milestone || adjustmentForm.sourceMilestoneId;
    let targetM = '';
    if (adjustmentForm.type === 'TRANSFER') {
      targetM = payments.find(p => p.id === adjustmentForm.targetMilestoneId)?.milestone || adjustmentForm.targetMilestoneId;
    }

    const adjPayload = {
      ...adjustmentForm,
      id: 'PADJ-' + Date.now(),
      status: 'PENDING',
      date: new Date().toISOString(),
      requestedBy: simulateRole,
      sourceName: srcM,
      targetName: targetM
    };

    requestFinanceApproval('Payment Adjustment', adjustmentForm.amount, adjustmentForm.reason, { adjustment: adjPayload });
    setAdjustmentModalOpen(false);
    setAdjustmentForm({ type: 'OVERPAYMENT', sourceMilestoneId: '', targetMilestoneId: '', amount: '', reason: '' });
  };



  // ERP Integration (Tally) States
  const [erpMappings, setErpMappings] = useState({
    salesLedger: 'Sales A/c',
    cgstLedger: 'CGST',
    sgstLedger: 'SGST',
    igstLedger: 'IGST',
    bankLedger: 'ICICI Bank A/c'
  });
  const [syncLogs, setSyncLogs] = useState([]);
  
  const handleTriggerSync = (type) => {
    let mockEntities = [];
    if (type === 'Invoices') {
      mockEntities = payments.filter(p => p.taxInvoiceNo).map(p => ({ id: p.id, name: p.taxInvoiceNo }));
    } else if (type === 'Payments') {
      mockEntities = payments.filter(p => p.collectedAmount > 0).map(p => ({ id: p.id, name: `Pay-${p.milestone}` }));
    } else if (type === 'Customers') {
      mockEntities = [{ id: 'CUST-01', name: project?.customer_name || 'Customer' }];
    } else if (type === 'Ledger Entries') {
      mockEntities = ledger.map(l => ({ id: l.id, name: l.details }));
    }

    if (mockEntities.length === 0) {
      toast.error(`No ${type} available to sync.`);
      return;
    }

    const newLogs = mockEntities.map((ent, idx) => ({
      id: 'SYNC-' + Date.now() + idx,
      date: new Date().toISOString(),
      type: type,
      entityId: ent.id,
      entityName: ent.name,
      status: Math.random() > 0.2 ? 'SUCCESS' : 'FAILED', // 80% success for demo
      message: ''
    }));

    // For failed ones, add a mock error
    newLogs.forEach(l => {
      if (l.status === 'FAILED') l.message = 'Network timeout / Tally server unreachable.';
    });

    setSyncLogs(prev => [...newLogs, ...prev]);

    const successes = newLogs.filter(l => l.status === 'SUCCESS').length;
    const failures = newLogs.filter(l => l.status === 'FAILED').length;
    
    if (failures > 0) {
      toast.warning(`Synced ${successes} ${type}. ${failures} failed.`);
    } else {
      toast.success(`Successfully synced ${successes} ${type} to ERP.`);
    }

    // Simulate generating Tally XML download
  };

  const handleRetrySync = (logId) => {
    setSyncLogs(prev => prev.map(l => l.id === logId ? {
      ...l,
      status: 'SUCCESS',
      message: 'Retry successful',
      date: new Date().toISOString()
    } : l));
    toast.success('Retry successful.');
  };

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
  const requestFinanceApproval = async (type, amount, reason, payload) => {
    try {
      await api.post('/financial-approvals', {
        type,
        amount: Number(amount),
        reason,
        payload: { ...payload, projectId },
        project_name: project?.name,
        customer_name: project?.client_name || project?.customer_name,
        target_number: payload.selectedPayment?.milestone || 'Manual'
      });
      if (typeof fetchApprovals === 'function') {
        fetchApprovals();
      }
      toast.success(`${type} request submitted for Finance Approval.`);
    } catch (err) {
      toast.error('Failed to submit approval request.');
    }
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

        // Auto-generate invoice locally
        const newInvoice = {
            id: 'INV-AUTO-' + Date.now(),
            projectId,
            invoiceDate: new Date().toISOString(),
            milestoneId: selectedPayment.id,
            milestoneName: selectedPayment.milestone,
            customerName: project?.customer_name || 'Customer',
            amount: splitPayments.reduce((sum, sp) => sum + sp.amount, 0),
            status: 'GENERATED',
            version: '1.0'
        };
        setInvoices(prev => [newInvoice, ...prev]);

      } else if (type === 'Discount' || type === 'Write-off') {
        setPayments(prev => prev.map(p => p.id === payload.milestoneId ? {
          ...p,
          remainingAmount: p.remainingAmount - payload.amount,
          amountValue: p.amountValue - payload.amount
        } : p));
      } else if (type === 'Gate Override') {
        setGateOverrides(prev => [...prev, payload]);
      } else if (type === 'Payment Adjustment') {
        const adj = payload.adjustment;
        const adjAmount = Number(adj.amount);
        
        // Update Adjustment History
        setPaymentAdjustments(prev => [{...adj, status: 'APPROVED'}, ...prev]);
        
        // Update Payments based on type
        if (adj.type === 'OVERPAYMENT') {
           // Move overpayment to advance adjustment or credit pool (Simulated by reducing outstanding or showing credit)
           // In this scenario we simulate creating a credit note or adding to Advance Adjustments
           setAdvanceAdjustments(prev => [{
             id: 'ADJ-OVER-' + Date.now(),
             invoiceId: adj.sourceMilestoneId,
             amount: adjAmount,
             reason: 'Transferred from Overpayment',
             status: 'APPROVED'
           }, ...prev]);
        } else if (adj.type === 'UNDERPAYMENT' || adj.type === 'WRONG_PAYMENT') {
           // Wrong payment resets collected amount
           // Underpayment might increase remaining amount
           setPayments(prev => prev.map(p => {
             if (p.id === adj.sourceMilestoneId) {
               return {
                 ...p,
                 remainingAmount: p.remainingAmount + adjAmount,
                 collectedAmount: Math.max(0, p.collectedAmount - adjAmount),
                 status: (p.remainingAmount + adjAmount) > 0 ? 'overdue' : p.status
               };
             }
             return p;
           }));
        } else if (adj.type === 'TRANSFER') {
           setPayments(prev => prev.map(p => {
             if (p.id === adj.sourceMilestoneId) {
               // Taking money back out (increases remaining amount)
               return {
                 ...p,
                 remainingAmount: p.remainingAmount + adjAmount,
                 collectedAmount: Math.max(0, p.collectedAmount - adjAmount),
                 status: (p.remainingAmount + adjAmount) > 0 ? 'overdue' : p.status
               };
             }
             if (p.id === adj.targetMilestoneId) {
               // Putting money in (decreases remaining amount)
               const newRemaining = Math.max(0, p.remainingAmount - adjAmount);
               return {
                 ...p,
                 remainingAmount: newRemaining,
                 collectedAmount: p.collectedAmount + adjAmount,
                 status: newRemaining === 0 ? 'paid' : p.status
               };
             }
             return p;
           }));
        }
      }
      
      // Hit API
      await api.post(`/financial-approvals/${approval.id}/approve`);
      fetchApprovals();

      // Append to immutable audit log
      let oldV = 0, newV = approval.amount;
      if (type === 'Manual Payment') {
         oldV = payload.selectedPayment?.collectedAmount || 0;
         newV = payload.newCollected || 0;
      }
      appendAuditLog(`Approve ${type}`, type, oldV, newV, approval.reason);

      toast.success(`${type} approved and executed successfully.`);
    } catch (err) {
      console.error(err);
      toast.error(`Failed to execute ${type}`);
    }
  };

  const handleRejectAction = async (approvalId) => {
    try {
      await api.post(`/financial-approvals/${approvalId}/reject`, { rejectionReason: 'Rejected by Finance Admin' });
      fetchApprovals();
      toast.success('Approval request rejected');
    } catch (err) {
      toast.error('Failed to reject approval');
    }
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

  const handleDeleteInvoice = async (invoiceId) => {
    if (!await confirm("Are you sure you want to delete this invoice?")) return;
    try {
      await deleteInvoice(invoiceId);
      setInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
      toast.success("Invoice deleted successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete invoice");
    }
  };

  // Payment Links States
  const [paymentLinks, setPaymentLinks] = useState([]);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkForm, setLinkForm] = useState({ expiryDays: 3 });
  const [selectedMilestoneForLink, setSelectedMilestoneForLink] = useState(null);


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
        
        const fallbackBudget = Number(project?.booking_amount || 0) > 0 ? Number(project.booking_amount) * 10 : 0;
        const totalB = Number(project?.contract_value || 0) || fallbackBudget || 0;
        
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

        // Inject missing full lifecycle milestones ONLY if no milestones exist from API
        if (raw.length === 0) {
          activeMilestones.forEach((mConf, index) => {
            let mockDate = new Date(project?.created_at || project?.createdAt || Date.now());
            mockDate.setDate(mockDate.getDate() + (index * 15));
            const milestoneAmount = (totalB * mConf.percentage) / 100;
            let mockPaymentEntries = [];
            let mockStatus = index === 0 ? 'pending' : 'scheduled';
            
            // Inject mock payment data for the first two milestones
            if (index === 0) {
               mockStatus = 'paid';
               mockPaymentEntries = [{
                 id: `mock_txn_${Date.now()}_1`,
                 amount: milestoneAmount,
                 paidAt: mockDate.toISOString(),
                 mode: 'Bank Transfer',
                 collectedByName: 'System Mock',
                 collectedByRole: 'Admin'
               }];
            } else if (index === 1) {
               mockStatus = 'partially_paid';
               mockPaymentEntries = [{
                 id: `mock_txn_${Date.now()}_2`,
                 amount: milestoneAmount * 0.5, // 50% paid
                 paidAt: mockDate.toISOString(),
                 mode: 'UPI',
                 collectedByName: 'System Mock',
                 collectedByRole: 'Admin'
               }];
            }

            const mockEntry = {
              id: `mock_m_${mConf.key}_${index}`,
              title: mConf.name || mConf.key,
              phase: 'Project Lifecycle',
              amount: milestoneAmount,
              due_date: mockDate.toISOString().split('T')[0],
              status: mockStatus,
              dependency: mConf.dependency,
              payment_entries: mockPaymentEntries
            };
            if (index === 0) raw.unshift(mockEntry); // Booking at top
            else raw.push(mockEntry); // Rest appended
          });
        }

        setPayments(raw.map((p, index) => {
          const entries = p.payment_entries ? [...p.payment_entries] : [];
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
      getRefunds(projectId),
      getInvoicesByProject(projectId),
      getReceiptsByProject(projectId)
    ]).then(([cnRes, rfRes, invRes, recRes]) => {
      setCreditNotes(cnRes.data?.data || cnRes.data || []);
      setRefunds(rfRes.data?.data || rfRes.data || []);
      setInvoices(invRes.data?.data || invRes.data || []);
      setReceipts(recRes.data?.data || recRes.data || []);
    }).catch(err => {
      console.error('Failed to load credit notes or refunds:', err);
    });

    loadEscalations();
  }, [projectId]);

  // Derived Values
  const totalBudgetFallback = payments.reduce((sum, p) => sum + (p.amountValue || 0), 0) || (Number(project?.booking_amount || 0) > 0 ? Number(project.booking_amount) * 10 : 0);
  const totalBudget = project?.stats?.netContractValue || Number(project?.contract_value || 0) || totalBudgetFallback || 0;
  const totalArea = project?.measurements?.reduce((sum, r) => sum + (Number(r.area) || 0), 0) || 2040;
  const avgRate = totalArea > 0 ? Math.round(totalBudget / totalArea) : 0;
  
  const totalPaid = payments.reduce((sum, p) => sum + (p.collectedAmount || 0), 0);
  const outstandingBalance = payments.reduce((sum, p) => sum + (p.remainingAmount || 0), 0);
  
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

      // Update local payment status to reflect it is pending approval
      setPayments(prev => prev.map(p => p.id === selectedPayment.id ? { ...p, status: 'pending_approval' } : p));

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

  // Available Cost Items Catalog
  const baseAvailableItems = React.useMemo(() => {
    const rawType = project?.type || project?.project_type || 'Full Interior';
    const type = rawType.replace(/_/g, ' ').toLowerCase();
    let list = [];
    if (type === 'full interior') {
       list = [
         { label: 'Modular Kitchen (Cabinets, Shutters, Countertop, Accessories)' },
         { label: 'Wardrobes & Storage (Bedrooms, Walk-in, Loft, Foyer Storage)' },
         { label: 'TV Unit & Living Furniture (TV Panel, Console, Shelves)' },
         { label: 'False Ceiling (Gypsum, POP, Cove Lighting)' },
         { label: 'Lighting Fixtures (Decorative & Functional Lights)' },
         { label: 'Painting & Wallpaper (Interior Paint, Texture, Wallpaper)' },
         { label: 'Flooring & Tiling (Bathrooms, Balcony, Feature Tiles)' },
         { label: 'Electrical Works (Wiring, Switches, Additional Points)' },
         { label: 'Plumbing Works (Bathroom & Kitchen Modifications)' },
         { label: 'Bathroom Vanity & Accessories (Vanity, Mirror, Shower Partition)' },
         { label: 'Doors & Hardware (Door Polish, Locks, Handles)' },
         { label: 'Custom Furniture (Beds, Study Table, Shoe Rack)' },
         { label: 'Curtains & Blinds (Windows & Balcony)' },
         { label: 'Home Decor (Mirrors, Art, Accessories)' },
         { label: 'Project Management (Design, Site Supervision)' }
       ];
    } else if (type === 'modular kitchen') {
       list = [
         { label: 'Base Cabinets' },
         { label: 'Wall Cabinets' },
         { label: 'Tall Units' },
         { label: 'Loft Storage' },
         { label: 'Countertop' },
         { label: 'Backsplash' },
         { label: 'Sink & Faucet' },
         { label: 'Chimney' },
         { label: 'Hob' },
         { label: 'Built-in Appliances' },
         { label: 'Tandem & Accessories' },
         { label: 'Soft-close Hardware' },
         { label: 'Electrical Points' },
         { label: 'Plumbing Modifications' },
         { label: 'Installation Charges' }
       ];
    } else if (type === 'commercial' || type === 'commercial interior') {
       list = [
         { label: 'Space Planning' },
         { label: 'Partitions' },
         { label: 'Workstations' },
         { label: 'Cabins' },
         { label: 'Reception Counter' },
         { label: 'Conference Room' },
         { label: 'Pantry' },
         { label: 'False Ceiling' },
         { label: 'Flooring' },
         { label: 'Painting' },
         { label: 'Branding & Signage' },
         { label: 'Lighting' },
         { label: 'Electrical' },
         { label: 'Data & Networking' },
         { label: 'HVAC Modifications' },
         { label: 'Plumbing' },
         { label: 'Storage Units' },
         { label: 'Loose Furniture' },
         { label: 'Fire Safety' },
         { label: 'Project Management' }
       ];
    } else if (type === 'turnkey' || type === 'turnkey project') {
       list = [
         { label: 'Design & Drawings' },
         { label: 'Demolition' },
         { label: 'Civil Construction' },
         { label: 'Masonry Work' },
         { label: 'Flooring' },
         { label: 'Waterproofing' },
         { label: 'Plumbing' },
         { label: 'Electrical' },
         { label: 'HVAC' },
         { label: 'False Ceiling' },
         { label: 'Painting' },
         { label: 'Doors & Windows' },
         { label: 'Modular Kitchen' },
         { label: 'Wardrobes' },
         { label: 'Furniture' },
         { label: 'Glass & Aluminium' },
         { label: 'Railings' },
         { label: 'Landscaping' },
         { label: 'Final Cleaning' },
         { label: 'Project Management' }
       ];
    } else if (type === 'renovation') {
       list = [
         { label: 'Demolition' },
         { label: 'Debris Removal' },
         { label: 'Civil Repairs' },
         { label: 'Wall Modifications' },
         { label: 'Waterproofing' },
         { label: 'Flooring Replacement' },
         { label: 'Bathroom Renovation' },
         { label: 'Kitchen Renovation' },
         { label: 'Electrical Rewiring' },
         { label: 'Plumbing Replacement' },
         { label: 'False Ceiling' },
         { label: 'Painting' },
         { label: 'Doors & Windows' },
         { label: 'Wardrobes' },
         { label: 'Custom Furniture' },
         { label: 'Deep Cleaning' },
         { label: 'Project Management' }
       ];
    } else {
       list = [
         { label: 'Modular Kitchen (Cabinets, Countertop, Accessories)' },
         { label: 'Wardrobes & Storage (Bedrooms, Living, Foyer)' },
         { label: 'False Ceiling & Lighting' },
         { label: 'Painting & Wallpaper (Premium Finish)' },
         { label: 'Civil & Tiling Work (Bathrooms, Balcony)' },
         { label: 'Electrical & Plumbing Modifications' },
         { label: 'Custom Furniture (Beds, TV Unit, Study)' },
         { label: 'Soft Furnishings & Decor' },
         { label: 'Design & Management Fees' }
       ];
    }

    const itemValue = Math.round(totalBudget / list.length);
    return list.map((item, idx) => {
       const isLast = idx === list.length - 1;
       const val = isLast ? (totalBudget - (itemValue * (list.length - 1))) : itemValue;
       return {
         id: `item_${idx}`,
         label: item.label,
         value: val
       };
    });
  }, [project, totalBudget]);

  const availableCostItems = [...baseAvailableItems, ...customAvailableItems];

  const handleAddCostItem = (item) => {
    if (!selectedCostItems.find(i => i.id === item.id)) {
      setSelectedCostItems(prev => [...prev, item]);
    }
  };

  const handleRemoveCostItem = (itemId) => {
    setSelectedCostItems(prev => prev.filter(i => i.id !== itemId));
  };

  const handleOpenAddAvailableCostItem = () => {
    setEditingCostItemType('available');
    setEditingCostItem({ id: 'avail_' + Date.now(), label: '', value: '' });
    setCostItemModalOpen(true);
  };

  const handleOpenAddCostItem = () => {
    setEditingCostItemType('selected');
    setEditingCostItem({ id: 'custom_' + Date.now(), label: '', value: '' });
    setCostItemModalOpen(true);
  };

  const handleOpenCustomizeCostItem = (item) => {
    setEditingCostItemType('selected');
    setEditingCostItem({ ...item });
    setCostItemModalOpen(true);
  };

  const handleSaveCostItem = () => {
    if (!editingCostItem.label || editingCostItem.value === '') {
      toast.error('Please provide a label and value.');
      return;
    }
    
    if (editingCostItemType === 'available') {
      setCustomAvailableItems(prev => [...prev, { ...editingCostItem, value: Number(editingCostItem.value) }]);
    } else {
      setSelectedCostItems(prev => {
        const exists = prev.find(i => i.id === editingCostItem.id);
        if (exists) {
          return prev.map(i => i.id === editingCostItem.id ? { ...editingCostItem, value: Number(editingCostItem.value) } : i);
        }
        return [...prev, { ...editingCostItem, value: Number(editingCostItem.value) }];
      });
    }
    setCostItemModalOpen(false);
  };

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
      return computed.filter(c => (c.type || '').toUpperCase() === ledgerFilterType);
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
             <Button variant="outline" onClick={async () => setIsCustomerPortalView(false)}>Exit to Admin</Button>
             <Button onClick={async () => {
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
           <Button variant="outline" size="sm" onClick={async () => { setIsCustomerPortalView(false); setIsPortalAuthenticated(false); setPortalPin(''); }}>Exit Portal (Admin Only)</Button>
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
                           isPending && <Button size="sm" onClick={async () => toast.info('Redirecting to Cashfree secure checkout...')}>Pay Online Now</Button>
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
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>{(inv.type || 'TAX_INVOICE').replace('_', ' ')}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>₹{inv.amount.toLocaleString('en-IN')}</div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={async () => handlePrintPDF(inv)}>Download PDF</Button>
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
          <Button variant="outline" size="sm" onClick={async () => setIsCustomerPortalView(true)}>
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
      <div className={styles.subTabsContainer} ref={subTabsRef}>
        {['dashboard', 'collections', 'breakdown', 'logs', 'audit_logs', 'milestones', 'gates', 'links', 'invoices', 'receipts', 'ledger', 'receivables', 'reminders', 'approvals'].map(tab => (
          <button
            key={tab}
            className={`${styles.subTab} ${activeSubTab === tab ? styles.subTabActive : ''}`}
            onClick={async () => setActiveSubTab(tab)}
          >
            {tab === 'dashboard' ? 'Dashboard' :
             tab === 'collections' ? 'Collections' :
             tab === 'breakdown' ? 'Cost Breakdown' : 
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
             tab === 'approvals' ? 'Approvals' : ''}
          </button>
        ))}
      </div>

      {/* Sub-Tab Content */}
      <div className={styles.subTabContent}>
        {activeSubTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>Finance Dashboard</h3>
               <PermissionButton module="finance" action="export_pdf" variant="outline" size="sm" onClick={handleExportDashboard}>
                 Export Report
               </PermissionButton>
            </div>

            {/* KPIs Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
               <div className={styles.creditCard} style={{ background: '#f8fafc', padding: '16px' }}>
                 <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Today's Collection</div>
                 <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginTop: '8px' }}>₹{dashboardData.todayCollection.toLocaleString('en-IN')}</div>
               </div>
               <div className={styles.creditCard} style={{ background: '#f8fafc', padding: '16px' }}>
                 <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Monthly Collection</div>
                 <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginTop: '8px' }}>₹{dashboardData.monthlyCollection.toLocaleString('en-IN')}</div>
               </div>
               <div className={styles.creditCard} style={{ background: '#f8fafc', padding: '16px' }}>
                 <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Outstanding</div>
                 <div style={{ fontSize: '18px', fontWeight: 700, color: '#ef4444', marginTop: '8px' }}>₹{dashboardData.outstanding.toLocaleString('en-IN')}</div>
               </div>
               <div className={styles.creditCard} style={{ background: '#f8fafc', padding: '16px' }}>
                 <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Overdue</div>
                 <div style={{ fontSize: '18px', fontWeight: 700, color: '#b91c1c', marginTop: '8px' }}>₹{dashboardData.overdue.toLocaleString('en-IN')}</div>
               </div>
               <div className={styles.creditCard} style={{ background: '#f8fafc', padding: '16px' }}>
                 <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Refunds</div>
                 <div style={{ fontSize: '18px', fontWeight: 700, color: '#f59e0b', marginTop: '8px' }}>₹{dashboardData.totalRefunds.toLocaleString('en-IN')}</div>
               </div>
               <div className={styles.creditCard} style={{ background: '#f8fafc', padding: '16px' }}>
                 <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Credit Notes Issued</div>
                 <div style={{ fontSize: '18px', fontWeight: 700, color: '#3b82f6', marginTop: '8px' }}>₹{dashboardData.totalCreditNotes.toLocaleString('en-IN')}</div>
               </div>
            </div>

            {/* Target Progress */}
            <div className={styles.card} style={{ padding: '24px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                 <div style={{ fontWeight: 600, color: '#1e293b' }}>Collection Target (Mock)</div>
                 <div style={{ color: '#64748b', fontSize: '14px' }}>
                   ₹{dashboardData.currentTotalCollected.toLocaleString('en-IN')} / ₹{dashboardData.collectionTarget.toLocaleString('en-IN')}
                 </div>
               </div>
               <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                 <div style={{ width: `${(dashboardData.currentTotalCollected / dashboardData.collectionTarget) * 100}%`, height: '100%', background: '#22c55e' }} />
               </div>
            </div>
            
            {/* Charts & Visuals */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
               {/* Cash Flow */}
               <div className={styles.creditCard} style={{ padding: '24px' }}>
                 <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '16px' }}>Cash Flow (Inflow vs Outflow)</div>
                 <div style={{ height: '220px', width: '100%' }}>
                   <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={dashboardData.cashFlowTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                       <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                       <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => "₹" + (v >= 1000 ? (v / 1000) + "k" : v)} />
                       <RechartsTooltip formatter={(v) => ["₹" + v.toLocaleString('en-IN'), undefined]} contentStyle={{ background: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px', border: 'none' }} />
                       <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                       <Bar dataKey="Inflow" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                       <Bar dataKey="Outflow" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                     </BarChart>
                   </ResponsiveContainer>
                 </div>
               </div>

               {/* Collection Trend */}
               <div className={styles.creditCard} style={{ padding: '24px' }}>
                 <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '16px' }}>Collection Trend</div>
                 <div style={{ height: '220px', width: '100%' }}>
                   <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={dashboardData.collectionTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                       <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                       <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => "₹" + (v >= 1000 ? (v / 1000) + "k" : v)} />
                       <RechartsTooltip formatter={(v) => ["₹" + v.toLocaleString('en-IN'), "Collection"]} contentStyle={{ background: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px', border: 'none' }} />
                       <Area type="monotone" dataKey="Collection" stroke="#10b981" fill="#10b981" fillOpacity={0.2} strokeWidth={2} />
                     </AreaChart>
                   </ResponsiveContainer>
                 </div>
               </div>
            </div>

            {/* Tables Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
               {/* Receivable Aging */}
               <div className={styles.creditCard} style={{ padding: '24px' }}>
                  <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '16px' }}>Receivable Aging</div>
                  <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                    <tbody>
                      {dashboardData.aging.map((r, i) => (
                        <tr key={i} style={{ borderBottom: i !== 3 ? '1px solid #e2e8f0' : 'none' }}>
                         <td style={{ padding: '12px 0', color: '#475569' }}>{r.label}</td>
                         <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 600, color: i > 1 && r.val > 0 ? '#ef4444' : '#1e293b' }}>₹{r.val.toLocaleString('en-IN')}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>

          </div>
        )}

        {activeSubTab === 'collections' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>Collection Dashboard</h3>
              <div style={{ display: 'flex', gap: '12px' }}>
                <select 
                  className={styles.input} 
                  value={collectionFilters.priority} 
                  onChange={(e) => setCollectionFilters(prev => ({...prev, priority: e.target.value}))}
                  style={{ width: '150px' }}
                >
                  <option value="All">All Priorities</option>
                  <option value="HIGH">High Priority</option>
                  <option value="MEDIUM">Medium Priority</option>
                  <option value="LOW">Low Priority</option>
                  <option value="UPCOMING">Upcoming</option>
                </select>
                <select 
                  className={styles.input} 
                  value={collectionFilters.owner} 
                  onChange={(e) => setCollectionFilters(prev => ({...prev, owner: e.target.value}))}
                  style={{ width: '150px' }}
                >
                  <option value="All">All Owners</option>
                  <option value="Finance Team A">Finance Team A</option>
                </select>
              </div>
            </div>

            {/* Collection KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              <div className={styles.creditCard} style={{ background: '#f8fafc', padding: '16px', borderLeft: '4px solid #ef4444' }}>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Overdue Follow-ups</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', marginTop: '8px' }}>{collectionData.kpis.overdueCount}</div>
              </div>
              <div className={styles.creditCard} style={{ background: '#f8fafc', padding: '16px', borderLeft: '4px solid #3b82f6' }}>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Upcoming Dues</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', marginTop: '8px' }}>{collectionData.kpis.upcomingCount}</div>
              </div>
              <div className={styles.creditCard} style={{ background: '#f8fafc', padding: '16px', borderLeft: '4px solid #f59e0b' }}>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Active Promises (PTP)</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', marginTop: '8px' }}>{collectionData.kpis.ptpCount}</div>
              </div>
              <div className={styles.creditCard} style={{ background: '#f8fafc', padding: '16px', borderLeft: '4px solid #10b981' }}>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Followed-Up Today</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', marginTop: '8px' }}>{collectionData.kpis.todayFollowUpCount}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' }}>
              {/* Action List */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Action List</h4>
                </div>
                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  {collectionData.items.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>No pending actions.</div>
                  ) : (
                    collectionData.items.map((item, idx) => (
                      <div 
                        key={idx} 
                        style={{ 
                          padding: '16px', 
                          borderBottom: '1px solid #f1f5f9', 
                          cursor: 'pointer',
                          background: selectedCollectionItem?.id === item.id ? '#f0f9ff' : 'transparent'
                        }}
                        onClick={async () => setSelectedCollectionItem(item)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 600, color: '#1e293b' }}>{item.milestone}</span>
                          <span style={{ 
                            padding: '2px 8px', 
                            borderRadius: '12px', 
                            fontSize: '12px', 
                            fontWeight: 600,
                            background: item.priority === 'HIGH' ? '#fee2e2' : item.priority === 'MEDIUM' ? '#fef3c7' : item.priority === 'LOW' ? '#f1f5f9' : '#dcfce7',
                            color: item.priority === 'HIGH' ? '#b91c1c' : item.priority === 'MEDIUM' ? '#b45309' : item.priority === 'LOW' ? '#475569' : '#166534'
                          }}>
                            {item.priority}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#475569' }}>
                          <span>Due: {new Date(item.dueDate).toLocaleDateString()}</span>
                          <span style={{ fontWeight: 600, color: '#ef4444' }}>₹{item.remainingAmount.toLocaleString('en-IN')}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '8px', color: '#64748b' }}>
                          <span>{item.daysOverdue > 0 ? `${item.daysOverdue} days overdue` : 'Upcoming'}</span>
                          {item.latestPtp && (
                            <span style={{ color: '#f59e0b', fontWeight: 600 }}>PTP: {new Date(item.latestPtp.ptpDate).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Action Center */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Action Center</h4>
                </div>
                {!selectedCollectionItem ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>Select a milestone from the list to take action.</div>
                ) : (
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ fontWeight: 600, marginBottom: '4px' }}>{selectedCollectionItem.milestone}</div>
                      <div style={{ fontSize: '14px', color: '#475569' }}>Outstanding: ₹{selectedCollectionItem.remainingAmount.toLocaleString('en-IN')}</div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '14px', fontWeight: 500 }}>Call Status</label>
                      <select 
                        className={styles.input}
                        value={collectionActionForm.callStatus}
                        onChange={(e) => setCollectionActionForm(prev => ({...prev, callStatus: e.target.value}))}
                      >
                        <option value="Connected">Connected</option>
                        <option value="No Answer">No Answer</option>
                        <option value="Busy">Busy</option>
                        <option value="Wrong Number">Wrong Number</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '14px', fontWeight: 500 }}>Collection Notes</label>
                      <textarea 
                        className={styles.input} 
                        style={{ height: '80px', resize: 'none' }}
                        placeholder="Log details of the conversation..."
                        value={collectionActionForm.note}
                        onChange={(e) => setCollectionActionForm(prev => ({...prev, note: e.target.value}))}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '14px', fontWeight: 500 }}>Promise To Pay (PTP) Date</label>
                      <input 
                        type="date" 
                        className={styles.input} 
                        value={collectionActionForm.ptpDate}
                        onChange={(e) => setCollectionActionForm(prev => ({...prev, ptpDate: e.target.value}))}
                      />
                    </div>

                    <Button variant="primary" onClick={handleLogCollectionAction}>Log Action</Button>

                    <div style={{ marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                      <h5 style={{ margin: 0, marginBottom: '12px', fontSize: '14px', fontWeight: 600 }}>Reminder & Call History</h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '200px', overflowY: 'auto' }}>
                        {selectedCollectionItem.history.length === 0 ? (
                          <div style={{ fontSize: '12px', color: '#94a3b8' }}>No previous history logged.</div>
                        ) : (
                          selectedCollectionItem.history.map((h, i) => (
                            <div key={i} style={{ fontSize: '12px', background: '#f1f5f9', padding: '8px', borderRadius: '4px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', marginBottom: '4px' }}>
                                <span>{new Date(h.date).toLocaleString()}</span>
                                <span style={{ fontWeight: 600 }}>{h.callStatus}</span>
                              </div>
                              <div style={{ color: '#1e293b' }}>{h.note}</div>
                              <div style={{ color: '#94a3b8', marginTop: '4px', fontStyle: 'italic' }}>By: {h.loggedBy}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {false && activeSubTab === 'tally_sync' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Tally Integration / ERP Sync</h3>
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button variant="outline" size="sm" onClick={async () => handleTriggerSync('Customers')}>Sync Customers</Button>
                <Button variant="outline" size="sm" onClick={async () => handleTriggerSync('Invoices')}>Sync Invoices</Button>
                <Button variant="outline" size="sm" onClick={async () => handleTriggerSync('Payments')}>Sync Payments</Button>
                <Button variant="outline" size="sm" onClick={async () => handleTriggerSync('Ledger Entries')}>Sync Ledger</Button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div className={styles.creditCard} style={{ background: '#f8fafc', padding: '16px', borderLeft: '4px solid #3b82f6' }}>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Sync Attempts</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', marginTop: '8px' }}>{syncLogs.length}</div>
              </div>
              <div className={styles.creditCard} style={{ background: '#f8fafc', padding: '16px', borderLeft: '4px solid #10b981' }}>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Successful Syncs</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', marginTop: '8px' }}>{syncLogs.filter(s => s.status === 'SUCCESS').length}</div>
              </div>
              <div className={styles.creditCard} style={{ background: '#f8fafc', padding: '16px', borderLeft: '4px solid #ef4444' }}>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Failed Syncs</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', marginTop: '8px' }}>{syncLogs.filter(s => s.status === 'FAILED').length}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
              {/* Configuration */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Tally Ledger Mapping</h4>
                </div>
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Sales Ledger Account</label>
                    <input 
                      type="text" 
                      className={styles.input} 
                      value={erpMappings.salesLedger}
                      onChange={(e) => setErpMappings({...erpMappings, salesLedger: e.target.value})}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Bank Account Ledger</label>
                    <input 
                      type="text" 
                      className={styles.input} 
                      value={erpMappings.bankLedger}
                      onChange={(e) => setErpMappings({...erpMappings, bankLedger: e.target.value})}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>CGST Ledger</label>
                      <input 
                        type="text" 
                        className={styles.input} 
                        value={erpMappings.cgstLedger}
                        onChange={(e) => setErpMappings({...erpMappings, cgstLedger: e.target.value})}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>SGST Ledger</label>
                      <input 
                        type="text" 
                        className={styles.input} 
                        value={erpMappings.sgstLedger}
                        onChange={(e) => setErpMappings({...erpMappings, sgstLedger: e.target.value})}
                      />
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={async () => toast.success('Mappings saved successfully.')}>Save Configuration</Button>
                </div>
              </div>

              {/* Sync Log */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Sync Activity Log</h4>
                </div>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Entity Type</th>
                      <th>Identifier</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncLogs.length === 0 ? (
                      <tr><td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>No sync history found.</td></tr>
                    ) : (
                      syncLogs.map((log) => (
                        <tr key={log.id}>
                          <td>{new Date(log.date).toLocaleString()}</td>
                          <td><span style={{ fontWeight: 600, color: '#475569' }}>{log.type}</span></td>
                          <td>{log.entityName}</td>
                          <td>
                            <span style={{ 
                              padding: '2px 8px', 
                              borderRadius: '12px', 
                              fontSize: '12px', 
                              fontWeight: 600,
                              background: log.status === 'SUCCESS' ? '#dcfce7' : '#fee2e2',
                              color: log.status === 'SUCCESS' ? '#166534' : '#b91c1c'
                            }}>
                              {log.status}
                            </span>
                            {log.message && <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>{log.message}</div>}
                          </td>
                          <td>
                            {log.status === 'FAILED' && (
                              <button 
                                onClick={async () => handleRetrySync(log.id)}
                                style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                              >
                                Retry
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {false && activeSubTab === 'adjustments' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Payment Adjustments</h3>
              {hasPermission('Manage Invoices') && (
                <Button variant="primary" size="sm" onClick={async () => setAdjustmentModalOpen(true)}>Request Adjustment</Button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div className={styles.creditCard} style={{ background: '#f8fafc', padding: '16px', borderLeft: '4px solid #3b82f6' }}>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Adjustments</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', marginTop: '8px' }}>{paymentAdjustments.length}</div>
              </div>
              <div className={styles.creditCard} style={{ background: '#f8fafc', padding: '16px', borderLeft: '4px solid #f59e0b' }}>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Pending Approvals</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', marginTop: '8px' }}>{financeApprovals.filter(a => a.type === 'Payment Adjustment' && a.status === 'PENDING').length}</div>
              </div>
              <div className={styles.creditCard} style={{ background: '#f8fafc', padding: '16px', borderLeft: '4px solid #10b981' }}>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Approved Actions</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', marginTop: '8px' }}>{paymentAdjustments.filter(a => a.status === 'APPROVED').length}</div>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Adjustment History</h4>
              </div>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Source</th>
                    <th>Target</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentAdjustments.length === 0 ? (
                    <tr><td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>No adjustments recorded.</td></tr>
                  ) : (
                    paymentAdjustments.map((adj) => (
                      <tr key={adj.id}>
                        <td style={{ fontSize: '12px', color: '#64748b' }}>{adj.id}</td>
                        <td>{new Date(adj.date).toLocaleDateString()}</td>
                        <td><span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '12px', background: '#f1f5f9', fontWeight: 600 }}>{adj.type}</span></td>
                        <td>{adj.sourceName || adj.sourceMilestoneId}</td>
                        <td>{adj.type === 'TRANSFER' ? (adj.targetName || adj.targetMilestoneId) : '-'}</td>
                        <td style={{ fontWeight: 600, color: '#3b82f6' }}>₹{Number(adj.amount).toLocaleString('en-IN')}</td>
                        <td>
                          <span style={{ 
                            padding: '2px 8px', 
                            borderRadius: '12px', 
                            fontSize: '12px', 
                            background: adj.status === 'APPROVED' ? '#dcfce7' : adj.status === 'PENDING' ? '#fef3c7' : '#fee2e2',
                            color: adj.status === 'APPROVED' ? '#166534' : adj.status === 'PENDING' ? '#b45309' : '#b91c1c'
                          }}>
                            {adj.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {adjustmentModalOpen && (
              <div className={styles.modalOverlay}>
                <div className={styles.modalContent} style={{ maxWidth: '500px' }}>
                  <h3 style={{ margin: 0, marginBottom: '24px', fontSize: '18px', fontWeight: 600 }}>Request Payment Adjustment</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '14px', fontWeight: 500 }}>Adjustment Type</label>
                      <select 
                        className={styles.input}
                        value={adjustmentForm.type}
                        onChange={(e) => setAdjustmentForm({...adjustmentForm, type: e.target.value})}
                      >
                        <option value="OVERPAYMENT">Overpayment (Move to Credit/Advance)</option>
                        <option value="UNDERPAYMENT">Underpayment (Short Payment)</option>
                        <option value="WRONG_PAYMENT">Wrong Payment (Nullify)</option>
                        <option value="TRANSFER">Transfer Between Invoices</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '14px', fontWeight: 500 }}>Source Milestone/Invoice</label>
                      <select 
                        className={styles.input}
                        value={adjustmentForm.sourceMilestoneId}
                        onChange={(e) => setAdjustmentForm({...adjustmentForm, sourceMilestoneId: e.target.value})}
                      >
                        <option value="">Select Source...</option>
                        {payments.map(p => (
                          <option key={p.id} value={p.id}>{p.milestone} (Paid: ₹{p.collectedAmount?.toLocaleString('en-IN')})</option>
                        ))}
                      </select>
                    </div>

                    {adjustmentForm.type === 'TRANSFER' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '14px', fontWeight: 500 }}>Target Milestone/Invoice</label>
                        <select 
                          className={styles.input}
                          value={adjustmentForm.targetMilestoneId}
                          onChange={(e) => setAdjustmentForm({...adjustmentForm, targetMilestoneId: e.target.value})}
                        >
                          <option value="">Select Target...</option>
                          {payments.map(p => (
                            <option key={p.id} value={p.id}>{p.milestone} (Due: ₹{p.remainingAmount?.toLocaleString('en-IN')})</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '14px', fontWeight: 500 }}>Amount (₹)</label>
                      <input 
                        type="number" 
                        className={styles.input}
                        placeholder="Enter adjustment amount"
                        value={adjustmentForm.amount}
                        onChange={(e) => setAdjustmentForm({...adjustmentForm, amount: e.target.value})}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '14px', fontWeight: 500 }}>Reason / Justification</label>
                      <textarea 
                        className={styles.input}
                        placeholder="Explain why this adjustment is needed"
                        value={adjustmentForm.reason}
                        onChange={(e) => setAdjustmentForm({...adjustmentForm, reason: e.target.value})}
                        style={{ height: '80px', resize: 'none' }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                      <Button variant="outline" onClick={async () => setAdjustmentModalOpen(false)}>Cancel</Button>
                      <Button variant="primary" onClick={handleRequestAdjustment}>Submit for Approval</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {false && activeSubTab === 'reconciliation' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Bank Reconciliation</h3>
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button variant="outline" size="sm" onClick={handleImportStatement}>
                  Import CSV
                </Button>
                <Button variant="primary" size="sm" onClick={handleAutoReconcile}>
                  Auto Reconcile
                </Button>
              </div>
            </div>

            {/* Reconciliation Report Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div className={styles.creditCard} style={{ background: '#f8fafc', padding: '16px' }}>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Imported Txns</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', marginTop: '8px' }}>{bankStatements.length}</div>
              </div>
              <div className={styles.creditCard} style={{ background: '#f8fafc', padding: '16px' }}>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Reconciled</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#10b981', marginTop: '8px' }}>{reconciledMatches.length}</div>
              </div>
              <div className={styles.creditCard} style={{ background: '#f8fafc', padding: '16px' }}>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Exceptions (Unmatched)</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#ef4444', marginTop: '8px' }}>{bankStatements.filter(b => !b.reconciled).length}</div>
              </div>
            </div>

            {/* Unmatched Bank Transactions */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Exceptions: Unmatched Bank Transactions</h4>
              </div>
              <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>
                    <th style={{ padding: '12px 8px', fontWeight: 600 }}>Txn ID</th>
                    <th style={{ padding: '12px 8px', fontWeight: 600 }}>Date</th>
                    <th style={{ padding: '12px 8px', fontWeight: 600 }}>Reference</th>
                    <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>Amount</th>
                    <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bankStatements.filter(b => !b.reconciled).length === 0 ? (
                    <tr><td colSpan="5" style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>No unmatched bank transactions.</td></tr>
                  ) : bankStatements.filter(b => !b.reconciled).map((txn, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 8px', color: '#1e293b' }}>{txn.id}</td>
                      <td style={{ padding: '12px 8px', color: '#475569' }}>{new Date(txn.date).toLocaleDateString()}</td>
                      <td style={{ padding: '12px 8px', color: '#475569' }}>{txn.reference}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', color: '#1e293b', fontWeight: 600 }}>₹{txn.amount.toLocaleString('en-IN')}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                        <Button variant="outline" size="sm" onClick={async () => handleManualReconcile(txn.id, null)}>Manual Link</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Reconciled Ledger */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Reconciled Ledger</h4>
              </div>
              <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>
                    <th style={{ padding: '12px 8px', fontWeight: 600 }}>Match ID</th>
                    <th style={{ padding: '12px 8px', fontWeight: 600 }}>Date Matched</th>
                    <th style={{ padding: '12px 8px', fontWeight: 600 }}>Bank Txn ID</th>
                    <th style={{ padding: '12px 8px', fontWeight: 600 }}>CRM Payment ID</th>
                    <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>Amount Reconciled</th>
                  </tr>
                </thead>
                <tbody>
                  {reconciledMatches.length === 0 ? (
                    <tr><td colSpan="5" style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>No reconciled records yet.</td></tr>
                  ) : reconciledMatches.map((match, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 8px', color: '#10b981', fontWeight: 500 }}>{match.id}</td>
                      <td style={{ padding: '12px 8px', color: '#475569' }}>{new Date(match.date).toLocaleDateString()}</td>
                      <td style={{ padding: '12px 8px', color: '#475569' }}>{match.bankTxn.id}</td>
                      <td style={{ padding: '12px 8px', color: '#475569' }}>{match.crmTxn.id}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', color: '#1e293b', fontWeight: 600 }}>₹{match.bankTxn.amount.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeSubTab === 'breakdown' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div className={styles.breakdownList}>
              <div className={styles.breakdownHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>AVAILABLE COST ITEMS</span>
                <Button variant="outline" size="sm" onClick={handleOpenAddAvailableCostItem}>+ Add Custom Item</Button>
              </div>
              {availableCostItems.map((item, idx) => {
                const isSelected = selectedCostItems.some(i => i.id === item.id);
                return (
                  <div key={item.id} className={styles.breakdownRow} style={{ opacity: isSelected ? 0.5 : 1 }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span>{item.label}</span>
                      <span className={styles.breakdownValue}>₹{item.value.toLocaleString('en-IN')}</span>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={async () => handleAddCostItem(item)}
                      disabled={isSelected}
                    >
                      {isSelected ? 'Added' : 'Add to Breakdown'}
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className={styles.breakdownList}>
              <div className={styles.breakdownHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>SELECTED COST BREAKDOWN</span>
                <Button variant="outline" size="sm" onClick={handleOpenAddCostItem}>+ Add Custom Item</Button>
              </div>
              {selectedCostItems.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  No items added to the cost breakdown yet. Select items from the available list or add a custom item.
                </div>
              ) : (
                selectedCostItems.map((item) => (
                  <div key={item.id} className={styles.breakdownRow}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span>{item.label}</span>
                      <span className={styles.breakdownValue}>₹{item.value.toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Button variant="outline" size="sm" onClick={async () => handleOpenCustomizeCostItem(item)}>Customize</Button>
                      <Button variant="danger" size="sm" onClick={async () => handleRemoveCostItem(item.id)}>Remove</Button>
                    </div>
                  </div>
                ))
              )}
              {selectedCostItems.length > 0 && (
                <div className={styles.breakdownRow} style={{ borderTop: '2px solid var(--color-border)', fontWeight: 700, marginTop: '8px' }}>
                  <span>Total Selected</span>
                  <span className={styles.breakdownValue}>₹{selectedCostItems.reduce((acc, curr) => acc + curr.value, 0).toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className={styles.breakdownRow} style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                Project Total Budget: ₹{totalBudget.toLocaleString('en-IN')}
              </div>
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
                    {!p.dependencyMet && p.status !== 'paid' && p.status !== 'partially_paid' && p.status !== 'pending_approval' && <span style={{fontSize: '12px', marginLeft: '8px', color: 'var(--color-text-muted)'}}>🔒 (Locked)</span>}
                  </div>
                  <Badge variant={p.displayStatus === 'paid' ? 'success' : (p.displayStatus === 'partially_paid' ? 'warning' : (p.displayStatus === 'pending_approval' ? 'info' : (p.isOverdue ? 'danger' : 'neutral')))} size="sm">
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
                    <span className={styles.mCardValue}>{p.dueDate ? p.dueDate.split('-').reverse().join('/') : '—'}</span>
                  </div>
                </div>
                <div className={styles.mCardFooter}>
                  {p.status !== 'paid' && p.status !== 'pending_approval' && hasPermission('Create') && (
                    <Button 
                      variant="primary" 
                      size="sm" 
                      onClick={async () => handleMarkPaidClick(p)}
                      disabled={!p.dependencyMet}
                      style={!p.dependencyMet ? {opacity: 0.5, cursor: 'not-allowed'} : {}}
                    >
                      {p.dependencyMet ? 'Collect Payment' : 'Dependency Pending'}
                    </Button>
                  )}
                  {p.status === 'pending_approval' && (
                    <span style={{fontSize: '13px', color: '#0ea5e9', fontWeight: 500}}>Waiting for Finance Approval</span>
                  )}
                  {p.status !== 'paid' && p.dependencyMet && hasPermission('Create') && (
                    <Button variant="outline" size="sm" onClick={async () => handleGenerateLinkClick(p)}>Generate Link</Button>
                  )}
                  {p.status !== 'paid' && p.dependencyMet && hasPermission('Create') && hasPermission('Refund') && (
                    <Button variant="ghost" size="sm" style={{ color: 'var(--color-text-muted)' }} onClick={async () => handleRequestWriteOff(p)}>Write-off</Button>
                  )}
                  {p.isOverdue && p.daysOverdue >= 15 && (
                    <Button variant="outline" size="sm" style={{ color: 'var(--color-warning)', borderColor: 'var(--color-warning)' }} onClick={async () => {
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
                      <Button variant="outline" size="sm" onClick={async () => handleRequestGateOverride(gate)}>Admin Override</Button>
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
                            <Button variant="ghost" size="sm" onClick={async () => { navigator.clipboard.writeText(link.url); toast.success('Link copied'); }}>Copy Link</Button>
                            <Button variant="outline" size="sm" onClick={async () => handleCancelLink(link.id)} style={{color: 'var(--color-danger)', borderColor: 'var(--color-danger)'}}>Cancel Link</Button>
                          </div>
                        ) : link.status === 'expired' || link.status === 'cancelled' ? (
                          hasPermission('Create') ? <Button variant="outline" size="sm" onClick={async () => handleGenerateLinkClick({id: link.milestoneId, milestone: link.milestoneName, remainingAmount: link.amount})}>Regenerate</Button> : null
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
                <Button variant="primary" size="sm" onClick={async () => setInvoiceModalOpen(true)}>Generate Invoice</Button>
             </div>
             {invoices.length === 0 ? <div className={styles.emptyState}>No invoices generated.</div> : (
                invoices.map(inv => (
                  <div key={inv.id} className={styles.creditCard}>
                    <div className={styles.cCardHeader}>
                      <span style={{fontWeight: 600}}>{inv.id} <Badge size="sm">{(inv.type || 'TAX_INVOICE').replace('_', ' ')}</Badge></span>
                      <span className={styles.cCardAmount}>₹{Number(inv.amount).toLocaleString('en-IN')}</span>
                    </div>
                    <div className={styles.cCardBody}>
                      <span>Date: {new Date(inv.date).toLocaleDateString('en-IN')}</span>
                      <span>Customer: {inv.customerName}</span>
                      <span>Milestone Ref: {inv.milestoneId || 'General'}</span>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                        <span>Status: <Badge variant="success" size="sm">{inv.status}</Badge> | Version: {inv.version}</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <Button variant="outline" size="sm" onClick={async () => handlePrintPDF(inv)}>Download PDF</Button>
                          <Button variant="danger" size="sm" onClick={async () => handleDeleteInvoice(inv.id)}>Delete</Button>
                        </div>
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
                        <Button variant="outline" size="sm" onClick={async () => {
                          setPrintingReceipt(rec);
                          setTimeout(() => window.print(), 100);
                        }}>Download PDF</Button>
                        <Button variant="outline" size="sm" onClick={async () => toast.success('Receipt emailed to customer!')}>Email</Button>
                        <Button variant="outline" size="sm" style={{borderColor: '#25D366', color: '#25D366'}} onClick={async () => toast.success('Receipt sent via WhatsApp!')}>WhatsApp</Button>
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
                       <Button size="sm" onClick={async () => handleDispatchReminder(rem.milestoneId, rem.milestoneName, rem.ruleKey)}>Dispatch Now</Button>
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
                           <Button variant="ghost" size="sm" onClick={async () => handleManualResend(log)}>Resend</Button>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               )}
             </div>
          </div>
        )}

        {false && activeSubTab === 'credits' && (
          <div className={styles.creditsList}>
            <div className={styles.creditsSection}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: 0 }}>Advances & Adjustments</h4>
                {hasPermission('Create') && <Button variant="outline" size="sm" onClick={async () => setManualAdjustmentModalOpen(true)}>Manual Override</Button>}
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
                               <Button size="sm" variant="primary" onClick={async () => handleApproveAdjustment(adj.id)}>Approve</Button>
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
                {hasPermission('Refund') && <Button variant="outline" size="sm" onClick={async () => setRefundModalOpen(true)}>Record Refund</Button>}
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
                {hasPermission('Create') && <Button variant="outline" size="sm" onClick={async () => setCreditNoteModalOpen(true)}>Issue Credit Note</Button>}
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
                {hasPermission('Create') && <Button variant="outline" size="sm" onClick={async () => setDebitNoteModalOpen(true)}>Issue Debit Note</Button>}
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
                             <Button size="sm" variant="outline" onClick={async () => handlePrintPDF({...dn, type: 'DEBIT_NOTE'})}>Download PDF</Button>
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

        {activeSubTab === 'approvals' && (() => {
          const totalPendingAmount = financeApprovals.filter(a => a.status === 'PENDING').reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
          const pendingCount = financeApprovals.filter(a => a.status === 'PENDING').length;
          const approvedCount = financeApprovals.filter(a => a.status === 'APPROVED').length;
          const filteredApprovals = financeApprovals.filter(a => approvalsFilter === 'ALL' || a.status === approvalsFilter);

          return (
          <div className={styles.approvalsList}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ margin: 0 }}>Finance Approvals Queue</h4>
            </div>

            {/* Metrics Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div style={{ background: 'var(--color-surface)', padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Pending Amount</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ca8a04' }}>₹{totalPendingAmount.toLocaleString('en-IN')}</div>
              </div>
              <div style={{ background: 'var(--color-surface)', padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Awaiting Approval</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-text)' }}>{pendingCount} Requests</div>
              </div>
              <div style={{ background: 'var(--color-surface)', padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>Total Approved</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-success)' }}>{approvedCount} Requests</div>
              </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(f => (
                <button 
                  key={f}
                  onClick={async () => setApprovalsFilter(f)}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '20px',
                    border: `1px solid ${approvalsFilter === f ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: approvalsFilter === f ? 'var(--color-primary-bg, #eff6ff)' : 'transparent',
                    color: approvalsFilter === f ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    fontSize: '13px',
                    fontWeight: approvalsFilter === f ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
            
            {filteredApprovals.length === 0 ? (
              <div className={styles.emptyState}>No approvals match this filter.</div>
            ) : (
              <div style={{ overflowX: 'auto', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-surface-hover)', textAlign: 'left' }}>
                      <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>Date</th>
                      <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>Requester</th>
                      <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>Type & Reason</th>
                      <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>Amount & Breakdown</th>
                      <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>Status</th>
                      <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApprovals.map(approval => (
                      <tr key={approval.id} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.2s', _hover: { background: 'var(--color-surface-hover)' } }}>
                        <td style={{ padding: '16px' }}>
                           <div style={{ fontWeight: 500 }}>{new Date(approval.date).toLocaleDateString('en-IN')}</div>
                           <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{new Date(approval.date).toLocaleTimeString('en-IN', {hour: '2-digit', minute:'2-digit'})}</div>
                        </td>
                        <td style={{ padding: '16px' }}>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                             <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--color-primary-bg)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px' }}>
                                {(approval.requester_name || 'U')[0].toUpperCase()}
                             </div>
                             <div>
                               <div style={{ fontWeight: 500 }}>{approval.requester_name || 'System User'}</div>
                             </div>
                           </div>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <div style={{ fontWeight: 600 }}>{approval.type}</div>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>{approval.reason || 'No specific reason provided'}</div>
                        </td>
                        <td style={{ padding: '16px' }}>
                          <div style={{ fontWeight: 600, color: approval.status === 'PENDING' ? '#ca8a04' : 'var(--color-text)' }}>
                            ₹{approval.amount.toLocaleString('en-IN')}
                          </div>
                          {approval.payload?.splitPayments && (
                            <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                              {approval.payload.splitPayments.map((sp, idx) => (
                                <Badge key={idx} size="sm" variant="outline">
                                  {sp.mode}: ₹{Number(sp.amount).toLocaleString('en-IN')}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '16px' }}>
                          <Badge size="sm" variant={approval.status === 'APPROVED' ? 'success' : (approval.status === 'REJECTED' ? 'danger' : 'warning')}>
                            {approval.status}
                          </Badge>
                        </td>
                        <td style={{ padding: '16px', textAlign: 'right' }}>
                          {approval.status === 'PENDING' ? (
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              {hasPermission('Approve') ? (
                                <>
                                  <Button size="sm" variant="outline" onClick={async () => handleRejectAction(approval.id)}>Reject</Button>
                                  <Button size="sm" variant="primary" onClick={async () => executeApprovedAction(approval)}>Approve</Button>
                                </>
                              ) : (
                                 <span style={{fontSize: '12px', color: 'var(--color-text-muted)'}}>Requires Approval</span>
                              )}
                            </div>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={async () => { setSelectedAuditApproval(approval); setAuditModalOpen(true); }}>
                              View Audit Trail
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          );
        })()}

        {false && activeSubTab === 'rbac' && simulateRole === 'Admin' && (
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
              <Button variant="ghost" onClick={async () => setManualAdjustmentModalOpen(false)}>Cancel</Button>
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
              <Button variant="ghost" onClick={async () => setWriteOffModalOpen(false)}>Cancel</Button>
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
                 {splitPayments.length > 1 && <Button variant="ghost" size="sm" onClick={async () => handleRemoveSplit(split.id)} style={{color: 'var(--color-danger)', position: 'absolute', top: '4px', right: '4px', padding: '4px'}}>✕</Button>}
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
              options={getCollectedByOptions()}
            />
            
            <div style={{display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-4)'}}>
              <Button variant="ghost" onClick={async () => setModalOpen(false)}>Cancel</Button>
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
              <Button variant="ghost" onClick={async () => setInvoiceModalOpen(false)}>Cancel</Button>
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
                 <h2 style={{ margin: 0, fontSize: '24px', color: '#0284c7', textTransform: 'uppercase' }}>{(printingInvoice.type || 'INVOICE').replace('_', ' ')}</h2>
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
              <Button variant="ghost" onClick={async () => setLinkModalOpen(false)}>Cancel</Button>
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
              <Button variant="ghost" onClick={async () => setRefundModalOpen(false)}>Cancel</Button>
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
              <Button variant="ghost" onClick={async () => setCreditNoteModalOpen(false)}>Cancel</Button>
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
              <Button variant="ghost" onClick={async () => setDebitNoteModalOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleIssueDebitNote}>Issue Debit Note</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Cost Item Customization Modal */}
      {costItemModalOpen && (
        <Modal isOpen onClose={() => setCostItemModalOpen(false)}>
          <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '480px', width: '100%' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Customize Cost Item</h3>
            <Input 
              label="Item Name / Description" 
              value={editingCostItem.label} 
              onChange={e => setEditingCostItem(prev => ({ ...prev, label: e.target.value }))} 
              required 
            />
            <Input 
              label="Cost Value (INR)" 
              type="number" 
              value={editingCostItem.value} 
              onChange={e => setEditingCostItem(prev => ({ ...prev, value: e.target.value }))} 
              required 
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: '8px' }}>
              <Button variant="ghost" onClick={async () => setCostItemModalOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleSaveCostItem}>Save Item</Button>
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

      <Modal isOpen={auditModalOpen} onClose={() => { setAuditModalOpen(false); setSelectedAuditApproval(null); }} title="Approval Audit Trail">
        {selectedAuditApproval && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
            <div style={{ fontWeight: 600, fontSize: '16px', marginBottom: '8px' }}>
               Request Ref: {selectedAuditApproval.id}
            </div>
            
            <div style={{ position: 'relative', paddingLeft: '24px', borderLeft: '2px solid var(--color-border)', marginLeft: '8px' }}>
              {selectedAuditApproval.auditTrail.map((log, index) => (
                <div key={index} style={{ marginBottom: index === selectedAuditApproval.auditTrail.length - 1 ? '0' : '24px', position: 'relative' }}>
                  <div style={{ 
                    position: 'absolute', 
                    left: '-31px', 
                    top: '2px', 
                    width: '12px', 
                    height: '12px', 
                    borderRadius: '50%', 
                    background: log.status === 'APPROVED' ? 'var(--color-success)' : (log.status === 'REJECTED' ? 'var(--color-danger)' : 'var(--color-primary)'),
                    border: '2px solid var(--color-surface)'
                  }} />
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>
                     {log.status}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                     {new Date(log.timestamp).toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                     {log.note}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
               <Button variant="ghost" onClick={async () => { setAuditModalOpen(false); setSelectedAuditApproval(null); }}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
});

export default PaymentsTab;
