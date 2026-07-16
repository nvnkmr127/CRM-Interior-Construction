/* eslint-disable react-hooks/immutability, react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import styles from './PortalApprovals.module.css'; // Let's reuse PortalApprovals classes or create unique ones
import stylesCo from './PortalChangeOrders.module.css';
import { useToast } from '../../store/toastContext';
import api from '../../api/axios';
import { Spinner, Modal, Button, Input } from '../../components/ui';

export default function PortalMaterialApprovals() {
  const toast = useToast();
  const [substitutions, setSubstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState(null);

  // Response / Sign Modal state
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [activeSubId, setActiveSubId] = useState(null);
  const [signatureName, setSignatureName] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [responseStatus, setResponseStatus] = useState('approved'); // approved or rejected

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/portal/material-substitutions');
      if (res.data?.success) {
        setSubstitutions(res.data.data || []);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load material approvals.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenResponseModal = (id, status) => {
    setActiveSubId(id);
    setResponseStatus(status);
    setSignatureName('');
    setFeedbackText('');
    setIsSignModalOpen(true);
  };

  const handleRespond = async () => {
    if (responseStatus === 'approved' && !signatureName.trim()) {
      return toast.error('Please type your name to sign this approval.');
    }

    setSubmittingId(activeSubId);
    setIsSignModalOpen(false);

    try {
      const res = await api.post(`/portal/material-substitutions/${activeSubId}/respond`, {
        status: responseStatus,
        feedback: feedbackText.trim() || null,
        signatureName: responseStatus === 'approved' ? signatureName.trim() : null,
        signatureData: responseStatus === 'approved' ? signatureName.trim() : null
      });

      if (res.data?.success) {
        setSubstitutions(substitutions.map(sub => sub.id === activeSubId ? {
          ...sub,
          status: responseStatus,
          client_approval_status: responseStatus,
          client_feedback: feedbackText.trim() || null,
          client_signoff_name: responseStatus === 'approved' ? signatureName.trim() : null,
          client_signature_data: responseStatus === 'approved' ? signatureName.trim() : null,
          client_approved_at: new Date().toISOString()
        } : sub));
        toast.success(`Material specification ${responseStatus} successfully.`);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to submit response.');
    } finally {
      setSubmittingId(null);
      setActiveSubId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <span className={`${stylesCo.badge} ${stylesCo.badgeApproved}`}>✓ Approved</span>;
      case 'rejected':
        return <span className={`${stylesCo.badge} ${stylesCo.badgeRejected}`}>✗ Rejected</span>;
      default:
        return <span className={`${stylesCo.badge} ${stylesCo.badgePending}`}>Awaiting Your Review</span>;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPriceDifference = (diff) => {
    const val = Number(diff || 0);
    if (val > 0) return `+ ${formatCurrency(val)} (Increase)`;
    if (val < 0) return `- ${formatCurrency(Math.abs(val))} (Saving)`;
    return 'No Price Impact';
  };

  const getPriceImpactClass = (diff) => {
    const val = Number(diff || 0);
    if (val > 0) return stylesCo.priceCost || 'text-danger';
    if (val < 0) return stylesCo.priceSaving || 'text-success';
    return stylesCo.priceNeutral || 'text-muted';
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Material Specification Approvals</h1>
        <div className={styles.pageSub}>Review and approve material/brand upgrades or substitutions requested for your project</div>
      </div>

      <div className={stylesCo.ordersList}>
        {substitutions.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>💎</div>
            <div className={styles.emptyTitle}>No material changes logged.</div>
            <div className={styles.emptyDesc}>All specifications are active under the default BOQ.</div>
          </div>
        ) : (
          substitutions.map(sub => (
            <div key={sub.id} className={stylesCo.orderCard} style={{ border: '1px solid var(--color-border)' }}>
              <div className={stylesCo.cardHeader}>
                <div>
                  <h3 className={stylesCo.coTitle} style={{ fontSize: '15px', fontWeight: '600' }}>
                    Material Modification Request
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    Reason: <strong>{sub.reason_shortage}</strong>
                  </span>
                </div>
                {getStatusBadge(sub.status)}
              </div>

              {/* Side-by-Side Specifications Comparison */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '20px',
                marginTop: '16px',
                marginBottom: '16px'
              }}>
                {/* Original Specification */}
                <div style={{
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '16px'
                }}>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: '#6b7280',
                    borderBottom: '1px solid #e5e7eb',
                    paddingBottom: '6px',
                    marginBottom: '10px'
                  }}>
                    ORIGINAL SPECIFICATION (BEFORE)
                  </div>
                  <div style={{ marginBottom: '8px', fontSize: '13px' }}>
                    <span style={{ display: 'block', fontSize: '10px', color: '#9ca3af' }}>Item Name</span>
                    <strong>{sub.original_item_name}</strong>
                  </div>
                  <div style={{ marginBottom: '8px', fontSize: '13px' }}>
                    <span style={{ display: 'block', fontSize: '10px', color: '#9ca3af' }}>Brand / Manufacturer</span>
                    <strong>{sub.original_brand || '—'}</strong>
                  </div>
                  <div style={{ marginBottom: '8px', fontSize: '13px' }}>
                    <span style={{ display: 'block', fontSize: '10px', color: '#9ca3af' }}>Material Specifications</span>
                    <strong style={{ whiteSpace: 'pre-wrap', fontWeight: '500' }}>
                      {sub.original_material_specifications || '—'}
                    </strong>
                  </div>
                  <div style={{ fontSize: '13px' }}>
                    <span style={{ display: 'block', fontSize: '10px', color: '#9ca3af' }}>Unit Cost</span>
                    <strong>{formatCurrency(sub.original_unit_price)}</strong>
                  </div>
                </div>

                {/* Proposed Specification */}
                <div style={{
                  background: 'rgba(37, 99, 235, 0.02)',
                  border: '1px solid rgba(37, 99, 235, 0.2)',
                  borderRadius: '8px',
                  padding: '16px'
                }}>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: 'var(--color-primary)',
                    borderBottom: '1px solid rgba(37, 99, 235, 0.2)',
                    paddingBottom: '6px',
                    marginBottom: '10px'
                  }}>
                    PROPOSED SPECIFICATION (AFTER)
                  </div>
                  <div style={{ marginBottom: '8px', fontSize: '13px' }}>
                    <span style={{ display: 'block', fontSize: '10px', color: '#9ca3af' }}>Item Name</span>
                    <strong>{sub.replacement_item_name}</strong>
                  </div>
                  <div style={{ marginBottom: '8px', fontSize: '13px' }}>
                    <span style={{ display: 'block', fontSize: '10px', color: '#9ca3af' }}>Brand / Manufacturer</span>
                    <strong>{sub.replacement_brand || '—'}</strong>
                  </div>
                  <div style={{ marginBottom: '8px', fontSize: '13px' }}>
                    <span style={{ display: 'block', fontSize: '10px', color: '#9ca3af' }}>Material Specifications</span>
                    <strong style={{ whiteSpace: 'pre-wrap', fontWeight: '500' }}>
                      {sub.replacement_material_specifications || '—'}
                    </strong>
                  </div>
                  <div style={{ fontSize: '13px' }}>
                    <span style={{ display: 'block', fontSize: '10px', color: '#9ca3af' }}>Unit Cost</span>
                    <strong>{formatCurrency(sub.replacement_unit_price)}</strong>
                  </div>
                </div>
              </div>

              {/* Price Difference Summary */}
              <div style={{
                background: '#f9fafb',
                borderRadius: '6px',
                padding: '12px',
                fontSize: '13px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>Unit Cost Impact (Price Difference):</span>
                <strong className={getPriceImpactClass(sub.price_difference)}>
                  {formatPriceDifference(sub.price_difference)}
                </strong>
              </div>

              {sub.client_feedback && (
                <div className={stylesCo.signBox} style={{ marginTop: '12px', background: '#fdf2f8', borderColor: '#fbcfe8' }}>
                  <strong>Client Remarks / Feedback:</strong>
                  <p style={{ margin: 0, fontStyle: 'italic', fontSize: '12px' }}>"{sub.client_feedback}"</p>
                </div>
              )}

              {/* Approval Sign-Off rendering */}
              {sub.status === 'approved' && sub.client_signoff_name && (
                <div className={stylesCo.signBox} style={{ marginTop: '12px' }}>
                  Approved via Client Digital Sign-Off
                  <strong>Digitally Signed by: {sub.client_signoff_name}</strong>
                  {sub.client_approved_at && (
                    <span>on {new Date(sub.client_approved_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  )}
                </div>
              )}

              {/* Interactive Actions for pending review */}
              {sub.status === 'pending' && (
                <div className={stylesCo.cardActions} style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px', marginTop: '12px' }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenResponseModal(sub.id, 'rejected')}
                    disabled={submittingId === sub.id}
                  >
                    ✗ Decline Specification
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleOpenResponseModal(sub.id, 'approved')}
                    disabled={submittingId === sub.id}
                  >
                    ✓ Approve Specification
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Response Sign Modal */}
      <Modal
        isOpen={isSignModalOpen}
        onClose={() => setIsSignModalOpen(false)}
        title={responseStatus === 'approved' ? "Confirm Material Specification Sign-Off" : "Reject Material Specification"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsSignModalOpen(false)}>Cancel</Button>
            <Button 
              variant={responseStatus === 'approved' ? 'primary' : 'danger'} 
              onClick={handleRespond}
            >
              {responseStatus === 'approved' ? 'Sign & Approve' : 'Submit Rejection'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {responseStatus === 'approved' ? (
            <>
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0 }}>
                By signing below, you approve the proposed brand/specification upgrade or downgrade and any associated unit cost difference. This will update your active project BOQ.
              </p>
              <Input
                label="Your Full Name (Type to sign)"
                placeholder="e.g. John Doe"
                value={signatureName}
                onChange={e => setSignatureName(e.target.value)}
                required
              />
              {signatureName && (
                <div style={{
                  padding: '12px',
                  background: '#f9fafb',
                  border: '1px dashed #d1d5db',
                  borderRadius: '6px',
                  textAlign: 'center',
                  fontFamily: '"Brush Script MT", cursive, sans-serif',
                  fontSize: '28px',
                  color: 'var(--color-primary)'
                }}>
                  {signatureName}
                </div>
              )}
            </>
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0 }}>
              Specify why you are declining this specification. The PM will review your comments and propose an alternative brand or specification.
            </p>
          )}

          <Input
            label="Comments / Feedback (Optional)"
            placeholder="e.g. Approved. / Preferred wooden finish is too dark."
            value={feedbackText}
            onChange={e => setFeedbackText(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
