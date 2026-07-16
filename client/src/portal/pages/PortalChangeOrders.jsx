/* eslint-disable react-hooks/immutability, react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import styles from './PortalChangeOrders.module.css';
import { useToast } from '../../store/toastContext';
import api from '../../api/axios';
import { Spinner, Modal, Button, Input } from '../../components/ui';

const REASON_LABELS = {
  'client-requested': 'Client Requested',
  'design-required': 'Design Required',
  'site-required': 'Site Required'
};

export default function PortalChangeOrders() {
  const toast = useToast();
  const [changeOrders, setChangeOrders] = useState([]);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState(null);
  
  // Signature Modal state
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [signatureName, setSignatureName] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordersRes, projectRes] = await Promise.all([
        api.get('/portal/change-orders'),
        api.get('/portal/project')
      ]);

      if (ordersRes.data?.success) {
        setChangeOrders(ordersRes.data.data || []);
      }
      if (projectRes.data?.success) {
        setProject(projectRes.data.data);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load change orders.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSignModal = (id) => {
    setActiveOrderId(id);
    setSignatureName('');
    setIsSignModalOpen(true);
  };

  const handleApprove = async () => {
    if (!signatureName.trim()) {
      return toast.error('Please type your name to sign.');
    }

    setSubmittingId(activeOrderId);
    setIsSignModalOpen(false);

    try {
      const res = await api.post(`/portal/change-orders/${activeOrderId}/approve`, {
        signature: signatureName.trim()
      });
      if (res.data?.success) {
        setChangeOrders(changeOrders.map(co => co.id === activeOrderId ? { 
          ...co, 
          status: 'approved',
          client_signature: signatureName.trim(),
          client_signed_at: new Date().toISOString()
        } : co));
        toast.success('Change order approved successfully.');
        
        // Refresh project info to get updated contract value
        const projectRes = await api.get('/portal/project');
        if (projectRes.data?.success) {
          setProject(projectRes.data.data);
        }
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to approve change order.');
    } finally {
      setSubmittingId(null);
      setActiveOrderId(null);
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

  const pendingOrders = changeOrders.filter(co => co.status === 'submitted');
  const baseContractValue = Number(project?.contract_value || 0);
  const activeOrder = changeOrders.find(co => co.id === activeOrderId);

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

              {/* Reason & Timeline Grid */}
              <div className={styles.metaGrid}>
                {co.reason && (
                  <div className={styles.metaItem}>
                    Reason for Change
                    <strong>{REASON_LABELS[co.reason] || co.reason}</strong>
                  </div>
                )}
                <div className={styles.metaItem}>
                  Timeline Impact
                  <strong>{co.timeline_impact_days > 0 ? `+${co.timeline_impact_days} Days` : 'No Timeline Impact'}</strong>
                </div>
              </div>

              {/* Revised Cost Highlights */}
              <div className={styles.revisedCostHighlight}>
                <span>Projected Revised Contract Value:</span>
                <strong>{formatCurrency(baseContractValue + (co.status === 'approved' ? 0 : Number(co.amount)))}</strong>
              </div>

              {/* BOQ Delta Items */}
              <div className={styles.deltaSection}>
                <h5 className={styles.deltaTitle}>BOQ Scope Delta</h5>
                {!co.items || co.items.length === 0 ? (
                  <p className={styles.cardDescription} style={{ fontStyle: 'italic' }}>
                    No BOQ items linked to this change order.
                  </p>
                ) : (
                  <div className={styles.deltaTableWrapper}>
                    <table className={styles.deltaTable}>
                      <thead>
                        <tr>
                          <th>Area/Room</th>
                          <th>Item Name</th>
                          <th>Qty</th>
                          <th>Unit</th>
                          <th>Unit Price</th>
                          <th>Total</th>
                          <th>Scope Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {co.items.map((item) => (
                          <tr key={item.id}>
                            <td>{item.room_or_area || 'N/A'}</td>
                            <td>{item.item_name}</td>
                            <td>{Number(item.quantity).toFixed(2)}</td>
                            <td>{item.unit || 'Nos'}</td>
                            <td>{formatCurrency(item.unit_price)}</td>
                            <td>{formatCurrency(item.total_price)}</td>
                            <td>
                              <span className={item.scope_type === 'addition' ? styles.badgeAddition : styles.badgeReduction}>
                                {item.scope_type === 'addition' ? '+ Addition' : '- Reduction'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Client Signature details */}
              {co.status === 'approved' && co.client_signature && (
                <div className={styles.signatureSection}>
                  <span className={styles.signatureIcon}>✍️</span>
                  <div className={styles.signatureDetails}>
                    Approved via digital sign-off
                    <strong>Digitally Signed by: {co.client_signature}</strong>
                    <span>on {new Date(co.client_signed_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              )}

              {co.status === 'submitted' && (
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
                    onClick={() => handleOpenSignModal(co.id)}
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

      {/* Signature Sign-off Modal */}
      <Modal
        isOpen={isSignModalOpen}
        onClose={() => setIsSignModalOpen(false)}
        title="Digital Authorization Signature"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsSignModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleApprove}>Confirm & Sign</Button>
          </>
        }
      >
        <div className={styles.modalForm}>
          <p className={styles.cardDescription}>
            By digitally signing below, you authorize the scope modifications, timeline impact of{' '}
            <strong>
              {activeOrder?.timeline_impact_days > 0
                ? `+${activeOrder.timeline_impact_days} Days`
                : 'No Timeline Impact'}
            </strong>{' '}
            and the revised contract cost delta of{' '}
            <strong>{activeOrder ? formatCurrency(activeOrder.amount) : ''}</strong>.
          </p>
          <Input
            label="Type Your Full Name to Sign"
            placeholder="e.g. John Doe"
            value={signatureName}
            onChange={(e) => setSignatureName(e.target.value)}
            required
          />
        </div>
      </Modal>
    </div>
  );
}
