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
  compareQuotations
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
  
  // Add item state
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({
    roomOrArea: '',
    itemName: '',
    description: '',
    unit: 'SqFt',
    quantity: '1',
    unitPrice: '0',
    markupPercentage: '0'
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
    }
  }, [projectId]);

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
        sortOrder: activeQuotation.items ? activeQuotation.items.length : 0
      });
      if (res.data?.success) {
        toast.success('Item added to BOQ');
        setNewItem({
          roomOrArea: newItem.roomOrArea, // keep room for quick adding
          itemName: '',
          description: '',
          unit: 'SqFt',
          quantity: '1',
          unitPrice: '0',
          markupPercentage: '0'
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
      markupPercentage: String(item.markup_percentage)
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
        markupPercentage: Number(editForm.markupPercentage)
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
                <p>
                  Version {activeQuotation.version} &bull; Status: <strong className="text-capitalize">{activeQuotation.status}</strong> &bull; Subtotal: ₹{Number(activeQuotation.subtotal).toLocaleString('en-IN')}
                </p>
              </div>
              <div className={styles.detailActions}>
                {activeQuotation.status === 'draft' && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setEditMode(!editMode)}
                  >
                    {editMode ? 'Finish Editing' : 'Edit BOQ Items'}
                  </Button>
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
                                  </div>
                                ) : (
                                  <div>
                                    <strong>{item.item_name}</strong>
                                    {item.description && <div className="text-xs text-gray-500 mt-1">{item.description}</div>}
                                    {item.brand && <div className="text-[10px] text-gray-400 mt-0.5">Brand: {item.brand}</div>}
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
                              <td className="text-right font-bold">
                                ₹{Number(item.total_price).toLocaleString('en-IN')}
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
                    <label>Markup %</label>
                    <input 
                      type="number" 
                      className={styles.itemInput} 
                      value={newItem.markupPercentage}
                      onChange={(e) => setNewItem({ ...newItem, markupPercentage: e.target.value })}
                      min="0"
                      step="0.01"
                    />
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
