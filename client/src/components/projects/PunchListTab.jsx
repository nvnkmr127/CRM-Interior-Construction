/* eslint-disable no-unused-vars, react-hooks/immutability, react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import styles from './PunchListTab.module.css';
import { Badge, Button, Input, Select, Card } from '../ui';
import { useToast } from '../../store/toastContext';
import api from '../../api/axios';

import { useConfirm } from '../../store/confirmContext';

const TRADES = [
  { value: 'carpentry', label: 'Carpentry' },
  { value: 'painting', label: 'Painting' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'flooring', label: 'Flooring' },
  { value: 'civil', label: 'Civil Work' },
  { value: 'false_ceiling', label: 'False Ceiling' },
  { value: 'glass', label: 'Glass Work' },
  { value: 'soft_furnishing', label: 'Soft Furnishing' }
];

export default function PunchListTab({ projectId, projectStatus }) {
  const { confirm } = useConfirm();

  const [punchLists, setPunchLists] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [teamUsers, setTeamUsers] = useState([]);
  
  // Modals / Form states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');

  const [showItemModal, setShowItemModal] = useState(false);
  const [itemRoom, setItemRoom] = useState('');
  const [itemTrade, setItemTrade] = useState('carpentry');
  const [itemDesc, setItemDesc] = useState('');
  const [itemAssignee, setItemAssignee] = useState('');

  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveTargetId, setResolveTargetId] = useState(null);
  const [qcNotes, setQcNotes] = useState('');

  const toast = useToast();

  useEffect(() => {
    if (!projectId) return;
    loadPunchLists();
    
    // Load team users for assignee dropdown
    api.get('/users')
      .then(res => setTeamUsers(res.data?.data || res.data || []))
      .catch(() => {});
  }, [projectId]);

  const loadPunchLists = async (selectId = null) => {
    setLoading(true);
    try {
      const res = await api.get(`/projects/${projectId}/punch-lists`);
      const lists = res.data?.data || [];
      setPunchLists(lists);
      
      if (lists.length > 0) {
        const toSelect = selectId 
          ? lists.find(l => l.id === selectId) 
          : lists[0];
        
        if (toSelect) {
          loadSingleList(toSelect.id);
        } else {
          loadSingleList(lists[0].id);
        }
      } else {
        setSelectedList(null);
        setLoading(false);
      }
    } catch {
      toast.error('Failed to load punch lists');
      setLoading(false);
    }
  };

  const loadSingleList = async (id) => {
    try {
      const res = await api.get(`/projects/${projectId}/punch-lists/${id}`);
      setSelectedList(res.data?.data || null);
    } catch {
      toast.error('Failed to load walkthrough items');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateList = async (e) => {
    e.preventDefault();
    if (projectStatus === 'completed') {
      toast.warning('Cannot create walkthroughs on a completed project.');
      return;
    }
    if (!newTitle.trim()) return toast.error('Walkthrough title is required');
    try {
      const res = await api.post(`/projects/${projectId}/punch-lists`, {
        title: newTitle.trim(),
        walkthrough_date: newDate || null
      });
      toast.success('Walkthrough checklist created');
      setNewTitle('');
      setNewDate('');
      setShowCreateModal(false);
      loadPunchLists(res.data?.data?.id);
    } catch {
      toast.error('Failed to create walkthrough');
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (projectStatus === 'completed') {
      toast.warning('Cannot add items on a completed project.');
      return;
    }
    if (!itemRoom.trim()) return toast.error('Room/Area is required');
    if (!itemDesc.trim()) return toast.error('Defect description is required');
    
    try {
      await api.post(`/projects/${projectId}/punch-lists/${selectedList.id}/items`, {
        room_name: itemRoom.trim(),
        trade: itemTrade,
        item_description: itemDesc.trim(),
        assignee_id: itemAssignee || null
      });
      toast.success('Walkthrough item added successfully');
      setItemRoom('');
      setItemDesc('');
      setItemAssignee('');
      setShowItemModal(false);
      loadSingleList(selectedList.id);
    } catch {
      toast.error('Failed to add walkthrough item');
    }
  };

  const openResolveModal = (itemId) => {
    setResolveTargetId(itemId);
    setQcNotes('');
    setShowResolveModal(true);
  };

  const handleResolveItem = async (e) => {
    e.preventDefault();
    if (projectStatus === 'completed') {
      toast.warning('Cannot resolve items on a completed project.');
      return;
    }
    if (!qcNotes.trim()) return toast.error('QC Notes are required to resolve/sign-off');

    try {
      await api.patch(`/projects/${projectId}/punch-lists/${selectedList.id}/items/${resolveTargetId}`, {
        status: 'resolved',
        qc_notes: qcNotes.trim()
      });
      toast.success('Punch item resolved and signed off by QC');
      setShowResolveModal(false);
      setResolveTargetId(null);
      setQcNotes('');
      
      // Reload details to update status
      loadSingleList(selectedList.id);
      
      // Optionally reload summary list to show updated counts/status
      const currentListId = selectedList.id;
      api.get(`/projects/${projectId}/punch-lists`).then(res => {
        setPunchLists(res.data?.data || []);
      });
    } catch {
      toast.error('Failed to resolve punch item');
    }
  };

  const handleVerifyItem = async (itemId) => {
    if (projectStatus === 'completed') {
      toast.warning('Cannot verify items on a completed project.');
      return;
    }
    try {
      await api.patch(`/projects/${projectId}/punch-lists/${selectedList.id}/items/${itemId}`, {
        status: 'verified'
      });
      toast.success('Punch item marked as verified by client');
      loadSingleList(selectedList.id);
      
      // Reload summary list
      api.get(`/projects/${projectId}/punch-lists`).then(res => {
        setPunchLists(res.data?.data || []);
      });
    } catch {
      toast.error('Failed to verify item');
    }
  };

  const handleUpdateItemAssignee = async (itemId, assigneeId) => {
    if (projectStatus === 'completed') {
      toast.warning('Cannot update assignees on a completed project.');
      return;
    }
    try {
      await api.patch(`/projects/${projectId}/punch-lists/${selectedList.id}/items/${itemId}`, {
        assignee_id: assigneeId || null
      });
      toast.success('Assignee updated');
      loadSingleList(selectedList.id);
    } catch {
      toast.error('Failed to update assignee');
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (projectStatus === 'completed') {
      toast.warning('Cannot delete items on a completed project.');
      return;
    }
    if (!await confirm('Are you sure you want to delete this walkthrough item?')) return;
    try {
      await api.delete(`/projects/${projectId}/punch-lists/${selectedList.id}/items/${itemId}`);
      toast.success('Item deleted');
      loadSingleList(selectedList.id);
    } catch {
      toast.error('Failed to delete item');
    }
  };

  const handleDeleteList = async (listId) => {
    if (projectStatus === 'completed') {
      toast.warning('Cannot delete walkthrough lists on a completed project.');
      return;
    }
    if (!await confirm('Delete this walkthrough list and all its items permanently?')) return;
    try {
      await api.delete(`/projects/${projectId}/punch-lists/${listId}`);
      toast.success('Walkthrough list deleted');
      loadPunchLists();
    } catch {
      toast.error('Failed to delete list');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'open':
        return <Badge variant="warning">Open / Assigned</Badge>;
      case 'resolved':
        return <Badge variant="info">Resolved by QC</Badge>;
      case 'verified':
      case 'client_verified':
        return <Badge variant="success">Client Verified</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Helper to structure formatted description sections if available
  const renderFormattedDescription = (text) => {
    if (!text) return null;
    const lines = text.split('\n').filter(Boolean);
    
    return (
      <div className={styles.descContainer}>
        {lines.map((line, idx) => {
          const colonIdx = line.indexOf(':');
          if (colonIdx > 0 && colonIdx < 30) {
            const key = line.substring(0, colonIdx).trim();
            const val = line.substring(colonIdx + 1).trim();
            
            const isHeader = key.toLowerCase().startsWith('item');
            const isResult = key.toLowerCase().includes('result');
            
            if (isHeader) {
              return (
                <div key={idx} className={styles.descHeaderLine}>
                  <strong>{key}:</strong> {val}
                </div>
              );
            }
            if (isResult) {
              return (
                <div key={idx} className={styles.descResultLine}>
                  <span className={styles.descTag}>Result</span>
                  <span>{val}</span>
                </div>
              );
            }
            return (
              <div key={idx} className={styles.descMetaLine}>
                <span className={styles.descLabel}>{key}:</span>
                <span className={styles.descValue}>{val}</span>
              </div>
            );
          }
          return <div key={idx} className={styles.descPlainLine}>{line}</div>;
        })}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      {/* Top Section - Horizontal list of walkthrough events */}
      <div className={styles.topSection}>
        <div className={styles.topHeader}>
          <div>
            <h3 className={styles.topTitle}>Pre-Handover Walkthrough Events</h3>
            <p className={styles.topSubtitle}>Select a walkthrough event to view, record, or verify punch list defect items</p>
          </div>
          {projectStatus !== 'completed' && (
            <Button variant="primary" size="sm" onClick={async () => setShowCreateModal(true)}>+ New Walkthrough</Button>
          )}
        </div>
        
        {punchLists.length === 0 ? (
          <div className={styles.emptyTopBar}>
            <div className={styles.emptyIcon}>📋</div>
            <div>
              <strong>No walkthroughs recorded yet</strong>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                Start by clicking "+ New Walkthrough" to log your pre-handover inspection.
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.eventsGrid}>
            {punchLists.map(l => (
              <div 
                key={l.id} 
                className={`${styles.eventCard} ${selectedList?.id === l.id ? styles.activeEventCard : ''}`}
                onClick={async () => {
                  setLoading(true);
                  loadSingleList(l.id);
                }}
              >
                <div className={styles.cardHeaderRow}>
                  <div className={styles.cardTitleText}>{l.title}</div>
                  {projectStatus !== 'completed' && (
                    <button 
                      className={styles.deleteListBtn} 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteList(l.id);
                      }}
                      title="Delete walkthrough"
                    >
                      ✕
                    </button>
                  )}
                </div>
                
                <div className={styles.eventMeta}>
                  <span>📅 {l.walkthrough_date ? new Date(l.walkthrough_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'No date'}</span>
                  <span className={l.status === 'fully_verified' ? styles.statusVerified : styles.statusProgress}>
                    ● {l.status?.replace('_', ' ')}
                  </span>
                </div>

                <div className={styles.eventCounts}>
                  <div className={styles.countBadge}>Total: <strong>{l.total_items}</strong></div>
                  <div className={`${styles.countBadge} ${styles.countResolved}`}>Resolved: <strong>{l.resolved_items}</strong></div>
                  <div className={`${styles.countBadge} ${styles.countVerified}`}>Verified: <strong>{l.verified_items}</strong></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main detail workspace */}
      <div className={styles.workspace}>
        {loading ? (
          <div className={styles.loader}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div className="animate-spin" style={{ fontSize: '24px' }}>⚙️</div>
              <span>Loading walkthrough details...</span>
            </div>
          </div>
        ) : !selectedList ? (
          <div className={styles.emptyState}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
            <h2>Pre-Handover Punch Lists</h2>
            <p>Select a walkthrough event from the cards above or record a new pre-handover walkthrough to track defects and item sign-offs.</p>
            {projectStatus !== 'completed' && (
              <Button variant="primary" onClick={async () => setShowCreateModal(true)}>Record First Walkthrough</Button>
            )}
          </div>
        ) : (
          <div className={styles.detailsCard}>
            <div className={styles.detailHeader}>
              <div>
                <h2>{selectedList.title}</h2>
                <div className={styles.detailMeta}>
                  <span>📅 <strong>Walkthrough Date:</strong> {selectedList.walkthrough_date ? new Date(selectedList.walkthrough_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A'}</span>
                  <span>👤 <strong>Recorded By:</strong> {selectedList.creator_name || '—'}</span>
                  <span>🔍 <strong>Overall Status:</strong> {getStatusBadge(selectedList.status)}</span>
                </div>
              </div>
              {projectStatus !== 'completed' && (
                <div className={styles.headerActions}>
                  <Button variant="primary" size="sm" onClick={async () => setShowItemModal(true)}>+ Add Walkthrough Item</Button>
                </div>
              )}
            </div>

            {/* Quick Metrics Summary Bar */}
            <div className={styles.summaryBar}>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Total Defects Logged</span>
                <span className={styles.summaryValue}>{selectedList.items?.length || selectedList.total_items || 0}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Resolved by QC</span>
                <span className={`${styles.summaryValue} ${styles.colorInfo}`}>
                  {(selectedList.items || []).filter(i => i.status === 'resolved').length}
                </span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Client Verified</span>
                <span className={`${styles.summaryValue} ${styles.colorSuccess}`}>
                  {(selectedList.items || []).filter(i => i.status === 'verified' || i.status === 'client_verified').length}
                </span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Pending QC Action</span>
                <span className={`${styles.summaryValue} ${styles.colorWarning}`}>
                  {(selectedList.items || []).filter(i => i.status === 'open').length}
                </span>
              </div>
            </div>

            {(!selectedList.items || selectedList.items.length === 0) ? (
              <div className={styles.emptyItems}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>✨</div>
                <p>No punch list items added to this walkthrough yet.</p>
                {projectStatus !== 'completed' && (
                  <Button size="sm" variant="primary" onClick={async () => setShowItemModal(true)}>Add Walkthrough Item</Button>
                )}
              </div>
            ) : (
              <div className={styles.tableResponsive}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ width: '12%' }}>Room / Area</th>
                      <th style={{ width: '12%' }}>Trade</th>
                      <th style={{ width: '34%' }}>Description & Verification Notes</th>
                      <th style={{ width: '16%' }}>Assignee</th>
                      <th style={{ width: '10%' }}>Status</th>
                      <th style={{ width: '12%' }}>QC Review & Verification</th>
                      <th style={{ width: '4%' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedList.items || []).map(item => (
                      <tr key={item.id} className={item.status === 'verified' ? styles.rowVerified : ''}>
                        <td className={styles.tdRoom}>
                          <div className={styles.roomPill}>
                            📍 {item.room_name}
                          </div>
                        </td>
                        <td className={styles.tdTrade}>
                          <span className={`${styles.tradeTag} ${styles['trade_' + item.trade]}`}>
                            {TRADES.find(t => t.value === item.trade)?.label || item.trade}
                          </span>
                        </td>
                        <td className={styles.tdDesc}>
                          {renderFormattedDescription(item.item_description)}
                        </td>
                        <td className={styles.tdAssignee}>
                          <div className={styles.assigneeWrapper}>
                            <select 
                              value={item.assignee_id || ''}
                              disabled={item.status === 'verified' || projectStatus === 'completed'}
                              className={styles.selectAssignee}
                              onChange={(e) => handleUpdateItemAssignee(item.id, e.target.value)}
                            >
                              <option value="">-- Unassigned --</option>
                              {teamUsers.map(u => {
                                const displayName = u.name || u.full_name || u.email;
                                return (
                                  <option key={u.id} value={u.id}>{displayName}</option>
                                );
                              })}
                            </select>
                          </div>
                        </td>
                        <td className={styles.tdStatus}>{getStatusBadge(item.status)}</td>
                        <td className={styles.tdQc}>
                          {projectStatus !== 'completed' && item.status === 'open' && (
                            <Button size="xs" variant="primary" style={{ width: '100%' }} onClick={async () => openResolveModal(item.id)}>
                              Close as QC Passed
                            </Button>
                          )}
                          {projectStatus === 'completed' && item.status === 'open' && (
                            <span style={{fontSize:11, color:'var(--color-text-muted)', fontWeight: 500}}>Locked</span>
                          )}
                          
                          {item.status === 'resolved' && (
                            <div className={styles.qcPassedBlock}>
                              <div className={styles.qcReviewer}>✔ QC Review Done</div>
                              {item.qc_notes && <div className={styles.qcNotes}>Note: "{item.qc_notes}"</div>}
                              {projectStatus !== 'completed' && (
                                <button className={styles.verifyBtn} onClick={async () => handleVerifyItem(item.id)}>
                                  ✓ Mark Verified (Client Sign-Off)
                                </button>
                              )}
                            </div>
                          )}

                          {item.status === 'verified' && (
                            <div className={styles.verifiedBlock}>
                              <div>✔ Client Verified</div>
                              <div className={styles.verifiedMeta}>
                                at {new Date(item.client_verified_at || item.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className={styles.tdAction}>
                          {projectStatus !== 'completed' && (
                            <button 
                              className={styles.deleteItemBtn}
                              onClick={async () => handleDeleteItem(item.id)}
                              title="Delete Item"
                            >
                              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CREATE WALKTHROUGH MODAL */}
      {showCreateModal && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalCard}>
            <h3>Create Pre-Handover Walkthrough</h3>
            <form onSubmit={handleCreateList}>
              <div className={styles.formGroup}>
                <label>Walkthrough Title *</label>
                <Input 
                  placeholder="e.g. Master Bedroom walkthrough with Client"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Walkthrough Date</label>
                <Input 
                  type="date"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                />
              </div>
              <div className={styles.modalActions}>
                <Button type="button" variant="outline" onClick={async () => setShowCreateModal(false)}>Cancel</Button>
                <Button type="submit" variant="primary">Create</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD ITEM MODAL */}
      {showItemModal && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalCard}>
            <h3>Add Walkthrough Defect / Item</h3>
            <form onSubmit={handleAddItem}>
              <div className={styles.formGroup}>
                <label>Room / Location *</label>
                <Input 
                  placeholder="e.g. Living Room, Balcony, Master Bathroom"
                  value={itemRoom}
                  onChange={e => setItemRoom(e.target.value)}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Trade Category *</label>
                <select 
                  className={styles.selectInput}
                  value={itemTrade}
                  onChange={e => setItemTrade(e.target.value)}
                  required
                >
                  {TRADES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Defect Description *</label>
                <textarea 
                  className={styles.textareaInput}
                  placeholder="Describe the pending work, defect, or alignment issue observed during walkthrough..."
                  value={itemDesc}
                  onChange={e => setItemDesc(e.target.value)}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label>Assignee (Trade Lead / Supervisor)</label>
                <select 
                  className={styles.selectInput}
                  value={itemAssignee}
                  onChange={e => setItemAssignee(e.target.value)}
                >
                  <option value="">-- Unassigned --</option>
                  {teamUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.name || u.full_name || u.email}</option>
                  ))}
                </select>
              </div>
              <div className={styles.modalActions}>
                <Button type="button" variant="outline" onClick={async () => setShowItemModal(false)}>Cancel</Button>
                <Button type="submit" variant="primary">Add Item</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QC SIGN-OFF RESOLUTION MODAL */}
      {showResolveModal && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalCard}>
            <h3>QC Sign-Off & Rework Log</h3>
            <form onSubmit={handleResolveItem}>
              <p className={styles.modalInfo}>Please log the description of rectification work done to resolve this defect. This will be visible to the client in their portal.</p>
              <div className={styles.formGroup}>
                <label>Rework / Rectification Notes *</label>
                <textarea 
                  className={styles.textareaInput}
                  placeholder="e.g. Wall patch sanded and re-coated with double coat premium emulsion paint. Scratches cleared."
                  value={qcNotes}
                  onChange={e => setQcNotes(e.target.value)}
                  required
                />
              </div>
              <div className={styles.modalActions}>
                <Button type="button" variant="outline" onClick={async () => setShowResolveModal(false)}>Cancel</Button>
                <Button type="submit" variant="success">Resolve & Pass QC</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
