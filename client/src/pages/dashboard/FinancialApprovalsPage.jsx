/* eslint-disable react-hooks/immutability, react-hooks/exhaustive-deps, no-unused-vars */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';
import { useAuth } from '../../store/authContext';
import styles from './FinancialApprovalsPage.module.css';
import FinancialApprovalDashboard from '../../components/finance/FinancialApprovalDashboard';
import SearchBar from '../../components/common/SearchBar';
import HighlightText from '../../components/common/HighlightText';
import Pagination from '../../components/ui/Pagination';
import AdvancedFilters from '../../components/finance/AdvancedFilters';
import SortDropdown from '../../components/common/SortDropdown';
import ConstructionSummary from '../../components/finance/ConstructionSummary';
import RiskSummary from '../../components/finance/RiskSummary';
import BudgetValidator from '../../components/finance/BudgetValidator';
import ApprovalTimeline from '../../components/common/ApprovalTimeline';
import ApprovalComments from '../../components/finance/ApprovalComments';
import UnreadBadge from '../../components/finance/UnreadBadge';
import ActivityLogTimeline from '../../components/finance/ActivityLogTimeline';
import DocumentPreviewModal from '../../components/finance/DocumentPreviewModal';
import AttachmentManager from '../../components/finance/AttachmentManager';
import BulkActionBar from '../../components/finance/BulkActionBar';
import AssignmentModal from '../../components/finance/AssignmentModal';


import { useConfirm } from '../../store/confirmContext';

