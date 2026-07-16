/* eslint-disable react-hooks/immutability, react-hooks/exhaustive-deps, no-unused-vars */
import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';
import { useAuth } from '../../store/authContext';
import styles from './FinancialApprovalsPage.module.css';

export default function FinancialApprovalsPage() {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectModalOpen, setRejectModalOpen] = useState(false);

  const { user } = useAuth();
  const toast = useToast();

  useEffect(() => {
    fetchApprovals();
  }, []);

  const fetchApprovals = async () => {
    try {
      const res = await api.get('/financial-approvals');
      setApprovals(res.data?.data || []);
    } catch (err) {
      toast.error('Failed to load financial approvals list.');
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (type) => {
    if (user?.role?.name === 'superadmin') return true;
    const perms = user?.role?.permissions || [];
    if (type === 'invoice') return perms.includes('finance:invoices');
    if (type === 'payment' || type === 'payment_update') return perms.includes('finance:payments');
    if (type === 'discount') return perms.includes('finance:discounts');
    if (type === 'credit' || type === 'refund') return perms.includes('finance:credits');
    return false;
  };

  const handleApprove = async (id, type) => {
    if (!hasPermission(type)) {
      toast.error('You do not have permission to approve this transaction.');
      return;
    }
    if (!window.confirm('Are you sure you want to approve this financial transaction?')) return;
    setSubmitting(true);
    try {
      await api.post(`/financial-approvals/${id}/approve`);
      toast.success('Transaction approved successfully!');
      fetchApprovals();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenReject = (approval) => {
    if (!hasPermission(approval.transaction_type)) {
      toast.error('You do not have permission to reject this transaction.');
      return;
    }
    setSelectedApproval(approval);
    setRejectionReason('');
    setRejectModalOpen(true);
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
      fetchApprovals();
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

  const pendingList = approvals.filter(a => a.status === 'pending');
  const historyList = approvals.filter(a => a.status !== 'pending');

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Financial Approvals Queue</h1>
          <p className={styles.subtitle}>Review pending transactions exceeding configured policy thresholds.</p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Pending Reviews ({pendingList.length})</h2>
        {pendingList.length === 0 ? (
          <div className={styles.empty}>All caught up! No approvals pending review.</div>
        ) : (
          <div className={styles.grid}>
            {pendingList.map((app) => (
              <div key={app.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.typeTag}>{getTypeLabel(app.transaction_type)}</span>
                  <span className={`${styles.statusTag} ${getStatusClass(app.status)}`}>{app.status}</span>
                </div>
                
                <div className={styles.cardBody}>
                  <div className={styles.amountText}>{formatCurrency(app.amount)}</div>
                  <div className={styles.detailsList}>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Project:</span>
                      <span className={styles.detailValue}>{app.project_name || 'N/A'}</span>
                    </div>
                    {app.target_number && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Reference:</span>
                        <span className={styles.detailValue}>{app.target_number}</span>
                      </div>
                    )}
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Requested By:</span>
                      <span className={styles.detailValue}>{app.requester_name || 'System'}</span>
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

                {hasPermission(app.transaction_type) && (
                  <div className={styles.cardActions}>
                    <button
                      onClick={() => handleApprove(app.id, app.transaction_type)}
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
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.section} style={{ marginTop: '40px' }}>
        <h2 className={styles.sectionTitle}>Approval History</h2>
        {historyList.length === 0 ? (
          <div className={styles.empty}>No past approvals found.</div>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Type</th>
                  <th className={styles.th}>Amount</th>
                  <th className={styles.th}>Project</th>
                  <th className={styles.th}>Requested By</th>
                  <th className={styles.th}>Status</th>
                  <th className={styles.th}>Resolved Date</th>
                  <th className={styles.th}>Remarks / Reasons</th>
                </tr>
              </thead>
              <tbody>
                {historyList.map((app) => (
                  <tr key={app.id} className={styles.tr}>
                    <td className={styles.td}><strong>{getTypeLabel(app.transaction_type)}</strong></td>
                    <td className={styles.td}>{formatCurrency(app.amount)}</td>
                    <td className={styles.td}>{app.project_name || 'N/A'}</td>
                    <td className={styles.td}>{app.requester_name || 'System'}</td>
                    <td className={styles.td}>
                      <span className={`${styles.statusBadge} ${getStatusClass(app.status)}`}>
                        {app.status}
                      </span>
                    </td>
                    <td className={styles.td}>{new Date(app.updated_at).toLocaleDateString()}</td>
                    <td className={styles.td}>
                      {app.status === 'rejected' ? (
                        <span className={styles.rejectionText}>{app.rejection_reason}</span>
                      ) : (
                        <span className={styles.okText}>Approved</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
    </div>
  );
}
