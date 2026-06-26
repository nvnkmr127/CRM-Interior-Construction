import React, { useState, useEffect } from 'react';
import { Button, Modal, Input, Textarea, EmptyState, Spinner } from '../ui';
import { useToast } from '../../store/toastContext';
import styles from './FactoryProductionTab.module.css';
import {
  getProductionOrders,
  getProductionOrder,
  createProductionOrder,
  updateProductionOrder,
  updateProductionOrderItem,
  getProject,
  getQuotations,
  getQuotation,
  recordQCInspection,
  createReworkOrder,
  updateReworkOrderStatus,
  clearOrderForDispatch,
  getQCAndReworkSummary,
  dispatchProductionOrder,
  confirmSiteDelivery,
  getDispatchRecords
} from '../../api/projects';

export default function FactoryProductionTab({ projectId }) {
  const toast = useToast();

  // Data States
  const [orders, setOrders] = useState([]);
  const [project, setProject] = useState(null);
  const [quotations, setQuotations] = useState([]);
  const [activeQuotationItems, setActiveQuotationItems] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [qcSummary, setQcSummary] = useState({ inspections: [], reworkOrders: [] });
  const [dispatches, setDispatches] = useState([]);
  const [damages, setDamages] = useState([]);

  // Loading States
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState(null);

  // Tab View within Detail Pane ('schedule', 'history', 'reworks', 'logistics', 'damage')
  const [detailTab, setDetailTab] = useState('schedule');

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isInspectModalOpen, setIsInspectModalOpen] = useState(false);
  const [isReworkModalOpen, setIsReworkModalOpen] = useState(false);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [isDeliverModalOpen, setIsDeliverModalOpen] = useState(false);
  const [isDamageModalOpen, setIsDamageModalOpen] = useState(false);
  const [isResolveDamageModalOpen, setIsResolveDamageModalOpen] = useState(false);

  // Active items for modals
  const [activeItem, setActiveItem] = useState(null);
  const [activeDispatch, setActiveDispatch] = useState(null);
  const [activeDamage, setActiveDamage] = useState(null);

  // Form States - Dispatch
  const [dispatchForm, setDispatchForm] = useState({
    vehicleNumber: '',
    driverName: '',
    driverContact: '',
    expectedDeliveryDate: ''
  });

  // Form States - Delivery Receipt
  const [deliverForm, setDeliverForm] = useState({
    receivedByName: '',
    receiptNotes: ''
  });

  // Form States - Transit Damage Report
  const [damageForm, setDamageForm] = useState({
    selectedItemId: '',
    quantityDamaged: '1',
    damageSeverity: 'major',
    liabilityType: 'undetermined',
    description: '',
    photoKeysInput: '',
    resolutionTimeline: ''
  });

  // Form States - Resolve Damage
  const [resolveForm, setResolveForm] = useState({
    status: 'resolved',
    liabilityType: 'undetermined',
    resolutionNotes: ''
  });

  // Form States - Production Order Creation
  const [form, setForm] = useState({
    factoryName: '',
    expectedCompletionDate: '',
    notes: '',
    selectedItems: {} // Maps boqItemId to { selected, quantity, itemName, unit }
  });

  // Form States - QC Inspection Logging
  const [inspectForm, setInspectForm] = useState({
    status: 'passed', // passed, failed
    notes: '',
    photoKeysInput: '' // Comma-separated photo keys
  });

  // Form States - Rework Order Creation
  const [reworkForm, setReworkForm] = useState({
    reworkInstructions: '',
    assignedTo: '',
    targetDate: ''
  });

  // Local state for inline item updates (factory, status, dates, packaging)
  const [editedItems, setEditedItems] = useState({});

  useEffect(() => {
    if (projectId) {
      fetchData();
    }
  }, [projectId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordersRes, projectRes, quotesRes] = await Promise.all([
        getProductionOrders(projectId),
        getProject(projectId),
        getQuotations(projectId)
      ]);

      if (ordersRes.data?.success) {
        setOrders(ordersRes.data.data || []);
      }

      const projData = projectRes.data?.data || projectRes.data;
      if (projData) {
        setProject(projData);
      }

      if (quotesRes.data?.success) {
        const quotes = quotesRes.data.data || [];
        setQuotations(quotes);

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
      toast.error('Failed to load factory production data.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOrder = async (orderId) => {
    setItemsLoading(true);
    try {
      const [orderRes, summaryRes, dispatchesRes, damagesRes] = await Promise.all([
        getProductionOrder(projectId, orderId),
        getQCAndReworkSummary(projectId, orderId),
        getDispatchRecords(projectId, orderId),
        getTransitDamageRecords(projectId, orderId)
      ]);

      if (orderRes.data?.success) {
        const order = orderRes.data.data;
        setSelectedOrder(order);

        // Populate inline editing state
        const itemEdits = {};
        order.items.forEach(item => {
          itemEdits[item.id] = {
            factory_assignment: item.factory_assignment || '',
            status: item.status || 'pending',
            production_start_date: item.production_start_date ? new Date(item.production_start_date).toISOString().split('T')[0] : '',
            production_complete_date: item.production_complete_date ? new Date(item.production_complete_date).toISOString().split('T')[0] : '',
            qc_status: item.qc_status || 'pending',
            packaging_status: item.packaging_status || 'pending',
            dispatch_date: item.dispatch_date ? new Date(item.dispatch_date).toISOString().split('T')[0] : ''
          };
        });
        setEditedItems(itemEdits);
      }

      if (summaryRes.data?.success) {
        setQcSummary(summaryRes.data.data || { inspections: [], reworkOrders: [] });
      }

      if (dispatchesRes.data?.success) {
        setDispatches(dispatchesRes.data.data || []);
      }

      if (damagesRes.data?.success) {
        setDamages(damagesRes.data.data || []);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load order details.');
    } finally {
      setItemsLoading(false);
    }
  };

  const openCreateModal = () => {
    const initialSelectedItems = {};
    activeQuotationItems.forEach(item => {
      if (parseFloat(item.unit_price) > 0) {
        initialSelectedItems[item.id] = {
          selected: false,
          quantity: item.quantity,
          itemName: item.item_name,
          unit: item.unit
        };
      }
    });

    setForm({
      factoryName: '',
      expectedCompletionDate: '',
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

  const handleCreateOrder = async (e) => {
    e.preventDefault();

    const itemsToCreate = [];
    Object.entries(form.selectedItems).forEach(([boqItemId, data]) => {
      if (data.selected) {
        itemsToCreate.push({
          boqItemId,
          quantity: parseFloat(data.quantity) || 1,
          itemName: data.itemName,
          unit: data.unit,
          factoryAssignment: form.factoryName
        });
      }
    });

    if (itemsToCreate.length === 0) {
      return toast.error('Please select at least one item.');
    }

    setActionLoading(true);
    try {
      const payload = {
        factoryName: form.factoryName,
        expectedCompletionDate: form.expectedCompletionDate ? new Date(form.expectedCompletionDate).toISOString() : null,
        notes: form.notes,
        items: itemsToCreate
      };

      const res = await createProductionOrder(projectId, payload);
      if (res.data?.success) {
        toast.success('Production Order scheduled.');
        setIsCreateModalOpen(false);
        fetchData();
        if (res.data.data?.id) {
          handleSelectOrder(res.data.data.id);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to create production order.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleInlineItemChange = (itemId, field, value) => {
    setEditedItems(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
  };

  const handleSaveItemChanges = async (itemId) => {
    setUpdatingItemId(itemId);
    try {
      const edits = editedItems[itemId];
      const payload = {
        factoryAssignment: edits.factory_assignment || null,
        status: edits.status,
        productionStartDate: edits.production_start_date ? new Date(edits.production_start_date).toISOString() : null,
        productionCompleteDate: edits.production_complete_date ? new Date(edits.production_complete_date).toISOString() : null,
        qcStatus: edits.qc_status,
        packagingStatus: edits.packaging_status,
        dispatchDate: edits.dispatch_date ? new Date(edits.dispatch_date).toISOString() : null
      };

      const res = await updateProductionOrderItem(projectId, selectedOrder.id, itemId, payload);
      if (res.data?.success) {
        toast.success('Item production milestones updated.');
        // Refresh details & summaries
        handleSelectOrder(selectedOrder.id);
        
        // Refresh list
        const listRes = await getProductionOrders(projectId);
        if (listRes.data?.success) {
          setOrders(listRes.data.data || []);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update item.');
    } finally {
      setUpdatingItemId(null);
    }
  };

  // Dispatch clearance gate trigger
  const handleApproveClearance = async () => {
    setActionLoading(true);
    try {
      const res = await clearOrderForDispatch(projectId, selectedOrder.id);
      if (res.data?.success) {
        toast.success('Dispatch clearance gate approved! Production order cleared.');
        handleSelectOrder(selectedOrder.id);
        
        // Refresh main list
        const listRes = await getProductionOrders(projectId);
        if (listRes.data?.success) {
          setOrders(listRes.data.data || []);
        }
      }
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error?.message || err.message || 'Failed to approve dispatch clearance.';
      toast.error(errMsg);
    } finally {
      setActionLoading(false);
    }
  };

  // QC inspection actions
  const openInspectModal = (item) => {
    setActiveItem(item);
    setInspectForm({
      status: 'passed',
      notes: '',
      photoKeysInput: ''
    });
    setIsInspectModalOpen(true);
  };

  const handleRecordQC = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const photoKeys = inspectForm.photoKeysInput
        ? inspectForm.photoKeysInput.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      const res = await recordQCInspection(projectId, selectedOrder.id, activeItem.id, {
        status: inspectForm.status,
        notes: inspectForm.notes,
        photoKeys
      });

      if (res.data?.success) {
        toast.success(`QC status recorded: ${inspectForm.status}`);
        setIsInspectModalOpen(false);
        handleSelectOrder(selectedOrder.id);

        // If it failed, offer to open Rework Modal immediately
        if (inspectForm.status === 'failed') {
          setActiveItem(activeItem);
          setReworkForm({
            reworkInstructions: `Rework instructions for ${activeItem.item_name}. Reason: ${inspectForm.notes}`,
            assignedTo: activeItem.factory_assignment || selectedOrder.factory_name || '',
            targetDate: ''
          });
          setIsReworkModalOpen(true);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to record QC inspection.');
    } finally {
      setActionLoading(false);
    }
  };

  // Rework order actions
  const openReworkModal = (item) => {
    setActiveItem(item);
    setReworkForm({
      reworkInstructions: '',
      assignedTo: item.factory_assignment || selectedOrder.factory_name || '',
      targetDate: ''
    });
    setIsReworkModalOpen(true);
  };

  const handleCreateRework = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const payload = {
        reworkInstructions: reworkForm.reworkInstructions,
        assignedTo: reworkForm.assignedTo,
        targetDate: reworkForm.targetDate ? new Date(reworkForm.targetDate).toISOString() : null
      };

      const res = await createReworkOrder(projectId, selectedOrder.id, activeItem.id, payload);
      if (res.data?.success) {
        toast.success('Rework Order logged successfully.');
        setIsReworkModalOpen(false);
        handleSelectOrder(selectedOrder.id);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to create rework order.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateReworkStatus = async (reworkId, newStatus) => {
    setItemsLoading(true);
    try {
      const res = await updateReworkOrderStatus(projectId, selectedOrder.id, reworkId, { status: newStatus });
      if (res.data?.success) {
        toast.success(`Rework order status updated to ${newStatus}`);
        handleSelectOrder(selectedOrder.id);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update rework status.');
    } finally {
      setItemsLoading(false);
    }
  };

  const openDispatchModal = () => {
    setDispatchForm({
      vehicleNumber: '',
      driverName: '',
      driverContact: '',
      expectedDeliveryDate: ''
    });
    setIsDispatchModalOpen(true);
  };

  const handleDispatchOrderSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await dispatchProductionOrder(projectId, selectedOrder.id, {
        vehicleNumber: dispatchForm.vehicleNumber,
        driverName: dispatchForm.driverName,
        driverContact: dispatchForm.driverContact,
        expectedDeliveryDate: dispatchForm.expectedDeliveryDate ? new Date(dispatchForm.expectedDeliveryDate).toISOString() : null
      });

      if (res.data?.success) {
        toast.success('Production order dispatched successfully. Transit status: In Transit.');
        setIsDispatchModalOpen(false);
        handleSelectOrder(selectedOrder.id);

        // Refresh main list
        const listRes = await getProductionOrders(projectId);
        if (listRes.data?.success) {
          setOrders(listRes.data.data || []);
        }
      }
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error?.message || err.message || 'Failed to dispatch batch.';
      toast.error(errMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const openDeliverModal = (disp) => {
    setActiveDispatch(disp);
    setDeliverForm({
      receivedByName: '',
      receiptNotes: ''
    });
    setIsDeliverModalOpen(true);
  };

  const handleConfirmDeliverySubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await confirmSiteDelivery(projectId, selectedOrder.id, activeDispatch.id, {
        receivedByName: deliverForm.receivedByName,
        receiptNotes: deliverForm.receiptNotes
      });

      if (res.data?.success) {
        toast.success('Delivery receipt confirmed successfully at site!');
        setIsDeliverModalOpen(false);
        handleSelectOrder(selectedOrder.id);

        // Refresh main list
        const listRes = await getProductionOrders(projectId);
        if (listRes.data?.success) {
          setOrders(listRes.data.data || []);
        }
      }
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error?.message || err.message || 'Failed to confirm site receipt.';
      toast.error(errMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const openDamageModal = (disp) => {
    setActiveDispatch(disp);
    setDamageForm({
      selectedItemId: selectedOrder.items[0]?.id || '',
      quantityDamaged: '1',
      damageSeverity: 'major',
      liabilityType: 'undetermined',
      description: '',
      photoKeysInput: '',
      resolutionTimeline: ''
    });
    setIsDamageModalOpen(true);
  };

  const handleCreateTransitDamage = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const photoKeys = damageForm.photoKeysInput
        ? damageForm.photoKeysInput.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      const res = await createTransitDamageReport(
        projectId,
        selectedOrder.id,
        activeDispatch.id,
        damageForm.selectedItemId,
        {
          quantityDamaged: parseFloat(damageForm.quantityDamaged) || 1.00,
          damageSeverity: damageForm.damageSeverity,
          liabilityType: damageForm.liabilityType,
          description: damageForm.description,
          photoKeys,
          resolutionTimeline: damageForm.resolutionTimeline ? new Date(damageForm.resolutionTimeline).toISOString() : null
        }
      );

      if (res.data?.success) {
        toast.success(`Transit damage report logged successfully: ${res.data.data.damage_number}`);
        setIsDamageModalOpen(false);
        handleSelectOrder(selectedOrder.id);
      }
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error?.message || err.message || 'Failed to report transit damage.';
      toast.error(errMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleInitiateReplacement = async (damageId) => {
    setActionLoading(true);
    try {
      const res = await initiateReplacementOrder(projectId, selectedOrder.id, damageId);
      if (res.data?.success) {
        toast.success(`Replacement Production Order initiated successfully! Number: ${res.data.data.replacementOrder.order_number}`);
        handleSelectOrder(selectedOrder.id);

        // Refresh main list
        const listRes = await getProductionOrders(projectId);
        if (listRes.data?.success) {
          setOrders(listRes.data.data || []);
        }
      }
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error?.message || err.message || 'Failed to initiate replacement order.';
      toast.error(errMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const openResolveDamageModal = (dmg) => {
    setActiveDamage(dmg);
    setResolveForm({
      status: dmg.status || 'resolved',
      liabilityType: dmg.liability_type || 'undetermined',
      resolutionNotes: dmg.resolution_notes || ''
    });
    setIsResolveDamageModalOpen(true);
  };

  const handleUpdateDamageStatus = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await updateTransitDamageStatus(projectId, selectedOrder.id, activeDamage.id, {
        status: resolveForm.status,
        liabilityType: resolveForm.liabilityType,
        resolutionNotes: resolveForm.resolutionNotes
      });

      if (res.data?.success) {
        toast.success('Damage report resolved and status updated successfully.');
        setIsResolveDamageModalOpen(false);
        handleSelectOrder(selectedOrder.id);
      }
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error?.message || err.message || 'Failed to resolve damage report.';
      toast.error(errMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const calculateProgress = (order) => {
    if (!order.total_items) return 0;
    return Math.round((order.completed_items / order.total_items) * 100);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2>Factory Production & QC Inspection</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--color-text-muted)' }}>
            Schedule manufacturing batches, log factory QC reports, assign rework, and manage dispatch clearance gates.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button onClick={openCreateModal} variant="primary">
            + Schedule Production
          </Button>
        </div>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title="No Production Orders Scheduled"
          description="Create a production order to allocate BOQ cabinet sets or woodworks to factories, log pre-dispatch QC passes, and clear orders."
          actionText="Schedule Production Batch"
          onAction={openCreateModal}
        />
      ) : (
        <div className={styles.splitLayout}>
          {/* Left Pane - Production Order List */}
          <div className={styles.listPane}>
            {orders.map(order => {
              const progress = calculateProgress(order);
              return (
                <div
                  key={order.id}
                  className={`${styles.poCard} ${selectedOrder?.id === order.id ? styles.poCardActive : ''}`}
                  onClick={() => handleSelectOrder(order.id)}
                >
                  <div className={styles.poCardHeader}>
                    <span className={styles.poNumber}>{order.order_number}</span>
                    <span className={`${styles.badge} ${styles[`badge-${order.status}`]}`}>
                      {order.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className={styles.poVendor}>
                    Factory: <strong>{order.factory_name || 'Unassigned'}</strong>
                  </div>
                  
                  {order.is_cleared_for_dispatch && (
                    <div style={{ margin: '4px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className={styles.badge} style={{ backgroundColor: '#d1fae5', color: '#065f46', fontSize: '9px' }}>
                        ✓ Dispatch Cleared
                      </span>
                    </div>
                  )}

                  <div className={styles.poCardFooter}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span className={styles.progressText}>Completed: {progress}%</span>
                      <div className={styles.progressBarContainer}>
                        <div className={styles.progressBar} style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                    <span className={styles.poDate}>
                      Target: {order.expected_completion_date ? new Date(order.expected_completion_date).toLocaleDateString('en-IN') : '—'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Pane - Production Order Details, QC, Rework */}
          <div className={styles.detailPane}>
            {selectedOrder ? (
              <>
                {/* Dispatch Clearance Gate Banner */}
                <div 
                  className={styles.detailHeader} 
                  style={{ 
                    flexDirection: 'column', 
                    alignItems: 'stretch', 
                    background: selectedOrder.is_cleared_for_dispatch ? '#f0fdf4' : '#fffbc6',
                    border: '1px solid ' + (selectedOrder.is_cleared_for_dispatch ? '#bbf7d0' : '#fef08a'),
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '13px', color: selectedOrder.is_cleared_for_dispatch ? '#166534' : '#854d0e' }}>
                        {selectedOrder.is_cleared_for_dispatch ? '✓ Dispatch Clearance Gate: Approved' : '⚠ Dispatch Clearance Gate: Locked'}
                      </h4>
                      <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        {selectedOrder.is_cleared_for_dispatch 
                          ? `Order cleared for shipping on ${new Date(selectedOrder.cleared_at).toLocaleString('en-IN')}`
                          : 'Clearance requires all items in the production batch to pass QC checklists.'}
                      </p>
                      {selectedOrder.is_cleared_for_dispatch && dispatches.length > 0 && (
                        <div style={{ marginTop: '8px', fontSize: '11px' }}>
                          <strong>Shipment Status:</strong>{' '}
                          <span className={`${styles.badge} ${styles['badge-' + dispatches[0].status]}`} style={{ marginLeft: '4px' }}>
                            {dispatches[0].status.replace('_', ' ')}
                          </span>
                          <span style={{ marginLeft: '8px', color: 'var(--color-text-muted)' }}>
                            ({dispatches[0].dispatch_number})
                          </span>
                        </div>
                      )}
                    </div>
                    <div>
                      {!selectedOrder.is_cleared_for_dispatch ? (
                        <Button
                          onClick={handleApproveClearance}
                          variant="primary"
                          size="sm"
                          disabled={actionLoading || selectedOrder.items.some(item => item.qc_status !== 'passed')}
                        >
                          Approve Clearance Gate
                        </Button>
                      ) : (
                        <>
                          {dispatches.length === 0 || dispatches[0].status === 'failed_delivery' ? (
                            <Button
                              onClick={openDispatchModal}
                              variant="primary"
                              size="sm"
                              disabled={actionLoading}
                            >
                              Dispatch Batch
                            </Button>
                          ) : dispatches[0].status === 'in_transit' ? (
                            <Button
                              onClick={() => openDeliverModal(dispatches[0])}
                              variant="success"
                              style={{ backgroundColor: '#10b981', color: '#fff' }}
                              size="sm"
                              disabled={actionLoading}
                            >
                              Confirm Site Delivery
                            </Button>
                          ) : (
                            <span style={{ color: '#166534', fontSize: '12px', fontWeight: '600' }}>
                              ✓ Received at Site
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Main Order Details Header */}
                <div className={styles.detailHeader} style={{ borderBottom: 'none', paddingBottom: 0 }}>
                  <div className={styles.detailTitleBlock}>
                    <h3>Production Order: {selectedOrder.order_number}</h3>
                    <span className={`${styles.badge} ${styles[`badge-${selectedOrder.status}`]}`} style={{ marginTop: '6px' }}>
                      {selectedOrder.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {/* Sub-tab view buttons inside Details Pane */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', gap: '16px', marginBottom: '8px' }}>
                  <button 
                    onClick={() => setDetailTab('schedule')} 
                    style={{ 
                      padding: '8px 4px', 
                      background: 'none', 
                      border: 'none', 
                      borderBottom: detailTab === 'schedule' ? '2px solid var(--color-primary)' : 'none',
                      fontWeight: detailTab === 'schedule' ? '600' : 'normal',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Items Schedule
                  </button>
                  <button 
                    onClick={() => setDetailTab('history')} 
                    style={{ 
                      padding: '8px 4px', 
                      background: 'none', 
                      border: 'none', 
                      borderBottom: detailTab === 'history' ? '2px solid var(--color-primary)' : 'none',
                      fontWeight: detailTab === 'history' ? '600' : 'normal',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Inspection Logs ({qcSummary.inspections?.length || 0})
                  </button>
                  <button 
                    onClick={() => setDetailTab('reworks')} 
                    style={{ 
                      padding: '8px 4px', 
                      background: 'none', 
                      border: 'none', 
                      borderBottom: detailTab === 'reworks' ? '2px solid var(--color-primary)' : 'none',
                      fontWeight: detailTab === 'reworks' ? '600' : 'normal',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Rework Orders ({qcSummary.reworkOrders?.length || 0})
                  </button>
                  <button 
                    onClick={() => setDetailTab('logistics')} 
                    style={{ 
                      padding: '8px 4px', 
                      background: 'none', 
                      border: 'none', 
                      borderBottom: detailTab === 'logistics' ? '2px solid var(--color-primary)' : 'none',
                      fontWeight: detailTab === 'logistics' ? '600' : 'normal',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Logistics & Delivery ({dispatches?.length || 0})
                  </button>
                  <button 
                    onClick={() => setDetailTab('damage')} 
                    style={{ 
                      padding: '8px 4px', 
                      background: 'none', 
                      border: 'none', 
                      borderBottom: detailTab === 'damage' ? '2px solid var(--color-primary)' : 'none',
                      fontWeight: detailTab === 'damage' ? '600' : 'normal',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Transit Damage & Claims ({damages?.length || 0})
                  </button>
                </div>

                {detailTab === 'schedule' && (
                  <div className={styles.itemsSection}>
                    <div className={styles.tableWrapper}>
                      <table className={styles.itemTable}>
                        <thead>
                          <tr>
                            <th>Item Name</th>
                            <th>Qty</th>
                            <th>Factory</th>
                            <th>QC Status</th>
                            <th>Milestones</th>
                            <th>Packaging & Dispatch</th>
                            <th style={{ width: '60px' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedOrder.items?.map(item => {
                            const edits = editedItems[item.id] || {};
                            return (
                              <tr key={item.id}>
                                <td>
                                  <strong>{item.item_name}</strong>
                                  <div style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>Unit: {item.unit || 'Nos'}</div>
                                </td>
                                <td>{item.quantity}</td>
                                <td>
                                  <input
                                    type="text"
                                    className={styles.inlineInput}
                                    value={edits.factory_assignment || ''}
                                    onChange={(e) => handleInlineItemChange(item.id, 'factory_assignment', e.target.value)}
                                  />
                                </td>
                                <td>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                                    <span className={`${styles.badge} ${styles[`badge-${item.qc_status}`]}`}>
                                      {item.qc_status}
                                    </span>
                                    <Button
                                      onClick={() => openInspectModal(item)}
                                      variant="secondary"
                                      size="sm"
                                      style={{ fontSize: '10px', padding: '2px 4px' }}
                                    >
                                      Inspect
                                    </Button>
                                  </div>
                                </td>
                                <td>
                                  <select
                                    className={styles.inlineSelect}
                                    value={edits.status || 'pending'}
                                    onChange={(e) => handleInlineItemChange(item.id, 'status', e.target.value)}
                                  >
                                    <option value="pending">Pending</option>
                                    <option value="in_production">In Production</option>
                                    <option value="completed">Completed</option>
                                    <option value="cancelled">Cancelled</option>
                                  </select>
                                  <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '9px' }}>
                                    <label>
                                      Start:
                                      <input
                                        type="date"
                                        style={{ fontSize: '9px', padding: '2px' }}
                                        value={edits.production_start_date || ''}
                                        onChange={(e) => handleInlineItemChange(item.id, 'production_start_date', e.target.value)}
                                      />
                                    </label>
                                    <label>
                                      End:
                                      <input
                                        type="date"
                                        style={{ fontSize: '9px', padding: '2px' }}
                                        value={edits.production_complete_date || ''}
                                        onChange={(e) => handleInlineItemChange(item.id, 'production_complete_date', e.target.value)}
                                      />
                                    </label>
                                  </div>
                                </td>
                                <td>
                                  <select
                                    className={styles.inlineSelect}
                                    value={edits.packaging_status || 'pending'}
                                    onChange={(e) => handleInlineItemChange(item.id, 'packaging_status', e.target.value)}
                                  >
                                    <option value="pending">Pending</option>
                                    <option value="packaged">Packaged</option>
                                    <option value="dispatched">Dispatched</option>
                                  </select>
                                  <div style={{ marginTop: '4px', fontSize: '9px' }}>
                                    <label>
                                      Ship Date:
                                      <input
                                        type="date"
                                        style={{ fontSize: '9px', padding: '2px', width: '90px' }}
                                        value={edits.dispatch_date || ''}
                                        onChange={(e) => handleInlineItemChange(item.id, 'dispatch_date', e.target.value)}
                                        disabled={!selectedOrder.is_cleared_for_dispatch}
                                      />
                                    </label>
                                    {!selectedOrder.is_cleared_for_dispatch && (
                                      <div style={{ color: '#d97706', fontSize: '8px', marginTop: '2px' }}>🔒 Locked — Needs QC</div>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <Button
                                    onClick={() => handleSaveItemChanges(item.id)}
                                    disabled={updatingItemId === item.id}
                                    variant="secondary"
                                    size="sm"
                                  >
                                    {updatingItemId === item.id ? '...' : 'Save'}
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {detailTab === 'history' && (
                  <div className={styles.itemsSection}>
                    <h4 style={{ display: 'none' }}>QC logs</h4>
                    {qcSummary.inspections?.length === 0 ? (
                      <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '12px' }}>
                        No quality control checklists recorded for this batch yet.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {qcSummary.inspections.map(ins => (
                          <div 
                            key={ins.id} 
                            style={{ 
                              border: '1px solid var(--color-border)', 
                              borderRadius: 'var(--radius-md)', 
                              padding: '12px',
                              background: ins.status === 'passed' ? '#f0fdf4' : '#fef2f2'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <strong>{ins.item_name}</strong>
                              <span className={`${styles.badge} ${styles[`badge-${ins.status}`]}`}>{ins.status}</span>
                            </div>
                            <p style={{ margin: '0 0 6px 0', fontSize: '12px' }}>{ins.notes || 'No inspection details provided.'}</p>
                            
                            {/* Defect photo key displays */}
                            {ins.photo_keys && JSON.parse(ins.photo_keys).length > 0 && (
                              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                {JSON.parse(ins.photo_keys).map((key, idx) => (
                                  <span 
                                    key={idx} 
                                    style={{ 
                                      fontSize: '10px', 
                                      backgroundColor: 'rgba(0,0,0,0.05)', 
                                      padding: '2px 6px', 
                                      borderRadius: '4px', 
                                      display: 'inline-flex', 
                                      alignItems: 'center', 
                                      gap: '4px',
                                      color: 'var(--color-text)'
                                    }}
                                  >
                                    📸 {key}
                                  </span>
                                ))}
                              </div>
                            )}

                            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '8px', textAlign: 'right' }}>
                              Inspected by: {ins.inspector_name || 'Inspector'} on {new Date(ins.created_at).toLocaleDateString('en-IN')}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {detailTab === 'reworks' && (
                  <div className={styles.itemsSection}>
                    <h4 style={{ display: 'none' }}>Rework Orders</h4>
                    {qcSummary.reworkOrders?.length === 0 ? (
                      <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '12px' }}>
                        No rework orders currently active for this production batch.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {qcSummary.reworkOrders.map(rw => (
                          <div 
                            key={rw.id} 
                            style={{ 
                              border: '1px solid var(--color-border)', 
                              borderRadius: 'var(--radius-md)', 
                              padding: '12px',
                              background: '#faf5ff'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <div>
                                <strong>{rw.rework_number}</strong>
                                <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--color-text-muted)' }}>({rw.item_name})</span>
                              </div>
                              <span className={`${styles.badge} ${styles[`badge-scheduled`]}`} style={{ backgroundColor: '#f3e8ff', color: '#6b21a8' }}>
                                {rw.status}
                              </span>
                            </div>
                            <p style={{ margin: '0 0 6px 0', fontSize: '12px' }}><strong>Instructions:</strong> {rw.rework_instructions}</p>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                              Assigned To: <strong>{rw.assigned_to || 'Unassigned'}</strong> | Target Completion: {rw.target_date ? new Date(rw.target_date).toLocaleDateString('en-IN') : '—'}
                            </div>

                            {rw.status === 'assigned' && (
                              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
                                <Button
                                  onClick={() => handleUpdateReworkStatus(rw.id, 'in_progress')}
                                  variant="secondary"
                                  size="sm"
                                >
                                  Mark In Progress
                                </Button>
                                <Button
                                  onClick={() => handleUpdateReworkStatus(rw.id, 'completed')}
                                  variant="secondary"
                                  size="sm"
                                >
                                  Mark Completed
                                </Button>
                              </div>
                            )}

                            {rw.status === 'in_progress' && (
                              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
                                <Button
                                  onClick={() => handleUpdateReworkStatus(rw.id, 'completed')}
                                  variant="secondary"
                                  size="sm"
                                >
                                  Mark Completed
                                </Button>
                              </div>
                            )}

                            {rw.status === 'completed' && (
                              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
                                <Button
                                  onClick={() => handleUpdateReworkStatus(rw.id, 'verified')}
                                  variant="primary"
                                  size="sm"
                                >
                                  Verify & Clear Item
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {detailTab === 'logistics' && (
                  <div className={styles.itemsSection}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h4 style={{ margin: 0 }}>Logistics & Delivery Logs</h4>
                      {selectedOrder.is_cleared_for_dispatch && (dispatches.length === 0 || dispatches[0].status === 'failed_delivery') && (
                        <Button
                          onClick={openDispatchModal}
                          variant="primary"
                          size="sm"
                        >
                          Dispatch Batch
                        </Button>
                      )}
                    </div>
                    {dispatches.length === 0 ? (
                      <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '12px' }}>
                        No dispatch logs or shipment tracking details recorded yet.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {dispatches.map(disp => (
                          <div 
                            key={disp.id} 
                            style={{ 
                              border: '1px solid var(--color-border)', 
                              borderRadius: 'var(--radius-md)', 
                              padding: '16px',
                              background: disp.status === 'delivered' ? '#f0fdf4' : disp.status === 'failed_delivery' ? '#fef2f2' : '#fefbf0'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                              <div>
                                <strong style={{ fontSize: '13px' }}>{disp.dispatch_number}</strong>
                                <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                  Shipped: {new Date(disp.dispatch_date).toLocaleDateString('en-IN')}
                                </span>
                              </div>
                              <span className={`${styles.badge} ${styles['badge-' + disp.status]}`}>
                                {disp.status.replace('_', ' ')}
                              </span>
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px', marginBottom: '10px' }}>
                              <div>
                                <div style={{ color: 'var(--color-text-muted)', marginBottom: '2px' }}>Vehicle Details</div>
                                <strong>{disp.vehicle_number || 'Not Recorded'}</strong>
                              </div>
                              <div>
                                <div style={{ color: 'var(--color-text-muted)', marginBottom: '2px' }}>Driver Info</div>
                                <strong>{disp.driver_name || 'N/A'}</strong> {disp.driver_contact ? `(${disp.driver_contact})` : ''}
                              </div>
                              <div>
                                <div style={{ color: 'var(--color-text-muted)', marginBottom: '2px' }}>Expected Delivery</div>
                                <strong>{disp.expected_delivery_date ? new Date(disp.expected_delivery_date).toLocaleDateString('en-IN') : '—'}</strong>
                              </div>
                              {disp.actual_delivery_date && (
                                <div>
                                  <div style={{ color: 'var(--color-text-muted)', marginBottom: '2px' }}>Actual Delivery</div>
                                  <strong>{new Date(disp.actual_delivery_date).toLocaleString('en-IN')}</strong>
                                </div>
                              )}
                            </div>

                            {disp.status === 'delivered' && (
                              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--color-border)', fontSize: '12px' }}>
                                <div>
                                  <strong>Received At Site By:</strong> {disp.received_by_name || disp.receiver_user_name || 'Supervisor'}
                                </div>
                                {disp.receipt_notes && (
                                  <div style={{ marginTop: '4px', fontStyle: 'italic', color: 'var(--color-text-muted)' }}>
                                    " {disp.receipt_notes} "
                                  </div>
                                )}
                              </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                              <Button
                                onClick={() => openDamageModal(disp)}
                                variant="secondary"
                                size="sm"
                                style={{ border: '1px solid #d97706', color: '#d97706', background: 'none' }}
                              >
                                ⚠ Report Damage
                              </Button>
                              {disp.status === 'in_transit' && (
                                <Button
                                  onClick={() => openDeliverModal(disp)}
                                  variant="success"
                                  style={{ backgroundColor: '#10b981', color: '#fff' }}
                                  size="sm"
                                >
                                  Confirm Site Delivery
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {detailTab === 'damage' && (
                  <div className={styles.itemsSection}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h4 style={{ margin: 0 }}>Transit Damage Reports & Replacement Claims</h4>
                    </div>
                    {damages.length === 0 ? (
                      <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '12px' }}>
                        No transit damage reports recorded for this batch.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {damages.map(dmg => (
                          <div 
                            key={dmg.id} 
                            style={{ 
                              border: '1px solid var(--color-border)', 
                              borderRadius: 'var(--radius-md)', 
                              padding: '16px',
                              background: '#fffbeb'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <div>
                                <strong style={{ fontSize: '13px' }}>{dmg.damage_number}</strong>
                                <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                  ({dmg.item_name})
                                </span>
                              </div>
                              <span className={`${styles.badge} ${styles['badge-' + dmg.status] || ''}`} style={{ backgroundColor: dmg.status === 'resolved' ? '#d1fae5' : '#fee2e2', color: dmg.status === 'resolved' ? '#065f46' : '#b91c1c' }}>
                                {dmg.status.replace('_', ' ')}
                              </span>
                            </div>

                            <p style={{ margin: '0 0 8px 0', fontSize: '12px' }}>
                              <strong>Reported Qty:</strong> {dmg.quantity_damaged} {dmg.unit || 'Nos'} |{' '}
                              <strong>Severity:</strong> <span style={{ textTransform: 'capitalize', fontWeight: '600', color: dmg.damage_severity === 'critical' ? '#b91c1c' : '#d97706' }}>{dmg.damage_severity}</span>
                            </p>

                            <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: 'var(--color-text)' }}>
                              <strong>Description:</strong> {dmg.description}
                            </p>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                              <div>
                                Liability: <strong style={{ textTransform: 'uppercase', color: 'var(--color-text)' }}>{dmg.liability_type.replace('_', ' ')}</strong>
                              </div>
                              <div>
                                Expected Resolution: <strong>{dmg.resolution_timeline ? new Date(dmg.resolution_timeline).toLocaleDateString('en-IN') : '—'}</strong>
                              </div>
                            </div>

                            {/* Photo keys */}
                            {dmg.photo_keys && JSON.parse(dmg.photo_keys).length > 0 && (
                              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                                {JSON.parse(dmg.photo_keys).map((key, idx) => (
                                  <span 
                                    key={idx} 
                                    style={{ 
                                      fontSize: '10px', 
                                      backgroundColor: 'rgba(0,0,0,0.05)', 
                                      padding: '2px 6px', 
                                      borderRadius: '4px', 
                                      color: 'var(--color-text)'
                                    }}
                                  >
                                    📸 {key}
                                  </span>
                                ))}
                              </div>
                            )}

                            {dmg.replacement_order_number && (
                              <div style={{ padding: '8px 12px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '4px', fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span>
                                  🔄 Replacement Order: <strong>{dmg.replacement_order_number}</strong>
                                </span>
                                <span style={{ color: '#065f46', fontWeight: '500' }}>Replacement Scheduled</span>
                              </div>
                            )}

                            {dmg.resolution_notes && (
                              <div style={{ padding: '8px 12px', backgroundColor: '#f9fafb', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '11px', marginBottom: '8px' }}>
                                <strong>Resolution Notes:</strong> {dmg.resolution_notes}
                              </div>
                            )}

                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                              {!dmg.replacement_order_id && dmg.status !== 'resolved' && (
                                <Button
                                  onClick={() => handleInitiateReplacement(dmg.id)}
                                  variant="primary"
                                  size="sm"
                                  disabled={actionLoading}
                                >
                                  🔄 Initiate Replacement
                                </Button>
                              )}
                              {dmg.status !== 'resolved' && (
                                <Button
                                  onClick={() => openResolveDamageModal(dmg)}
                                  variant="secondary"
                                  size="sm"
                                  disabled={actionLoading}
                                >
                                  Update Status / Resolve
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className={styles.noSelection}>
                Select a production order from the sidebar to view scheduling, log inspections, and approve clearances.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal - Schedule Production */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Schedule Factory Production Batch"
      >
        <form onSubmit={handleCreateOrder} className={styles.modalForm}>
          <div className={styles.formGrid}>
            <div className={styles.fullWidth}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px' }}>
                Factory Assignment Name
              </label>
              <Input
                type="text"
                placeholder="e.g., Woodwork Studio, Kitchen Factory A"
                value={form.factoryName}
                onChange={(e) => setForm(prev => ({ ...prev, factoryName: e.target.value }))}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px' }}>
                Expected Completion Date
              </label>
              <Input
                type="date"
                value={form.expectedCompletionDate}
                onChange={(e) => setForm(prev => ({ ...prev, expectedCompletionDate: e.target.value }))}
                required
              />
            </div>
            <div className={styles.fullWidth}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px' }}>
                Manufacturing Notes
              </label>
              <Textarea
                placeholder="Specify laminate directions, custom glue requirements, edge banding specs, etc."
                value={form.notes}
                onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </div>

            <div className={styles.fullWidth}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px' }}>
                Select BOQ Items for Manufacturing
              </label>
              <div className={styles.boqSelectionBox}>
                {activeQuotationItems.filter(item => parseFloat(item.unit_price) > 0).map(item => {
                  const selectionState = form.selectedItems[item.id] || { selected: false, quantity: item.quantity };
                  return (
                    <div
                      key={item.id}
                      className={`${styles.boqItemRow} ${selectionState.selected ? styles.boqItemRowSelected : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectionState.selected}
                        onChange={(e) => handleCheckboxChange(item.id, e.target.checked)}
                      />
                      <div>
                        <span className={styles.boqItemName}>{item.item_name}</span>
                        <span className={styles.boqItemDesc}>{item.description || 'No description'}</span>
                      </div>
                      <div style={{ color: 'var(--color-text-muted)' }}>
                        BOQ Qty: {item.quantity} {item.unit}
                      </div>
                      <div>
                        <input
                          type="number"
                          className={styles.boqQtyInput}
                          min="0.01"
                          step="0.01"
                          value={selectionState.quantity}
                          onChange={(e) => handleItemQtyChange(item.id, e.target.value)}
                          disabled={!selectionState.selected}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className={styles.actionsBlock}>
            <Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={actionLoading}>
              {actionLoading ? 'Scheduling...' : 'Confirm Production Schedule'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal - Log QC Inspection Checklist */}
      <Modal
        isOpen={isInspectModalOpen}
        onClose={() => setIsInspectModalOpen(false)}
        title={activeItem ? `QC Inspection Checklist: ${activeItem.item_name}` : 'QC Inspection Checklist'}
      >
        <form onSubmit={handleRecordQC} className={styles.modalForm}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '13px' }}>
              Quality Verdict
            </label>
            <div style={{ display: 'flex', gap: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="qc_verdict"
                  value="passed"
                  checked={inspectForm.status === 'passed'}
                  onChange={() => setInspectForm(prev => ({ ...prev, status: 'passed' }))}
                />
                <span className={styles.badge} style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '4px 8px' }}>Passed QC Check</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="qc_verdict"
                  value="failed"
                  checked={inspectForm.status === 'failed'}
                  onChange={() => setInspectForm(prev => ({ ...prev, status: 'failed' }))}
                />
                <span className={styles.badge} style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '4px 8px' }}>Failed (Requires Rework)</span>
              </label>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px' }}>
              Quality Audit Notes / Inspection Checklist details
            </label>
            <Textarea
              placeholder="Verify dimensions, edge polish, finish matching specifications. Document any defects here..."
              value={inspectForm.notes}
              onChange={(e) => setInspectForm(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px' }}>
              📸 Defect Photography (S3 Photo Keys / Image Links)
            </label>
            <Input
              type="text"
              placeholder="e.g., photo_scratch_corner.jpg, photo_poor_alignment.jpg"
              value={inspectForm.photoKeysInput}
              onChange={(e) => setInspectForm(prev => ({ ...prev, photoKeysInput: e.target.value }))}
            />
            <p style={{ margin: '4px 0 0 0', fontSize: '10px', color: 'var(--color-text-muted)' }}>
              Provide comma-separated image file names or keys detailing the quality issue.
            </p>
          </div>

          <div className={styles.actionsBlock}>
            <Button type="button" variant="secondary" onClick={() => setIsInspectModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={actionLoading}>
              Record QC Verification
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal - Create Rework Order */}
      <Modal
        isOpen={isReworkModalOpen}
        onClose={() => setIsReworkModalOpen(false)}
        title={activeItem ? `Issue Rework Order: ${activeItem.item_name}` : 'Issue Rework Order'}
      >
        <form onSubmit={handleCreateRework} className={styles.modalForm}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px' }}>
              Rework/Remanufacture Instructions
            </label>
            <Textarea
              placeholder="Explain the specific repair or panel replacements needed to resolve the QC failure..."
              value={reworkForm.reworkInstructions}
              onChange={(e) => setReworkForm(prev => ({ ...prev, reworkInstructions: e.target.value }))}
              rows={4}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px' }}>
              Assign To (Factory Team / Subcontractor)
            </label>
            <Input
              type="text"
              placeholder="e.g., Wardrobe Production Line 2, Carpenter Amit"
              value={reworkForm.assignedTo}
              onChange={(e) => setReworkForm(prev => ({ ...prev, assignedTo: e.target.value }))}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px' }}>
              Target Resolution Date
            </label>
            <Input
              type="date"
              value={reworkForm.targetDate}
              onChange={(e) => setReworkForm(prev => ({ ...prev, targetDate: e.target.value }))}
              required
            />
          </div>

          <div className={styles.actionsBlock}>
            <Button type="button" variant="secondary" onClick={() => setIsReworkModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={actionLoading}>
              Issue Rework Order
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal - Dispatch Production Batch */}
      <Modal
        isOpen={isDispatchModalOpen}
        onClose={() => setIsDispatchModalOpen(false)}
        title="Dispatch Production Batch & Logistics Details"
      >
        <form onSubmit={handleDispatchOrderSubmit} className={styles.modalForm}>
          <div className={styles.formGrid}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px' }}>
                Vehicle Number
              </label>
              <Input
                type="text"
                placeholder="e.g. KA-01-ME-1234 / Courier ID"
                value={dispatchForm.vehicleNumber}
                onChange={(e) => setDispatchForm(prev => ({ ...prev, vehicleNumber: e.target.value }))}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px' }}>
                Expected Delivery Date
              </label>
              <Input
                type="date"
                value={dispatchForm.expectedDeliveryDate}
                onChange={(e) => setDispatchForm(prev => ({ ...prev, expectedDeliveryDate: e.target.value }))}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px' }}>
                Driver / Courier Name
              </label>
              <Input
                type="text"
                placeholder="e.g. Ramesh Kumar"
                value={dispatchForm.driverName}
                onChange={(e) => setDispatchForm(prev => ({ ...prev, driverName: e.target.value }))}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px' }}>
                Driver Contact Number
              </label>
              <Input
                type="text"
                placeholder="e.g. 9876543210"
                value={dispatchForm.driverContact}
                onChange={(e) => setDispatchForm(prev => ({ ...prev, driverContact: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className={styles.actionsBlock}>
            <Button type="button" variant="secondary" onClick={() => setIsDispatchModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={actionLoading}>
              {actionLoading ? 'Dispatching...' : 'Dispatch Shipment'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal - Confirm Site Delivery */}
      <Modal
        isOpen={isDeliverModalOpen}
        onClose={() => setIsDeliverModalOpen(false)}
        title="Confirm Site Delivery Receipt"
      >
        <form onSubmit={handleConfirmDeliverySubmit} className={styles.modalForm}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px' }}>
              Received By (Receiver Name / Site Supervisor)
            </label>
            <Input
              type="text"
              placeholder="e.g. Supervisor Amit"
              value={deliverForm.receivedByName}
              onChange={(e) => setDeliverForm(prev => ({ ...prev, receivedByName: e.target.value }))}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px' }}>
              Receipt / Inspection Notes
            </label>
            <Textarea
              placeholder="Describe condition of received items. Verify count, checklist matches, and that packaging is intact..."
              value={deliverForm.receiptNotes}
              onChange={(e) => setDeliverForm(prev => ({ ...prev, receiptNotes: e.target.value }))}
              rows={3}
              required
            />
          </div>

          <div className={styles.actionsBlock}>
            <Button type="button" variant="secondary" onClick={() => setIsDeliverModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" style={{ backgroundColor: '#10b981', color: '#fff' }} disabled={actionLoading}>
              {actionLoading ? 'Confirming...' : 'Confirm Received at Site'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal - Report Transit Damage */}
      <Modal
        isOpen={isDamageModalOpen}
        onClose={() => setIsDamageModalOpen(false)}
        title="Report Transit Damage Incident"
      >
        <form onSubmit={handleCreateTransitDamage} className={styles.modalForm}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px' }}>
              Select Damaged Item
            </label>
            <select
              className={styles.inlineSelect}
              value={damageForm.selectedItemId}
              onChange={(e) => setDamageForm(prev => ({ ...prev, selectedItemId: e.target.value }))}
              style={{ padding: '8px', fontSize: '13px' }}
              required
            >
              <option value="">-- Select Item --</option>
              {selectedOrder.items?.map(item => (
                <option key={item.id} value={item.id}>
                  {item.item_name} (Shipped Qty: {item.quantity})
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGrid}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px' }}>
                Quantity Damaged
              </label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={damageForm.quantityDamaged}
                onChange={(e) => setDamageForm(prev => ({ ...prev, quantityDamaged: e.target.value }))}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px' }}>
                Damage Severity
              </label>
              <select
                className={styles.inlineSelect}
                value={damageForm.damageSeverity}
                onChange={(e) => setDamageForm(prev => ({ ...prev, damageSeverity: e.target.value }))}
                style={{ padding: '8px', fontSize: '13px' }}
                required
              >
                <option value="minor">Minor (Scratches/Buffs)</option>
                <option value="major">Major (Dent/Deep cracks)</option>
                <option value="critical">Critical (Completely broken/unusable)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px' }}>
                Initial Liability Assignment
              </label>
              <select
                className={styles.inlineSelect}
                value={damageForm.liabilityType}
                onChange={(e) => setDamageForm(prev => ({ ...prev, liabilityType: e.target.value }))}
                style={{ padding: '8px', fontSize: '13px' }}
                required
              >
                <option value="undetermined">Undetermined</option>
                <option value="transporter">Transporter Fault</option>
                <option value="vendor">Vendor / Subcontractor Fault</option>
                <option value="insurance_claim">Insurance Claim Case</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px' }}>
                Expected Resolution Date
              </label>
              <Input
                type="date"
                value={damageForm.resolutionTimeline}
                onChange={(e) => setDamageForm(prev => ({ ...prev, resolutionTimeline: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px' }}>
              Detailed Description of Damage
            </label>
            <Textarea
              placeholder="State what needs replacement. Specify cracked panels, alignment issues or broken corners..."
              value={damageForm.description}
              onChange={(e) => setDamageForm(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px' }}>
              📸 Damage Photos (S3 Keys / Comma-separated File Names)
            </label>
            <Input
              type="text"
              placeholder="e.g. dmg_panel_1.jpg, dmg_edge_2.jpg"
              value={damageForm.photoKeysInput}
              onChange={(e) => setDamageForm(prev => ({ ...prev, photoKeysInput: e.target.value }))}
            />
          </div>

          <div className={styles.actionsBlock}>
            <Button type="button" variant="secondary" onClick={() => setIsDamageModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={actionLoading}>
              Log Damage Incident
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal - Resolve / Update Damage Report */}
      <Modal
        isOpen={isResolveDamageModalOpen}
        onClose={() => setIsResolveDamageModalOpen(false)}
        title="Update / Resolve Transit Damage Incident"
      >
        <form onSubmit={handleUpdateDamageStatus} className={styles.modalForm}>
          <div className={styles.formGrid}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px' }}>
                Incident Status
              </label>
              <select
                className={styles.inlineSelect}
                value={resolveForm.status}
                onChange={(e) => setResolveForm(prev => ({ ...prev, status: e.target.value }))}
                style={{ padding: '8px', fontSize: '13px' }}
                required
              >
                <option value="reported">Reported</option>
                <option value="claim_filed">Insurance Claim Filed</option>
                <option value="replacement_initiated">Replacement Initiated</option>
                <option value="resolved">Resolved & Closed</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px' }}>
                Final Liability Type
              </label>
              <select
                className={styles.inlineSelect}
                value={resolveForm.liabilityType}
                onChange={(e) => setResolveForm(prev => ({ ...prev, liabilityType: e.target.value }))}
                style={{ padding: '8px', fontSize: '13px' }}
                required
              >
                <option value="undetermined">Undetermined</option>
                <option value="transporter">Transporter Liability</option>
                <option value="vendor">Vendor / Subcontractor Liability</option>
                <option value="insurance_claim">Insurance Recovery Claim</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '13px' }}>
              Resolution Notes
            </label>
            <Textarea
              placeholder="Record final claims resolution, payout or replacement woodwork delivery details..."
              value={resolveForm.resolutionNotes}
              onChange={(e) => setResolveForm(prev => ({ ...prev, resolutionNotes: e.target.value }))}
              rows={4}
              required
            />
          </div>

          <div className={styles.actionsBlock}>
            <Button type="button" variant="secondary" onClick={() => setIsResolveDamageModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={actionLoading}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