function SLATracker({ approval }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (approval.status !== 'pending') return;
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, [approval.status]);

  if (approval.status !== 'pending') return null;

  const targetDate = new Date(approval.target_resolution_date || new Date(new Date(approval.created_at).getTime() + 72 * 60 * 60 * 1000));
  const diffMs = targetDate.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const isOverdue = diffHours < 0;
  
  let color = 'var(--color-success)'; 
  let bgColor = 'var(--color-success-bg)';
  let level = 0;
  
  const hoursElapsed = (now.getTime() - new Date(approval.created_at).getTime()) / (1000 * 60 * 60);
  if (hoursElapsed >= 72) { color = 'var(--color-danger)'; bgColor = 'var(--color-danger-bg)'; level = 3; } 
  else if (hoursElapsed >= 48) { color = 'var(--color-danger)'; bgColor = 'var(--color-danger-bg)'; level = 2; } 
  else if (hoursElapsed >= 24) { color = 'var(--color-warning)'; bgColor = 'var(--color-warning-bg)'; level = 1; } 

  const absHours = Math.floor(Math.abs(diffHours));
  const absMins = Math.floor((Math.abs(diffMs) % (1000 * 60 * 60)) / (1000 * 60));
  const timeString = `${absHours}h ${absMins}m`;

  return (
    <span style={{ 
      display: 'inline-flex', 
      alignItems: 'center', 
      gap: '4px', 
      padding: '4px 8px', 
      borderRadius: 'var(--radius-full)', 
      backgroundColor: bgColor, 
      color: color, 
      fontSize: 'var(--text-xs)', 
      fontWeight: 700 
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
      {isOverdue ? `Overdue: ${timeString}` : `SLA: ${timeString}`}
      {level > 0 && <span style={{ marginLeft: '2px', opacity: 0.85 }}>(L{level})</span>}
    </span>
  );
}


function PriorityBadge({ approval, onUpdate }) {
  const { confirm } = useConfirm();

  const [isOpen, setIsOpen] = useState(false);
  const { priority } = approval;
  
  let color = 'var(--color-text-muted)';
  let bg = 'var(--color-surface-2)';
  if (priority === 'medium') { color = 'var(--color-info)'; bg = 'var(--color-info-bg)'; }
  else if (priority === 'high') { color = 'var(--color-warning)'; bg = 'var(--color-warning-bg)'; }
  else if (priority === 'critical') { color = 'var(--color-danger)'; bg = 'var(--color-danger-bg)'; }

  const handleUpdate = (newP) => {
    setIsOpen(false);
    if (onUpdate) onUpdate(approval.id, newP);
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <span 
        onClick={async () => setIsOpen(!isOpen)}
        style={{ cursor: 'pointer', padding: '4px 10px', borderRadius: 'var(--radius-full)', backgroundColor: bg, color, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'inline-block', transition: 'all 0.2s' }}
      >
        {priority || 'low'}
      </span>
      {isOpen && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', zIndex: 50, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', minWidth: '120px', overflow: 'hidden' }}>
          {['low', 'medium', 'high', 'critical'].map(p => (
            <div key={p} onClick={async () => handleUpdate(p)} style={{ padding: '8px 16px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', color: 'var(--color-text)', borderBottom: '1px solid var(--color-border-light)', transition: 'background 0.2s' }}>
              {p}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FinancialApprovalsPage() {
  const { confirm } = useConfirm();

  const [budgetStates, setBudgetStates] = useState({});
  const [constructionStates, setConstructionStates] = useState({});
  const [pendingList, setPendingList] = useState([]);
  const [historyList, setHistoryList] = useState([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [assignApproval, setAssignApproval] = useState(null);
  const [commentsApprovalId, setCommentsApprovalId] = useState(null);
  const [activityApprovalId, setActivityApprovalId] = useState(null);
  const [attachmentApprovalId, setAttachmentApprovalId] = useState(null);
  const [commentsRefreshSeq, setCommentsRefreshSeq] = useState(0);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingPage, setPendingPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [advancedFilters, setAdvancedFilters] = useState({});
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
  const [sortOption, setSortOption] = useState('newest');
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewDocuments, setPreviewDocuments] = useState([]);

  const handleOpenDocPreview = (docOrDocs) => {
    if (!docOrDocs) return;
    const docsArray = Array.isArray(docOrDocs) 
      ? docOrDocs 
      : [typeof docOrDocs === 'string' 
          ? { name: 'Payment Transaction Proof', type: docOrDocs.includes('pdf') ? 'application/pdf' : 'image/png', url: docOrDocs }
          : docOrDocs
        ];
    setPreviewDocuments(docsArray);
    setPreviewModalOpen(true);
  };
  
  const ITEMS_PER_PAGE = 10;

  // Reset pagination when search or filters change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingPage(1);
    setHistoryPage(1);
  }, [searchQuery, filterType, advancedFilters, sortOption]);

  const { user } = useAuth();
  const toast = useToast();

  useEffect(() => {
    fetchPendingApprovals();
  }, [pendingPage, searchQuery, filterType, advancedFilters, sortOption]);

  useEffect(() => {
    fetchHistoryApprovals();
  }, [historyPage, searchQuery, filterType, advancedFilters, sortOption]);

  useEffect(() => {
    const handleDbChange = () => {
      fetchPendingApprovals();
      fetchHistoryApprovals();
    };
    window.addEventListener('app:mock-db-change', handleDbChange);
    return () => window.removeEventListener('app:mock-db-change', handleDbChange);
  }, [pendingPage, historyPage, searchQuery, filterType, advancedFilters, sortOption]);

  const buildQueryParams = (baseStatus, page) => {
    const params = new URLSearchParams();
    params.append('page', page);
    params.append('limit', ITEMS_PER_PAGE);

    // Apply advanced filters
    if (advancedFilters.status) {
      // If user explicitly filtered status, only apply if it overlaps with the section
      const selectedStatuses = advancedFilters.status.split(',');
      const validStatuses = selectedStatuses.filter(s => baseStatus.includes(s));
      if (validStatuses.length === 0) return null; // Skip fetch if no overlap
      params.append('status', validStatuses.join(','));
    } else {
      params.append('status', baseStatus.join(','));
    }

    if (advancedFilters.transaction_type) params.append('transaction_type', advancedFilters.transaction_type);
    else if (filterType !== 'all') params.append('transaction_type', filterType);
    
    if (advancedFilters.project) params.append('project', advancedFilters.project);
    if (advancedFilters.customer) params.append('customer', advancedFilters.customer);
    if (advancedFilters.requester) params.append('requester', advancedFilters.requester);
    if (advancedFilters.priority) params.append('priority', advancedFilters.priority);
    if (advancedFilters.minAmount) params.append('min_amount', advancedFilters.minAmount);
    if (advancedFilters.maxAmount) params.append('max_amount', advancedFilters.maxAmount);
    if (advancedFilters.startDate) params.append('start_date', advancedFilters.startDate);
    if (advancedFilters.endDate) params.append('end_date', advancedFilters.endDate);
    if (searchQuery) params.append('search', searchQuery);
    if (sortOption) params.append('sort_by', sortOption);

    return params;
  };

  const fetchPendingApprovals = async () => {
    try {
      const params = buildQueryParams(['pending'], pendingPage);
      if (!params) {
        setPendingList([]);
        setPendingTotal(0);
        return;
      }
      const res = await api.get(`/financial-approvals?${params.toString()}`);
      const payload = res.data?.data || {};
      let data = Array.isArray(payload) ? payload : (payload.data || []);
      setPendingTotal(payload.pagination?.total || payload.meta?.total || 0);
      setPendingList(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoryApprovals = async () => {
    try {
      const params = buildQueryParams(['approved', 'rejected'], historyPage);
      if (!params) {
        setHistoryList([]);
        setHistoryTotal(0);
        return;
      }
      const res = await api.get(`/financial-approvals?${params.toString()}`);
      const payload = res.data?.data || {};
      let data = Array.isArray(payload) ? payload : (payload.data || []);
      setHistoryTotal(payload.pagination?.total || payload.meta?.total || 0);
      setHistoryList(data);
    } catch (err) {
      console.error(err);
    }
  };

  const hasPermission = (app) => {
    const rName = user?.role?.name?.toLowerCase();
    if (user?.role === 'superadmin' || rName === 'superadmin' || rName === 'super admin' || (user?.role?.permissions && user.role.permissions.includes('*'))) return true;
    
    const uid = user?.id || user?.userId;
    if (app.assigned_to === uid || app.backup_approver === uid) return true;
    
    const perms = user?.role?.permissions || [];
    
    // Check Multi-level stage requirement first
    let currentStage = app.current_stage || 1;
    let chain = app.approval_chain;
    if (typeof chain === 'string') {
      try { chain = JSON.parse(chain); } catch(e) { chain = []; }
    }
    chain = chain || [];
    const stageData = chain.find(c => c.stage === currentStage);
    if (stageData && stageData.role) {
      if (perms.includes('admin')) return true;
      return perms.includes(stageData.role);
    }
    
    // Fallback to transaction type
    const type = app.transaction_type;
    if (type === 'invoice') return perms.includes('finance:invoices');
    if (type === 'payment' || type === 'payment_update') return perms.includes('finance:payments');
    if (type === 'discount') return perms.includes('finance:discounts');
    if (type === 'credit' || type === 'refund') return perms.includes('finance:credits');
    if (type === 'change_order') return perms.includes('finance:change_orders') || perms.includes('projects:change_orders');
    return false;
  };

  const handleApprove = async (app) => {
    if (!hasPermission(app)) {
      toast.error('You do not have permission to approve this transaction.');
      return;
    }
    if (!await confirm('Are you sure you want to approve this request?')) return;
    setSubmitting(true);
    try {
      await api.post(`/financial-approvals/${app.id}/approve`);
      toast.success('Transaction approved successfully!');
      fetchPendingApprovals();
      fetchHistoryApprovals();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnassign = async (app) => {
    if (!await confirm('Are you sure you want to remove the assigned team member from this approval?')) return;
    setSubmitting(true);
    try {
      await api.post(`/financial-approvals/${app.id}/assign`, {
        assigned_to: null,
        backup_approver: null,
        assignment_notes: null
      });
      toast.success('Assignment removed successfully.');
      fetchPendingApprovals();
      fetchHistoryApprovals();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReopen = async (app) => {
    if (!await confirm('Are you sure you want to reopen this rejected transaction?')) return;
    setSubmitting(true);
    try {
      await api.post(`/financial-approvals/${app.id}/reopen`);
      toast.success('Transaction reopened successfully!');
      fetchPendingApprovals();
      fetchHistoryApprovals();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reopen transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSelection = (id) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const refreshAllData = () => {
    fetchPendingApprovals();
    fetchHistoryApprovals();
  };

  const handleOpenReject = (app) => {
    if (!hasPermission(app)) {
      toast.error('You do not have permission to reject this transaction.');
      return;
    }
    setSelectedApproval(app);
    setRejectionReason('');
    setRejectModalOpen(true);
  };

  
  const handleUpdatePriority = async (id, newPriority) => {
    try {
      await api.post(`/financial-approvals/${id}/priority`, { priority: newPriority });
      toast.success('Priority updated');
      fetchPendingApprovals();
      fetchHistoryApprovals();
    } catch (err) {
      toast.error('Failed to update priority');
    }
  };

  const handleRejectConfirm = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      toast.error('Rejection reason is required.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/financial-approvals/${selectedApproval.id}/reject`, {
        rejectionReason
      });
      toast.success('Transaction rejected.');
      setRejectModalOpen(false);
      setSelectedApproval(null);
      fetchPendingApprovals();
      fetchHistoryApprovals();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusClass = (status) => {
    if (status === 'pending') return styles.statusPending;
    if (status === 'approved') return styles.statusApproved;
    return styles.statusRejected;
  };

  const getTypeLabel = (type) => {
    if (type === 'invoice') return 'Invoice Generation';
    if (type === 'payment') return 'Payment Creation';
    if (type === 'payment_update') return 'Payment Record';
    if (type === 'discount') return 'Discount Application';
    if (type === 'credit') return 'Credit Note';
    if (type === 'refund') return 'Refund';
    return type;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  if (loading) {
    return <div className={styles.loading}>Loading approvals list...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTitles}>
          <h1 className={styles.title}>Financial Approvals Queue</h1>
          <p className={styles.subtitle}>Review pending transactions exceeding configured policy thresholds.</p>
        </div>
        <div className={styles.filterContainer}>
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search approvals..." />
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            className={styles.selectFilter}
          >
            <option value="all">All Transaction Types</option>
            <option value="invoice">Invoice Generation</option>
            <option value="payment">Payment Milestone</option>
            <option value="payment_update">Payment Update</option>
            <option value="discount">Discount Application</option>
            <option value="credit">Credit Note</option>
            <option value="refund">Refund</option>
            <option value="change_order">Change Order</option>
          </select>
          <SortDropdown 
            options={[
              { value: 'newest', label: 'Newest First' },
              { value: 'oldest', label: 'Oldest First' },
              { value: 'amount_desc', label: 'Highest Amount' },
              { value: 'amount_asc', label: 'Lowest Amount' },
              { value: 'project_name', label: 'Project Name' },
              { value: 'customer_name', label: 'Customer Name' },
              { value: 'priority', label: 'Priority' },
              { value: 'approval_date', label: 'Approval Date' },
              { value: 'requested_date', label: 'Requested Date' },
              { value: 'priority_desc', label: 'Priority (High to Low)' },
              { value: 'priority_asc', label: 'Priority (Low to High)' }
            ]}
            value={sortOption}
            onChange={setSortOption}
          />
          <button 
            className={styles.secondaryBtn} 
            onClick={async () => setIsAdvancedFiltersOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>⚡</span> Filters
          </button>
          {(user?.role === 'superadmin' || user?.role?.name?.toLowerCase() === 'superadmin' || user?.role?.name?.toLowerCase() === 'super admin' || (user?.role?.permissions && user.role.permissions.includes('*'))) && (
            <Link to="/settings/approval-matrix" className={styles.primaryBtn}>
              Manage Matrix
            </Link>
          )}
        </div>
      </div>

      <FinancialApprovalDashboard />

      <AdvancedFilters 
        isOpen={isAdvancedFiltersOpen}
        onClose={() => setIsAdvancedFiltersOpen(false)}
        appliedFilters={advancedFilters}
        onApply={setAdvancedFilters} 
        onReset={() => setAdvancedFilters({})}
      />

      <div className={styles.section}>
        {Object.keys(advancedFilters).length > 0 && (
          <div className={styles.activeFilters}>
            <span className={styles.activeFiltersLabel}>Active Filters:</span>
            {Object.entries(advancedFilters).map(([key, val]) => (
              <span key={key} className={styles.filterChip}>
                {key}: {val}
                <button 
                  className={styles.chipRemoveBtn}
                  onClick={async () => {
                    const newFilters = { ...advancedFilters };
                    delete newFilters[key];
                    setAdvancedFilters(newFilters);
                  }}
                >✕</button>
              </span>
            ))}
            <button 
              className={styles.clearAllBtn}
              onClick={async () => setAdvancedFilters({})}
            >Clear All</button>
          </div>
        )}

        <h2 className={styles.sectionTitle}>Pending Reviews ({pendingTotal})</h2>
        {pendingList.length === 0 ? (
          <div className={styles.empty}>All caught up! No approvals pending review.</div>
        ) : (
          <>
            {selectedIds.size > 0 && (
              <BulkActionBar 
                selectedIds={selectedIds} 
                refreshData={refreshAllData} 
                clearSelection={() => setSelectedIds(new Set())}
              />
            )}
            <div className={styles.grid}>
              {pendingList.map((app) => (
                <div key={app.id} className={`${styles.approvalCard} ${selectedIds.has(app.id) ? styles.selectedCard : ''}`}>
                  <div className={styles.cardHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(app.id)} 
                        onChange={() => toggleSelection(app.id)} 
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                      />
                      <span className={styles.typeTag}>{getTypeLabel(app.transaction_type)}</span>
                      {app.priority === 'urgent' && <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', padding: '4px 8px', borderRadius: 'var(--radius-full)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Urgent</span>}
                      {app.priority === 'high' && <span style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', padding: '4px 8px', borderRadius: 'var(--radius-full)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>High</span>}
                    </div>
                    <span className={`${styles.statusTag} ${getStatusClass(app.status)}`}>{app.status}</span>
                  </div>
                  
                  <div className={styles.cardBody}>
                    {app.assigned_to_name && (
                      <div style={{ background: 'var(--color-surface-2)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-3)', fontSize: 'var(--text-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', flexWrap: 'wrap', gap: '4px' }}>
                            <span><strong>Assigned to:</strong> {app.assigned_to_name} {app.backup_approver_name && <span>(Backup: {app.backup_approver_name})</span>}</span>
                            {app.assigned_by_name && <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-xs)' }}>Assigned by {app.assigned_by_name} on {app.assigned_date ? new Date(app.assigned_date).toLocaleDateString() : ''}</span>}
                          </div>
                          {app.assignment_notes && <div style={{ fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>"{app.assignment_notes}"</div>}
                        </div>
                        {(user?.role === 'superadmin' || user?.role?.name?.toLowerCase() === 'superadmin' || user?.role?.name?.toLowerCase() === 'super admin' || user?.role?.permissions?.includes('admin')) && (
                          <button
                            type="button"
                            onClick={() => handleUnassign(app)}
                            title="Remove Assignment"
                            disabled={submitting}
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#dc2626',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              lineHeight: 1.2,
                              fontWeight: 600,
                              whiteSpace: 'nowrap'
                            }}
                          >
                            Unassign ×
                          </button>
                        )}
                      </div>
                    )}
                    <div className={styles.amountText}>
                      <HighlightText text={formatCurrency(app.amount)} highlight={searchQuery} />
                    </div>
                    
                    {/* Compact Stage Progress & SLA Summary Bar */}
                    <div style={{
                      margin: 'var(--space-3) 0',
                      padding: 'var(--space-3)',
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      justify: 'space-between',
                      flexWrap: 'wrap',
                      gap: 'var(--space-2)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                          Stage {app.current_stage || 1} of {app.total_stages || 1}
                        </span>
                        <span style={{ fontSize: 'var(--text-xs)', background: 'var(--color-surface)', padding: '2px 8px', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border)', fontWeight: 600, color: 'var(--color-accent)' }}>
                          {(() => {
                            let chain = app.approval_chain;
                            if (typeof chain === 'string') try { chain = JSON.parse(chain); } catch(e) { chain = []; }
                            const current = (chain || []).find(c => c.stage === (app.current_stage || 1));
                            const r = current ? current.role : 'Authorized Finance Role';
                            return r.replace('finance:', 'Finance ').replace(/\b\w/g, l => l.toUpperCase());
                          })()}
                        </span>
                      </div>
                      <SLATracker approval={app} />
                    </div>

                    <div className={styles.detailsList}>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Project</span>
                        <span className={styles.detailValue}>
                          {(() => {
                            const pId = app.project_id || app.requested_changes?.project_id || app.requested_changes?.payload?.projectId;
                            if (pId) {
                              return (
                                <Link to={`/projects/${pId}`} className={styles.detailLink} title="View Project Details">
                                  <HighlightText text={app.project_name || 'N/A'} highlight={searchQuery} />
                                </Link>
                              );
                            }
                            return <HighlightText text={app.project_name || 'N/A'} highlight={searchQuery} />;
                          })()}
                        </span>
                      </div>
                      {app.customer_name && (
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Lead</span>
                          <span className={styles.detailValue}>
                            {(() => {
                              const lId = app.lead_id || app.requested_changes?.lead_id || app.requested_changes?.payload?.leadId;
                              const leadPath = lId 
                                ? `/leads?id=${lId}` 
                                : `/leads?search=${encodeURIComponent(app.customer_name)}`;
                              return (
                                <Link to={leadPath} className={styles.detailLink} title="View Lead Details">
                                  <HighlightText text={app.customer_name} highlight={searchQuery} />
                                </Link>
                              );
                            })()}
                          </span>
                        </div>
                      )}
                      {app.target_number && (
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Reference</span>
                          <span className={styles.detailValue}>
                            <HighlightText text={app.target_number} highlight={searchQuery} />
                          </span>
                        </div>
                      )}
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Requested By</span>
                        <span className={styles.detailValue}>
                          <HighlightText text={app.requester_name || 'System'} highlight={searchQuery} />
                        </span>
                      </div>
                      {!!(app.threshold_limit && Number(app.threshold_limit) > 0 && app.has_matrix_rule) && (
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Limit Exceeded</span>
                          <span className={styles.detailValue}>{formatCurrency(app.threshold_limit)}</span>
                        </div>
                      )}
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Requested On</span>
                        <span className={styles.detailValue}>{new Date(app.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {app.requested_changes && (() => {
                      let changes = app.requested_changes;
                      if (typeof changes === 'string') {
                        try { changes = JSON.parse(changes); } catch(e) { return null; }
                      }
                      const payload = changes.payload || changes.data || changes;
                      if (!payload) return null;

                      const milestoneName = payload.selectedPayment?.milestone || payload.splits?.[0]?.milestoneName || app.target_number;
                      const statusVal = payload.data?.status || payload.status || changes.type || 'Update';
                      const paidAmt = payload.data?.paid_amount || payload.paid_amount || app.amount;
                      const paidAtDate = payload.data?.paid_at || payload.paid_at;
                      
                      const isExplicitlyRemoved = 
                        changes?.proofDocument === null || 
                        changes?.proofDocumentRemoved || 
                        payload?.proofDocument === null || 
                        payload?.proofDocumentRemoved || 
                        payload?.selectedPayment?.proofDocument === null ||
                        payload?.selectedPayment?.proofDocumentRemoved ||
                        (typeof window !== 'undefined' && (
                          (app.target_id && localStorage.getItem(`crm_removed_proof_doc_${payload?.projectId || app.project_id}_${app.target_id}`) === 'true') ||
                          (milestoneName && localStorage.getItem(`crm_removed_proof_doc_${payload?.projectId || app.project_id}_${milestoneName}`) === 'true')
                        ));

                      const proofDoc = isExplicitlyRemoved ? null : (payload.proofDocument || payload.selectedPayment?.proofDocument || (payload.newEntries && payload.newEntries.find(e => e.proofDocument)?.proofDocument) || null);

                      return (
                        <div style={{
                          marginTop: 'var(--space-3)',
                          padding: 'var(--space-3) var(--space-4)',
                          background: 'var(--color-surface-2, rgba(0,0,0,0.02))',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-lg, 8px)',
                          fontSize: 'var(--text-xs)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}>
                          <div style={{ fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.7rem' }}>
                            Transaction Summary
                          </div>
                          {milestoneName && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Milestone:</span>
                              <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{milestoneName}</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Target Action:</span>
                            <span style={{ fontWeight: 700, textTransform: 'capitalize', color: statusVal === 'paid' ? 'var(--color-success)' : 'var(--color-accent)' }}>
                              {statusVal}
                            </span>
                          </div>
                          {paidAmt && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Payment Amount:</span>
                              <span style={{ fontWeight: 800, color: 'var(--color-text)' }}>{formatCurrency(paidAmt)}</span>
                            </div>
                          )}
                          {paidAtDate && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Payment Date:</span>
                              <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>{new Date(paidAtDate).toLocaleDateString()}</span>
                            </div>
                          )}
                          {proofDoc && (
                            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Transaction Proof:</span>
                              <button
                                type="button"
                                onClick={() => handleOpenDocPreview(proofDoc)}
                                style={{
                                  background: 'var(--color-primary-bg, #eff6ff)',
                                  border: '1px solid var(--color-primary)',
                                  color: 'var(--color-primary)',
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                📎 View Proof ({proofDoc.name || 'Document'})
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {hasPermission(app) && (
                    <div className={styles.cardActions}>
                      <div style={{ display: 'flex', width: '100%', gap: '12px' }}>
                        <button
                          onClick={async () => handleApprove(app)}
                          disabled={submitting}
                          className={styles.approveBtn}
                        >
                          Approve
                        </button>
                        <button
                          onClick={async () => handleOpenReject(app)}
                          disabled={submitting}
                          className={styles.rejectBtn}
                        >
                          Reject
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', width: '100%', flexWrap: 'wrap' }}>
                        <button 
                          onClick={async () => { setSelectedApproval(app); setCommentsApprovalId(app.id); }}
                          className={styles.secondaryBtn}
                        >
                          💬 Notes <UnreadBadge approvalId={app.id} refreshCounter={commentsRefreshSeq} />
                        </button>
                        <button
                          onClick={async () => {
                            setAttachmentApprovalId(app.id);
                            api.post(`/financial-approvals/${app.id}/view`).catch(() => {});
                          }}
                          className={styles.secondaryBtn}
                        >
                          📎 Files
                        </button>
                        <button
                          onClick={async () => { setActivityApprovalId(app.id); api.post(`/financial-approvals/${app.id}/view`).catch(() => {}); }}
                          className={styles.secondaryBtn}
                        >
                          📋 Logs
                        </button>
                        {(user?.role === 'superadmin' || user?.role?.name?.toLowerCase() === 'superadmin' || user?.role?.name?.toLowerCase() === 'super admin' || user?.role?.permissions?.includes('admin')) && (
                          <button 
                            onClick={async () => setAssignApproval(app)}
                            className={styles.secondaryBtn}
                            style={{ marginLeft: 'auto' }}
                          >
                            👤 Assign
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {!hasPermission(app) && (
                    <div className={styles.cardActions} style={{ justifyContent: 'flex-start' }}>
                        <button
                          onClick={async () => { setCommentsApprovalId(app.id); api.post(`/financial-approvals/${app.id}/view`).catch(() => {}); }}
                          className={styles.secondaryBtn}
                        >
                          💬 Notes <UnreadBadge approvalId={app.id} refreshCounter={commentsRefreshSeq} />
                        </button>
                        <button
                          onClick={async () => {
                            setAttachmentApprovalId(app.id);
                            api.post(`/financial-approvals/${app.id}/view`).catch(() => {});
                          }}
                          className={styles.secondaryBtn}
                        >
                          📎 Files
                        </button>
                        <button
                          onClick={async () => { setActivityApprovalId(app.id); api.post(`/financial-approvals/${app.id}/view`).catch(() => {}); }}
                          className={styles.secondaryBtn}
                        >
                          📋 Logs
                        </button>
                    </div>
                  )}
              </div>
            ))}
            </div>
            <div style={{ marginTop: '20px' }}>
              <Pagination 
                currentPage={pendingPage}
                totalItems={pendingTotal}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setPendingPage}
              />
            </div>
          </>
        )}
      </div>

      <div className={styles.section} style={{ marginTop: '40px' }}>
        <h2 className={styles.sectionTitle}>Approval History ({historyTotal})</h2>
        {historyList.length === 0 ? (
          <div className={styles.empty}>No past approvals found.</div>
        ) : (
          <>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Type</th>
                  <th className={styles.th}>Reference</th>
                  <th className={styles.th}>Amount</th>
                  <th className={styles.th}>Project</th>
                  <th className={styles.th}>Customer</th>
                  <th className={styles.th}>Requested By</th>
                  <th className={styles.th}>Status</th>
                  <th className={styles.th}>Resolved Date</th>
                  <th className={styles.th}>Remarks / Reasons</th>
                  <th className={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {historyList.map((app) => (
                  <tr key={app.id} className={styles.tr}>
                    <td className={styles.td}><strong>{getTypeLabel(app.transaction_type)}</strong></td>
                    <td className={styles.td}>
                      <HighlightText text={app.target_number || '-'} highlight={searchQuery} />
                    </td>
                    <td className={styles.td}>
                      <HighlightText text={formatCurrency(app.amount)} highlight={searchQuery} />
                    </td>
                    <td className={styles.td}>
                      {(() => {
                        const pId = app.project_id || app.requested_changes?.project_id || app.requested_changes?.payload?.projectId;
                        if (pId) {
                          return (
                            <Link to={`/projects/${pId}`} className={styles.detailLink} title="View Project Details">
                              <HighlightText text={app.project_name || 'N/A'} highlight={searchQuery} />
                            </Link>
                          );
                        }
                        return <HighlightText text={app.project_name || 'N/A'} highlight={searchQuery} />;
                      })()}
                    </td>
                    <td className={styles.td}>
                      {(() => {
                        if (!app.customer_name || app.customer_name === '-') return '-';
                        const lId = app.lead_id || app.requested_changes?.lead_id || app.requested_changes?.payload?.leadId;
                        const leadPath = lId 
                          ? `/leads?id=${lId}` 
                          : `/leads?search=${encodeURIComponent(app.customer_name)}`;
                        return (
                          <Link to={leadPath} className={styles.detailLink} title="View Lead Details">
                            <HighlightText text={app.customer_name} highlight={searchQuery} />
                          </Link>
                        );
                      })()}
                    </td>
                    <td className={styles.td}>
                      <HighlightText text={app.requester_name || 'System'} highlight={searchQuery} />
                    </td>
                    <td className={styles.td}>
                      <span className={`${styles.statusBadge} ${getStatusClass(app.status)}`}>
                        {app.status}
                      </span>
                    </td>
                    <td className={styles.td}>{new Date(app.updated_at).toLocaleDateString()}</td>
                      <td className={styles.td}>
                        {app.status === 'rejected' ? (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className={styles.rejectionText}>
                              <HighlightText text={app.rejection_reason} highlight={searchQuery} />
                            </span>
                            {(user?.role === 'superadmin' || user?.role?.name?.toLowerCase() === 'superadmin' || user?.role?.name?.toLowerCase() === 'super admin' || user?.role?.permissions?.includes('admin')) && (
                              <button 
                                onClick={async () => handleReopen(app)} 
                                disabled={submitting}
                                className={styles.secondaryBtn} 
                                style={{ marginLeft: '12px', padding: '4px 8px', fontSize: '0.75rem' }}
                              >
                                Reopen
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className={styles.okText}>Approved</span>
                        )}
                      </td>
                    <td className={styles.td}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button 
                          onClick={async () => { setCommentsApprovalId(app.id); api.post(`/financial-approvals/${app.id}/view`).catch(() => {}); }} 
                          className={styles.secondaryBtn} 
                          title="View Notes & Comments"
                          style={{ position: 'relative', padding: '6px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          💬 Notes <UnreadBadge approvalId={app.id} refreshCounter={commentsRefreshSeq} />
                        </button>
                        <button 
                          onClick={async () => {
                            setAttachmentApprovalId(app.id);
                            api.post(`/financial-approvals/${app.id}/view`).catch(() => {});
                          }} 
                          className={styles.secondaryBtn} 
                          title="View Uploaded Files & Receipts"
                          style={{ padding: '6px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          📎 Files
                        </button>
                        <button 
                          onClick={async () => { setActivityApprovalId(app.id); api.post(`/financial-approvals/${app.id}/view`).catch(() => {}); }} 
                          className={styles.secondaryBtn} 
                          title="View Audit Logs"
                          style={{ padding: '6px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          📋 Logs
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <div style={{ marginTop: '20px' }}>
              <Pagination 
                currentPage={historyPage}
                totalItems={historyTotal}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setHistoryPage}
              />
            </div>
          </>
        )}
      </div>

      {rejectModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Reject Transaction</h3>
            <p className={styles.modalDesc}>Please provide a reason for rejecting this {getTypeLabel(selectedApproval?.transaction_type)} request.</p>
            
            <form onSubmit={handleRejectConfirm}>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                required
                className={styles.textarea}
                placeholder="Reason for rejection..."
                rows={4}
              />
              
              <div className={styles.modalActions}>
                <button
                  type="button"
                  onClick={async () => setRejectModalOpen(false)}
                  disabled={submitting}
                  className={styles.cancelBtn}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={styles.confirmRejectBtn}
                >
                  Confirm Reject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {commentsApprovalId && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} style={{ maxWidth: '600px', width: '100%', padding: '0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
              <h3 style={{ margin: 0 }}>Discussion & Notes</h3>
              <button onClick={async () => setCommentsApprovalId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--color-text)' }}>✕</button>
            </div>
            <ApprovalComments 
              approvalId={commentsApprovalId} 
              currentUserRole={user.role?.name} 
              onUnreadChange={() => setCommentsRefreshSeq(s => s + 1)} 
            />
          </div>
        </div>
      )}

      {activityApprovalId && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} style={{ maxWidth: '700px', width: '100%', padding: '0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
              <h3 style={{ margin: 0 }}>Activity & Audit Log</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={async () => { api.post(`/financial-approvals/${activityApprovalId}/export`, { format: 'csv' }); toast.info('Exporting activity log...'); }} 
                  className={styles.secondaryBtn} 
                >
                  ⬇️ Export CSV
                </button>
                <button onClick={async () => setActivityApprovalId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--color-text)' }}>✕</button>
              </div>
            </div>
            <ActivityLogTimeline approvalId={activityApprovalId} />
          </div>
        </div>
      )}

      {attachmentApprovalId && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal} style={{ maxWidth: '800px', width: '100%', padding: '0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
                <h3 style={{ margin: 0 }}>Attachments & Documents</h3>
                <button onClick={async () => setAttachmentApprovalId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--color-text)' }}>✕</button>
              </div>
              <div style={{ padding: '24px' }}>
                <AttachmentManager 
                  approvalId={attachmentApprovalId} 
                  currentUserRole={user?.role?.name} 
                  currentUserId={user?.id || user?.userId} 
                />
              </div>
            </div>
          </div>
        )}

        <AssignmentModal 
          isOpen={!!assignApproval} 
          approval={assignApproval} 
          onClose={() => setAssignApproval(null)} 
          onSuccess={refreshAllData} 
        />

        <BulkActionBar 
          selectedIds={selectedIds} 
          clearSelection={() => setSelectedIds(new Set())} 
          refreshData={refreshAllData} 
        />

        <DocumentPreviewModal
          isOpen={previewModalOpen}
          onClose={() => setPreviewModalOpen(false)}
          documents={previewDocuments}
        />
      </div>
    );
  }
