import React, { useState, useEffect } from 'react';
import { Button, Modal, Input, Textarea, EmptyState, Spinner } from '../ui';
import { useToast } from '../../store/toastContext';
import styles from './MaterialSubstitutionsTab.module.css';
import {
  getSubstitutions,
  getSubstitution,
  proposeSubstitution,
  respondToSubstitution,
  getQuotations,
  getQuotation
} from '../../api/projects';

export default function MaterialSubstitutionsTab({ projectId }) {
  const toast = useToast();

  // Data States
  const [substitutions, setSubstitutions] = useState([]);
  const [boqItems, setBoqItems] = useState([]);
  const [selectedSub, setSelectedSub] = useState(null);

  // Loading States
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Modal States
  const [isProposeOpen, setIsProposeOpen] = useState(false);
  const [isRespondOpen, setIsRespondOpen] = useState(false);

  // Form States
  const [proposeForm, setProposeForm] = useState({
    boqItemId: '',
    reasonShortage: '',
    replacementItemName: '',
    replacementBrand: '',
    replacementMaterialSpecifications: '',
    replacementUnitPrice: ''
  });

  const [respondForm, setRespondForm] = useState({
    clientApprovalStatus: 'approved',
    clientFeedback: ''
  });

  useEffect(() => {
    if (projectId) {
      fetchData();
    }
  }, [projectId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [subsRes, quotesRes] = await Promise.all([
        getSubstitutions(projectId),
        getQuotations(projectId)
      ]);

      if (subsRes.data?.success) {
        setSubstitutions(subsRes.data.data || []);
      }

      if (quotesRes.data?.success) {
        const quotes = quotesRes.data.data || [];
        const targetQuote = quotes.find(q => q.status === 'accepted') || quotes[0];
        if (targetQuote) {
          setItemsLoading(true);
          const quoteDetailRes = await getQuotation(projectId, targetQuote.id);
          if (quoteDetailRes.data?.success) {
            setBoqItems(quoteDetailRes.data.data?.items || []);
          }
          setItemsLoading(false);
        }
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load substitutions data.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSub = async (subId) => {
    setItemsLoading(true);
    try {
      const res = await getSubstitution(projectId, subId);
      if (res.data?.success) {
        setSelectedSub(res.data.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load substitution details.');
    } finally {
      setItemsLoading(false);
    }
  };

  const handleBoqItemChange = (itemId) => {
    if (!itemId) {
      setProposeForm(prev => ({
        ...prev,
        boqItemId: '',
        replacementItemName: '',
        replacementBrand: '',
        replacementMaterialSpecifications: '',
        replacementUnitPrice: ''
      }));
      return;
    }

    const selectedItem = boqItems.find(i => i.id === itemId);
    if (selectedItem) {
      setProposeForm(prev => ({
        ...prev,
        boqItemId: itemId,
        replacementItemName: selectedItem.item_name,
        replacementBrand: selectedItem.brand || '',
        replacementMaterialSpecifications: selectedItem.material_specifications || '',
        replacementUnitPrice: selectedItem.unit_price
      }));
    }
  };

  const openProposeModal = () => {
    setProposeForm({
      boqItemId: '',
      reasonShortage: '',
      replacementItemName: '',
      replacementBrand: '',
      replacementMaterialSpecifications: '',
      replacementUnitPrice: ''
    });
    setIsProposeOpen(true);
  };

  const handleProposeSubmit = async (e) => {
    e.preventDefault();
    if (!proposeForm.boqItemId) return toast.error('Please select an item experiencing a shortage.');
    if (!proposeForm.reasonShortage.trim()) return toast.error('Please specify the shortage reason.');
    if (!proposeForm.replacementItemName.trim()) return toast.error('Replacement material name is required.');
    if (!proposeForm.replacementUnitPrice || Number(proposeForm.replacementUnitPrice) < 0) {
      return toast.error('Please enter a valid replacement unit price.');
    }

    setActionLoading(true);
    try {
      const payload = {
        boqItemId: proposeForm.boqItemId,
        reasonShortage: proposeForm.reasonShortage.trim(),
        replacementItemName: proposeForm.replacementItemName.trim(),
        replacementBrand: proposeForm.replacementBrand.trim() || null,
        replacementMaterialSpecifications: proposeForm.replacementMaterialSpecifications.trim() || null,
        replacementUnitPrice: Number(proposeForm.replacementUnitPrice)
      };

      const res = await proposeSubstitution(projectId, payload);
      if (res.data?.success) {
        toast.success('Shortage flagged and replacement proposed.');
        setIsProposeOpen(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to propose material substitution.');
    } finally {
      setActionLoading(false);
    }
  };

  const openRespondModal = () => {
    setRespondForm({
      clientApprovalStatus: 'approved',
      clientFeedback: ''
    });
    setIsRespondOpen(true);
  };

  const handleRespondSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSub) return;

    setActionLoading(true);
    try {
      const res = await respondToSubstitution(projectId, selectedSub.id, {
        clientApprovalStatus: respondForm.clientApprovalStatus,
        clientFeedback: respondForm.clientFeedback.trim() || null
      });

      if (res.data?.success) {
        toast.success(`Proposed substitution ${respondForm.clientApprovalStatus} successfully.`);
        setIsRespondOpen(false);
        
        // Reload details and lists
        const updatedSub = res.data.data;
        setSelectedSub(null);
        fetchData();
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to record response.');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badgeClass = `${styles.badge} ${styles[`badge-${status}`]}`;
    return <span className={badgeClass}>{status}</span>;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getPriceImpactStyle = (diff) => {
    const amount = parseFloat(diff);
    if (amount < 0) {
      return `${styles.priceImpact} ${styles.priceSaving}`;
    } else if (amount > 0) {
      return `${styles.priceImpact} ${styles.priceCost}`;
    } else {
      return `${styles.priceImpact} ${styles.priceNeutral}`;
    }
  };

  const formatPriceImpact = (diff) => {
    const amount = parseFloat(diff);
    if (amount < 0) {
      return `Saves ${formatCurrency(Math.abs(amount))}/unit`;
    } else if (amount > 0) {
      return `Costs +${formatCurrency(amount)}/unit`;
    } else {
      return 'No Price Variance';
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <Spinner size="lg" />
        <p>Loading Substitutions module...</p>
      </div>
    );
  }

  // Filter items in BOQ checklist that don't have header placeholders (price > 0)
  const activeBoqItemsList = boqItems.filter(item => Number(item.unit_price) > 0);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2>Material Shortages & Substitutions</h2>
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
            Flag material shortages, propose alternative specifications, and log client approval.
          </span>
        </div>
        <Button variant="primary" onClick={openProposeModal}>
          + Propose Replacement
        </Button>
      </div>

      {substitutions.length === 0 ? (
        <EmptyState
          title="No Shortages Flagged"
          description="Flag material shortages when products are out of stock or discontinued, and propose alternatives for client signoff."
          actionLabel="Propose Replacement"
          onAction={openProposeModal}
        />
      ) : (
        <div className={styles.splitLayout}>
          {/* Left Column: Proposals List */}
          <div className={styles.listPane}>
            {substitutions.map(sub => (
              <div
                key={sub.id}
                className={`${styles.subCard} ${selectedSub?.id === sub.id ? styles.subCardActive : ''}`}
                onClick={() => handleSelectSub(sub.id)}
              >
                <div className={styles.subCardHeader}>
                  <span className={styles.subItemName}>{sub.original_item_name}</span>
                  {getStatusBadge(sub.status)}
                </div>
                <span className={styles.subReason}>Shortage: {sub.reason_shortage}</span>
                <div className={styles.subCardFooter}>
                  <span className={getPriceImpactStyle(sub.price_difference)}>
                    {formatPriceImpact(sub.price_difference)}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                    Proposed: {formatDate(sub.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Right Column: Comparative Pane */}
          <div className={styles.detailPane}>
            {itemsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Spinner size="md" />
                <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                  Loading details...
                </p>
              </div>
            ) : selectedSub ? (
              <>
                <div className={styles.detailHeader}>
                  <div className={styles.detailTitleBlock}>
                    <h3>Material Substitution Proposal</h3>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                      Shortage Reason: <strong>{selectedSub.reason_shortage}</strong>
                    </span>
                  </div>
                  <div>{getStatusBadge(selectedSub.status)}</div>
                </div>

                <div className={styles.detailMeta}>
                  <div className={styles.detailMetaItem}>
                    <span>Flagged Date:</span>
                    <strong>{formatDate(selectedSub.created_at)}</strong>
                  </div>
                  <div className={styles.detailMetaItem}>
                    <span>Quotation Reference:</span>
                    <strong>{selectedSub.quotation_number} (V{selectedSub.quotation_version})</strong>
                  </div>
                  <div className={styles.detailMetaItem}>
                    <span>Client Approval Status:</span>
                    <strong style={{ textTransform: 'capitalize' }}>{selectedSub.client_approval_status}</strong>
                  </div>
                  {selectedSub.client_approved_at && (
                    <div className={styles.detailMetaItem}>
                      <span>Action Date:</span>
                      <strong>{formatDate(selectedSub.client_approved_at)}</strong>
                    </div>
                  )}
                </div>

                <div className={styles.comparisonSection}>
                  <h4 style={{ margin: '0', fontSize: '14px', fontWeight: '600' }}>Specification Comparison</h4>
                  
                  <div className={styles.comparisonGrid}>
                    {/* Original Spec */}
                    <div className={`${styles.comparisonCol} ${styles.originalCol}`}>
                      <div className={styles.colHeader}>
                        <span>ORIGINAL SPECIFICATION</span>
                      </div>
                      <div className={styles.specItem}>
                        <span>Material / Item Name</span>
                        <strong>{selectedSub.original_item_name}</strong>
                      </div>
                      <div className={styles.specItem}>
                        <span>Brand / Manufacturer</span>
                        <strong>{selectedSub.original_brand || '—'}</strong>
                      </div>
                      <div className={styles.specItem}>
                        <span>Technical Details</span>
                        <strong>{selectedSub.original_material_specifications || '—'}</strong>
                      </div>
                      <div className={styles.specItem}>
                        <span>BOQ Unit Price</span>
                        <strong>{formatCurrency(selectedSub.original_unit_price)}</strong>
                      </div>
                    </div>

                    {/* Proposed Replacement Spec */}
                    <div className={`${styles.comparisonCol} ${styles.replacementCol}`}>
                      <div className={styles.colHeader}>
                        <span>PROPOSED REPLACEMENT</span>
                        <span className={getPriceImpactStyle(selectedSub.price_difference)} style={{ fontSize: '10px' }}>
                          {formatPriceImpact(selectedSub.price_difference)}
                        </span>
                      </div>
                      <div className={styles.specItem}>
                        <span>Material / Item Name</span>
                        <strong>{selectedSub.replacement_item_name}</strong>
                      </div>
                      <div className={styles.specItem}>
                        <span>Brand / Manufacturer</span>
                        <strong>{selectedSub.replacement_brand || '—'}</strong>
                      </div>
                      <div className={styles.specItem}>
                        <span>Technical Details</span>
                        <strong>{selectedSub.replacement_material_specifications || '—'}</strong>
                      </div>
                      <div className={styles.specItem}>
                        <span>Proposed Unit Price</span>
                        <strong>{formatCurrency(selectedSub.replacement_unit_price)}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedSub.client_feedback && (
                  <div className={styles.approvalNotesBlock}>
                    <strong>Client Feedback / Response Remarks:</strong>
                    <p style={{ margin: 0, fontStyle: 'italic' }}>
                      "{selectedSub.client_feedback}"
                    </p>
                  </div>
                )}

                {selectedSub.status === 'pending' && (
                  <div className={styles.actionsBlock}>
                    <Button variant="primary" onClick={openRespondModal}>
                      Log Client Response
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className={styles.noSelection}>
                Select a substitution request from the left panel to compare details.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Propose Substitution Modal */}
      <Modal
        isOpen={isProposeOpen}
        onClose={() => setIsProposeOpen(false)}
        title="Propose Material Substitution"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsProposeOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleProposeSubmit} disabled={actionLoading}>
              Submit Proposal
            </Button>
          </>
        }
      >
        <form onSubmit={handleProposeSubmit} className={styles.modalForm}>
          <div className={styles.formGrid}>
            <div className={styles.fullWidth}>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Select Item experiencing shortage
              </label>
              <select
                className={styles.selectField}
                value={proposeForm.boqItemId}
                onChange={e => handleBoqItemChange(e.target.value)}
                required
              >
                <option value="">Select BOQ Material</option>
                {activeBoqItemsList.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.room_or_area ? `[${item.room_or_area}] ` : ''}
                    {item.item_name} (₹{item.unit_price}/unit)
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.fullWidth}>
              <Input
                label="Reason for Shortage"
                placeholder="e.g. CenturyPly Club Prime discontinued in local markets"
                value={proposeForm.reasonShortage}
                onChange={e => setProposeForm({ ...proposeForm, reasonShortage: e.target.value })}
                required
              />
            </div>

            <div className={styles.fullWidth} style={{ borderBottom: '1px dashed #e5e7eb', height: '0', margin: '4px 0' }} />

            <div className={styles.fullWidth} style={{ fontSize: '12px', fontWeight: '600' }}>
              Replacement Specifications
            </div>

            <Input
              label="Replacement Material Name"
              placeholder="e.g. CenturyPly Architect Ply"
              value={proposeForm.replacementItemName}
              onChange={e => setProposeForm({ ...proposeForm, replacementItemName: e.target.value })}
              required
            />

            <Input
              label="Replacement Brand"
              placeholder="e.g. CenturyPly"
              value={proposeForm.replacementBrand}
              onChange={e => setProposeForm({ ...proposeForm, replacementBrand: e.target.value })}
            />

            <Input
              label="Proposed Unit Price (₹)"
              type="number"
              value={proposeForm.replacementUnitPrice}
              onChange={e => setProposeForm({ ...proposeForm, replacementUnitPrice: e.target.value })}
              required
            />

            <div />

            <div className={styles.fullWidth}>
              <Textarea
                label="Replacement Technical Specifications"
                placeholder="Verify quality standards (IS: 710 BWR, borer proof, thickness)..."
                value={proposeForm.replacementMaterialSpecifications}
                onChange={e => setProposeForm({ ...proposeForm, replacementMaterialSpecifications: e.target.value })}
                rows={3}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Client Response Modal */}
      {selectedSub && (
        <Modal
          isOpen={isRespondOpen}
          onClose={() => setIsRespondOpen(false)}
          title="Log Client Approval / Rejection"
          footer={
            <>
              <Button variant="ghost" onClick={() => setIsRespondOpen(false)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleRespondSubmit} disabled={actionLoading}>
                Save Response
              </Button>
            </>
          }
        >
          <form onSubmit={handleRespondSubmit} className={styles.modalForm}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Client Decision
                </label>
                <select
                  className={styles.selectField}
                  value={respondForm.clientApprovalStatus}
                  onChange={e => setRespondForm({ ...respondForm, clientApprovalStatus: e.target.value })}
                  required
                >
                  <option value="approved">Approved (Overwrites original BOQ item & updates prices)</option>
                  <option value="rejected">Rejected (Flagged as rejected; PM must propose alternative)</option>
                </select>
              </div>

              <Textarea
                label="Client Feedback Comments"
                placeholder="Remarks, feedback, or custom terms requested by client..."
                value={respondForm.clientFeedback}
                onChange={e => setRespondForm({ ...respondForm, clientFeedback: e.target.value })}
                rows={4}
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
