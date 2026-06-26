import { useState, useEffect } from 'react';
import styles from './PortalChangeOrders.module.css';
import { useToast } from '../../store/toastContext';
import api from '../../api/axios';
import { Spinner } from '../../components/ui';

export default function PortalChangeOrders() {
  const toast = useToast();
  const [changeOrders, setChangeOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState(null);

  useEffect(() => {
    fetchChangeOrders();
  }, []);

  const fetchChangeOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/portal/change-orders');
      if (res.data?.success) {
        setChangeOrders(res.data.data || []);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load change orders.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    if (!window.confirm('Are you sure you want to approve this change order? This will update project contract terms.')) return;
    setSubmittingId(id);
    try {
      const res = await api.post(`/portal/change-orders/${id}/approve`);
      if (res.data?.success) {
        setChangeOrders(changeOrders.map(co => co.id === id ? { ...co, status: 'approved' } : co));
        toast.success('Change order approved successfully.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to approve change order.');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm('Are you sure you want to reject this change order?')) return;
    setSubmittingId(id);
    try {
      const res = await api.post(`/portal/change-orders/${id}/reject`);
      if (res.data?.success) {
        setChangeOrders(changeOrders.map(co => co.id === id ? { ...co, status: 'rejected' } : co));
        toast.success('Change order rejected.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to reject change order.');
    } finally {
      setSubmittingId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <span className={`${styles.badge} ${styles.badgeApproved}`}>Approved</span>;
      case 'rejected':
        return <span className={`${styles.badge} ${styles.badgeRejected}`}>Rejected</span>;
      default:
        return <span className={`${styles.badge} ${styles.badgePending}`}>Awaiting Your Review</span>;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Spinner size="lg" />
        <p>Loading Change Orders...</p>
      </div>
    );
  }

  const pendingOrders = changeOrders.filter(co => co.status === 'pending');

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Change Orders</h1>
        <p className={styles.subtitle}>
          Review and approve scope modifications, design revision limits fees, or additional works requested for your project.
        </p>
      </header>

      {pendingOrders.length > 0 && (
        <div className={styles.alert}>
          <span className={styles.alertIcon}>🔔</span>
          <div className={styles.alertContent}>
            <strong>Action Required:</strong> You have <strong>{pendingOrders.length}</strong> change order(s) awaiting your review and approval.
          </div>
        </div>
      )}

      {changeOrders.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📄</div>
          <h3>No Change Orders Yet</h3>
          <p>Any commercial scope adjustments or additional revision charges raised by your design team will appear here.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {changeOrders.map(co => (
            <div key={co.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.cardHeaderInfo}>
                  <h3 className={styles.cardTitle}>{co.title}</h3>
                  <span className={styles.cardDate}>
                    Raised on {new Date(co.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div className={styles.cardHeaderAction}>
                  <span className={styles.cardAmount}>{formatCurrency(co.amount)}</span>
                  {getStatusBadge(co.status)}
                </div>
              </div>

              {co.description && (
                <p className={styles.cardDescription}>{co.description}</p>
              )}

              {co.status === 'pending' && (
                <div className={styles.cardActions}>
                  <button
                    className={`${styles.btn} ${styles.btnReject}`}
                    onClick={() => handleReject(co.id)}
                    disabled={submittingId === co.id}
                  >
                    Reject
                  </button>
                  <button
                    className={`${styles.btn} ${styles.btnApprove}`}
                    onClick={() => handleApprove(co.id)}
                    disabled={submittingId === co.id}
                  >
                    {submittingId === co.id ? 'Processing...' : 'Approve Change Order'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
