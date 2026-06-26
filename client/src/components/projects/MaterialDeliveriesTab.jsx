import React, { useState, useEffect } from 'react';
import { Button, Modal, Input, Textarea, EmptyState, Spinner } from '../ui';
import { useToast } from '../../store/toastContext';
import { useS3Upload } from '../../hooks/useS3Upload';
import styles from './MaterialDeliveriesTab.module.css';
import {
  getMaterialDeliveries,
  getMaterialDelivery,
  createMaterialDelivery,
  updateMaterialDelivery,
  getPurchaseOrders,
  getPurchaseOrder
} from '../../api/projects';

export default function MaterialDeliveriesTab({ projectId }) {
  const toast = useToast();
  const { uploadRaw, uploading: uploadInProgress } = useS3Upload();
  
  // Data States
  const [deliveries, setDeliveries] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  
  // Loading States
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Modal / Lightbox States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);

  // Form States
  const [form, setForm] = useState({
    purchaseOrderId: '',
    expectedDeliveryDate: '',
    actualReceiptDate: '',
    notes: '',
    items: [] // { poItemId, itemName, quantityExpected, quantityReceived, isDamaged, damageDescription, conditionNotes, file, photoKey }
  });

  useEffect(() => {
    if (projectId) {
      fetchData();
    }
  }, [projectId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [delRes, poRes] = await Promise.all([
        getMaterialDeliveries(projectId),
        getPurchaseOrders(projectId)
      ]);

      if (delRes.data?.success) {
        setDeliveries(delRes.data.data || []);
      }
      
      if (poRes.data?.success) {
        // Filter POs that are active/confirmed/partially received so we can log receipts against them
        const activePos = (poRes.data.data || []).filter(po => 
          ['confirmed', 'partially received'].includes(po.status)
        );
        setPurchaseOrders(activePos);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load material deliveries data.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDelivery = async (delId) => {
    setItemsLoading(true);
    try {
      const res = await getMaterialDelivery(projectId, delId);
      if (res.data?.success) {
        setSelectedDelivery(res.data.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load delivery receipt details.');
    } finally {
      setItemsLoading(false);
    }
  };

  // When PO is selected in creation form, populate items with remaining quantities
  const handlePoChange = async (poId) => {
    if (!poId) {
      setForm(prev => ({ ...prev, purchaseOrderId: '', items: [] }));
      return;
    }

    setItemsLoading(true);
    try {
      const res = await getPurchaseOrder(projectId, poId);
      if (res.data?.success) {
        const po = res.data.data;
        const initialItems = po.items
          .filter(item => Number(item.quantity_received) < Number(item.quantity))
          .map(item => ({
            poItemId: item.id,
            itemName: item.item_name,
            quantityExpected: Number(item.quantity) - Number(item.quantity_received),
            quantityReceived: Number(item.quantity) - Number(item.quantity_received),
            isDamaged: false,
            damageDescription: '',
            conditionNotes: '',
            photoKey: null,
            file: null
          }));
        
        setForm(prev => ({
          ...prev,
          purchaseOrderId: poId,
          items: initialItems
        }));
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load items from Purchase Order.');
    } finally {
      setItemsLoading(false);
    }
  };

  const openCreateModal = () => {
    setForm({
      purchaseOrderId: '',
      expectedDeliveryDate: '',
      actualReceiptDate: new Date().toISOString().slice(0, 10),
      notes: '',
      items: []
    });
    setIsCreateModalOpen(true);
  };

  const handleItemFieldChange = (index, field, value) => {
    setForm(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems };
    });
  };

  const handleFileChange = (index, file) => {
    setForm(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], file };
      return { ...prev, items: newItems };
    });
  };

  const handleCreateDelivery = async (e) => {
    e.preventDefault();
    if (!form.purchaseOrderId) return toast.error('Please select a Purchase Order.');

    const receivedItems = form.items.filter(item => Number(item.quantityReceived) > 0);
    if (receivedItems.length === 0) {
      return toast.error('Please enter a received quantity greater than 0 for at least one item.');
    }

    setActionLoading(true);
    try {
      // 1. Upload photos to S3 first if any exist
      const processedItems = [];
      for (const item of form.items) {
        let photoKey = null;
        if (item.file) {
          try {
            photoKey = await uploadRaw({
              file: item.file,
              projectId,
              purpose: 'delivery-condition-photo'
            });
          } catch (uploadErr) {
            console.error('Photo upload failed for item', item.itemName, uploadErr);
            toast.error(`Photo upload failed for ${item.itemName}. Proceeding without photo.`);
          }
        }

        processedItems.push({
          poItemId: item.poItemId,
          itemName: item.itemName,
          quantityExpected: Number(item.quantityExpected),
          quantityReceived: Number(item.quantityReceived),
          isDamaged: !!item.isDamaged,
          damageDescription: item.isDamaged ? item.damageDescription : null,
          conditionNotes: item.conditionNotes || null,
          photoKey
        });
      }

      // 2. Submit receipt data
      const payload = {
        purchaseOrderId: form.purchaseOrderId,
        expectedDeliveryDate: form.expectedDeliveryDate || null,
        actualReceiptDate: form.actualReceiptDate || new Date(),
        notes: form.notes || null,
        items: processedItems
      };

      const res = await createMaterialDelivery(projectId, payload);
      if (res.data?.success) {
        const newDel = res.data.data;
        
        // Find PO number for local state update
        const selectedPo = purchaseOrders.find(po => po.id === form.purchaseOrderId);
        if (selectedPo) {
          newDel.po_number = selectedPo.po_number;
        }

        setDeliveries([newDel, ...deliveries]);
        setSelectedDelivery(newDel);
        setIsCreateModalOpen(false);
        toast.success(`Delivery Note ${newDel.delivery_number} logged successfully.`);
        
        // Re-fetch to update list and active PO dropdown
        fetchData();
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to log material delivery.');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badgeClass = `${styles.badge} ${styles[`badge-${status.replace(' ', '_')}`]}`;
    return <span className={badgeClass}>{status}</span>;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <Spinner size="lg" />
        <p>Loading Delivery module...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2>Material Delivery & Goods Receipts</h2>
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
            Confirm arrival of materials at site/factory and track condition logs.
          </span>
        </div>
        <Button variant="primary" onClick={openCreateModal}>
          + Log Goods Receipt
        </Button>
      </div>

      {deliveries.length === 0 ? (
        <EmptyState
          title="No Delivery Receipts Logged"
          description="Log a Goods Receipt Note (GRN) when material shipments arrive to inspect condition and track quantities."
          actionLabel="Log Goods Receipt"
          onAction={openCreateModal}
        />
      ) : (
        <div className={styles.splitLayout}>
          {/* Left Column: Deliveries List */}
          <div className={styles.listPane}>
            {deliveries.map(del => {
              const damagedItemsCount = del.items?.filter(i => i.is_damaged).length || 0;
              return (
                <div
                  key={del.id}
                  className={`${styles.deliveryCard} ${selectedDelivery?.id === del.id ? styles.deliveryCardActive : ''}`}
                  onClick={() => handleSelectDelivery(del.id)}
                >
                  <div className={styles.deliveryCardHeader}>
                    <span className={styles.deliveryNumber}>{del.delivery_number}</span>
                    {getStatusBadge(del.status)}
                  </div>
                  <span className={styles.deliveryPoInfo}>
                    PO: {del.po_number || 'Direct Delivery'}
                  </span>
                  <div className={styles.deliveryCardFooter}>
                    <span className={styles.deliveryDate}>Recd: {formatDate(del.actual_receipt_date)}</span>
                    {damagedItemsCount > 0 && (
                      <span className={styles.damageWarning}>
                        ⚠️ {damagedItemsCount} Damaged
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Detailed View */}
          <div className={styles.detailPane}>
            {itemsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Spinner size="md" />
                <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                  Loading details...
                </p>
              </div>
            ) : selectedDelivery ? (
              <>
                <div className={styles.detailHeader}>
                  <div className={styles.detailTitleBlock}>
                    <h3>{selectedDelivery.delivery_number}</h3>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                      PO: {selectedDelivery.po_number || 'Direct Delivery'}
                    </span>
                  </div>
                  <div>{getStatusBadge(selectedDelivery.status)}</div>
                </div>

                <div className={styles.detailMeta}>
                  <div className={styles.detailMetaItem}>
                    <span>Received Date:</span>
                    <strong>{formatDateTime(selectedDelivery.actual_receipt_date)}</strong>
                  </div>
                  <div className={styles.detailMetaItem}>
                    <span>Received By:</span>
                    <strong>{selectedDelivery.receiver_name || 'System User'}</strong>
                  </div>
                  {selectedDelivery.expected_delivery_date && (
                    <div className={styles.detailMetaItem}>
                      <span>Expected Delivery Date:</span>
                      <strong>{formatDate(selectedDelivery.expected_delivery_date)}</strong>
                    </div>
                  )}
                </div>

                {selectedDelivery.notes && (
                  <div style={{ fontSize: '13px' }}>
                    <strong>Notes:</strong>
                    <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-muted)', whiteSpace: 'pre-line' }}>
                      {selectedDelivery.notes}
                    </p>
                  </div>
                )}

                <div className={styles.itemsSection}>
                  <h4>Receipt Items Checklist</h4>
                  <div className={styles.tableWrapper}>
                    <table className={styles.itemTable}>
                      <thead>
                        <tr>
                          <th>Item Name</th>
                          <th className={styles.textRight}>Expected</th>
                          <th className={styles.textRight}>Received</th>
                          <th>Status & Notes</th>
                          <th>Condition Photo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDelivery.items?.map(item => (
                          <tr key={item.id}>
                            <td>
                              <div style={{ fontWeight: '500' }}>{item.item_name}</div>
                            </td>
                            <td className={styles.textRight}>{item.quantity_expected}</td>
                            <td className={styles.textRight}>{item.quantity_received}</td>
                            <td>
                              {item.is_damaged ? (
                                <div style={{ color: 'var(--color-danger)', fontWeight: '600' }}>
                                  ⚠️ Damaged
                                  <div style={{ fontSize: '10px', fontWeight: 'normal', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                    {item.damage_description}
                                  </div>
                                </div>
                              ) : (
                                <span style={{ color: 'var(--color-success, #10b981)' }}>✓ Intact</span>
                              )}
                              {item.condition_notes && (
                                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                                  {item.condition_notes}
                                </div>
                              )}
                            </td>
                            <td>
                              {item.photo_url ? (
                                <img
                                  src={item.photo_url}
                                  alt="delivery condition"
                                  className={styles.imagePreview}
                                  onClick={() => setLightboxUrl(item.photo_url)}
                                />
                              ) : (
                                <span style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>No photo</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.noSelection}>
                Select a Delivery Receipt card from the left panel to inspect details.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Log Delivery / Goods Receipt Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Log Material Delivery Receipt"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)} disabled={actionLoading || uploadInProgress}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateDelivery} disabled={actionLoading || uploadInProgress}>
              {actionLoading ? 'Logging Receipt...' : 'Log Goods Receipt'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateDelivery} className={styles.modalForm}>
          <div className={styles.formGrid}>
            <div className={styles.fullWidth}>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Select Purchase Order to receive against
              </label>
              <select
                className={styles.poSelection}
                value={form.purchaseOrderId}
                onChange={e => handlePoChange(e.target.value)}
                required
              >
                <option value="">Select Confirmed Purchase Order</option>
                {purchaseOrders.map(po => (
                  <option key={po.id} value={po.id}>
                    {po.po_number} — {po.vendor_name || 'General Vendor'} (₹{po.total_amount})
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Expected Delivery Date"
              type="date"
              value={form.expectedDeliveryDate}
              onChange={e => setForm({ ...form, expectedDeliveryDate: e.target.value })}
            />

            <Input
              label="Actual Receipt Date"
              type="date"
              value={form.actualReceiptDate}
              onChange={e => setForm({ ...form, actualReceiptDate: e.target.value })}
              required
            />

            <div className={styles.fullWidth}>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Materials Checklist
              </label>
              {itemsLoading ? (
                <div style={{ textAlign: 'center', padding: '16px' }}><Spinner size="sm" /></div>
              ) : form.items.length === 0 ? (
                <p className="text-xs text-gray-500 italic p-4 border border-dashed rounded text-center">
                  Select a confirmed purchase order above to load items.
                </p>
              ) : (
                <div className={styles.deliveryItemsTableWrapper}>
                  {form.items.map((item, idx) => (
                    <div key={item.poItemId} className={styles.deliveryItemRow}>
                      <div className={styles.deliveryItemName}>
                        {item.itemName}
                      </div>
                      <div>
                        <Input
                          label="Qty Expected"
                          type="number"
                          value={item.quantityExpected}
                          onChange={e => handleItemFieldChange(idx, 'quantityExpected', e.target.value)}
                          disabled
                        />
                      </div>
                      <div>
                        <Input
                          label="Qty Received"
                          type="number"
                          value={item.quantityReceived}
                          onChange={e => handleItemFieldChange(idx, 'quantityReceived', e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: '600', color: 'var(--color-text)' }}>
                          <input
                            type="checkbox"
                            checked={item.isDamaged}
                            onChange={e => handleItemFieldChange(idx, 'isDamaged', e.target.checked)}
                          />
                          ⚠️ Damaged?
                        </label>
                      </div>

                      {/* Expanded damage logging blocks if damaged */}
                      {item.isDamaged && (
                        <div className={styles.damageFormBlock}>
                          <Input
                            label="Damage Description"
                            placeholder="Describe cracks, breakage, issues..."
                            value={item.damageDescription}
                            onChange={e => handleItemFieldChange(idx, 'damageDescription', e.target.value)}
                            required
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: '600' }}>
                              Condition Photo
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              className={styles.photoUploadInput}
                              onChange={e => handleFileChange(idx, e.target.files[0])}
                            />
                            {item.file && (
                              <span style={{ fontSize: '9px', color: 'var(--color-success)' }}>
                                Selected: {item.file.name}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <div className={styles.fullWidth} style={{ borderBottom: '1px dashed #e5e7eb', height: '0', margin: '4px 0' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.fullWidth}>
              <Textarea
                label="General Notes"
                placeholder="Log delivery notes, carrier details, supervisor comments..."
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Lightbox Photo Preview */}
      {lightboxUrl && (
        <div className={styles.lightboxOverlay} onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="expanded view" className={styles.lightboxImage} />
        </div>
      )}
    </div>
  );
}
