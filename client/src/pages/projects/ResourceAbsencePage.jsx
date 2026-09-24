import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../store/authContext';
import { useToast } from '../../store/toastContext';
import { 
  getLeaves, 
  getLeaveImpact, 
  createLeave, 
  updateLeaveStatus, 
  getCoveringLeaves, 
  getTeamSchedule, 
  deleteLeave 
} from '../../api/leaveApi';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { Spinner, EmptyState, Modal, Button } from '../../components/ui';
import api from '../../api/axios';
import styles from './ResourceAbsencePage.module.css';

function calcDays(start, end) {
  if (!start || !end) return 1;
  const s = new Date(start);
  const e = new Date(end);
  const diffTime = Math.abs(e - s);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays > 0 ? diffDays : 1;
}

function isActiveNow(start, end) {
  if (!start || !end) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const s = new Date(start);
  s.setHours(0, 0, 0, 0);
  const e = new Date(end);
  e.setHours(23, 59, 59, 999);
  return now >= s && now <= e;
}

function isUpcoming(start) {
  if (!start) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const s = new Date(start);
  s.setHours(0, 0, 0, 0);
  return now < s;
}

export default function ResourceAbsencePage() {
  usePageTitle('Absence Management');
  useBreadcrumbs([{ label: 'Projects' }, { label: 'Absence Management' }]);

  const { user } = useAuth();
  const toast = useToast();

  const roleName = (typeof user?.role === 'string' ? user.role : user?.role?.name || '').toLowerCase().trim();
  const perms = Array.isArray(user?.permissions) ? user.permissions : (Array.isArray(user?.role?.permissions) ? user.role.permissions : []);
  const canApprove = roleName === 'admin' || roleName === 'superadmin' || roleName === 'owner' || roleName === 'super admin' || perms.includes('*') || perms.includes('*:*');

  const hasUserSelectedTab = useRef(false);
  const [activeTab, setActiveTab] = useState(canApprove ? 'approvals' : 'my-leaves'); // Option A: admins default to 'approvals', team to 'my-leaves'

  useEffect(() => {
    if (canApprove && !hasUserSelectedTab.current && activeTab === 'my-leaves') {
      setActiveTab('approvals');
    }
  }, [canApprove]);

  const switchTab = (tab) => {
    hasUserSelectedTab.current = true;
    setActiveTab(tab);
    setStatusFilter('all');
  };

  const [myLeaves, setMyLeaves] = useState([]);
  const [allStaffLeaves, setAllStaffLeaves] = useState([]);
  const [coveringLeaves, setCoveringLeaves] = useState([]);
  const [teamSchedule, setTeamSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'planned' | 'approved' | 'rejected'
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [staffUsers, setStaffUsers] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [submissionStatus, setSubmissionStatus] = useState('planned');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveType, setLeaveType] = useState('Casual Leave');
  const [reason, setReason] = useState('');
  const [impactData, setImpactData] = useState(null);
  const [coverages, setCoverages] = useState({}); // { projectId: { coveringUserId, handoverNotes, clientNotified } }
  const [submitting, setSubmitting] = useState(false);
  const [impactLoading, setImpactLoading] = useState(false);

  // Cancel Leave Request Modal State
  const [leaveToCancel, setLeaveToCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [selectedPresetReason, setSelectedPresetReason] = useState('');

  // Leave & Attendance Policy State (Organization Defaults)
  const [leavePolicy, setLeavePolicy] = useState({
    default_annual_quota: 18,
    work_week: '5_days',
    fiscal_year_start: 'january'
  });
  const [savingPolicy, setSavingPolicy] = useState(false);

  const PRESET_CANCEL_REASONS = [
    '📅 Trip / Event Postponed',
    '💼 Urgent Project Priorities',
    '🔄 Rescheduling Leave Dates',
    '🤝 Coverage Not Needed',
    'Personal Reasons'
  ];

  useEffect(() => {
    fetchData();
  }, [user?.id, canApprove]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resMy, resCovering, resSchedule, resAll] = await Promise.all([
        getLeaves({ myLeaves: 'true' }).catch(() => []),
        getCoveringLeaves().catch(() => []),
        canApprove ? getTeamSchedule().catch(() => []) : Promise.resolve([]),
        canApprove ? getLeaves().catch(() => []) : Promise.resolve([])
      ]);

      const myLeavesData = Array.isArray(resMy) ? resMy : [];
      setMyLeaves(myLeavesData);
      setCoveringLeaves(Array.isArray(resCovering) ? resCovering : []);
      setTeamSchedule(Array.isArray(resSchedule) ? resSchedule : []);
      setAllStaffLeaves(Array.isArray(resAll) ? resAll : []);

      if (canApprove) {
        api.get('/users?limit=200').then(res => {
          const uList = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
          setStaffUsers(uList);
        }).catch(() => {});

        api.get('/config/tenant-settings').then(res => {
          if (res.data?.success && res.data.data?.leave_policy) {
            const pol = res.data.data.leave_policy;
            setLeavePolicy({
              default_annual_quota: pol.default_annual_quota !== undefined ? pol.default_annual_quota : 18,
              work_week: pol.work_week || '5_days',
              fiscal_year_start: pol.fiscal_year_start || 'january'
            });
          }
        }).catch(() => {});
      }
    } catch (err) {
      toast.error('Failed to load leave records');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLeavePolicy = async (e) => {
    e.preventDefault();
    setSavingPolicy(true);
    try {
      const payload = {
        leave_policy: {
          default_annual_quota: Number(leavePolicy.default_annual_quota) >= 0 ? Number(leavePolicy.default_annual_quota) : 18,
          work_week: leavePolicy.work_week || '5_days',
          fiscal_year_start: leavePolicy.fiscal_year_start || 'january'
        }
      };
      const res = await api.patch('/config/tenant-settings', payload);
      if (res.data?.success) {
        toast.success('Leave & Attendance Policy saved successfully!');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update leave policy');
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleStatusUpdate = async (leaveId, newStatus) => {
    setUpdatingId(leaveId);
    try {
      await updateLeaveStatus(leaveId, newStatus);
      toast.success(`Leave request ${newStatus === 'approved' ? 'approved' : 'rejected'} successfully`);
      fetchData();
    } catch (err) {
      toast.error(`Failed to update leave status`);
    } finally {
      setUpdatingId(null);
    }
  };

  const openCancelModal = (leave) => {
    setLeaveToCancel(leave);
    setCancelReason('');
    setSelectedPresetReason('');
  };

  const closeCancelModal = () => {
    if (isCancelling) return;
    setLeaveToCancel(null);
    setCancelReason('');
    setSelectedPresetReason('');
  };

  const handleSelectPreset = (preset) => {
    if (selectedPresetReason === preset) {
      setSelectedPresetReason('');
      setCancelReason('');
    } else {
      setSelectedPresetReason(preset);
      setCancelReason(preset);
    }
  };

  const handleConfirmCancelLeave = async (e) => {
    if (e) e.preventDefault();
    if (!leaveToCancel) return;

    setIsCancelling(true);
    setUpdatingId(leaveToCancel.id);
    try {
      await deleteLeave(leaveToCancel.id, {
        cancellationReason: cancelReason.trim()
      });
      toast.success('Leave request cancelled successfully');
      closeCancelModal();
      fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to cancel leave request');
    } finally {
      setIsCancelling(false);
      setUpdatingId(null);
    }
  };

  const handleDatesSelected = async () => {
    if (!startDate || !endDate) {
      toast.error('Please select both start and end dates');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast.error('End date cannot be earlier than start date');
      return;
    }
    
    setImpactLoading(true);
    try {
      const targetUserId = (canApprove && selectedStaffId) ? selectedStaffId : user.id;
      const res = await getLeaveImpact(targetUserId);
      setImpactData(res);
      const initialCov = {};
      (res?.affectedProjects || []).forEach(p => {
        initialCov[p.id] = { coveringUserId: '', handoverNotes: '', clientNotified: false };
      });
      setCoverages(initialCov);
    } catch (error) {
      toast.error('Failed to analyze project impact');
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
    if (!startDate || !endDate) {
      toast.error('Please select valid start and end dates');
      return;
    }

    setSubmitting(true);
    try {
      const coverageArray = Object.keys(coverages)
        .filter(pid => coverages[pid]?.coveringUserId)
        .map(pid => ({
          projectId: pid,
          coveringUserId: coverages[pid].coveringUserId,
          handoverNotes: coverages[pid].handoverNotes,
          clientNotified: coverages[pid].clientNotified
        }));

      const targetUserId = (canApprove && selectedStaffId) ? selectedStaffId : user.id;
      const targetStatus = canApprove ? submissionStatus : 'planned';

      await createLeave({
        userId: targetUserId,
        startDate,
        endDate,
        leaveType,
        reason,
        status: targetStatus,
        coverages: coverageArray
      });

      toast.success(
        canApprove 
          ? (targetStatus === 'approved' ? 'Leave scheduled and confirmed successfully' : 'Leave planned & approval request submitted successfully') 
          : 'Leave requested successfully'
      );
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to submit leave request');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setStartDate('');
    setEndDate('');
    setLeaveType('Casual Leave');
    setReason('');
    setImpactData(null);
    setCoverages({});
    setSelectedStaffId(user?.id || '');
    setSubmissionStatus('planned');
  };

  const openModal = () => {
    resetForm();
    setSelectedStaffId(user?.id || '');
    setSubmissionStatus('planned');
    setShowModal(true);
  };

  // Filtered lists
  const filteredMyLeaves = useMemo(() => {
    return myLeaves.filter(l => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      return true;
    });
  }, [myLeaves, statusFilter]);

  const filteredStaffLeaves = useMemo(() => {
    return allStaffLeaves.filter(l => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (l.user_name || '').toLowerCase().includes(q);
        const matchRole = (l.role_name || '').toLowerCase().includes(q);
        const matchReason = (l.reason || '').toLowerCase().includes(q);
        const matchProj = (l.coverages || []).some(c => (c.project_name || '').toLowerCase().includes(q));
        return matchName || matchRole || matchReason || matchProj;
      }
      return true;
    });
  }, [allStaffLeaves, statusFilter, searchQuery]);

  // Real KPIs (Zero Mock Data)
  const myApprovedDays = myLeaves
    .filter(l => l.status === 'approved')
    .reduce((sum, l) => sum + calcDays(l.start_date, l.end_date), 0);

  const pendingApprovalsCount = allStaffLeaves.filter(l => l.status === 'planned').length;
  const activeTodayCount = allStaffLeaves.filter(l => l.status === 'approved' && isActiveNow(l.start_date, l.end_date)).length;

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>
            Leave Management
          </h1>
          <div className={styles.desc}>
            Plan your leaves, monitor colleague coverage, review team absences, and manage handover delegations.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {canApprove && (
            <Button
              onClick={() => switchTab('policy')}
              variant={activeTab === 'policy' ? 'primary' : 'secondary'}
            >
              ⚙️ Leave Policy
            </Button>
          )}
          <Button onClick={openModal} variant="primary">
            {canApprove ? '+ Schedule Absence' : '+ Plan Leave'}
          </Button>
        </div>
      </div>

      {/* Tab Navigation - Option A: Management-first for Admins, Staff-first for Team Members */}
      <div className={styles.tabNav}>
        {canApprove ? (
          <>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'approvals' ? styles.tabBtnActive : ''}`}
              onClick={() => switchTab('approvals')}
            >
              ⚖️ Staff Approvals ({allStaffLeaves.length})
              {pendingApprovalsCount > 0 && (
                <span className={styles.tabBadge} style={{ background: '#f59e0b' }}>
                  {pendingApprovalsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'schedule' ? styles.tabBtnActive : ''}`}
              onClick={() => switchTab('schedule')}
            >
              📅 Team Schedule ({teamSchedule.length})
            </button>

            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'covering' ? styles.tabBtnActive : ''}`}
              onClick={() => switchTab('covering')}
            >
              🤝 Covering for Colleagues
              {coveringLeaves.length > 0 && (
                <span className={styles.tabBadge}>{coveringLeaves.length}</span>
              )}
            </button>

            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'my-leaves' ? styles.tabBtnActive : ''}`}
              onClick={() => switchTab('my-leaves')}
            >
              📋 My Leaves ({myLeaves.length})
            </button>

            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'policy' ? styles.tabBtnActive : ''}`}
              onClick={() => switchTab('policy')}
            >
              ⚙️ Leave Policy
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'my-leaves' ? styles.tabBtnActive : ''}`}
              onClick={() => switchTab('my-leaves')}
            >
              📋 My Leaves ({myLeaves.length})
            </button>

            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'covering' ? styles.tabBtnActive : ''}`}
              onClick={() => switchTab('covering')}
            >
              🤝 Covering for Colleagues
              {coveringLeaves.length > 0 && (
                <span className={styles.tabBadge}>{coveringLeaves.length}</span>
              )}
            </button>
          </>
        )}
      </div>

      {loading ? (
        <div style={{ padding: '40px 0' }}><Spinner /></div>
      ) : activeTab === 'my-leaves' || (!canApprove && activeTab !== 'covering') ? (
        /* ── MY LEAVES TAB ── */
        <div>
          {/* Summary Metric Cards */}
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Total Requests</span>
                <span className={styles.kpiIcon}>📝</span>
              </div>
              <div className={styles.kpiValue}>{myLeaves.length}</div>
              <div className={styles.kpiSub}>Total leaves submitted by you</div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Approved Leaves</span>
                <span className={styles.kpiIcon}>✅</span>
              </div>
              <div className={styles.kpiValue} style={{ color: '#059669' }}>
                {myLeaves.filter(l => l.status === 'approved').length}
              </div>
              <div className={styles.kpiSub}>Confirmed by management</div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Pending Review</span>
                <span className={styles.kpiIcon}>⏳</span>
              </div>
              <div className={styles.kpiValue} style={{ color: '#d97706' }}>
                {myLeaves.filter(l => l.status === 'planned').length}
              </div>
              <div className={styles.kpiSub}>Awaiting manager approval</div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Days Approved</span>
                <span className={styles.kpiIcon}>🌴</span>
              </div>
              <div className={styles.kpiValue} style={{ color: '#2563eb' }}>
                {myApprovedDays}
              </div>
              <div className={styles.kpiSub}>Total calendar days taken</div>
            </div>
          </div>

          {/* Table Toolbar */}
          <div className={styles.tableCard}>
            <div className={styles.tableToolbar}>
              <div className={styles.filterGroup}>
                <button
                  type="button"
                  className={`${styles.filterPill} ${statusFilter === 'all' ? styles.filterPillActive : ''}`}
                  onClick={() => setStatusFilter('all')}
                >
                  All ({myLeaves.length})
                </button>
                <button
                  type="button"
                  className={`${styles.filterPill} ${statusFilter === 'planned' ? styles.filterPillActive : ''}`}
                  onClick={() => setStatusFilter('planned')}
                >
                  Pending ({myLeaves.filter(l => l.status === 'planned').length})
                </button>
                <button
                  type="button"
                  className={`${styles.filterPill} ${statusFilter === 'approved' ? styles.filterPillActive : ''}`}
                  onClick={() => setStatusFilter('approved')}
                >
                  Approved ({myLeaves.filter(l => l.status === 'approved').length})
                </button>
                <button
                  type="button"
                  className={`${styles.filterPill} ${statusFilter === 'rejected' ? styles.filterPillActive : ''}`}
                  onClick={() => setStatusFilter('rejected')}
                >
                  Rejected ({myLeaves.filter(l => l.status === 'rejected').length})
                </button>
              </div>
            </div>

            {filteredMyLeaves.length === 0 ? (
              <EmptyState 
                title="No leaves match this filter" 
                description="Click '+ Plan Leave' above to submit a new leave request." 
              />
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Leave Type</th>
                    <th className={styles.th}>Duration & Dates</th>
                    <th className={styles.th}>Reason</th>
                    <th className={styles.th}>Project Handover Coverage</th>
                    <th className={styles.th}>Status</th>
                    <th className={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMyLeaves.map(l => {
                    const daysCount = calcDays(l.start_date, l.end_date);
                    const isPlanned = l.status === 'planned';

                    return (
                      <tr key={l.id} className={styles.tr}>
                        <td className={styles.td}>
                          <span className={styles.typeBadge}>{l.leave_type || 'Annual Leave'}</span>
                        </td>
                        <td className={styles.td}>
                          <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                            {new Date(l.start_date).toLocaleDateString()} – {new Date(l.end_date).toLocaleDateString()}
                            <span className={styles.durationPill}>{daysCount} {daysCount === 1 ? 'day' : 'days'}</span>
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                            Applied on {l.created_at ? new Date(l.created_at).toLocaleDateString() : '—'}
                          </div>
                        </td>
                        <td className={styles.td} style={{ maxWidth: '240px' }}>
                          <span style={{ color: l.reason ? 'var(--color-text)' : 'var(--color-text-secondary)' }}>
                            {l.reason || '—'}
                          </span>
                        </td>
                        <td className={styles.td} style={{ minWidth: '220px' }}>
                          {l.coverages && l.coverages.length > 0 ? (
                            <div className={styles.coveragePill}>
                              <span className={styles.coverageIcon}>🤝 Handover Coverage</span>
                              {l.coverages.map((cov, i) => (
                                <div key={i} className={styles.coverageItem}>
                                  Covered by <strong>{cov.covering_user_name || 'Colleague'}</strong> on <Link to={`/projects/${cov.project_id}`} className={styles.projectLink}>{cov.project_name}</Link>
                                  {cov.handover_notes && <span> · <span className={styles.notesQuote}>"{cov.handover_notes}"</span></span>}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>No active projects affected</span>
                          )}
                        </td>
                        <td className={styles.td}>
                          <span className={`${styles.statusBadge} ${styles[l.status] || ''}`}>
                            {l.status}
                          </span>
                        </td>
                        <td className={styles.td}>
                          {isPlanned || canApprove ? (
                            <button
                              type="button"
                              className={styles.cancelBtn}
                              disabled={updatingId === l.id}
                              onClick={() => openCancelModal(l)}
                              title={canApprove && l.status === 'approved' ? "Cancel scheduled absence" : "Cancel pending leave request"}
                            >
                              ✕ Cancel
                            </button>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : activeTab === 'covering' ? (
        /* ── COVERING FOR COLLEAGUES TAB ── */
        <div>
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Delegations Assigned</span>
                <span className={styles.kpiIcon}>🤝</span>
              </div>
              <div className={styles.kpiValue}>{coveringLeaves.length}</div>
              <div className={styles.kpiSub}>Projects designated to you</div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Active Right Now</span>
                <span className={styles.kpiIcon}>🟢</span>
              </div>
              <div className={styles.kpiValue} style={{ color: '#059669' }}>
                {coveringLeaves.filter(c => isActiveNow(c.start_date, c.end_date)).length}
              </div>
              <div className={styles.kpiSub}>Colleagues currently away</div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Upcoming Delegations</span>
                <span className={styles.kpiIcon}>📅</span>
              </div>
              <div className={styles.kpiValue} style={{ color: '#0369a1' }}>
                {coveringLeaves.filter(c => isUpcoming(c.start_date)).length}
              </div>
              <div className={styles.kpiSub}>Scheduled for future dates</div>
            </div>
          </div>

          <div className={styles.tableCard}>
            {coveringLeaves.length === 0 ? (
              <EmptyState 
                title="No projects assigned to cover" 
                description="You have not been designated to cover any colleague projects yet." 
              />
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Colleague on Leave</th>
                    <th className={styles.th}>Project to Cover</th>
                    <th className={styles.th}>Client</th>
                    <th className={styles.th}>Coverage Window</th>
                    <th className={styles.th}>Leave Type</th>
                    <th className={styles.th}>Handover Notes</th>
                    <th className={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {coveringLeaves.map(c => {
                    const activeNow = isActiveNow(c.start_date, c.end_date);
                    const upcoming = isUpcoming(c.start_date);
                    const daysCount = calcDays(c.start_date, c.end_date);

                    return (
                      <tr key={c.coverage_id} className={styles.tr}>
                        <td className={styles.td}>
                          <span className={styles.userName}>{c.requester_name}</span>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                            {c.requester_role || 'Team Member'}
                          </div>
                        </td>
                        <td className={styles.td}>
                          <Link to={`/projects/${c.project_id}`} className={styles.projectLink}>
                            {c.project_name} ↗
                          </Link>
                        </td>
                        <td className={styles.td}>{c.client_name || '—'}</td>
                        <td className={styles.td}>
                          <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                            {new Date(c.start_date).toLocaleDateString()} – {new Date(c.end_date).toLocaleDateString()}
                            <span className={styles.durationPill}>{daysCount} {daysCount === 1 ? 'day' : 'days'}</span>
                          </div>
                          <div>
                            {activeNow && <span className={styles.activeBadge}>Active Now</span>}
                            {upcoming && <span className={styles.upcomingBadge}>Upcoming</span>}
                          </div>
                        </td>
                        <td className={styles.td}>
                          <span className={styles.typeBadge}>{c.leave_type || 'Annual Leave'}</span>
                        </td>
                        <td className={styles.td}>
                          <span className={styles.notesQuote}>{c.handover_notes || '—'}</span>
                        </td>
                        <td className={styles.td}>
                          <span className={`${styles.statusBadge} ${styles[c.leave_status] || ''}`}>
                            {c.leave_status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : activeTab === 'approvals' && canApprove ? (
        /* ── STAFF APPROVALS TAB (FOR ADMINS) ── */
        <div>
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Pending Review</span>
                <span className={styles.kpiIcon}>⏳</span>
              </div>
              <div className={styles.kpiValue} style={{ color: '#d97706' }}>{pendingApprovalsCount}</div>
              <div className={styles.kpiSub}>Require admin action</div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>On Leave Today</span>
                <span className={styles.kpiIcon}>🌴</span>
              </div>
              <div className={styles.kpiValue} style={{ color: '#059669' }}>{activeTodayCount}</div>
              <div className={styles.kpiSub}>Active company absences</div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Total Approved</span>
                <span className={styles.kpiIcon}>✅</span>
              </div>
              <div className={styles.kpiValue} style={{ color: '#2563eb' }}>
                {allStaffLeaves.filter(l => l.status === 'approved').length}
              </div>
              <div className={styles.kpiSub}>Confirmed leaves on record</div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiHeader}>
                <span className={styles.kpiLabel}>Total Company Requests</span>
                <span className={styles.kpiIcon}>📋</span>
              </div>
              <div className={styles.kpiValue}>{allStaffLeaves.length}</div>
              <div className={styles.kpiSub}>All recorded leaves</div>
            </div>
          </div>

          <div className={styles.tableCard}>
            <div className={styles.tableToolbar}>
              <div className={styles.searchBox}>
                <span className={styles.searchIcon}>🔍</span>
                <input
                  type="text"
                  placeholder="Search by staff name, role, or project..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
              </div>
              <div className={styles.filterGroup}>
                <button
                  type="button"
                  className={`${styles.filterPill} ${statusFilter === 'all' ? styles.filterPillActive : ''}`}
                  onClick={() => setStatusFilter('all')}
                >
                  All ({allStaffLeaves.length})
                </button>
                <button
                  type="button"
                  className={`${styles.filterPill} ${statusFilter === 'planned' ? styles.filterPillActive : ''}`}
                  onClick={() => setStatusFilter('planned')}
                >
                  Pending ({allStaffLeaves.filter(l => l.status === 'planned').length})
                </button>
                <button
                  type="button"
                  className={`${styles.filterPill} ${statusFilter === 'approved' ? styles.filterPillActive : ''}`}
                  onClick={() => setStatusFilter('approved')}
                >
                  Approved ({allStaffLeaves.filter(l => l.status === 'approved').length})
                </button>
                <button
                  type="button"
                  className={`${styles.filterPill} ${statusFilter === 'rejected' ? styles.filterPillActive : ''}`}
                  onClick={() => setStatusFilter('rejected')}
                >
                  Rejected ({allStaffLeaves.filter(l => l.status === 'rejected').length})
                </button>
              </div>
            </div>

            {filteredStaffLeaves.length === 0 ? (
              <EmptyState 
                title="No staff leaves match your criteria" 
                description="Try clearing search or filters." 
              />
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Staff Member</th>
                    <th className={styles.th}>Role</th>
                    <th className={styles.th}>Leave Type</th>
                    <th className={styles.th}>Duration & Dates</th>
                    <th className={styles.th}>Reason</th>
                    <th className={styles.th}>Coverage Plan</th>
                    <th className={styles.th}>Status</th>
                    <th className={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaffLeaves.map(l => {
                    const daysCount = calcDays(l.start_date, l.end_date);
                    return (
                      <tr key={l.id} className={styles.tr}>
                        <td className={styles.td}>
                          <span className={styles.userName}>{l.user_name}</span>
                          {l.user_id === user?.id && <span className={styles.selfBadge}>You</span>}
                        </td>
                        <td className={styles.td}>{l.role_name || 'Team Member'}</td>
                        <td className={styles.td}>
                          <span className={styles.typeBadge}>{l.leave_type || 'Annual Leave'}</span>
                        </td>
                        <td className={styles.td}>
                          <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                            {new Date(l.start_date).toLocaleDateString()} – {new Date(l.end_date).toLocaleDateString()}
                            <span className={styles.durationPill}>{daysCount} {daysCount === 1 ? 'day' : 'days'}</span>
                          </div>
                        </td>
                        <td className={styles.td}>{l.reason || '—'}</td>
                        <td className={styles.td} style={{ minWidth: '220px' }}>
                          {l.coverages && l.coverages.length > 0 ? (
                            <div className={styles.coveragePill}>
                              <span className={styles.coverageIcon}>🤝 Handover Coverage</span>
                              {l.coverages.map((cov, i) => (
                                <div key={i} className={styles.coverageItem}>
                                  Covered by <strong>{cov.covering_user_name || 'Colleague'}</strong> on <Link to={`/projects/${cov.project_id}`} className={styles.projectLink}>{cov.project_name}</Link>
                                  {cov.handover_notes && <span> · <span className={styles.notesQuote}>"{cov.handover_notes}"</span></span>}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>No projects affected</span>
                          )}
                        </td>
                        <td className={styles.td}>
                          <span className={`${styles.statusBadge} ${styles[l.status] || ''}`}>
                            {l.status}
                          </span>
                        </td>
                        <td className={styles.td}>
                          <div className={styles.actionCell}>
                            {l.status === 'planned' ? (
                              <>
                                <button
                                  type="button"
                                  className={styles.approveBtn}
                                  disabled={updatingId === l.id}
                                  onClick={() => handleStatusUpdate(l.id, 'approved')}
                                  title="Approve leave request"
                                >
                                  ✓ Approve
                                </button>
                                <button
                                  type="button"
                                  className={styles.rejectBtn}
                                  disabled={updatingId === l.id}
                                  onClick={() => handleStatusUpdate(l.id, 'rejected')}
                                  title="Reject leave request"
                                >
                                  ✕ Reject
                                </button>
                              </>
                            ) : l.status === 'approved' ? (
                              <button
                                type="button"
                                className={styles.rejectBtn}
                                disabled={updatingId === l.id}
                                onClick={() => handleStatusUpdate(l.id, 'rejected')}
                                title="Change status to rejected"
                              >
                                Revoke
                              </button>
                            ) : (
                              <button
                                type="button"
                                className={styles.approveBtn}
                                disabled={updatingId === l.id}
                                onClick={() => handleStatusUpdate(l.id, 'approved')}
                                title="Change status to approved"
                              >
                                Approve
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : activeTab === 'schedule' && canApprove ? (
        /* ── TEAM ABSENCE SCHEDULE TAB (EXCLUSIVE TO ADMIN / SUPER ADMIN) ── */
        <div>
          {/* Active Absences Spotlight */}
          {teamSchedule.some(s => isActiveNow(s.start_date, s.end_date)) && (
            <div className={styles.activeRosterBanner}>
              <span>🟢</span>
              <div>
                <strong>Staff currently on leave today:</strong>{' '}
                {teamSchedule
                  .filter(s => isActiveNow(s.start_date, s.end_date))
                  .map(s => `${s.user_name} (${s.role_name || 'Staff'})`)
                  .join(', ')}
              </div>
            </div>
          )}

          <div className={styles.scheduleCard}>
            <div className={styles.scheduleHeader}>
              <div className={styles.scheduleTitle}>
                <span>📅</span> Company-wide Staff Absence Roster
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                {teamSchedule.length} active and planned absence(s) on schedule
              </div>
            </div>

            {teamSchedule.length === 0 ? (
              <EmptyState 
                title="No absences scheduled" 
                description="All team members are currently active with zero planned leaves on record." 
              />
            ) : (
              <div className={styles.scheduleGrid}>
                {teamSchedule.map(s => {
                  const activeNow = isActiveNow(s.start_date, s.end_date);
                  const upcoming = isUpcoming(s.start_date);
                  const daysCount = calcDays(s.start_date, s.end_date);

                  return (
                    <div key={s.id} className={styles.scheduleItem}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
                            {s.user_name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                            {s.role_name || 'Team Member'}
                          </div>
                        </div>
                        <span className={`${styles.statusBadge} ${styles[s.status] || ''}`}>
                          {s.status}
                        </span>
                      </div>

                      <div style={{ fontSize: '12px', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🗓️</span>
                        <span>{new Date(s.start_date).toLocaleDateString()} – {new Date(s.end_date).toLocaleDateString()}</span>
                        <span className={styles.durationPill}>{daysCount}d</span>
                      </div>

                      <div>
                        {activeNow && <span className={styles.activeBadge}>Active Today</span>}
                        {upcoming && <span className={styles.upcomingBadge}>Upcoming</span>}
                      </div>

                      {s.coverages && s.coverages.length > 0 && (
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', background: 'var(--color-surface)', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                          {s.coverages.map((cov, idx) => (
                            <div key={idx}>
                              🤝 Covered by <strong>{cov.covering_user_name || 'Colleague'}</strong> on <Link to={`/projects/${cov.project_id}`} className={styles.projectLink}>{cov.project_name}</Link>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'policy' && canApprove ? (
        /* ── LEAVE & ATTENDANCE POLICY TAB ── */
        <div className={styles.policyCard}>
          <div className={styles.policyHeader}>
            <span style={{ fontSize: '22px' }}>📅</span>
            <h3 className={styles.policyTitle}>Leave & Attendance Policy</h3>
          </div>
          <div className={styles.policyDesc}>
            Define company-wide paid leave quotas, working week structure, and annual cycle renewal dates for all employees.
          </div>

          <form onSubmit={handleSaveLeavePolicy} className={styles.policyForm}>
            <div className={styles.policyRow}>
              <div className={styles.policyGroup}>
                <label className={styles.policyLabel}>Default Annual Leave Quota (Days / Year) *</label>
                <input
                  type="number"
                  min="0"
                  max="365"
                  className={styles.policyInput}
                  value={leavePolicy.default_annual_quota}
                  onChange={e => setLeavePolicy({ ...leavePolicy, default_annual_quota: e.target.value })}
                  required
                  placeholder="e.g. 18"
                />
                <span className={styles.policyHelpText}>
                  Standard baseline annual paid leaves allocated to employees who do not have an individual override.
                </span>
              </div>

              <div className={styles.policyGroup}>
                <label className={styles.policyLabel}>Work Week Schedule *</label>
                <select
                  className={styles.policyInput}
                  value={leavePolicy.work_week}
                  onChange={e => setLeavePolicy({ ...leavePolicy, work_week: e.target.value })}
                >
                  <option value="5_days">5 Days / Week (Monday – Friday, Weekends Off)</option>
                  <option value="6_days">6 Days / Week (Monday – Saturday, Sunday Off)</option>
                </select>
                <span className={styles.policyHelpText}>
                  Controls the working day multiplier used to calculate monthly attendance rates and days present.
                </span>
              </div>
            </div>

            <div className={styles.policyRow}>
              <div className={styles.policyGroup}>
                <label className={styles.policyLabel}>Annual Leave Cycle / Fiscal Renewal *</label>
                <select
                  className={styles.policyInput}
                  value={leavePolicy.fiscal_year_start}
                  onChange={e => setLeavePolicy({ ...leavePolicy, fiscal_year_start: e.target.value })}
                >
                  <option value="january">Calendar Year (January 1 – December 31)</option>
                  <option value="april">Fiscal Year (April 1 – March 31)</option>
                </select>
                <span className={styles.policyHelpText}>
                  Leave balance resets and counts deductions strictly within this annual cycle window.
                </span>
              </div>

              <div className={styles.policyGroup} style={{ justifyContent: 'center' }}>
                <div className={styles.policySummaryBox}>
                  <div className={styles.policySummaryTitle}>
                    Policy Summary:
                  </div>
                  <div className={styles.policySummaryContent}>
                    • <strong>{leavePolicy.default_annual_quota || 18} days</strong> quota renewed annually ({leavePolicy.fiscal_year_start === 'april' ? 'Apr–Mar' : 'Jan–Dec'})<br />
                    • <strong>{leavePolicy.work_week === '6_days' ? '6-Day work schedule (Mon–Sat)' : '5-Day standard schedule (Mon–Fri)'}</strong>
                  </div>
                </div>
              </div>
            </div>

            <button type="submit" className={styles.savePolicyBtn} disabled={savingPolicy}>
              {savingPolicy ? 'Saving Policy...' : 'Save Leave Policy'}
            </button>
          </form>
        </div>
      ) : null}

      {/* ── PLAN LEAVE MODAL ── */}
      {showModal && (
        <Modal 
          isOpen={showModal} 
          title={canApprove ? "Schedule Planned Absence" : "Plan Leave Request"} 
          onClose={() => setShowModal(false)} 
          size="lg"
        >
          <form onSubmit={handleSubmit} className={styles.form}>
            {canApprove && (
              <div className={styles.formRow} style={{ marginBottom: 'var(--space-4)' }}>
                <div className={styles.formGroup} style={{ flex: 1.4 }}>
                  <label>Staff Member / Employee *</label>
                  <select 
                    value={selectedStaffId || user?.id || ''} 
                    onChange={(e) => {
                      setSelectedStaffId(e.target.value);
                      setImpactData(null);
                    }}
                    className={styles.select}
                    required
                  >
                    <option value={user?.id}>Myself ({user?.name || user?.email} - {roleName})</option>
                    {staffUsers
                      .filter(u => u.id !== user?.id)
                      .map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name || u.email} {u.role_name || u.role ? `(${u.role_name || u.role})` : ''} {u.department ? `· ${u.department}` : ''}
                        </option>
                      ))}
                  </select>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)', display: 'block' }}>
                    Select which employee or department member this absence is scheduled for.
                  </span>
                </div>
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label>Approval Workflow Mode *</label>
                  <select 
                    value={submissionStatus} 
                    onChange={(e) => setSubmissionStatus(e.target.value)}
                    className={styles.select}
                    required
                  >
                    <option value="planned">⏳ Pending Review (Submit to Approvals Queue)</option>
                    <option value="approved">✅ Confirmed (Auto-Approved Absence)</option>
                  </select>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)', display: 'block' }}>
                    {submissionStatus === 'planned' 
                      ? 'Displays in Staff Approvals queue with pending status.' 
                      : 'Bypasses review and marks absence as confirmed.'}
                  </span>
                </div>
              </div>
            )}
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Start Date *</label>
                <input 
                  type="date" 
                  required 
                  value={startDate} 
                  onChange={e => {
                    setStartDate(e.target.value);
                    setImpactData(null);
                  }} 
                />
              </div>
              <div className={styles.formGroup}>
                <label>End Date *</label>
                <input 
                  type="date" 
                  required 
                  value={endDate} 
                  onChange={e => {
                    setEndDate(e.target.value);
                    setImpactData(null);
                  }} 
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Leave Type *</label>
                <select 
                  value={leaveType} 
                  onChange={e => setLeaveType(e.target.value)}
                  className={styles.select}
                  required
                >
                  <option value="Casual Leave">Casual Leave</option>
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Earned / Annual Leave">Earned / Annual Leave</option>
                  <option value="Maternity / Paternity">Maternity / Paternity</option>
                  <option value="Unpaid Leave">Unpaid Leave</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Reason</label>
                <input 
                  type="text" 
                  placeholder="e.g. Family vacation, personal appointment" 
                  value={reason} 
                  onChange={e => setReason(e.target.value)} 
                />
              </div>
            </div>

            {!impactData && (
              <div className={styles.actionPrompt}>
                <Button 
                  type="button" 
                  onClick={handleDatesSelected} 
                  disabled={impactLoading || !startDate || !endDate} 
                  variant="primary"
                >
                  {impactLoading ? 'Analyzing Active Projects...' : 'Automated Project Impact Analysis →'}
                </Button>
              </div>
            )}

            {impactData && (
              <div className={styles.impactSection}>
                <div className={styles.impactHeader}>
                  <div className={styles.impactTitle}>Project Handover & Coverage Plan</div>
                  <div className={styles.impactSubtitle}>
                    {impactData.affectedProjects.length === 0 
                      ? 'No active client projects are currently impacted by your leave dates.'
                      : `You have ${impactData.affectedProjects.length} active/ongoing project(s). You can designate colleague handovers below:`}
                  </div>
                </div>

                {impactData.affectedProjects.length > 0 && (
                  <div className={styles.coverageList}>
                    {impactData.affectedProjects.map(p => (
                      <div key={p.id} className={styles.coverageItem}>
                        <div className={styles.covHeader}>
                          <span className={styles.covProjectName}>{p.project_name}</span>
                          <span className={styles.covClientName}>Client: {p.client_name || 'Internal'} · <span style={{ textTransform: 'capitalize', color: 'var(--color-text-secondary)', fontWeight: 400 }}>{p.status?.replace('_', ' ')}</span></span>
                        </div>
                        <div className={styles.covControls}>
                          <div className={styles.colleagueSelect}>
                            <select 
                              value={coverages[p.id]?.coveringUserId || ''} 
                              onChange={(e) => handleCoverageChange(p.id, 'coveringUserId', e.target.value)}
                            >
                              <option value="">-- Select Covering Colleague (Optional) --</option>
                              {impactData.availableCoveringUsers.map(u => (
                                <option key={u.id} value={u.id}>{u.name} ({u.role_name || 'Team'})</option>
                              ))}
                            </select>
                          </div>
                          <div className={styles.notesInput}>
                            <input 
                              type="text" 
                              placeholder="Handover notes (key milestones, contacts)..."
                              value={coverages[p.id]?.handoverNotes || ''}
                              onChange={(e) => handleCoverageChange(p.id, 'handoverNotes', e.target.value)}
                            />
                          </div>
                          <label className={styles.checkboxLabel}>
                            <input 
                              type="checkbox"
                              checked={coverages[p.id]?.clientNotified || false}
                              onChange={(e) => handleCoverageChange(p.id, 'clientNotified', e.target.checked)}
                            />
                            <span>Notify Client</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className={styles.modalActions}>
                  <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={submitting}>
                    {canApprove 
                      ? (submissionStatus === 'approved' ? 'Confirm Absence' : 'Submit Approval Request') 
                      : 'Submit Leave Request'}
                  </Button>
                </div>
              </div>
            )}
          </form>
        </Modal>
      )}

      {/* ── ENHANCED CANCEL LEAVE REQUEST MODAL FORM ── */}
      {leaveToCancel && (
        <Modal
          isOpen={!!leaveToCancel}
          title={
            leaveToCancel.status === 'approved' 
              ? "Cancel Scheduled Absence" 
              : "Cancel Leave Request"
          }
          onClose={closeCancelModal}
          size="md"
        >
          <form onSubmit={handleConfirmCancelLeave} className={styles.cancelForm}>
            {/* Leave Details Summary Card */}
            <div className={styles.cancelSummaryCard}>
              <div className={styles.cancelSummaryHeader}>
                <span className={styles.cancelSummaryTitle}>
                  📋 Absence Details
                </span>
                <span className={`${styles.statusBadge} ${styles[leaveToCancel.status] || ''}`}>
                  {leaveToCancel.status}
                </span>
              </div>
              <div className={styles.cancelSummaryGrid}>
                <div className={styles.cancelField}>
                  <span className={styles.cancelFieldLabel}>Leave Type</span>
                  <span className={styles.cancelFieldValue}>
                    <span className={styles.typeBadge}>{leaveToCancel.leave_type || 'Casual Leave'}</span>
                  </span>
                </div>
                <div className={styles.cancelField}>
                  <span className={styles.cancelFieldLabel}>Duration & Dates</span>
                  <span className={styles.cancelFieldValue}>
                    📅 {new Date(leaveToCancel.start_date).toLocaleDateString()} – {new Date(leaveToCancel.end_date).toLocaleDateString()}
                    <span className={styles.durationPill}>
                      {calcDays(leaveToCancel.start_date, leaveToCancel.end_date)} {calcDays(leaveToCancel.start_date, leaveToCancel.end_date) === 1 ? 'day' : 'days'}
                    </span>
                  </span>
                </div>
                <div className={styles.cancelField} style={{ gridColumn: 'span 2' }}>
                  <span className={styles.cancelFieldLabel}>Original Stated Reason</span>
                  <span className={styles.cancelFieldValue} style={{ color: leaveToCancel.reason ? 'var(--color-text)' : 'var(--color-text-secondary)', fontStyle: leaveToCancel.reason ? 'normal' : 'italic' }}>
                    {leaveToCancel.reason ? `"${leaveToCancel.reason}"` : 'No specific reason entered'}
                  </span>
                </div>
              </div>
            </div>

            {/* Handover & Coverage Recall Notice */}
            {leaveToCancel.coverages && leaveToCancel.coverages.length > 0 ? (
              <div className={styles.cancelHandoverBox}>
                <div className={styles.cancelHandoverHeader}>
                  <span>🤝 Active Project Handover Recall</span>
                </div>
                {leaveToCancel.coverages.map((cov, i) => (
                  <div key={i} className={styles.cancelHandoverItem}>
                    <div>
                      Covered by <strong>{cov.covering_user_name || 'Colleague'}</strong> on <Link to={`/projects/${cov.project_id}`} className={styles.projectLink}>{cov.project_name}</Link>
                      {cov.handover_notes && <span> · <span className={styles.notesQuote}>"{cov.handover_notes}"</span></span>}
                    </div>
                  </div>
                ))}
                <p className={styles.cancelHandoverNotice}>
                  🔔 <strong>Automated Colleague Notification:</strong> Your covering colleague ({leaveToCancel.coverages.map(c => c.covering_user_name || 'colleague').join(', ')}) will be automatically notified that this absence has been cancelled and their project handover coverage is no longer required.
                </p>
              </div>
            ) : null}

            {/* Reason for Cancellation Input */}
            <div className={styles.cancelReasonSection}>
              <label className={styles.cancelReasonLabel}>
                Reason for Cancellation <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)', fontSize: '12px' }}>(Optional)</span>
              </label>
              
              {/* Quick preset chips */}
              <div className={styles.presetChips}>
                {PRESET_CANCEL_REASONS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`${styles.presetChip} ${selectedPresetReason === preset ? styles.presetChipActive : ''}`}
                    onClick={() => handleSelectPreset(preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <textarea
                className={styles.cancelTextarea}
                rows={3}
                placeholder="Explain why you are cancelling this leave request (e.g., event rescheduled, work priorities changed, etc.)..."
                value={cancelReason}
                onChange={(e) => {
                  setCancelReason(e.target.value);
                  if (selectedPresetReason && e.target.value !== selectedPresetReason) {
                    setSelectedPresetReason('');
                  }
                }}
              />
            </div>

            {/* Policy Confirmation Callout */}
            <div className={styles.cancelWarningBox}>
              <span style={{ fontSize: '16px', lineHeight: 1 }}>⚠️</span>
              <div>
                <strong>Cancellation Impact:</strong> Once cancelled, this leave entry will be permanently removed from your schedule, your leave balance will be restored, and any pending manager approval requests will be dismissed.
              </div>
            </div>

            {/* Modal Actions */}
            <div className={styles.cancelModalFooter}>
              <button
                type="button"
                className={styles.keepLeaveBtn}
                onClick={closeCancelModal}
                disabled={isCancelling}
              >
                Keep Leave
              </button>
              <button
                type="submit"
                className={styles.confirmCancelBtn}
                disabled={isCancelling}
              >
                {isCancelling ? 'Cancelling...' : '✕ Confirm Cancellation'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
