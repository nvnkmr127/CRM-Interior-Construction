import React, { useState, useEffect } from 'react';
import { Button, Modal, Input, Textarea, EmptyState, Spinner } from '../ui';
import { useToast } from '../../store/toastContext';
import styles from './PurchaseOrdersTab.module.css';
import {
  getPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrder,
  updatePOItemReceipt,
  getProject,
  getQuotations,
  getQuotation,
  updateProject
} from '../../api/projects';

export default function PurchaseOrdersTab({ projectId }) {
  const toast = useToast();
  
  // Data States
  const [pos, setPos] = useState([]);
  const [project, setProject] = useState(null);
  const [quotations, setQuotations] = useState([]);
  const [activeQuotationItems, setActiveQuotationItems] = useState([]);
  const [selectedPo, setSelectedPo] = useState(null);
  
  // Loading States
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isQuickVendorOpen, setIsQuickVendorOpen] = useState(false);

  // Form States
  const [form, setForm] = useState({
    vendorId: '',
    expectedDeliveryDate: '',
    notes: '',
    termsConditions: '',
    deliveryAddress: '',
    selectedItems: {} // Maps boqItemId to { selected, quantity, unitPrice, itemName, unit, brand, materialSpecifications }
  });

  const [quickVendorForm, setQuickVendorForm] = useState({
    name: '',
    scopeOfWork: '',
    agreedRate: '',
    paymentTerms: ''
  });

  // Inline receipt logs state
  const [receiptQuantities, setReceiptQuantities] = useState({}); // Maps itemId to quantity_received

  useEffect(() => {
    if (projectId) {
      fetchData();
    }
  }, [projectId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [posRes, projectRes, quotesRes] = await Promise.all([
        getPurchaseOrders(projectId),
        getProject(projectId),
        getQuotations(projectId)
      ]);

      if (posRes.data?.success) {
        setPos(posRes.data.data || []);
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
      toast.error('Failed to load purchase orders data.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPo = async (poId) => {
    setItemsLoading(true);
    try {
      const res = await getPurchaseOrder(projectId, poId);
      if (res.data?.success) {
        const po = res.data.data;
        setSelectedPo(po);
        
        // Populate receipt quantities state
        const receipts = {};
        po.items.forEach(item => {
          receipts[item.id] = item.quantity_received;
        });
        setReceiptQuantities(receipts);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load PO details.');
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
          materialSpecifications: item.material_specifications
        };
      }
    });

    setForm({
      vendorId: '',
      expectedDeliveryDate: '',
      notes: '',
      termsConditions: '',
      deliveryAddress: project?.site_address || '',
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

  const handleItemPriceChange = (boqItemId, val) => {
    setForm(prev => ({
      ...prev,
      selectedItems: {
        ...prev.selectedItems,
        [boqItemId]: {
          ...prev.selectedItems[boqItemId],
          unitPrice: val
        }
      }
    }));
  };

  const handleCreatePO = async (e) => {
    e.preventDefault();
    if (!form.vendorId) return toast.error('Please assign a vendor.');

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
          materialSpecifications: data.materialSpecifications
        });
      }
    });

    if (itemsToCreate.length === 0) {
      return toast.error('Please select at least one BOQ item to order.');
    }

    setActionLoading(true);
    try {
      const payload = {
        vendorId: form.vendorId,
        expectedDeliveryDate: form.expectedDeliveryDate || null,
        notes: form.notes || null,
        termsConditions: form.termsConditions || null,
        deliveryAddress: form.deliveryAddress || null,
        items: itemsToCreate
      };

      const res = await createPurchaseOrder(projectId, payload);
      if (res.data?.success) {
        const newPo = res.data.data;
        setPos([newPo, ...pos]);
        setSelectedPo(newPo);
        setIsCreateModalOpen(false);
        toast.success(`Purchase Order ${newPo.po_number} created successfully.`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to create Purchase Order.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStatus = async (status) => {
    if (!selectedPo) return;
    
    let confirmMsg = `Are you sure you want to mark this PO as ${status}?`;
    if (status === 'confirmed') {
      confirmMsg = 'Confirming the PO will log a committed cost of ' + formatCurrency(selectedPo.total_amount) + ' in the project budget. Do you want to proceed?';
    } else if (status === 'cancelled') {
      confirmMsg = 'Cancelling this PO will reverse its associated budget allocations. Proceed?';
    }

    if (!window.confirm(confirmMsg)) return;

    setActionLoading(true);
    try {
      const res = await updatePurchaseOrder(projectId, selectedPo.id, { status });
      if (res.data?.success) {
        const updated = res.data.data;
        setSelectedPo(updated);
        setPos(pos.map(po => po.id === updated.id ? updated : po));
        toast.success(`Purchase Order status updated to ${status}.`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update Purchase Order.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateItemReceipt = async (itemId) => {
    const qty = Number(receiptQuantities[itemId]);
    const item = selectedPo.items.find(i => i.id === itemId);
    if (!item) return;

    if (isNaN(qty) || qty < 0) {
      return toast.error('Please enter a valid received quantity.');
    }
    if (qty > Number(item.quantity)) {
      if (!window.confirm(`You are receiving ${qty} units which is greater than the ordered quantity of ${item.quantity}. Do you want to proceed?`)) {
        return;
      }
    }

    setActionLoading(true);
    try {
      const res = await updatePOItemReceipt(projectId, selectedPo.id, itemId, { quantityReceived: qty });
      if (res.data?.success) {
        const updated = res.data.data;
        setSelectedPo(updated);
        setPos(pos.map(po => po.id === updated.id ? updated : po));
        toast.success(`Received quantity updated for ${item.item_name}.`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update item receipt.');
    } finally {
      setActionLoading(false);
    }
  };

  // Inline Quick Vendor Creation
  const handleQuickVendorCreate = async (e) => {
    e.preventDefault();
    if (!quickVendorForm.name.trim()) return toast.error('Vendor name is required');

    setActionLoading(true);
    try {
      const newVendor = {
        vendor_name: quickVendorForm.name.trim(),
        scope_of_work: quickVendorForm.scopeOfWork.trim() || null,
        agreed_rate: Number(quickVendorForm.agreedRate) || null,
        payment_terms: quickVendorForm.paymentTerms.trim() || null,
        status: 'approved'
      };

      const existingVendors = project?.vendors || [];
      const updatedVendors = [...existingVendors, newVendor];

      const res = await updateProject(projectId, { vendors: updatedVendors });
      if (res.data?.success || res.status === 200) {
        // Re-fetch project to update dropdowns
        const projectRes = await getProject(projectId);
        const projData = projectRes.data?.data || projectRes.data;
        if (projData) {
          setProject(projData);
          // Auto select the new vendor in the PO creation form
          const newCreated = projData.vendors?.find(v => v.vendor_name === newVendor.vendor_name);
          if (newCreated) {
            setForm(prev => ({ ...prev, vendorId: newCreated.id }));
          }
        }
        setIsQuickVendorOpen(false);
        setQuickVendorForm({ name: '', scopeOfWork: '', agreedRate: '', paymentTerms: '' });
        toast.success('Vendor added to project successfully.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to add vendor.');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badgeClass = `${styles.badge} ${styles[`badge-${status.replace(' ', '_')}`]}`;
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

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <Spinner size="lg" />
        <p>Loading Purchase Orders module...</p>
      </div>
    );
  }

  const projectVendors = project?.vendors || [];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2>Purchase Orders</h2>
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
            Generate and track vendor procurement for BOQ items.
          </span>
        </div>
        <div className={styles.headerActions}>
          <Button variant="primary" onClick={openCreateModal}>
            + Create Purchase Order
          </Button>
        </div>
      </div>

      {pos.length === 0 ? (
        <EmptyState
          title="No Purchase Orders"
          description="Create purchase orders to request materials or work from vendors based on BOQ details."
          actionLabel="Create Purchase Order"
          onAction={openCreateModal}
        />
      ) : (
        <div className={styles.splitLayout}>
          {/* Left Column: PO List */}
          <div className={styles.listPane}>
            {pos.map(po => (
              <div
                key={po.id}
                className={`${styles.poCard} ${selectedPo?.id === po.id ? styles.poCardActive : ''}`}
                onClick={() => handleSelectPo(po.id)}
              >
                <div className={styles.poCardHeader}>
                  <span className={styles.poNumber}>{po.po_number}</span>
                  {getStatusBadge(po.status)}
                </div>
                <span className={styles.poVendor}>{po.vendor_name || 'No Vendor Assigned'}</span>
                <div className={styles.poCardFooter}>
                  <span className={styles.poAmount}>{formatCurrency(po.total_amount)}</span>
                  <span className={styles.poDate}>Est. Delivery: {formatDate(po.expected_delivery_date)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Right Column: PO Detail View */}
          <div className={styles.detailPane}>
            {itemsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Spinner size="md" />
                <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                  Loading details...
                </p>
              </div>
            ) : selectedPo ? (
              <>
                <div className={styles.detailHeader}>
                  <div className={styles.detailTitleBlock}>
                    <h3>{selectedPo.po_number}</h3>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                      {selectedPo.vendor_name || 'No Vendor Assigned'}
                    </span>
                  </div>
                  <div>{getStatusBadge(selectedPo.status)}</div>
                </div>

                <div className={styles.detailMeta}>
                  <div className={styles.detailMetaItem}>
                    <span>Created Date:</span>
                    <strong>{formatDate(selectedPo.created_at)}</strong>
                  </div>
                  <div className={styles.detailMetaItem}>
                    <span>Expected Delivery:</span>
                    <strong>{formatDate(selectedPo.expected_delivery_date)}</strong>
                  </div>
                  <div className={styles.detailMetaItem}>
                    <span>Delivery Address:</span>
                    <strong>{selectedPo.delivery_address || '—'}</strong>
                  </div>
                  <div className={styles.detailMetaItem}>
                    <span>Total PO Amount:</span>
                    <strong>{formatCurrency(selectedPo.total_amount)}</strong>
                  </div>
                </div>

                {selectedPo.notes && (
                  <div style={{ fontSize: '13px' }}>
                    <strong>Notes:</strong>
                    <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-muted)', whiteSpace: 'pre-line' }}>
                      {selectedPo.notes}
                    </p>
                  </div>
                )}

                <div className={styles.itemsSection}>
                  <h4>Ordered Items</h4>
                  <div className={styles.tableWrapper}>
                    <table className={styles.itemTable}>
                      <thead>
                        <tr>
                          <th>Item Name</th>
                          <th>Brand & Specs</th>
                          <th className={styles.textRight}>Ordered Qty</th>
                          <th className={styles.textRight}>Unit Price</th>
                          <th className={styles.textRight}>Total Price</th>
                          <th className={styles.textRight}>Received Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPo.items?.map(item => (
                          <tr key={item.id}>
                            <td>
                              <div style={{ fontWeight: '500' }}>{item.item_name}</div>
                              {item.unit && <span style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>Unit: {item.unit}</span>}
                            </td>
                            <td>
                              <span style={{ fontSize: '11px', display: 'block' }}>
                                {item.brand ? `Brand: ${item.brand}` : ''}
                              </span>
                              <span style={{ color: 'var(--color-text-muted)', fontSize: '10px', display: 'block', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.material_specifications}
                              </span>
                            </td>
                            <td className={styles.textRight}>{item.quantity}</td>
                            <td className={styles.textRight}>{formatCurrency(item.unit_price)}</td>
                            <td className={styles.textRight}>{formatCurrency(item.total_price)}</td>
                            <td className={styles.textRight}>
                              {['confirmed', 'partially received', 'received'].includes(selectedPo.status) ? (
                                <div className={styles.receiptInputGroup}>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className={styles.receiptInput}
                                    value={receiptQuantities[item.id] !== undefined ? receiptQuantities[item.id] : item.quantity_received}
                                    onChange={e => setReceiptQuantities({
                                      ...receiptQuantities,
                                      [item.id]: e.target.value
                                    })}
                                    disabled={actionLoading || selectedPo.status === 'received'}
                                  />
                                  {selectedPo.status !== 'received' && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleUpdateItemReceipt(item.id)}
                                      disabled={actionLoading}
                                      style={{ padding: '2px 6px', fontSize: '10px' }}
                                    >
                                      ✓ Log
                                    </Button>
                                  )}
                                </div>
                              ) : (
                                <span>{item.quantity_received}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className={styles.actionsBlock}>
                  {['sent', 'confirmed', 'partially received', 'received'].includes(selectedPo.status) && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        const key = `${selectedPo.tenant_id}/projects/${projectId}/po/PO_${selectedPo.po_number}.pdf`;
                        window.open(`/api/local-download?key=${encodeURIComponent(key)}`, '_blank');
                      }}
                      style={{ marginRight: 'auto' }}
                    >
                      Download PO PDF
                    </Button>
                  )}
                  {selectedPo.status === 'draft' && (
                    <>
                      <Button
                        variant="secondary"
                        onClick={() => handleUpdateStatus('sent')}
                        disabled={actionLoading}
                      >
                        Mark as Sent
                      </Button>
                      <Button
                        variant="primary"
                        onClick={() => handleUpdateStatus('confirmed')}
                        disabled={actionLoading}
                      >
                        Confirm PO
                      </Button>
                    </>
                  )}
                  {selectedPo.status === 'sent' && (
                    <Button
                      variant="primary"
                      onClick={() => handleUpdateStatus('confirmed')}
                      disabled={actionLoading}
                    >
                      Confirm PO
                    </Button>
                  )}
                  {['confirmed', 'partially received'].includes(selectedPo.status) && (
                    <>
                      <Button
                        variant="ghost"
                        onClick={() => handleUpdateStatus('cancelled')}
                        disabled={actionLoading}
                        style={{ color: 'var(--color-danger)' }}
                      >
                        Cancel Purchase Order
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => handleUpdateStatus('received')}
                        disabled={actionLoading}
                      >
                        Mark All Fully Received
                      </Button>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className={styles.noSelection}>
                Select a Purchase Order from the left panel to inspect details.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Purchase Order Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Purchase Order"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreatePO} disabled={actionLoading}>
              {actionLoading ? 'Creating...' : 'Create Purchase Order'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreatePO} className={styles.modalForm}>
          <div className={styles.formGrid}>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Vendor Assignment
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                  value={form.vendorId}
                  onChange={e => setForm({ ...form, vendorId: e.target.value })}
                  required
                >
                  <option value="">Select Vendor</option>
                  {projectVendors.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.vendor_name} ({v.scope_of_work || 'General'})
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsQuickVendorOpen(!isQuickVendorOpen)}
                  style={{ whiteSpace: 'nowrap', fontSize: '12px' }}
                >
                  {isQuickVendorOpen ? 'Cancel' : '+ New Vendor'}
                </Button>
              </div>
            </div>
            
            <Input
              label="Expected Delivery Date"
              type="date"
              value={form.expectedDeliveryDate}
              onChange={e => setForm({ ...form, expectedDeliveryDate: e.target.value })}
            />

            {/* Quick Vendor form nested in modal */}
            {isQuickVendorOpen && (
              <div className={`${styles.vendorFormInline} ${styles.fullWidth}`}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-text)' }}>
                  Quick Add Vendor to Project
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <Input
                    label="Vendor Name"
                    placeholder="e.g. Ply & Wood Traders"
                    value={quickVendorForm.name}
                    onChange={e => setQuickVendorForm({ ...quickVendorForm, name: e.target.value })}
                    required
                  />
                  <Input
                    label="Scope / Material"
                    placeholder="e.g. Plywood Supply"
                    value={quickVendorForm.scopeOfWork}
                    onChange={e => setQuickVendorForm({ ...quickVendorForm, scopeOfWork: e.target.value })}
                  />
                  <Input
                    label="Agreed Price Rate (Optional)"
                    type="number"
                    placeholder="e.g. 50000"
                    value={quickVendorForm.agreedRate}
                    onChange={e => setQuickVendorForm({ ...quickVendorForm, agreedRate: e.target.value })}
                  />
                  <Input
                    label="Payment Terms (Optional)"
                    placeholder="e.g. 50% advance, 50% delivery"
                    value={quickVendorForm.paymentTerms}
                    onChange={e => setQuickVendorForm({ ...quickVendorForm, paymentTerms: e.target.value })}
                  />
                </div>
                <div className={styles.vendorFormActions}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsQuickVendorOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleQuickVendorCreate}
                    disabled={actionLoading}
                  >
                    Add Vendor
                  </Button>
                </div>
              </div>
            )}

            <div className={styles.fullWidth}>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Select items from BOQ / Quotation
              </label>
              {itemsLoading ? (
                <div style={{ textAlign: 'center', padding: '16px' }}><Spinner size="sm" /></div>
              ) : activeQuotationItems.length === 0 ? (
                <p className="text-xs text-gray-500 italic p-2 border border-dashed rounded">
                  No BOQ items found. Please ensure an active quotation exists.
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
                      <div>
                        <input
                          type="number"
                          step="0.01"
                          className={styles.boqPriceInput}
                          value={itemData.unitPrice}
                          onChange={e => handleItemPriceChange(id, e.target.value)}
                          placeholder="Price"
                          disabled={!itemData.selected}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.fullWidth}>
              <Textarea
                label="Delivery Address"
                placeholder="Specify the delivery location/address..."
                value={form.deliveryAddress}
                onChange={e => setForm({ ...form, deliveryAddress: e.target.value })}
                rows={2}
              />
            </div>

            <div className={styles.fullWidth}>
              <Textarea
                label="Notes"
                placeholder="Internal instructions or details..."
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>

            <div className={styles.fullWidth}>
              <Textarea
                label="Terms & Conditions"
                placeholder="Payment terms, delivery conditions..."
                value={form.termsConditions}
                onChange={e => setForm({ ...form, termsConditions: e.target.value })}
                rows={2}
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
