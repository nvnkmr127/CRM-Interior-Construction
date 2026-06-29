import React, { useState, useEffect } from 'react';
import { Button, Badge, Modal, Input, Textarea, EmptyState, Spinner } from '../ui';
import { useToast } from '../../store/toastContext';
import styles from './ProjectQuotationsTab.module.css';
import {
  getQuotations,
  getQuotation,
  createQuotation,
  addBOQItem,
  updateBOQItem,
  deleteBOQItem,
  reviseQuotation,
  compareQuotations,
  getChangeOrders,
  sendQuotation,
  acceptQuotation,
  rejectQuotation,
  updateQuotation
} from '../../api/projects';

export default function ProjectQuotationsTab({ projectId }) {
  const toast = useToast();
  const [quotations, setQuotations] = useState([]);
  const [activeQuotation, setActiveQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  
  // Edit state
  const [editMode, setEditMode] = useState(false);
  const [editingItem, setEditingItem] = useState(null); // ID of item being edited
  const [editForm, setEditForm] = useState({});
  
  // Revision state
  const [showReviseModal, setShowReviseModal] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [changeOrders, setChangeOrders] = useState([]);
  
  // Add item state
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({
    roomOrArea: '',
    itemName: '',
    description: '',
    unit: 'SqFt',
    quantity: '1',
    unitPrice: '0',
    markupPercentage: '0',
    scopeType: 'original',
    changeOrderId: '',
    hsnCode: '',
    gstRate: '18',
    laborTrade: '',
    laborRateType: 'rate_per_unit',
    laborUnitRate: '0',
    laborMarkupPercentage: '0'
  });

  // Compare state
  const [compareMode, setCompareMode] = useState(false);
  const [compareBaseId, setCompareBaseId] = useState('');
  const [compareTargetId, setCompareTargetId] = useState('');
  const [comparisonResult, setComparisonResult] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);

  useEffect(() => {
    if (projectId) {
      fetchQuotations();
      fetchChangeOrders();
    }
  }, [projectId]);

  const fetchChangeOrders = async () => {
    try {
      const res = await getChangeOrders(projectId);
      if (res.data?.success) {
        setChangeOrders(res.data.data || []);
      }
    } catch (e) {
      console.error('Failed to load change orders', e);
    }
  };

  const fetchQuotations = async (selectId = null) => {
    setLoading(true);
    try {
      const res = await getQuotations(projectId);
      if (res.data?.success) {
        const list = res.data.data || [];
        setQuotations(list);
        
        if (list.length > 0) {
          const defaultSelect = selectId ? list.find(q => q.id === selectId) : list[0];
          handleSelectQuotation(defaultSelect || list[0]);
        } else {
          setActiveQuotation(null);
        }
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load quotations.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectQuotation = async (quote) => {
    setCompareMode(false);
    setItemsLoading(true);
    setEditMode(false);
    try {
      const res = await getQuotation(projectId, quote.id);
      if (res.data?.success) {
        setActiveQuotation(res.data.data);
      }
    } catch (e) {
      console.error(e);
      toast.error(`Failed to load items for version ${quote.version}`);
    } finally {
      setItemsLoading(false);
    }
  };

  const handleCreateInitial = async () => {
    setLoading(true);
    try {
      const number = `QT-${Date.now().toString().slice(-6)}`;
      const res = await createQuotation(projectId, {
        quotationNumber: number,
        notes: 'Initial quotation',
        termsConditions: '50% Advance, 40% Work in Progress, 10% Handover',
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });
      if (res.data?.success) {
        toast.success('Quotation draft created successfully.');
        await fetchQuotations(res.data.data.id);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to create quotation draft.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItem.roomOrArea.trim()) return toast.error('Room or Area is required');
    if (!newItem.itemName.trim()) return toast.error('Item name is required');
    if (isNaN(Number(newItem.quantity)) || Number(newItem.quantity) <= 0) return toast.error('Quantity must be positive');
    if (isNaN(Number(newItem.unitPrice)) || Number(newItem.unitPrice) < 0) return toast.error('Price must be non-negative');

    setItemsLoading(true);
    try {
      const res = await addBOQItem(projectId, activeQuotation.id, {
        roomOrArea: newItem.roomOrArea.trim(),
        itemName: newItem.itemName.trim(),
        description: newItem.description.trim() || null,
        unit: newItem.unit,
        quantity: Number(newItem.quantity),
        unitPrice: Number(newItem.unitPrice),
        markupPercentage: Number(newItem.markupPercentage),
        scopeType: newItem.scopeType,
        changeOrderId: newItem.changeOrderId || null,
        hsnCode: newItem.hsnCode.trim() || null,
        gstRate: Number(newItem.gstRate || 0),
        sortOrder: activeQuotation.items ? activeQuotation.items.length : 0,
        laborTrade: newItem.laborTrade || null,
        laborRateType: newItem.laborRateType,
        laborUnitRate: Number(newItem.laborUnitRate || 0),
        laborMarkupPercentage: Number(newItem.laborMarkupPercentage || 0)
      });
      if (res.data?.success) {
        toast.success('Item added to BOQ');
        setNewItem({
          roomOrArea: '',
          itemName: '',
          description: '',
          unit: 'SqFt',
          quantity: '1',
          unitPrice: '0',
          markupPercentage: '0',
          scopeType: 'original',
          changeOrderId: '',
          hsnCode: '',
          gstRate: '18',
          laborTrade: '',
          laborRateType: 'rate_per_unit',
          laborUnitRate: '0',
          laborMarkupPercentage: '0'
        });
        setShowAddItem(false);
        // Refresh quotation
        const quoteRes = await getQuotation(projectId, activeQuotation.id);
        if (quoteRes.data?.success) {
          setActiveQuotation(quoteRes.data.data);
          // Also update total in local list
          setQuotations(quotations.map(q => q.id === activeQuotation.id ? { ...q, total_amount: quoteRes.data.data.total_amount } : q));
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to add BOQ item');
    } finally {
      setItemsLoading(false);
    }
  };

  const startEditing = (item) => {
    setEditingItem(item.id);
    setEditForm({
      roomOrArea: item.room_or_area,
      itemName: item.item_name,
      description: item.description || '',
      unit: item.unit || '',
      quantity: String(item.quantity),
      unitPrice: String(item.unit_price),
      markupPercentage: String(item.markup_percentage),
      scopeType: item.scope_type || 'original',
      changeOrderId: item.change_order_id || '',
      hsnCode: item.hsn_code || '',
      gstRate: String(item.gst_rate || 0),
      laborTrade: item.labor_trade || '',
      laborRateType: item.labor_rate_type || 'rate_per_unit',
      laborUnitRate: String(item.labor_unit_rate || 0),
      laborMarkupPercentage: String(item.labor_markup_percentage || 0)
    });
  };

  const handleUpdateItem = async (itemId) => {
    if (!editForm.itemName.trim()) return toast.error('Item name is required');
    
    setItemsLoading(true);
    try {
      const res = await updateBOQItem(projectId, activeQuotation.id, itemId, {
        roomOrArea: editForm.roomOrArea,
        itemName: editForm.itemName.trim(),
        description: editForm.description || null,
        unit: editForm.unit,
        quantity: Number(editForm.quantity),
        unitPrice: Number(editForm.unitPrice),
        markupPercentage: Number(editForm.markupPercentage),
        scopeType: editForm.scopeType,
        changeOrderId: editForm.changeOrderId || null,
        hsnCode: editForm.hsnCode.trim() || null,
        gstRate: Number(editForm.gstRate || 0),
        laborTrade: editForm.laborTrade || null,
        laborRateType: editForm.laborRateType,
        laborUnitRate: Number(editForm.laborUnitRate || 0),
        laborMarkupPercentage: Number(editForm.laborMarkupPercentage || 0)
      });
      if (res.data?.success) {
        toast.success('Item updated');
        setEditingItem(null);
        // Refresh quotation
        const quoteRes = await getQuotation(projectId, activeQuotation.id);
        if (quoteRes.data?.success) {
          setActiveQuotation(quoteRes.data.data);
          setQuotations(quotations.map(q => q.id === activeQuotation.id ? { ...q, total_amount: quoteRes.data.data.total_amount } : q));
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update item');
    } finally {
      setItemsLoading(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    setItemsLoading(true);
    try {
      const res = await deleteBOQItem(projectId, activeQuotation.id, itemId);
      if (res.data?.success) {
        toast.success('Item deleted');
        const quoteRes = await getQuotation(projectId, activeQuotation.id);
        if (quoteRes.data?.success) {
          setActiveQuotation(quoteRes.data.data);
          setQuotations(quotations.map(q => q.id === activeQuotation.id ? { ...q, total_amount: quoteRes.data.data.total_amount } : q));
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete item');
    } finally {
      setItemsLoading(false);
    }
  };

  const handleUpdateGstType = async (newGstType) => {
    setItemsLoading(true);
    try {
      const res = await updateQuotation(projectId, activeQuotation.id, {
        gstType: newGstType
      });
      if (res.data?.success) {
        toast.success(`GST Type updated to ${newGstType === 'igst' ? 'Inter-State (IGST)' : 'Intra-State (CGST + SGST)'}`);
        setActiveQuotation(res.data.data);
        setQuotations(quotations.map(q => q.id === activeQuotation.id ? { 
          ...q, 
          gst_type: res.data.data.gst_type,
          tax_amount: res.data.data.tax_amount,
          total_amount: res.data.data.total_amount,
          cgst_total: res.data.data.cgst_total,
          sgst_total: res.data.data.sgst_total,
          igst_total: res.data.data.igst_total
        } : q));
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update GST Type');
    } finally {
      setItemsLoading(false);
    }
  };

  const handleUpdateTaxTreatment = async (newTreatment) => {
    setItemsLoading(true);
    try {
      const res = await updateQuotation(projectId, activeQuotation.id, {
        taxTreatment: newTreatment
      });
      if (res.data?.success) {
        toast.success(`Tax Treatment updated to ${newTreatment.replace('_', ' ').toUpperCase()}`);
        setActiveQuotation(res.data.data);
        setQuotations(quotations.map(q => q.id === activeQuotation.id ? { 
          ...q, 
          tax_treatment: res.data.data.tax_treatment,
          tax_amount: res.data.data.tax_amount,
          total_amount: res.data.data.total_amount,
          cgst_total: res.data.data.cgst_total,
          sgst_total: res.data.data.sgst_total,
          igst_total: res.data.data.igst_total
        } : q));
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update Tax Treatment');
    } finally {
      setItemsLoading(false);
    }
  };

  const handleUpdateWorksContractRate = async (newRate) => {
    if (isNaN(Number(newRate)) || Number(newRate) < 0) return;
    setItemsLoading(true);
    try {
      const res = await updateQuotation(projectId, activeQuotation.id, {
        worksContractRate: Number(newRate)
      });
      if (res.data?.success) {
        toast.success(`Works Contract GST Rate updated to ${newRate}%`);
        setActiveQuotation(res.data.data);
        setQuotations(quotations.map(q => q.id === activeQuotation.id ? { 
          ...q, 
          works_contract_rate: res.data.data.works_contract_rate,
          tax_amount: res.data.data.tax_amount,
          total_amount: res.data.data.total_amount,
          cgst_total: res.data.data.cgst_total,
          sgst_total: res.data.data.sgst_total,
          igst_total: res.data.data.igst_total
        } : q));
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update Works Contract Rate');
    } finally {
      setItemsLoading(false);
    }
  };

  const handleUpdateWorksContractHsn = async (newHsn) => {
    setItemsLoading(true);
    try {
      const res = await updateQuotation(projectId, activeQuotation.id, {
        worksContractHsn: newHsn
      });
      if (res.data?.success) {
        toast.success(`Works Contract HSN Code updated to ${newHsn}`);
        setActiveQuotation(res.data.data);
        setQuotations(quotations.map(q => q.id === activeQuotation.id ? { 
          ...q, 
          works_contract_hsn: res.data.data.works_contract_hsn
        } : q));
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update Works Contract HSN Code');
    } finally {
      setItemsLoading(false);
    }
  };

  const handleRevise = async (e) => {
    e.preventDefault();
    if (!changeReason.trim()) return toast.error('Change reason is required to create a revision');
    
    setLoading(true);
    try {
      const res = await reviseQuotation(projectId, activeQuotation.id, changeReason.trim());
      if (res.data?.success) {
        toast.success(`Quotation revised to Version ${res.data.data.version}`);
        setShowReviseModal(false);
        setChangeReason('');
        await fetchQuotations(res.data.data.id);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to revise quotation');
    } finally {
      setLoading(false);
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
      const res = await compareQuotations(projectId, compareBaseId, compareTargetId);
      if (res.data?.success) {
        setComparisonResult(res.data.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to compare versions');
      setCompareMode(false);
    } finally {
      setCompareLoading(false);
    }
  };

  const handleSend = async () => {
    setItemsLoading(true);
    try {
      const res = await sendQuotation(projectId, activeQuotation.id);
      if (res.data?.success) {
        toast.success('Quotation status marked as Sent.');
        await fetchQuotations(activeQuotation.id);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to update status to Sent.');
    } finally {
      setItemsLoading(false);
    }
  };

  const handleAccept = async () => {
    setItemsLoading(true);
    try {
      const res = await acceptQuotation(projectId, activeQuotation.id);
      if (res.data?.success) {
        toast.success('Quotation accepted successfully.');
        await fetchQuotations(activeQuotation.id);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to accept quotation.');
    } finally {
      setItemsLoading(false);
    }
  };

  const handleReject = async () => {
    setItemsLoading(true);
    try {
      const res = await rejectQuotation(projectId, activeQuotation.id);
      if (res.data?.success) {
        toast.success('Quotation status marked as Rejected.');
        await fetchQuotations(activeQuotation.id);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to reject quotation.');
    } finally {
      setItemsLoading(false);
    }
  };

  // Helper to group items by room
  const getGroupedItems = (items) => {
    if (!items) return {};
    const grouped = {};
    items.forEach(item => {
      const room = item.room_or_area || 'General';
      if (!grouped[room]) grouped[room] = [];
      grouped[room].push(item);
    });
    return grouped;
  };

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <Spinner size="lg" />
        <p>Loading quotations and BOQ version history...</p>
      </div>
    );
  }

  // Group current active items
  const activeGrouped = activeQuotation ? getGroupedItems(activeQuotation.items) : {};

  return (
    <div className={styles.container}>
      {/* LEFT COLUMN: Version selector & compare triggers */}
      <div className={styles.leftCol}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Versions</h3>
          {quotations.length === 0 && (
            <Button size="sm" variant="primary" onClick={handleCreateInitial}>Initialize</Button>
          )}
        </div>
        
        {quotations.length === 0 ? (
          <p className="text-xs text-gray-500 italic">No quotations initialized for this project yet.</p>
        ) : (
          <div className={styles.versionsList}>
            {quotations.map(q => {
              const isActive = activeQuotation && activeQuotation.id === q.id && !compareMode;
              return (
                <div 
                  key={q.id}
                  className={`${styles.versionCard} ${isActive ? styles.activeCard : ''}`}
                  onClick={() => handleSelectQuotation(q)}
                >
                  <div className={styles.cardHeader}>
                    <span className={styles.versionTitle}>
                      Version {q.version}
                      <Badge variant={
                        q.status === 'accepted' ? 'success' : 
                        q.status === 'draft' ? 'warning' : 
                        q.status === 'revised' ? 'secondary' : 'info'
                      }>
                        {q.status}
                      </Badge>
                    </span>
                    <span className={styles.cardAmount}>
                      ₹{Number(q.total_amount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className={styles.cardMeta}>
                    <span>Created: {new Date(q.created_at).toLocaleDateString('en-IN')}</span>
                    <span>By: {q.creator_name || 'System'}</span>
                  </div>
                  {q.change_reason && (
                    <div className={styles.changeReasonText} title={q.change_reason}>
                      Reason: {q.change_reason}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Compare Control Panel */}
        {quotations.length > 1 && (
          <div className={styles.comparePanel}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Compare Versions</h3>
            </div>
            <div className={styles.compareSelects}>
              <div className={styles.compareSelectRow}>
                <label>Base (Old)</label>
                <select 
                  value={compareBaseId} 
                  onChange={(e) => setCompareBaseId(e.target.value)}
                >
                  <option value="">Select version...</option>
                  {quotations.map(q => (
                    <option key={q.id} value={q.id}>Version {q.version} (₹{Number(q.total_amount).toLocaleString('en-IN')})</option>
                  ))}
                </select>
              </div>
              <div className={styles.compareSelectRow}>
                <label>Target (New)</label>
                <select 
                  value={compareTargetId} 
                  onChange={(e) => setCompareTargetId(e.target.value)}
                >
                  <option value="">Select version...</option>
                  {quotations.map(q => (
                    <option key={q.id} value={q.id}>Version {q.version} (₹{Number(q.total_amount).toLocaleString('en-IN')})</option>
                  ))}
                </select>
              </div>
              <Button 
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

      {/* RIGHT COLUMN: Active Version Viewer / Editor OR Compare visualizer */}
      <div className={styles.rightCol}>
        {compareMode && (
          <div className={styles.detailPanel}>
            {compareLoading ? (
              <div className={styles.loadingState}>
                <Spinner size="lg" />
                <p>Generating item-level version differences...</p>
              </div>
            ) : comparisonResult ? (
              <div>
                <div className={styles.compHeader}>
                  <div>
                    <h3>Version Diff Analysis</h3>
                    <p className="text-xs text-gray-500">
                      Comparing Version {comparisonResult.baseQuotation.version} (Base) vs Version {comparisonResult.targetQuotation.version} (Target)
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setCompareMode(false)}>Exit Comparison</Button>
                </div>

                {/* Summary Info */}
                {(() => {
                  const baseVal = parseFloat(comparisonResult.baseQuotation.total_amount);
                  const targetVal = parseFloat(comparisonResult.targetQuotation.total_amount);
                  const diffVal = targetVal - baseVal;
                  const isIncrease = diffVal >= 0;
                  return (
                    <div className={`${styles.compSummaryBanner} ${!isIncrease ? styles.compSummaryBannerRed : ''}`}>
                      <div className={styles.compSummaryText}>
                        Contract Value Impact: {isIncrease ? 'Increase' : 'Decrease'} of ₹{Math.abs(diffVal).toLocaleString('en-IN')}
                      </div>
                      <div className="text-sm">
                        Original: ₹{baseVal.toLocaleString('en-IN')} &rarr; Current: ₹{targetVal.toLocaleString('en-IN')}
                      </div>
                    </div>
                  );
                })()}

                {comparisonResult.targetQuotation.change_reason && (
                  <div className={styles.compReasonBox}>
                    <strong>Reason for Change (Version {comparisonResult.targetQuotation.version}):</strong>
                    <p className="mt-1 m-0 text-gray-700 italic">"{comparisonResult.targetQuotation.change_reason}"</p>
                    <p className="text-[10px] text-gray-400 mt-1">Revised by {comparisonResult.targetQuotation.creator_name} on {new Date(comparisonResult.targetQuotation.created_at).toLocaleString('en-IN')}</p>
                  </div>
                )}

                {/* Diff table */}
                <div className={styles.boqTableContainer}>
                  <table className={styles.boqTable}>
                    <thead>
                      <tr>
                        <th style={{ width: '120px' }}>Diff Status</th>
                        <th>Room / Area</th>
                        <th>Item Details</th>
                        <th style={{ width: '90px', textAlign: 'right' }}>Base Amount</th>
                        <th style={{ width: '90px', textAlign: 'right' }}>Target Amount</th>
                        <th>Change Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonResult.diffs.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="text-center py-6 text-gray-500 italic">No differences detected between these versions.</td>
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
                                {isUnchanged && <span className="text-xs text-gray-400">No Change</span>}
                              </td>
                              <td className="font-medium">{diff.room_or_area}</td>
                              <td>
                                <div><strong>{diff.item_name}</strong></div>
                                {item.description && <div className="text-xs text-gray-500">{item.description}</div>}
                                {item.brand && <div className="text-[10px] text-gray-400">Brand: {item.brand}</div>}
                              </td>
                              <td className="text-right font-medium">
                                {diff.base_item ? `₹${Number(diff.base_item.total_price).toLocaleString('en-IN')}` : '—'}
                              </td>
                              <td className="text-right font-medium">
                                {diff.target_item ? `₹${Number(diff.target_item.total_price).toLocaleString('en-IN')}` : '—'}
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
                                      <span>Rate: ₹{Number(diff.changes.unit_price.old).toLocaleString('en-IN')} &rarr; ₹{Number(diff.changes.unit_price.new).toLocaleString('en-IN')}</span>
                                    )}
                                    {diff.changes.hsn_code && (
                                      <span>HSN: "{diff.changes.hsn_code.old || 'N/A'}" &rarr; "{diff.changes.hsn_code.new || 'N/A'}"</span>
                                    )}
                                    {diff.changes.gst_rate && (
                                      <span>GST: {Number(diff.changes.gst_rate.old || 0)}% &rarr; {Number(diff.changes.gst_rate.new || 0)}%</span>
                                    )}
                                  </div>
                                )}
                                {isAdded && (
                                  <span className="text-xs text-green-700">
                                    Qty {Number(item.quantity)} @ ₹{Number(item.unit_price).toLocaleString('en-IN')}/{item.unit || 'Unit'}
                                  </span>
                                )}
                                {isRemoved && (
                                  <span className="text-xs text-red-700">
                                    Was Qty {Number(item.quantity)} @ ₹{Number(item.unit_price).toLocaleString('en-IN')}
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
              <EmptyState title="No comparison result" />
            )}
          </div>
        )}

        {!compareMode && activeQuotation && (
          <div className={styles.detailPanel}>
            {/* Active Header */}
            <div className={styles.detailHeader}>
              <div className={styles.detailMeta}>
                <h3>Quotation Number: {activeQuotation.quotation_number}</h3>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '4px' }}>
                  <span className="text-xs text-gray-500">
                    Version {activeQuotation.version} &bull; Status: <strong className="text-capitalize">{activeQuotation.status}</strong>
                  </span>
                  {activeQuotation.status === 'draft' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="text-xs text-gray-500 font-medium">GST Type:</span>
                        <select
                          style={{ fontSize: '12px', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '2px 8px', backgroundColor: 'white', cursor: 'pointer' }}
                          value={activeQuotation.gst_type || 'cgst_sgst'}
                          onChange={(e) => handleUpdateGstType(e.target.value)}
                        >
                          <option value="cgst_sgst">Intra-State (CGST + SGST)</option>
                          <option value="igst">Inter-State (IGST)</option>
                        </select>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="text-xs text-gray-500 font-medium">Tax Treatment:</span>
                        <select
                          style={{ fontSize: '12px', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '2px 8px', backgroundColor: 'white', cursor: 'pointer' }}
                          value={activeQuotation.tax_treatment || 'itemized'}
                          onChange={(e) => handleUpdateTaxTreatment(e.target.value)}
                        >
                          <option value="itemized">Itemized Supply</option>
                          <option value="works_contract">Works Contract</option>
                          <option value="composite_supply">Composite Supply</option>
                        </select>
                      </div>

                      {(activeQuotation.tax_treatment === 'works_contract' || activeQuotation.tax_treatment === 'composite_supply') && (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span className="text-xs text-gray-500 font-medium">GST Rate (%):</span>
                            <input
                              type="number"
                              style={{ width: '65px', fontSize: '12px', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '2px 8px' }}
                              value={activeQuotation.works_contract_rate || 18.00}
                              onChange={(e) => handleUpdateWorksContractRate(e.target.value)}
                              step="0.01"
                              min="0"
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span className="text-xs text-gray-500 font-medium">HSN/SAC:</span>
                            <input
                              type="text"
                              style={{ width: '80px', fontSize: '12px', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '2px 8px' }}
                              value={activeQuotation.works_contract_hsn || '9954'}
                              onChange={(e) => handleUpdateWorksContractHsn(e.target.value)}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-500">
                      &bull; GST Type: <strong>{activeQuotation.gst_type === 'igst' ? 'Inter-State (IGST)' : 'Intra-State (CGST + SGST)'}</strong>
                      &bull; Tax Treatment: <strong className="text-uppercase">{activeQuotation.tax_treatment ? activeQuotation.tax_treatment.replace('_', ' ') : 'ITEMIZED'}</strong>
                      {(activeQuotation.tax_treatment === 'works_contract' || activeQuotation.tax_treatment === 'composite_supply') && (
                        <>
                          &bull; GST Rate: <strong>{activeQuotation.works_contract_rate || 18.00}%</strong>
                          &bull; HSN/SAC: <strong>{activeQuotation.works_contract_hsn || '9954'}</strong>
                        </>
                      )}
                    </span>
                  )}
                </div>
              </div>
              <div className={styles.detailActions}>
                {activeQuotation.status === 'draft' && (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setEditMode(!editMode)}
                    >
                      {editMode ? 'Finish Editing' : 'Edit BOQ Items'}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleSend}
                    >
                      Mark as Sent
                    </Button>
                  </>
                )}
                {activeQuotation.status === 'sent' && (
                  <>
                    <Button 
                      variant="primary" 
                      size="sm" 
                      onClick={handleAccept}
                    >
                      Client Accept
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleReject}
                      style={{ color: 'red', borderColor: 'red' }}
                    >
                      Reject
                    </Button>
                  </>
                )}
                <Button 
                  variant="primary" 
                  size="sm" 
                  onClick={() => setShowReviseModal(true)}
                >
                  Revise (New Version)
                </Button>
              </div>
            </div>

            {/* Confirmation Banner if exists */}
            {activeQuotation.accepted_at && (
              <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded text-xs text-green-700 italic" style={{ marginTop: '8px', marginBottom: '8px' }}>
                <strong>Client Approved On:</strong> {new Date(activeQuotation.accepted_at).toLocaleString('en-IN')}
              </div>
            )}

            {/* Change Reason Banner if exists */}
            {activeQuotation.change_reason && (
              <div className="bg-gray-50 border-l-4 border-blue-500 p-3 rounded text-xs text-gray-700 italic">
                <strong>Revision Reason:</strong> "{activeQuotation.change_reason}"
              </div>
            )}

            {/* BOQ Items Listing */}
            {itemsLoading ? (
              <div className={styles.loadingState}>
                <Spinner />
                <p>Loading BOQ items...</p>
              </div>
            ) : Object.keys(activeGrouped).length === 0 ? (
              <div className={styles.emptyState}>
                <p className="text-sm text-gray-500 italic">This version has no items in the Bill of Quantities yet.</p>
                {activeQuotation.status === 'draft' && (
                  <Button 
                    variant="primary" 
                    size="sm" 
                    className="mt-3"
                    onClick={() => setShowAddItem(true)}
                  >
                    + Add First BOQ Item
                  </Button>
                )}
              </div>
            ) : (
              <div className={styles.boqTableContainer}>
                <table className={styles.boqTable}>
                  <thead>
                    <tr>
                      <th>Room / Area &amp; Items</th>
                      <th style={{ width: '80px' }}>Unit</th>
                      <th style={{ width: '80px', textAlign: 'right' }}>Qty</th>
                      <th style={{ width: '120px', textAlign: 'right' }}>Rate (₹)</th>
                      <th style={{ width: '100px', textAlign: 'right' }}>Markup %</th>
                      <th style={{ width: '120px', textAlign: 'right' }}>Total (₹)</th>
                      {editMode && <th style={{ width: '100px' }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(activeGrouped).map(([room, items]) => (
                      <React.Fragment key={room}>
                        {/* Group Header */}
                        <tr className={styles.roomRow}>
                          <td colSpan={editMode ? 7 : 6}>{room}</td>
                        </tr>
                        {/* Items */}
                        {items.map(item => {
                          const isItemEditing = editingItem === item.id;
                          const isComposite = activeQuotation.tax_treatment === 'works_contract' || activeQuotation.tax_treatment === 'composite_supply';
                          const displayedGstRate = isComposite ? (activeQuotation.works_contract_rate || 18.00) : (item.gst_rate || 0);
                          const displayedHsn = isComposite ? (activeQuotation.works_contract_hsn || '9954') : item.hsn_code;
                          return (
                            <tr key={item.id}>
                              <td>
                                {isItemEditing ? (
                                  <div className="flex flex-col gap-2">
                                    <input 
                                      type="text" 
                                      className={styles.itemInput} 
                                      value={editForm.itemName}
                                      onChange={(e) => setEditForm({ ...editForm, itemName: e.target.value })}
                                      placeholder="Item Name"
                                    />
                                    <textarea 
                                      className={styles.itemInput} 
                                      value={editForm.description}
                                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                      placeholder="Description / Specs"
                                    />
                                    <input 
                                      type="text" 
                                      className={styles.itemInput} 
                                      value={editForm.roomOrArea}
                                      onChange={(e) => setEditForm({ ...editForm, roomOrArea: e.target.value })}
                                      placeholder="Room/Area Name"
                                    />
                                    {(!activeQuotation.tax_treatment || activeQuotation.tax_treatment === 'itemized') && (
                                      <div style={{ display: 'flex', gap: '8px' }}>
                                        <div style={{ flex: 1 }}>
                                          <label style={{ fontSize: '10px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '2px' }}>HSN Code</label>
                                          <input 
                                            type="text" 
                                            className={styles.itemInput} 
                                            value={editForm.hsnCode}
                                            onChange={(e) => setEditForm({ ...editForm, hsnCode: e.target.value })}
                                            placeholder="HSN Code"
                                          />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                          <label style={{ fontSize: '10px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '2px' }}>GST Rate (%)</label>
                                          <input 
                                            type="number" 
                                            className={styles.itemInput} 
                                            value={editForm.gstRate}
                                            onChange={(e) => setEditForm({ ...editForm, gstRate: e.target.value })}
                                            placeholder="GST Rate"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                          />
                                        </div>
                                      </div>
                                    )}
                                    <div className="flex gap-2">
                                      <div style={{ flex: 1 }}>
                                        <label style={{ fontSize: '10px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '2px' }}>Scope Type</label>
                                        <select
                                          className={styles.itemInput}
                                          value={editForm.scopeType}
                                          onChange={(e) => setEditForm({ ...editForm, scopeType: e.target.value, changeOrderId: e.target.value === 'original' ? '' : editForm.changeOrderId })}
                                        >
                                          <option value="original">Original Scope</option>
                                          <option value="addition">Scope Addition</option>
                                          <option value="reduction">Scope Reduction</option>
                                        </select>
                                      </div>
                                      <div style={{ flex: 1 }}>
                                        <label style={{ fontSize: '10px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '2px' }}>Change Order</label>
                                        <select
                                          className={styles.itemInput}
                                          value={editForm.changeOrderId}
                                          onChange={(e) => setEditForm({ ...editForm, changeOrderId: e.target.value })}
                                          disabled={editForm.scopeType === 'original'}
                                        >
                                          <option value="">Select CO...</option>
                                          {changeOrders.map(co => (
                                            <option key={co.id} value={co.id}>{co.title} ({co.status})</option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', borderTop: '1px dashed var(--color-border)', paddingTop: '8px' }}>
                                      <div style={{ flex: 1 }}>
                                        <label style={{ fontSize: '10px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '2px' }}>Labor Trade</label>
                                        <select
                                          className={styles.itemInput}
                                          value={editForm.laborTrade || ''}
                                          onChange={(e) => setEditForm({ ...editForm, laborTrade: e.target.value })}
                                        >
                                          <option value="">No Labor Cost</option>
                                          <option value="Carpentry">Carpentry</option>
                                          <option value="Electrical">Electrical</option>
                                          <option value="Plumbing">Plumbing</option>
                                          <option value="Painting">Painting</option>
                                          <option value="Civil">Civil / Masonry</option>
                                          <option value="Demolition">Demolition</option>
                                          <option value="Other">Other Trade</option>
                                        </select>
                                      </div>
                                      {editForm.laborTrade && (
                                        <>
                                          <div style={{ flex: 1 }}>
                                            <label style={{ fontSize: '10px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '2px' }}>Rate Type</label>
                                            <select
                                              className={styles.itemInput}
                                              value={editForm.laborRateType || 'rate_per_unit'}
                                              onChange={(e) => setEditForm({ ...editForm, laborRateType: e.target.value })}
                                            >
                                              <option value="rate_per_unit">Rate per Unit</option>
                                              <option value="lump_sum">Lump Sum</option>
                                            </select>
                                          </div>
                                          <div style={{ flex: 1 }}>
                                            <label style={{ fontSize: '10px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '2px' }}>Labor Rate (₹)</label>
                                            <input 
                                              type="number" 
                                              className={styles.itemInput} 
                                              value={editForm.laborUnitRate} 
                                              onChange={(e) => setEditForm({ ...editForm, laborUnitRate: e.target.value })}
                                            />
                                          </div>
                                          <div style={{ flex: 1 }}>
                                            <label style={{ fontSize: '10px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '2px' }}>Labor Markup %</label>
                                            <input 
                                              type="number" 
                                              className={styles.itemInput} 
                                              value={editForm.laborMarkupPercentage} 
                                              onChange={(e) => setEditForm({ ...editForm, laborMarkupPercentage: e.target.value })}
                                            />
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <strong>{item.item_name}</strong>
                                    {item.description && <div className="text-xs text-gray-500 mt-1">{item.description}</div>}
                                    {item.brand && <div className="text-[10px] text-gray-400 mt-0.5">Brand: {item.brand}</div>}
                                    <div className="flex gap-2 items-center mt-1" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                      {item.scope_type === 'addition' && <span style={{ fontSize: '10px', background: '#dcfce7', color: '#166534', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>Scope Addition</span>}
                                      {item.scope_type === 'reduction' && <span style={{ fontSize: '10px', background: '#fee2e2', color: '#991b1b', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>Scope Reduction</span>}
                                      {item.scope_type === 'original' && <span style={{ fontSize: '10px', background: '#f3f4f6', color: '#374151', padding: '1px 6px', borderRadius: '4px' }}>Original Scope</span>}
                                      {displayedHsn && <span style={{ fontSize: '10px', background: '#eff6ff', color: '#1e40af', padding: '1px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>HSN: {displayedHsn}</span>}
                                      <span style={{ fontSize: '10px', background: '#f3f4f6', color: '#4b5563', padding: '1px 6px', borderRadius: '4px' }}>GST: {Number(displayedGstRate)}%</span>
                                      {item.change_order_title && (
                                        <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>
                                          Authorized by: <strong>{item.change_order_title}</strong>
                                        </span>
                                      )}
                                    </div>
                                    {item.labor_trade && (
                                       <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                                         <span style={{ fontSize: '10px', background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: '4px', fontWeight: '500' }}>
                                           Labor: {item.labor_trade.toUpperCase()}
                                         </span>
                                         <span style={{ fontSize: '10px', color: '#6b7280' }}>
                                           {item.labor_rate_type === 'lump_sum' 
                                             ? `Lump Sum: ₹${Number(item.labor_unit_rate).toLocaleString('en-IN')}`
                                             : `${Number(item.quantity)} unit × ₹${Number(item.labor_unit_rate).toLocaleString('en-IN')}/unit`}
                                           {Number(item.labor_markup_percentage || 0) > 0 && ` (+${item.labor_markup_percentage}% markup)`}
                                           {` = ₹${Number(item.labor_total_price).toLocaleString('en-IN')}`}
                                         </span>
                                       </div>
                                     )}
                                  </div>
                                )}
                              </td>
                              <td>
                                {isItemEditing ? (
                                  <input 
                                    type="text" 
                                    className={styles.itemInput} 
                                    value={editForm.unit} 
                                    onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                                  />
                                ) : (
                                  item.unit || 'SqFt'
                                )}
                              </td>
                              <td className="text-right">
                                {isItemEditing ? (
                                  <input 
                                    type="number" 
                                    className={styles.itemInput} 
                                    value={editForm.quantity} 
                                    onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                                  />
                                ) : (
                                  Number(item.quantity)
                                )}
                              </td>
                              <td className="text-right font-medium">
                                {isItemEditing ? (
                                  <input 
                                    type="number" 
                                    className={styles.itemInput} 
                                    value={editForm.unitPrice} 
                                    onChange={(e) => setEditForm({ ...editForm, unitPrice: e.target.value })}
                                  />
                                ) : (
                                  `₹${Number(item.unit_price).toLocaleString('en-IN')}`
                                )}
                              </td>
                              <td className="text-right">
                                {isItemEditing ? (
                                  <input 
                                    type="number" 
                                    className={styles.itemInput} 
                                    value={editForm.markupPercentage} 
                                    onChange={(e) => setEditForm({ ...editForm, markupPercentage: e.target.value })}
                                  />
                                ) : (
                                  `${Number(item.markup_percentage || 0)}%`
                                )}
                              </td>
                              <td className="text-right font-bold" style={{ verticalAlign: 'top' }}>
                                <div>{item.scope_type === 'reduction' ? '-' : ''}₹{Number(Number(item.total_price || 0) + Number(item.labor_total_price || 0)).toLocaleString('en-IN')}</div>
                                {Number(item.labor_total_price || 0) > 0 && (
                                  <div style={{ fontSize: '9px', color: '#6b7280', fontWeight: 'normal', marginTop: '2px' }}>
                                    (Mat: ₹{Number(item.total_price || 0).toLocaleString('en-IN')}, Lab: ₹{Number(item.labor_total_price || 0).toLocaleString('en-IN')})
                                  </div>
                                )}
                                {activeQuotation.gst_type === 'cgst_sgst' ? (
                                  <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: 'normal', marginTop: '4px', lineHeight: '1.2' }}>
                                    CGST ({Number(displayedGstRate) / 2}%): {item.scope_type === 'reduction' ? '-' : ''}₹{Number(item.cgst_amount || 0).toLocaleString('en-IN')}<br />
                                    SGST ({Number(displayedGstRate) / 2}%): {item.scope_type === 'reduction' ? '-' : ''}₹{Number(item.sgst_amount || 0).toLocaleString('en-IN')}
                                  </div>
                                ) : (
                                  <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: 'normal', marginTop: '4px', lineHeight: '1.2' }}>
                                    IGST ({Number(displayedGstRate)}%): {item.scope_type === 'reduction' ? '-' : ''}₹{Number(item.igst_amount || 0).toLocaleString('en-IN')}
                                  </div>
                                )}
                              </td>
                              {editMode && (
                                <td>
                                  {isItemEditing ? (
                                    <div className="flex gap-1">
                                      <Button size="xs" variant="primary" onClick={() => handleUpdateItem(item.id)}>Save</Button>
                                      <Button size="xs" variant="outline" onClick={() => setEditingItem(null)}>Cancel</Button>
                                    </div>
                                  ) : (
                                    <div className="flex gap-1">
                                      <Button size="xs" variant="outline" onClick={() => startEditing(item)}>Edit</Button>
                                      <Button size="xs" variant="outline" style={{ color: 'red', borderColor: 'red' }} onClick={() => handleDeleteItem(item.id)}>Delete</Button>
                                    </div>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totals Card */}
            {activeQuotation.items && activeQuotation.items.length > 0 && (
              <div className={styles.totalsCard}>
                {Number(activeQuotation.labor_subtotal || 0) > 0 && (
                  <>
                    <div className={styles.totalsRow} style={{ color: '#4b5563', fontSize: '12px' }}>
                      <span>Material Subtotal:</span>
                      <span>₹{Number(activeQuotation.material_subtotal || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className={styles.totalsRow} style={{ color: '#4b5563', fontSize: '12px' }}>
                      <span>Labor Subtotal:</span>
                      <span>₹{Number(activeQuotation.labor_subtotal || 0).toLocaleString('en-IN')}</span>
                    </div>
                  </>
                )}
                <div className={styles.totalsRow} style={{ fontWeight: 600 }}>
                  <span>Subtotal:</span>
                  <span>₹{Number(activeQuotation.subtotal || 0).toLocaleString('en-IN')}</span>
                </div>
                {activeQuotation.gst_type === 'cgst_sgst' ? (
                  <>
                    <div className={styles.totalsRow}>
                      <span>CGST Total:</span>
                      <span>₹{Number(activeQuotation.cgst_total || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className={styles.totalsRow}>
                      <span>SGST Total:</span>
                      <span>₹{Number(activeQuotation.sgst_total || 0).toLocaleString('en-IN')}</span>
                    </div>
                  </>
                ) : (
                  <div className={styles.totalsRow}>
                    <span>IGST Total:</span>
                    <span>₹{Number(activeQuotation.igst_total || 0).toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className={styles.totalsRow} style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
                  <span>Total GST Tax:</span>
                  <span>₹{Number(activeQuotation.tax_amount || 0).toLocaleString('en-IN')}</span>
                </div>
                
                {/* Discount field */}
                {activeQuotation.status === 'draft' ? (
                  <div className={styles.totalsRow} style={{ alignItems: 'center' }}>
                    <span>Discount (₹):</span>
                    <input
                      type="number"
                      className={styles.discountInput}
                      value={activeQuotation.discount_amount || 0}
                      onChange={async (e) => {
                        const val = parseFloat(e.target.value || 0);
                        try {
                          const res = await updateQuotation(projectId, activeQuotation.id, {
                            discountAmount: val
                          });
                          if (res.data?.success) {
                            setActiveQuotation(res.data.data);
                            setQuotations(quotations.map(q => q.id === activeQuotation.id ? { 
                              ...q, 
                              discount_amount: res.data.data.discount_amount,
                              total_amount: res.data.data.total_amount 
                            } : q));
                          }
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                      min="0"
                      step="1"
                    />
                  </div>
                ) : (
                  Number(activeQuotation.discount_amount || 0) > 0 && (
                    <div className={styles.totalsRow}>
                      <span>Discount:</span>
                      <span>-₹{Number(activeQuotation.discount_amount).toLocaleString('en-IN')}</span>
                    </div>
                  )
                )}

                <div className={`${styles.totalsRow} ${styles.grandTotal}`}>
                  <span>Grand Total:</span>
                  <span>₹{Number(activeQuotation.total_amount || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            )}

            {/* inline Add Item Button/Form */}
            {editMode && !showAddItem && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowAddItem(true)}
                style={{ borderStyle: 'dashed', alignSelf: 'center', width: '200px', marginTop: '16px' }}
              >
                + Add BOQ Item
              </Button>
            )}

            {showAddItem && (
              <form onSubmit={handleAddItem} className={styles.addItemBox}>
                <h4 className="font-semibold text-xs text-gray-700 m-0">Add BOQ Item</h4>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Room or Area</label>
                    <input 
                      type="text" 
                      className={styles.itemInput} 
                      value={newItem.roomOrArea}
                      onChange={(e) => setNewItem({ ...newItem, roomOrArea: e.target.value })}
                      placeholder="e.g. Master Bedroom"
                      required
                    />
                  </div>
                  {(!activeQuotation.tax_treatment || activeQuotation.tax_treatment === 'itemized') && (
                    <>
                      <div className={styles.formGroup}>
                        <label>HSN Code</label>
                        <input 
                          type="text" 
                          className={styles.itemInput} 
                          value={newItem.hsnCode || ''}
                          onChange={(e) => setNewItem({ ...newItem, hsnCode: e.target.value })}
                          placeholder="e.g. 9954"
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label>GST Rate (%)</label>
                        <input 
                          type="number" 
                          className={styles.itemInput} 
                          value={newItem.gstRate || ''}
                          onChange={(e) => setNewItem({ ...newItem, gstRate: e.target.value })}
                          placeholder="e.g. 18"
                          min="0"
                          max="100"
                          step="0.01"
                        />
                      </div>
                    </>
                  )}
                  <div className={styles.formGroup}>
                    <label>Item Name</label>
                    <input 
                      type="text" 
                      className={styles.itemInput} 
                      value={newItem.itemName}
                      onChange={(e) => setNewItem({ ...newItem, itemName: e.target.value })}
                      placeholder="e.g. Modular Wardrobe"
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Unit</label>
                    <input 
                      type="text" 
                      className={styles.itemInput} 
                      value={newItem.unit}
                      onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                      placeholder="e.g. SqFt, Nos"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Quantity</label>
                    <input 
                      type="number" 
                      className={styles.itemInput} 
                      value={newItem.quantity}
                      onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                      min="0.01"
                      step="0.01"
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Unit Price (₹)</label>
                    <input 
                      type="number" 
                      className={styles.itemInput} 
                      value={newItem.unitPrice}
                      onChange={(e) => setNewItem({ ...newItem, unitPrice: e.target.value })}
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Scope Type</label>
                    <select 
                      className={styles.itemInput} 
                      value={newItem.scopeType}
                      onChange={(e) => setNewItem({ ...newItem, scopeType: e.target.value, changeOrderId: e.target.value === 'original' ? '' : newItem.changeOrderId })}
                    >
                      <option value="original">Original Scope</option>
                      <option value="addition">Scope Addition</option>
                      <option value="reduction">Scope Reduction</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Authorized Change Order</label>
                    <select 
                      className={styles.itemInput} 
                      value={newItem.changeOrderId}
                      onChange={(e) => setNewItem({ ...newItem, changeOrderId: e.target.value })}
                      disabled={newItem.scopeType === 'original'}
                    >
                      <option value="">No Change Order (Base)</option>
                      {changeOrders.map(co => (
                        <option key={co.id} value={co.id}>{co.title} ({co.status})</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label>Material Specifications & Description</label>
                  <textarea 
                    className={styles.itemInput} 
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                    placeholder="Describe material grades, thickness, finish details etc."
                  />
                </div>
                <div style={{ marginTop: '12px', borderTop: '1px dashed var(--color-border)', paddingTop: '12px', width: '100%' }}>
                  <h5 className="font-semibold text-xs text-gray-600 mb-2">Labor Cost Estimation</h5>
                  <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                      <label>Labor Trade</label>
                      <select
                        className={styles.itemInput}
                        value={newItem.laborTrade || ''}
                        onChange={(e) => setNewItem({ ...newItem, laborTrade: e.target.value })}
                      >
                        <option value="">No Labor Cost</option>
                        <option value="Carpentry">Carpentry</option>
                        <option value="Electrical">Electrical</option>
                        <option value="Plumbing">Plumbing</option>
                        <option value="Painting">Painting</option>
                        <option value="Civil">Civil / Masonry</option>
                        <option value="Demolition">Demolition</option>
                        <option value="Other">Other Trade</option>
                      </select>
                    </div>
                    {newItem.laborTrade && (
                      <>
                        <div className={styles.formGroup}>
                          <label>Rate Type</label>
                          <select
                            className={styles.itemInput}
                            value={newItem.laborRateType || 'rate_per_unit'}
                            onChange={(e) => setNewItem({ ...newItem, laborRateType: e.target.value })}
                          >
                            <option value="rate_per_unit">Rate per Unit</option>
                            <option value="lump_sum">Lump Sum</option>
                          </select>
                        </div>
                        <div className={styles.formGroup}>
                          <label>Labor Rate (₹)</label>
                          <input 
                            type="number" 
                            className={styles.itemInput} 
                            value={newItem.laborUnitRate} 
                            onChange={(e) => setNewItem({ ...newItem, laborUnitRate: e.target.value })}
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label>Labor Markup %</label>
                          <input 
                            type="number" 
                            className={styles.itemInput} 
                            value={newItem.laborMarkupPercentage} 
                            onChange={(e) => setNewItem({ ...newItem, laborMarkupPercentage: e.target.value })}
                            min="0"
                            step="1"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowAddItem(false)}>Cancel</Button>
                  <Button type="submit" variant="primary" size="sm">Add to BOQ</Button>
                </div>
              </form>
            )}
          </div>
        )}

        {!activeQuotation && !compareMode && (
          <div className={styles.detailPanel}>
            <EmptyState 
              title="No Quotations" 
              description="No BOQ quotations have been generated for this project yet. Click below to initialize the first version."
            >
              <Button variant="primary" onClick={handleCreateInitial}>Initialize First Quotation</Button>
            </EmptyState>
          </div>
        )}
      </div>

      {/* Revise Modal popup */}
      {showReviseModal && (
        <Modal 
          isOpen={showReviseModal} 
          onClose={() => setShowReviseModal(false)}
          title="Create New BOQ Revision"
        >
          <form onSubmit={handleRevise} className={styles.modalForm}>
            <p className="text-xs text-gray-500">
              Creating a revision freezes Version {activeQuotation.version} and initializes Version {activeQuotation.version + 1} as a draft copy where you can make further edits.
            </p>
            <div className={styles.formGroup}>
              <label>Reason for Revision / Change *</label>
              <Textarea 
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="Explain what is changing and why (e.g., Client requested laminate finish instead of veneer; added living room sideboard)."
                rows={3}
                required
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="outline" onClick={() => setShowReviseModal(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Create Draft Revision</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
