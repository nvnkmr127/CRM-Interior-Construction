import React, { useState, useEffect } from 'react';
import { Button, Modal, Input, Textarea, EmptyState, Spinner } from '../ui';
import { useToast } from '../../store/toastContext';
import styles from './PurchaseRequestsTab.module.css';
import {
  getPurchaseRequests,
  getPurchaseRequest,
  createPurchaseRequest,
  updatePurchaseRequest,
  convertPRToPO,
  getProject,
  getQuotations,
  getQuotation
} from '../../api/projects';

export default function PurchaseRequestsTab({ projectId }) {
  const toast = useToast();
  
  // Data States
  const [prs, setPrs] = useState([]);
  const [project, setProject] = useState(null);
  const [quotations, setQuotations] = useState([]);
  const [activeQuotationItems, setActiveQuotationItems] = useState([]);
  const [selectedPr, setSelectedPr] = useState(null);
  
  // Loading States
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);

  // Form States
  const [form, setForm] = useState({
    requiredByDate: '',
    deliveryLocation: 'site',
    notes: '',
    selectedItems: {} // Maps boqItemId to { selected, quantity, unitPrice, itemName, unit, brand, materialSpecifications }
  });

  const [rejectFeedback, setRejectFeedback] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState('');

  useEffect(() => {
    if (projectId) {
      fetchData();
    }
  }, [projectId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prsRes, projectRes, quotesRes] = await Promise.all([
        getPurchaseRequests(projectId),
        getProject(projectId),
        getQuotations(projectId)
      ]);

      if (prsRes.data?.success) {
        setPrs(prsRes.data.data || []);
      }
      
      const projData = projectRes.data?.data || projectRes.data;
      if (projData) {
        setProject(projData);
      }

      if (quotesRes.data?.success) {
        const quotes = quotesRes.data.data || [];
        setQuotations(quotes);
        
        // Find accepted quotation or latest version quotation to load BOQ items
        const targetQuote = quotes.find(q => q.status === 'accepted') || quotes[0];
        if (targetQuote) {
          setItemsLoading(true);
          const quoteDetailRes = await getQuotation(projectId, targetQuote.id);
          if (quoteDetailRes.data?.success) {
            setActiveQuotationItems(quoteDetailRes.data.data?.items || []);
          }
          setItemsLoading(false);
        }
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load purchase requests data.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPr = async (prId) => {
    setItemsLoading(true);
    try {
      const res = await getPurchaseRequest(projectId, prId);
      if (res.data?.success) {
        setSelectedPr(res.data.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load PR details.');
    } finally {
      setItemsLoading(false);
    }
  };

  // Open creation modal & pre-populate selection list
  const openCreateModal = () => {
    const initialSelectedItems = {};
    activeQuotationItems.forEach(item => {
      // Don't select parent headers, only actual items with price
      if (item.unit_price > 0) {
        initialSelectedItems[item.id] = {
          selected: false,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          itemName: item.item_name,
          unit: item.unit,
          brand: item.brand,
          materialSpecifications: item.material_specifications,
          materialCategory: 'general'
        };
      }
    });

    setForm({
      requiredByDate: '',
      deliveryLocation: 'site',
      notes: '',
      selectedItems: initialSelectedItems
    });
    setIsCreateModalOpen(true);
  };

  const handleCheckboxChange = (boqItemId, checked) => {
    setForm(prev => ({
      ...prev,
      selectedItems: {
        ...prev.selectedItems,
        [boqItemId]: {
          ...prev.selectedItems[boqItemId],
          selected: checked
        }
      }
    }));
  };

  const handleItemQtyChange = (boqItemId, val) => {
    setForm(prev => ({
      ...prev,
      selectedItems: {
        ...prev.selectedItems,
        [boqItemId]: {
          ...prev.selectedItems[boqItemId],
          quantity: val
        }
      }
    }));
  };

  const handleItemCategoryChange = (boqItemId, val) => {
    setForm(prev => ({
      ...prev,
      selectedItems: {
        ...prev.selectedItems,
        [boqItemId]: {
          ...prev.selectedItems[boqItemId],
          materialCategory: val
        }
      }
    }));
  };

  const handleCreatePR = async (e) => {
    e.preventDefault();
    if (!form.requiredByDate) return toast.error('Please specify a required-by date.');

    const itemsToCreate = [];
    Object.entries(form.selectedItems).forEach(([boqItemId, data]) => {
      if (data.selected) {
        itemsToCreate.push({
          boqItemId,
          itemName: data.itemName,
          description: data.materialSpecifications,
          quantity: Number(data.quantity) || 1,
          unit: data.unit,
          unitPrice: Number(data.unitPrice) || 0,
          brand: data.brand,
          materialSpecifications: data.materialSpecifications,
          materialCategory: data.materialCategory || 'general'
        });
      }
    });

    if (itemsToCreate.length === 0) {
      return toast.error('Please select at least one BOQ item.');
    }

    setActionLoading(true);
    try {
      const payload = {
        requiredByDate: form.requiredByDate,
        deliveryLocation: form.deliveryLocation,
        notes: form.notes || null,
        items: itemsToCreate
      };

      const res = await createPurchaseRequest(projectId, payload);
      if (res.data?.success) {
        const newPr = res.data.data;
        setPrs([newPr, ...prs]);
        setSelectedPr(newPr);
        setIsCreateModalOpen(false);
        toast.success(`Purchase Request ${newPr.pr_number} created successfully.`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to create Purchase Request.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStatus = async (status, feedback = '') => {
    if (!selectedPr) return;
    
    let confirmMsg = `Are you sure you want to transition this PR to ${status}?`;
    if (status === 'pending_approval') {
      confirmMsg = 'Do you want to submit this purchase request for approval?';
    } else if (status === 'approved') {
      confirmMsg = 'Confirm PM approval for this purchase request?';
    }

    if (status !== 'rejected' && !window.confirm(confirmMsg)) return;

    setActionLoading(true);
    try {
      const payload = { status };
      if (feedback) {
        payload.pmFeedback = feedback;
      }
      
      const res = await updatePurchaseRequest(projectId, selectedPr.id, payload);
      if (res.data?.success) {
        const updated = res.data.data;
        setSelectedPr(updated);
        setPrs(prs.map(pr => pr.id === updated.id ? updated : pr));
        toast.success(`Purchase Request status updated to ${status}.`);
        setIsRejectModalOpen(false);
        setRejectFeedback('');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update Purchase Request status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSubmit = (e) => {
    e.preventDefault();
    if (!rejectFeedback.trim()) return toast.error('Please specify feedback for rejection.');
    handleUpdateStatus('rejected', rejectFeedback.trim());
  };

  const handleConvertToPO = async (e) => {
    e.preventDefault();
    if (!selectedVendorId) return toast.error('Please select a vendor.');

    setActionLoading(true);
    try {
      const res = await convertPRToPO(projectId, selectedPr.id, { vendorId: selectedVendorId });
      if (res.data?.success) {
        toast.success(`Successfully converted to Purchase Order ${res.data.data?.po_number}`);
        setIsConvertModalOpen(false);
        setSelectedVendorId('');
        
        // Re-fetch requests to show status change to 'ordered'
        const prsRes = await getPurchaseRequests(projectId);
        if (prsRes.data?.success) {
          const prList = prsRes.data.data || [];
          setPrs(prList);
          const found = prList.find(p => p.id === selectedPr.id);
          if (found) setSelectedPr(found);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to convert Purchase Request to Purchase Order.');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const displayStatus = status.replace('_', ' ');
    const badgeClass = `${styles.badge} ${styles[`badge-${status.replace(' ', '_')}`]}`;
    return <span className={badgeClass}>{displayStatus}</span>;
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

  const getUrgencyBadge = (latestOrderDateStr) => {
    if (!latestOrderDateStr) return null;
    const latestOrderDate = new Date(latestOrderDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    latestOrderDate.setHours(0, 0, 0, 0);
    
    const diffTime = latestOrderDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) {
      return <span className={`${styles.urgencyTag} ${styles.danger}`}>🚨 Past Due</span>;
    } else if (diffDays <= 3) {
      return <span className={`${styles.urgencyTag} ${styles.warning}`}>⚠️ Place within {diffDays}d</span>;
    } else {
      return <span className={`${styles.urgencyTag} ${styles.safe}`}>✓ {diffDays}d left</span>;
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <Spinner size="lg" />
        <p>Loading Purchase Requests module...</p>
      </div>
    );
  }

  const projectVendors = project?.vendors || [];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2>Purchase Requests / Indents</h2>
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
            Raise and approve project procurement requests linked to BOQ items.
          </span>
        </div>
        <div className={styles.headerActions}>
          <Button variant="primary" onClick={openCreateModal}>
            + New Purchase Request
          </Button>
        </div>
      </div>

      {prs.length === 0 ? (
        <EmptyState
          title="No Purchase Requests"
          description="Raise a purchase request for BOQ items to submit for PM approval and subsequent ordering."
          actionLabel="New Purchase Request"
          onAction={openCreateModal}
        />
      ) : (
        <div className={styles.splitLayout}>
          {/* Left Column: PR List */}
          <div className={styles.listPane}>
            {prs.map(pr => (
              <div
                key={pr.id}
                className={`${styles.prCard} ${selectedPr?.id === pr.id ? styles.prCardActive : ''}`}
                onClick={() => handleSelectPr(pr.id)}
              >
                <div className={styles.prCardHeader}>
                  <span className={styles.prNumber}>{pr.pr_number}</span>
                  {getStatusBadge(pr.status)}
                </div>
                <span className={styles.prRequester}>
                  Requested By: {pr.requested_by_name || 'System User'}
                </span>
                <div className={styles.prCardFooter}>
                  <span className={styles.prAmount}>{formatCurrency(pr.total_amount)}</span>
                  <span className={styles.prDate}>Required: {formatDate(pr.required_by_date)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Right Column: PR Detail View */}
          <div className={styles.detailPane}>
            {itemsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Spinner size="md" />
                <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                  Loading details...
                </p>
              </div>
            ) : selectedPr ? (
              <>
                <div className={styles.detailHeader}>
                  <div className={styles.detailTitleBlock}>
                    <h3>{selectedPr.pr_number}</h3>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                      Requested By: {selectedPr.requested_by_name || 'System User'}
                    </span>
                  </div>
                  <div>{getStatusBadge(selectedPr.status)}</div>
                </div>

                <div className={styles.detailMeta}>
                  <div className={styles.detailMetaItem}>
                    <span>Required Date:</span>
                    <strong>{formatDate(selectedPr.required_by_date)}</strong>
                  </div>
                  <div className={styles.detailMetaItem}>
                    <span>Delivery Location:</span>
                    <strong style={{ textTransform: 'capitalize' }}>
                      {selectedPr.delivery_location || 'Site'}
                    </strong>
                  </div>
                  <div className={styles.detailMetaItem}>
                    <span>Total Estimated Value:</span>
                    <strong>{formatCurrency(selectedPr.total_amount)}</strong>
                  </div>
                </div>

                {selectedPr.notes && (
                  <div style={{ fontSize: '13px' }}>
                    <strong>Notes / Justification:</strong>
                    <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-muted)', whiteSpace: 'pre-line' }}>
                      {selectedPr.notes}
                    </p>
                  </div>
                )}

                {selectedPr.pm_feedback && (
                  <div style={{ fontSize: '13px', background: 'var(--color-bg-inset)', padding: '12px', borderRadius: '8px', borderLeft: '4px solid var(--color-danger, #dc2626)' }}>
                    <strong>PM Feedback:</strong>
                    <p style={{ margin: '4px 0 0 0', color: 'var(--color-danger, #dc2626)', whiteSpace: 'pre-line' }}>
                      {selectedPr.pm_feedback}
                    </p>
                  </div>
                )}

                <div className={styles.itemsSection}>
                  <h4>Requested Items</h4>
                  <div className={styles.tableWrapper}>
                    <table className={styles.itemTable}>
                      <thead>
                        <tr>
                          <th>Item Name</th>
                          <th>Brand & Specs</th>
                          <th>Latest Order Date</th>
                          <th className={styles.textRight}>Requested Qty</th>
                          <th className={styles.textRight}>Est. Price</th>
                          <th className={styles.textRight}>Total Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPr.items?.map(item => (
                          <tr key={item.id}>
                            <td>
                              <div style={{ fontWeight: '500' }}>{item.item_name}</div>
                              <span className={styles.categoryBadge}>{item.material_category || 'general'}</span>
                              {item.unit && <span style={{ color: 'var(--color-text-muted)', fontSize: '10px', marginLeft: '6px' }}>Unit: {item.unit}</span>}
                            </td>
                            <td>
                              <span style={{ fontSize: '11px', display: 'block' }}>
                                {item.brand ? `Brand: ${item.brand}` : ''}
                              </span>
                              <span style={{ color: 'var(--color-text-muted)', fontSize: '10px', display: 'block', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.material_specifications}
                              </span>
                            </td>
                            <td>
                              <div style={{ fontSize: '12px', fontWeight: '500' }}>{formatDate(item.latest_order_date)}</div>
                              <div style={{ marginTop: '2px' }}>{getUrgencyBadge(item.latest_order_date)}</div>
                            </td>
                            <td className={styles.textRight}>{item.quantity}</td>
                            <td className={styles.textRight}>{formatCurrency(item.unit_price)}</td>
                            <td className={styles.textRight}>{formatCurrency(item.total_price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className={styles.actionsBlock}>
                  {selectedPr.status === 'draft' && (
                    <>
                      <Button
                        variant="secondary"
                        onClick={() => handleUpdateStatus('cancelled')}
                        disabled={actionLoading}
                      >
                        Cancel Request
                      </Button>
                      <Button
                        variant="primary"
                        onClick={() => handleUpdateStatus('pending_approval')}
                        disabled={actionLoading}
                      >
                        Submit for PM Approval
                      </Button>
                    </>
                  )}
                  {selectedPr.status === 'pending_approval' && (
                    <>
                      <Button
                        variant="secondary"
                        onClick={() => setIsRejectModalOpen(true)}
                        disabled={actionLoading}
                        style={{ color: 'var(--color-danger)' }}
                      >
                        Reject Request
                      </Button>
                      <Button
                        variant="primary"
                        onClick={() => handleUpdateStatus('approved')}
                        disabled={actionLoading}
                      >
                        Approve Request
                      </Button>
                    </>
                  )}
                  {selectedPr.status === 'approved' && (
                    <Button
                      variant="primary"
                      onClick={() => setIsConvertModalOpen(true)}
                      disabled={actionLoading}
                    >
                      Convert to Purchase Order
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <div className={styles.noSelection}>
                Select a Purchase Request from the left panel to inspect details.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Purchase Request Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="New Purchase Request"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreatePR} disabled={actionLoading}>
              {actionLoading ? 'Creating...' : 'Create Purchase Request'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreatePR} className={styles.modalForm}>
          <div className={styles.formGrid}>
            <Input
              label="Required-by Date"
              type="date"
              value={form.requiredByDate}
              onChange={e => setForm({ ...form, requiredByDate: e.target.value })}
              required
            />
            
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Delivery Location
              </label>
              <select
                className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                value={form.deliveryLocation}
                onChange={e => setForm({ ...form, deliveryLocation: e.target.value })}
                required
              >
                <option value="site">Site Delivery</option>
                <option value="warehouse">Warehouse Storage</option>
              </select>
            </div>

            <div className={styles.fullWidth}>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Select items from BOQ / Quotation
              </label>
              {itemsLoading ? (
                <div style={{ textAlign: 'center', padding: '16px' }}><Spinner size="sm" /></div>
              ) : activeQuotationItems.length === 0 ? (
                <p className="text-xs text-gray-500 italic p-2 border border-dashed rounded">
                  No active BOQ items found. Please ensure an active quotation exists for the project.
                </p>
              ) : (
                <div className={styles.boqSelectionBox}>
                  {Object.entries(form.selectedItems).map(([id, itemData]) => (
                    <div
                      key={id}
                      className={`${styles.boqItemRow} ${itemData.selected ? styles.boqItemRowSelected : ''}`}
                    >
                      <div>
                        <input
                          type="checkbox"
                          checked={itemData.selected}
                          onChange={e => handleCheckboxChange(id, e.target.checked)}
                        />
                      </div>
                      <div>
                        <span className={styles.boqItemName}>{itemData.itemName}</span>
                        <span className={styles.boqItemDesc}>
                          {itemData.brand ? `[${itemData.brand}] ` : ''}
                          {itemData.materialSpecifications || 'No specs'}
                        </span>
                      </div>
                      <div>
                        <select
                          className={styles.categorySelect}
                          value={itemData.materialCategory || 'general'}
                          onChange={e => handleItemCategoryChange(id, e.target.value)}
                          disabled={!itemData.selected}
                        >
                          <option value="general">General</option>
                          <option value="plywood">Plywood</option>
                          <option value="hardware">Hardware</option>
                          <option value="laminate">Laminate</option>
                          <option value="paint">Paint</option>
                          <option value="electrical">Electrical</option>
                          <option value="plumbing">Plumbing</option>
                          <option value="modular">Modular</option>
                        </select>
                      </div>
                      <div>
                        <input
                          type="number"
                          step="0.01"
                          className={styles.boqQtyInput}
                          value={itemData.quantity}
                          onChange={e => handleItemQtyChange(id, e.target.value)}
                          placeholder="Qty"
                          disabled={!itemData.selected}
                        />
                        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginLeft: '4px' }}>
                          {itemData.unit || 'Nos'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: '500', color: 'var(--color-text-muted)', textAlign: 'right' }}>
                        {formatCurrency(itemData.unitPrice)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.fullWidth}>
              <Textarea
                label="Justification / Technical Notes"
                placeholder="State the usage context or justification for this request..."
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="Reject Purchase Request"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleRejectSubmit} disabled={actionLoading} style={{ background: 'var(--color-danger, #dc2626)' }}>
              {actionLoading ? 'Rejecting...' : 'Reject Request'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleRejectSubmit} className={styles.modalForm}>
          <Textarea
            label="Reason for Rejection / Actionable Feedback"
            placeholder="Please specify why this request is rejected so the team can adjust and re-submit..."
            value={rejectFeedback}
            onChange={e => setRejectFeedback(e.target.value)}
            required
            rows={4}
          />
        </form>
      </Modal>

      {/* Convert to PO Modal */}
      <Modal
        isOpen={isConvertModalOpen}
        onClose={() => setIsConvertModalOpen(false)}
        title="Convert Request to Purchase Order"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsConvertModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConvertToPO} disabled={actionLoading}>
              {actionLoading ? 'Converting...' : 'Convert to PO'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleConvertToPO} className={styles.modalForm}>
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
            To create a Purchase Order from this request, you must assign a project vendor who will fulfill the order.
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Select Project Vendor
            </label>
            <select
              className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
              value={selectedVendorId}
              onChange={e => setSelectedVendorId(e.target.value)}
              required
            >
              <option value="">Select Vendor</option>
              {projectVendors.map(v => (
                <option key={v.id} value={v.id}>
                  {v.vendor_name} ({v.scope_of_work || 'General'})
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
}
