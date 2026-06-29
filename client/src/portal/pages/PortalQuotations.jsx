import { useState, useEffect } from 'react';
import styles from './PortalQuotations.module.css';
import { useToast } from '../../store/toastContext';
import api from '../../api/axios';
import { Spinner, Modal, Button, Input, Badge } from '../../components/ui';

export default function PortalQuotations() {
  const toast = useToast();
  
  // Data State
  const [quotations, setQuotations] = useState([]);
  const [activeQuotation, setActiveQuotation] = useState(null);
  const [activeItems, setActiveItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState(null);

  // Compare State
  const [compareMode, setCompareMode] = useState(false);
  const [compareBaseId, setCompareBaseId] = useState('');
  const [compareTargetId, setCompareTargetId] = useState('');
  const [comparisonResult, setComparisonResult] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);

  // Acceptance Modal State
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [actionType, setActionType] = useState('accept'); // 'accept' | 'reject'

  useEffect(() => {
    fetchQuotations();
  }, []);

  const fetchQuotations = async (selectId = null) => {
    setLoading(true);
    try {
      const res = await api.get('/portal/quotations');
      if (res.data?.success) {
        const list = res.data.data || [];
        setQuotations(list);
        
        // Select active version (either the selected one, or the latest)
        if (list.length > 0) {
          const toSelect = selectId ? list.find(q => q.id === selectId) : list[0];
          if (toSelect) {
            handleSelectQuotation(toSelect);
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load project quotations.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectQuotation = async (q) => {
    setCompareMode(false);
    setActiveQuotation(q);
    setItemsLoading(true);
    try {
      const res = await api.get(`/portal/quotations/${q.id}`);
      if (res.data?.success) {
        setActiveItems(res.data.data.items || []);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load items for this quotation version.');
    } finally {
      setItemsLoading(false);
    }
  };

  const triggerComparison = async () => {
    if (!compareBaseId || !compareTargetId) {
      return toast.error('Please select both Base and Target versions to compare');
    }
    if (compareBaseId === compareTargetId) {
      return toast.error('Base and Target versions must be different');
    }
    setCompareLoading(true);
    setCompareMode(true);
    try {
      const res = await api.get(`/portal/quotations/${compareBaseId}/compare/${compareTargetId}`);
      if (res.data?.success) {
        setComparisonResult(res.data.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate version differences');
      setCompareMode(false);
    } finally {
      setCompareLoading(false);
    }
  };

  const handleOpenActionModal = (type) => {
    setActionType(type);
    setSignatureName('');
    setIsSignModalOpen(true);
  };

  const handleActionConfirm = async () => {
    if (!signatureName.trim()) {
      return toast.error('Please type your name to authorize this action');
    }

    setSubmittingId(activeQuotation.id);
    setIsSignModalOpen(false);

    try {
      const endpoint = `/portal/quotations/${activeQuotation.id}/${actionType === 'accept' ? 'accept' : 'reject'}`;
      const res = await api.post(endpoint, {
        signature: signatureName.trim()
      });
      if (res.data?.success) {
        toast.success(`Quotation version ${activeQuotation.version} has been ${actionType === 'accept' ? 'accepted' : 'rejected'}.`);
        await fetchQuotations(activeQuotation.id);
      }
    } catch (e) {
      console.error(e);
      toast.error(`Failed to ${actionType} quotation.`);
    } finally {
      setSubmittingId(null);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'accepted': return 'success';
      case 'rejected': return 'danger';
      case 'sent': return 'warning';
      default: return 'info';
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <Spinner size="lg" />
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading your BOQ configurations...</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title} id="portal-boq-title">BOQ Revisions & History</h1>
        <p className={styles.subtitle}>
          Compare project quotation versions, view itemized additions/reductions, and sign off on revisions.
        </p>
      </header>

      {quotations.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📋</div>
          <h3>No Quotations Available</h3>
          <p>Once your project team shares quotation versions and estimates, they will appear here.</p>
        </div>
      ) : (
        <div className={styles.layoutGrid}>
          {/* LEFT COLUMN: Versions List */}
          <div className={styles.leftCol}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Available Versions</h3>
            </div>
            
            {quotations.map(q => {
              const isActive = activeQuotation?.id === q.id && !compareMode;
              return (
                <div 
                  key={q.id} 
                  className={`${styles.card} ${isActive ? styles.cardActive : ''}`}
                  onClick={() => handleSelectQuotation(q)}
                >
                  <div className={styles.cardHeader}>
                    <h4 className={styles.versionTitle}>Version {q.version}</h4>
                    <span className={styles.cardAmount}>{formatCurrency(parseFloat(q.total_amount || 0))}</span>
                  </div>
                  <div className={styles.cardMeta}>
                    <span>{formatDate(q.created_at)}</span>
                    <Badge variant={getStatusColor(q.status)}>{q.status}</Badge>
                  </div>
                  {q.change_reason && (
                    <div className={styles.changeReasonText} title={q.change_reason}>
                      Reason: {q.change_reason}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Compare Selector Panel */}
            {quotations.length > 1 && (
              <div className={styles.comparePanel}>
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionTitle}>Compare Versions</h3>
                </div>
                <div className={styles.compareSelects}>
                  <div className={styles.compareSelectRow}>
                    <label htmlFor="base-version-select">Base Version (Older)</label>
                    <select 
                      id="base-version-select"
                      value={compareBaseId} 
                      onChange={(e) => setCompareBaseId(e.target.value)}
                    >
                      <option value="">Select version...</option>
                      {quotations.map(q => (
                        <option key={q.id} value={q.id}>Version {q.version} ({formatCurrency(parseFloat(q.total_amount || 0))})</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.compareSelectRow}>
                    <label htmlFor="target-version-select">Target Version (Newer)</label>
                    <select 
                      id="target-version-select"
                      value={compareTargetId} 
                      onChange={(e) => setCompareTargetId(e.target.value)}
                    >
                      <option value="">Select version...</option>
                      {quotations.map(q => (
                        <option key={q.id} value={q.id}>Version {q.version} ({formatCurrency(parseFloat(q.total_amount || 0))})</option>
                      ))}
                    </select>
                  </div>
                  <Button 
                    id="compare-diffs-btn"
                    variant="primary" 
                    size="sm" 
                    onClick={triggerComparison}
                    disabled={!compareBaseId || !compareTargetId}
                    style={{ width: '100%', marginTop: '8px' }}
                  >
                    Compare Version Diffs
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Version Diffs or Itemized Details */}
          <div className={styles.rightCol}>
            {compareMode ? (
              compareLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Spinner size="lg" />
                  <p style={{ color: 'var(--color-text-secondary)' }}>Comparing versions...</p>
                </div>
              ) : comparisonResult ? (
                <div>
                  <div className={styles.compHeader}>
                    <div>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Version Diff Analysis</h3>
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        Comparing Version {comparisonResult.baseQuotation.version} (Base) vs Version {comparisonResult.targetQuotation.version} (Target)
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setCompareMode(false)}>Exit Comparison</Button>
                  </div>

                  {/* Summary Banner */}
                  {(() => {
                    const baseVal = parseFloat(comparisonResult.baseQuotation.total_amount || 0);
                    const targetVal = parseFloat(comparisonResult.targetQuotation.total_amount || 0);
                    const diffVal = targetVal - baseVal;
                    const isIncrease = diffVal >= 0;
                    return (
                      <div className={`${styles.compSummaryBanner} ${!isIncrease ? styles.compSummaryBannerRed : ''}`}>
                        <div className={styles.compSummaryText}>
                          Value Impact: {isIncrease ? 'Increase' : 'Decrease'} of {formatCurrency(Math.abs(diffVal))}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                          Original: {formatCurrency(baseVal)} &rarr; Current: {formatCurrency(targetVal)}
                        </div>
                      </div>
                    );
                  })()}

                  {comparisonResult.targetQuotation.change_reason && (
                    <div className={styles.compReasonBox}>
                      <strong>Reason for Change (Version {comparisonResult.targetQuotation.version}):</strong>
                      <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                        "{comparisonResult.targetQuotation.change_reason}"
                      </p>
                    </div>
                  )}

                  {/* Diff Table */}
                  <div className={styles.tableContainer}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th style={{ width: '120px' }}>Diff Status</th>
                          <th>Room / Area</th>
                          <th>Item Details</th>
                          <th style={{ width: '120px', textAlign: 'right' }}>Base Amount</th>
                          <th style={{ width: '120px', textAlign: 'right' }}>Target Amount</th>
                          <th>Change Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonResult.diffs.length === 0 ? (
                          <tr>
                            <td colSpan="6" style={{ textAlign: 'center', padding: '24px', fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>
                              No differences detected between these versions.
                            </td>
                          </tr>
                        ) : (
                          comparisonResult.diffs.map((diff, index) => {
                            const isAdded = diff.type === 'added';
                            const isRemoved = diff.type === 'removed';
                            const isChanged = diff.type === 'changed';
                            const isUnchanged = diff.type === 'unchanged';

                            let trClass = '';
                            if (isAdded) trClass = styles.diffAdded;
                            if (isRemoved) trClass = styles.diffRemoved;
                            if (isChanged) trClass = styles.diffChanged;

                            const item = diff.target_item || diff.base_item;

                            return (
                              <tr key={index} className={trClass}>
                                <td>
                                  {isAdded && <span className={`${styles.changeBadge} ${styles.badgeAdded}`}>Added</span>}
                                  {isRemoved && <span className={`${styles.changeBadge} ${styles.badgeRemoved}`}>Removed</span>}
                                  {isChanged && <span className={`${styles.changeBadge} ${styles.badgeChanged}`}>Modified</span>}
                                  {isUnchanged && <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>No Change</span>}
                                </td>
                                <td style={{ fontWeight: '500' }}>{diff.room_or_area}</td>
                                <td>
                                  <div style={{ fontWeight: '600' }}>{diff.item_name}</div>
                                  {item.description && <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{item.description}</div>}
                                  {item.brand && <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>Brand: {item.brand}</div>}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: '500' }}>
                                  {diff.base_item ? formatCurrency(parseFloat(diff.base_item.total_price || 0)) : '—'}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: '500' }}>
                                  {diff.target_item ? formatCurrency(parseFloat(diff.target_item.total_price || 0)) : '—'}
                                </td>
                                <td>
                                  {isChanged && diff.changes && (
                                    <div className={styles.changeDetails}>
                                      {diff.changes.room_or_area && (
                                        <span>Room: {diff.changes.room_or_area.old} &rarr; {diff.changes.room_or_area.new}</span>
                                      )}
                                      {diff.changes.item_name && (
                                        <span>Name: "{diff.changes.item_name.old}" &rarr; "{diff.changes.item_name.new}"</span>
                                      )}
                                      {diff.changes.quantity && (
                                        <span>Qty: {Number(diff.changes.quantity.old)} &rarr; {Number(diff.changes.quantity.new)}</span>
                                      )}
                                      {diff.changes.unit_price && (
                                        <span>Rate: {formatCurrency(parseFloat(diff.changes.unit_price.old))} &rarr; {formatCurrency(parseFloat(diff.changes.unit_price.new))}</span>
                                      )}
                                      {diff.changes.gst_rate && (
                                        <span>GST: {Number(diff.changes.gst_rate.old || 0)}% &rarr; {Number(diff.changes.gst_rate.new || 0)}%</span>
                                      )}
                                    </div>
                                  )}
                                  {isAdded && (
                                    <span style={{ fontSize: '11px', color: '#047857' }}>
                                      Qty {Number(item.quantity)} @ {formatCurrency(parseFloat(item.unit_price))}/{item.unit || 'Nos'}
                                    </span>
                                  )}
                                  {isRemoved && (
                                    <span style={{ fontSize: '11px', color: '#b91c1c' }}>
                                      Was Qty {Number(item.quantity)} @ {formatCurrency(parseFloat(item.unit_price))}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>📊</div>
                  <p>Choose two versions on the left and select Compare.</p>
                </div>
              )
            ) : activeQuotation ? (
              <div>
                {/* Active Quotation Header */}
                <div className={styles.detailHeader}>
                  <div>
                    <h3 className={styles.detailTitle}>Version {activeQuotation.version} Configuration</h3>
                    <div className={styles.detailMeta}>
                      <span>Created by {activeQuotation.creator_name || 'Project Team'} on {formatDate(activeQuotation.created_at)}</span>
                    </div>
                  </div>
                  <Badge variant={getStatusColor(activeQuotation.status)}>{activeQuotation.status}</Badge>
                </div>

                {/* Accept/Reject banner if status is sent */}
                {activeQuotation.status === 'sent' && (
                  <div className={styles.actionBanner}>
                    <div className={styles.actionText}>
                      <strong>Review Required:</strong> This quotation revision has been submitted for your approval. Please review the itemized BOQ list below or compare it to older versions before signing.
                    </div>
                    <div className={styles.actionButtons}>
                      <button 
                        id="reject-quotation-btn"
                        className={styles.btnReject}
                        onClick={() => handleOpenActionModal('reject')}
                        disabled={submittingId === activeQuotation.id}
                      >
                        Reject Revision
                      </button>
                      <button 
                        id="approve-quotation-btn"
                        className={styles.btnApprove}
                        onClick={() => handleOpenActionModal('accept')}
                        disabled={submittingId === activeQuotation.id}
                      >
                        Approve & Sign
                      </button>
                    </div>
                  </div>
                )}

                {activeQuotation.change_reason && (
                  <div className={styles.sectionBlock}>
                    <h4>Reason for Change</h4>
                    <p style={{ fontStyle: 'italic' }}>"{activeQuotation.change_reason}"</p>
                  </div>
                )}

                {/* Items List */}
                <div className={styles.sectionBlock}>
                  <h4 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Itemized BOQ List ({activeItems.length} items)</span>
                    <strong style={{ fontSize: '15px' }}>Total: {formatCurrency(parseFloat(activeQuotation.total_amount || 0))}</strong>
                  </h4>
                  {itemsLoading ? (
                    <div style={{ display: 'flex', gap: 8, padding: '24px 0', alignItems: 'center', justifyContent: 'center' }}>
                      <Spinner />
                      <span>Loading items...</span>
                    </div>
                  ) : activeItems.length === 0 ? (
                    <p style={{ fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>No items found in this version.</p>
                  ) : (
                    <div className={styles.tableContainer}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Room / Area</th>
                            <th>Item Details</th>
                            <th>Qty</th>
                            <th style={{ textAlign: 'right' }}>Unit Rate</th>
                            <th style={{ textAlign: 'right' }}>Tax (GST)</th>
                            <th style={{ textAlign: 'right' }}>Total Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeItems.map(item => (
                            <tr key={item.id}>
                              <td style={{ fontWeight: '500' }}>{item.room_or_area}</td>
                              <td>
                                <div style={{ fontWeight: '600' }}>{item.item_name}</div>
                                {item.description && <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{item.description}</div>}
                                {item.brand && <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>Brand: {item.brand}</div>}
                              </td>
                              <td>{Number(item.quantity)} {item.unit || 'Nos'}</td>
                              <td style={{ textAlign: 'right' }}>{formatCurrency(parseFloat(item.unit_price))}</td>
                              <td style={{ textAlign: 'right' }}>{Number(item.gst_rate || 0)}%</td>
                              <td style={{ textAlign: 'right', fontWeight: '600' }}>{formatCurrency(parseFloat(item.total_price))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {activeQuotation.notes && (
                  <div className={styles.sectionBlock}>
                    <h4>Notes</h4>
                    <p>{activeQuotation.notes}</p>
                  </div>
                )}

                {activeQuotation.terms_conditions && (
                  <div className={styles.sectionBlock}>
                    <h4>Terms & Conditions</h4>
                    <p style={{ whiteSpace: 'pre-line' }}>{activeQuotation.terms_conditions}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📄</div>
                <p>Select a quotation version from the left panel to inspect its itemized breakdown.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Signature Approval/Rejection Modal */}
      <Modal
        isOpen={isSignModalOpen}
        onClose={() => setIsSignModalOpen(false)}
        title={actionType === 'accept' ? 'Approve Quotation Revision' : 'Reject Quotation Revision'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsSignModalOpen(false)}>Cancel</Button>
            <Button 
              id="confirm-sign-btn"
              variant={actionType === 'accept' ? 'primary' : 'danger'} 
              onClick={handleActionConfirm}
            >
              {actionType === 'accept' ? 'Sign & Approve' : 'Confirm Rejection'}
            </Button>
          </>
        }
      >
        <div className={styles.modalForm}>
          {actionType === 'accept' ? (
            <div className={styles.signatureWarning}>
              By typing your name below and submitting, you confirm digital sign-off and approval of this revised BOQ contract configuration (Version {activeQuotation?.version}) totaling <strong>{activeQuotation ? formatCurrency(parseFloat(activeQuotation.total_amount)) : ''}</strong>.
            </div>
          ) : (
            <div className={styles.signatureWarning} style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }}>
              Are you sure you want to reject this quotation revision? Please type your name to authorize this rejection.
            </div>
          )}
          <Input
            id="sign-input-field"
            label="Type Your Full Name to Sign"
            placeholder="e.g. Jane Smith"
            value={signatureName}
            onChange={(e) => setSignatureName(e.target.value)}
            required
          />
        </div>
      </Modal>
    </div>
  );
}
