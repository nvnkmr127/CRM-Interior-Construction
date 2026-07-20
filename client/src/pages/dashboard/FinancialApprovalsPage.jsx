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
  
  let color = '#059669'; // Green (under 24h)
  let level = 0;
  
  const hoursElapsed = (now.getTime() - new Date(approval.created_at).getTime()) / (1000 * 60 * 60);
  if (hoursElapsed >= 72) { color = '#dc2626'; level = 3; } // Red
  else if (hoursElapsed >= 48) { color = '#ea580c'; level = 2; } // Orange
  else if (hoursElapsed >= 24) { color = '#d97706'; level = 1; } // Yellow

  // Format remaining time
  const absHours = Math.floor(Math.abs(diffHours));
  const absMins = Math.floor((Math.abs(diffMs) % (1000 * 60 * 60)) / (1000 * 60));
  const timeString = `${absHours}h ${absMins}m`;

  return (
    <div style={{ marginTop: '12px', padding: '12px', borderRadius: '6px', border: `1px solid ${color}40`, backgroundColor: `${color}10` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SLA Tracking</span>
        {level > 0 && (
          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', backgroundColor: color, color: '#fff' }}>
            Escalation L${level}
          </span>
        )}
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem' }}>
        <div>
          <div style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem' }}>Created Time</div>
          <div style={{ fontWeight: 500 }}>{new Date(approval.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem' }}>Target Resolution</div>
          <div style={{ fontWeight: 500 }}>{targetDate.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
        </div>
      </div>
      
      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        {isOverdue ? (
          <span>Overdue by {timeString}</span>
        ) : (
          <span>{timeString} remaining</span>
        )}
      </div>
    </div>
  );
}


function PriorityBadge({ approval, onUpdate }) {
  const [isOpen, setIsOpen] = useState(false);
  const { priority } = approval;
  
  let color = '#6b7280'; // Low: gray
  if (priority === 'medium') color = '#3b82f6'; // Blue
  else if (priority === 'high') color = '#f97316'; // Orange
  else if (priority === 'critical') color = '#dc2626'; // Red

  const handleUpdate = (newP) => {
    setIsOpen(false);
    if (onUpdate) onUpdate(approval.id, newP);
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <span 
        onClick={() => setIsOpen(!isOpen)}
        style={{ cursor: 'pointer', padding: '2px 8px', borderRadius: '4px', backgroundColor: `${color}20`, color, fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize' }}
      >
        {priority || 'low'}
      </span>
      {isOpen && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 10, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '4px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', minWidth: '100px' }}>
          {['low', 'medium', 'high', 'critical'].map(p => (
            <div key={p} onClick={() => handleUpdate(p)} style={{ padding: '6px 12px', fontSize: '0.75rem', cursor: 'pointer', textTransform: 'capitalize', color: '#374151' }}>
              {p}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FinancialApprovalsPage() {
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
  const [sortOption, setSortOption] = useState('newest');
  
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
      
      setPendingList(res.data?.data || []);
      setPendingTotal(res.data?.pagination?.total || 0);
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
      
      setHistoryList(res.data?.data || []);
      setHistoryTotal(res.data?.pagination?.total || 0);
    } catch (err) {
      console.error(err);
    }
  };

  const hasPermission = (app) => {
    if (user?.role?.name === 'superadmin') return true;
    
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
    if (!window.confirm('Are you sure you want to approve this request?')) return;
    setSubmitting(true);
    try {
      await api.post(`/api/financial-approvals/${app.id}/approve`);
      toast.success('Transaction approved successfully!');
      fetchPendingApprovals();
      fetchHistoryApprovals();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReopen = async (app) => {
    if (!window.confirm('Are you sure you want to reopen this rejected transaction?')) return;
    setSubmitting(true);
    try {
      await api.post(`/api/financial-approvals/${app.id}/reopen`);
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
      <div className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className={styles.title}>Financial Approvals Queue</h1>
          <p className={styles.subtitle}>Review pending transactions exceeding configured policy thresholds.</p>
        </div>
        <div className={styles.filterContainer} style={{ display: 'flex', gap: '12px' }}>
          {user?.role?.name === 'superadmin' && (
            <Link to="/settings/approval-matrix" className={styles.primaryBtn} style={{ textDecoration: 'none', padding: '8px 16px', background: '#4f46e5', color: '#fff', borderRadius: '6px' }}>
              Manage Matrix
            </Link>
          )}
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
              { value: 'requested_date', label: 'Requested Date' }
            ,
                { value: 'priority_desc', label: 'Priority (High to Low)' },
                { value: 'priority_asc', label: 'Priority (Low to High)' }
              ]}
            value={sortOption}
            onChange={setSortOption}
          />
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
        </div>
      </div>

      <FinancialApprovalDashboard />

      <AdvancedFilters 
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
                  onClick={() => {
                    const newFilters = { ...advancedFilters };
                    delete newFilters[key];
                    setAdvancedFilters(newFilters);
                  }}
                >✕</button>
              </span>
            ))}
            <button 
              className={styles.clearAllBtn}
              onClick={() => setAdvancedFilters({})}
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
                selectedIds={Array.from(selectedIds)} 
                onSuccess={refreshAllData} 
                onClear={() => setSelectedIds(new Set())}
              />
            )}
            <div className={styles.grid}>
              {pendingList.map((app) => (
                <div key={app.id} className={`${styles.approvalCard} ${selectedIds.has(app.id) ? styles.selectedCard : ''}`}>
                  <div className={styles.cardHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(app.id)} 
                        onChange={() => toggleSelection(app.id)} 
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span className={styles.typeTag}>{getTypeLabel(app.transaction_type)}</span>
                      {app.priority === 'urgent' && <span style={{ background: '#fef2f2', color: '#991b1b', padding: '2px 8px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>Urgent</span>}
                      {app.priority === 'high' && <span style={{ background: '#fffbeb', color: '#b45309', padding: '2px 8px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>High</span>}
                    </div>
                    <span className={`${styles.statusTag} ${getStatusClass(app.status)}`}>{app.status}</span>
                  </div>
                  
                  <div className={styles.cardBody}>
                    {app.assigned_to_name && (
                      <div style={{ background: 'var(--bg-secondary)', padding: '8px', borderRadius: '4px', marginBottom: '12px', fontSize: '0.8rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span><strong>Assigned to:</strong> {app.assigned_to_name} {app.backup_approver_name && <span>(Backup: {app.backup_approver_name})</span>}</span>
                          {app.assigned_by_name && <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>Assigned by {app.assigned_by_name} on {app.assigned_date ? new Date(app.assigned_date).toLocaleDateString() : ''}</span>}
                        </div>
                        {app.assignment_notes && <div style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>"{app.assignment_notes}"</div>}
                      </div>
                    )}
                    <div className={styles.amountText}>
                      <HighlightText text={formatCurrency(app.amount)} highlight={searchQuery} />
                    </div>
                    
                    {/* Multi-Level Progress UI */}
                    <div className={styles.stageProgressContainer} style={{ margin: '16px 0', padding: '12px', background: 'var(--surface-sunken)', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <strong>Stage Progress:</strong>
                        <span style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>Stage {app.current_stage || 1} of {app.total_stages || 1}</span>
                      </div>
                      <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span><strong>Completed Stages:</strong> {(app.current_stage || 1) - 1}</span>
                        <span><strong>Remaining Stages:</strong> {(app.total_stages || 1) - (app.current_stage || 1)}</span>
                        <span>
                          <strong>Current Approver:</strong>{' '}
                          {(() => {
                            let chain = app.approval_chain;
                            if (typeof chain === 'string') try { chain = JSON.parse(chain); } catch(e) { chain = []; }
                            const current = (chain || []).find(c => c.stage === (app.current_stage || 1));
                            return current ? current.role : 'Authorized Finance Role';
                          })()}
                        </span>
                        <span><strong>Waiting Since:</strong> {new Date(app.updated_at || app.created_at).toLocaleString()}</span>
                        <span><strong>Estimated Completion:</strong> {new Date(new Date(app.updated_at || app.created_at).getTime() + 24 * 60 * 60 * 1000).toLocaleString()} (SLA 24h)</span>
                      </div>
                      <div style={{ marginTop: '12px' }}>
                          <strong>Approval Timeline:</strong>
                          <div style={{ marginTop: '4px' }}>
                            {(() => {
                              let chain = app.approval_chain;
                              if (typeof chain === 'string') try { chain = JSON.parse(chain); } catch(e) { chain = []; }
                              
                              const timelineStages = [
                                { title: 'Created', status: 'completed', date: app.created_at, name: app.requester_name || 'System', role: 'Requester' },
                                { title: 'Submitted', status: 'completed', date: app.created_at, name: app.requester_name || 'System', role: 'Requester' },
                                { title: 'Under Review', status: app.status === 'pending' ? 'current' : 'completed', date: app.created_at }
                              ];

                              if (chain && chain.length > 0) {
                                chain.forEach((c, i) => {
                                  let tStatus = c.status === 'approved' ? 'completed' : c.status === 'rejected' ? 'rejected' : 'pending';
                                  if (tStatus === 'pending' && c.stage === (app.current_stage || 1)) {
                                     tStatus = 'current';
                                  }
                                  const roleName = c.role.replace('finance:', 'Finance ').replace(/\b\w/g, l => l.toUpperCase());
                                  let duration = null;
                                  if (c.approved_at && i === 0) {
                                    const diff = new Date(c.approved_at) - new Date(app.created_at);
                                    duration = Math.round(diff / 60000) + ' min';
                                  } else if (c.approved_at && i > 0 && chain[i-1].approved_at) {
                                    const diff = new Date(c.approved_at) - new Date(chain[i-1].approved_at);
                                    duration = Math.round(diff / 60000) + ' min';
                                  }

                                  timelineStages.push({
                                    title: tStatus === 'completed' ? `${roleName} Approved` : `${roleName} Approval`,
                                    role: roleName,
                                    status: tStatus,
                                    date: c.approved_at,
                                    name: c.approved_by || (tStatus === 'current' ? 'Pending Approver' : null),
                                    comments: tStatus === 'rejected' ? app.rejection_reason : null,
                                    duration: duration
                                  });
                                });
                              } else {
                                timelineStages.push({
                                  title: 'Single-Stage Approval',
                                  status: app.status === 'pending' ? 'current' : (app.status === 'approved' ? 'completed' : 'rejected'),
                                  date: app.updated_at
                                });
                              }

                              timelineStages.push({
                                title: 'Completed',
                                status: app.status === 'approved' ? 'completed' : (app.status === 'rejected' ? 'rejected' : 'pending'),
                                date: app.status !== 'pending' ? app.updated_at : null
                              });

                              return <ApprovalTimeline stages={timelineStages} />;
                            })()}
                          </div>
                        </div>
                    </div>

                    <div className={styles.detailsList}>
                    <SLATracker approval={app} />
                      <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Project:</span>
                      <span className={styles.detailValue}>
                        <HighlightText text={app.project_name || 'N/A'} highlight={searchQuery} />
                      </span>
                    </div>
                    {app.customer_name && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Customer:</span>
                        <span className={styles.detailValue}>
                          <HighlightText text={app.customer_name} highlight={searchQuery} />
                        </span>
                      </div>
                    )}
                    {app.target_number && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Reference:</span>
                        <span className={styles.detailValue}>
                          <HighlightText text={app.target_number} highlight={searchQuery} />
                        </span>
                      </div>
                    )}
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Requested By:</span>
                      <span className={styles.detailValue}>
                        <HighlightText text={app.requester_name || 'System'} highlight={searchQuery} />
                      </span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Limit Exceeded:</span>
                      <span className={styles.detailValue}>{formatCurrency(app.threshold_limit)}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Requested On:</span>
                      <span className={styles.detailValue}>{new Date(app.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                  {hasPermission(app) && (
                    <div className={styles.cardActions}>
                        <button 
                          onClick={() => { setSelectedApproval(app); setCommentsApprovalId(app.id); }}
                          className={styles.secondaryBtn}
                        >
                          Comments & Activity
                        </button>
                        {(user?.role?.name === 'superadmin' || user?.role?.permissions?.includes('admin')) && (
                          <button 
                            onClick={() => setAssignApproval(app)}
                            className={styles.secondaryBtn}
                          >
                            Assign
                          </button>
                        )}
                        <button
                          onClick={() => handleApprove(app)}
                          disabled={submitting}
                          className={styles.approveBtn}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleOpenReject(app)}
                          disabled={submitting}
                          className={styles.rejectBtn}
                        >
                          Reject
                        </button>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                          onClick={() => { setCommentsApprovalId(app.id); api.post(`/api/financial-approvals/${app.id}/view`); }}
                          className={styles.primaryBtn}
                          style={{ marginLeft: 'auto', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', position: 'relative' }}
                        >
                          💬 Discussion <UnreadBadge approvalId={app.id} refreshCounter={commentsRefreshSeq} />
                        </button>
                        <button
                          onClick={() => {
                            setAttachmentApprovalId(app.id);
                            api.post(`/api/financial-approvals/${app.id}/view`);
                          }}
                          className={styles.primaryBtn}
                          style={{ background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                        >
                          📎 Attachments
                        </button>
                        <button
                          onClick={() => { setActivityApprovalId(app.id); api.post(`/api/financial-approvals/${app.id}/view`); }}
                          className={styles.primaryBtn}
                          style={{ background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                        >
                          📋 Activity Log
                        </button>
                      </div>
                    </div>
                  )}
                  {!hasPermission(app) && (
                    <div className={styles.cardActions} style={{ justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => { setCommentsApprovalId(app.id); api.post(`/api/financial-approvals/${app.id}/view`); }}
                          className={styles.primaryBtn}
                          style={{ background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', position: 'relative' }}
                        >
                          💬 Discussion <UnreadBadge approvalId={app.id} refreshCounter={commentsRefreshSeq} />
                        </button>
                        <button
                          onClick={() => {
                            setAttachmentApprovalId(app.id);
                            api.post(`/api/financial-approvals/${app.id}/view`);
                          }}
                          className={styles.primaryBtn}
                          style={{ marginLeft: '8px', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                        >
                          📎 Attachments
                        </button>
                        <button
                          onClick={() => { setActivityApprovalId(app.id); api.post(`/api/financial-approvals/${app.id}/view`); }}
                          className={styles.primaryBtn}
                          style={{ marginLeft: '8px', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                        >
                          📋 Activity Log
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
                      <HighlightText text={app.project_name || 'N/A'} highlight={searchQuery} />
                    </td>
                    <td className={styles.td}>
                      <HighlightText text={app.customer_name || '-'} highlight={searchQuery} />
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
                            {(user?.role?.name === 'superadmin' || user?.role?.permissions?.includes('admin')) && (
                              <button 
                                onClick={() => handleReopen(app)} 
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
                       <button onClick={() => { setCommentsApprovalId(app.id); api.post(`/api/financial-approvals/${app.id}/view`); }} style={{ padding: '4px 8px', cursor: 'pointer', background: 'transparent', border: '1px solid #ccc', borderRadius: '4px', position: 'relative' }}>
                         💬 <UnreadBadge approvalId={app.id} refreshCounter={commentsRefreshSeq} />
                       </button>
                       <button onClick={() => {
                            setAttachmentApprovalId(app.id);
                            api.post(`/api/financial-approvals/${app.id}/view`);
                          }} style={{ marginLeft: '8px', padding: '4px 8px', cursor: 'pointer', background: 'transparent', border: '1px solid #ccc', borderRadius: '4px' }}>
                         📎
                       </button>
                       <button onClick={() => { setActivityApprovalId(app.id); api.post(`/api/financial-approvals/${app.id}/view`); }} style={{ marginLeft: '8px', padding: '4px 8px', cursor: 'pointer', background: 'transparent', border: '1px solid #ccc', borderRadius: '4px' }}>
                         📋
                       </button>
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
                  onClick={() => setRejectModalOpen(false)}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: 0 }}>Discussion & Notes</h3>
              <button onClick={() => setCommentsApprovalId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>✕</button>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: 0 }}>Activity & Audit Log</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => { api.post(`/api/financial-approvals/${activityApprovalId}/export`, { format: 'csv' }); alert('Exporting activity log...'); }} 
                  className={styles.primaryBtn} 
                  style={{ background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
                  ⬇️ Export CSV
                </button>
                <button onClick={() => setActivityApprovalId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>✕</button>
              </div>
            </div>
            <ActivityLogTimeline approvalId={activityApprovalId} />
          </div>
        </div>
      )}

      {attachmentApprovalId && (
          <div className={styles.modalOverlay}>
            <div className={styles.modal} style={{ maxWidth: '800px', width: '100%', padding: '0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                <h3 style={{ margin: 0 }}>Attachments & Documents</h3>
                <button onClick={() => setAttachmentApprovalId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>✕</button>
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
      </div>
    );
  }
