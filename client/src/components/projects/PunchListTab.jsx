/* eslint-disable no-unused-vars, react-hooks/immutability, react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react';
import styles from './PunchListTab.module.css';
import { Badge, Button, Input, Select, Card } from '../ui';
import { useToast } from '../../store/toastContext';
import api from '../../api/axios';

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

export default function PunchListTab({ projectId }) {
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
    if (!window.confirm('Are you sure you want to delete this walkthrough item?')) return;
    try {
      await api.delete(`/projects/${projectId}/punch-lists/${selectedList.id}/items/${itemId}`);
      toast.success('Item deleted');
      loadSingleList(selectedList.id);
    } catch {
      toast.error('Failed to delete item');
    }
  };

  const handleDeleteList = async (listId) => {
    if (!window.confirm('Delete this walkthrough list and all its items permanently?')) return;
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

  return (
    <div className={styles.container}>
      {/* Sidebar - list of walkthrough events */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h3>Walkthrough Events</h3>
          <Button size="sm" onClick={() => setShowCreateModal(true)}>+ New Walkthrough</Button>
        </div>
        
        {punchLists.length === 0 ? (
          <div className={styles.emptySidebar}>
            No walkthroughs recorded yet. Start by creating a pre-handover walkthrough event.
          </div>
        ) : (
          <div className={styles.listContainer}>
            {punchLists.map(l => (
              <div 
                key={l.id} 
                className={`${styles.sidebarItem} ${selectedList?.id === l.id ? styles.activeItem : ''}`}
                onClick={() => {
                  setLoading(true);
                  loadSingleList(l.id);
                }}
              >
                <div className={styles.itemTitle}>{l.title}</div>
                <div className={styles.itemMeta}>
                  <span>📅 {l.walkthrough_date ? new Date(l.walkthrough_date).toLocaleDateString() : 'No date'}</span>
                  <span>⚙ {l.status?.toUpperCase().replace('_', ' ')}</span>
                </div>
                <div className={styles.itemCounts}>
                  <span>Total: {l.total_items}</span>
                  <span>Resolved: {l.resolved_items}</span>
                  <span>Verified: {l.verified_items}</span>
                </div>
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
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main detail workspace */}
      <div className={styles.workspace}>
        {loading ? (
          <div className={styles.loader}>Loading walkthrough details...</div>
        ) : !selectedList ? (
          <div className={styles.emptyState}>
            <h2>Pre-Handover Punch Lists</h2>
            <p>Select a walkthrough event from the sidebar or record a new pre-handover walkthrough to track defects and item sign-offs.</p>
            <Button onClick={() => setShowCreateModal(true)}>Record First Walkthrough</Button>
          </div>
        ) : (
          <div className={styles.detailsCard}>
            <div className={styles.detailHeader}>
              <div>
                <h2>{selectedList.title}</h2>
                <div className={styles.detailMeta}>
                  <span><strong>Date:</strong> {selectedList.walkthrough_date ? new Date(selectedList.walkthrough_date).toLocaleDateString() : 'N/A'}</span>
                  <span><strong>Recorded By:</strong> {selectedList.creator_name || '—'}</span>
                  <span><strong>Status:</strong> {getStatusBadge(selectedList.status)}</span>
                </div>
              </div>
              <div className={styles.headerActions}>
                <Button variant="outline" onClick={() => setShowItemModal(true)}>+ Add Walkthrough Item</Button>
              </div>
            </div>

            {selectedList.items?.length === 0 ? (
              <div className={styles.emptyItems}>
                <p>No punch list items added to this walkthrough yet.</p>
                <Button size="sm" onClick={() => setShowItemModal(true)}>Add Walkthrough Item</Button>
              </div>
            ) : (
              <div className={styles.tableResponsive}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Room / Area</th>
                      <th>Trade</th>
                      <th>Description</th>
                      <th>Assignee</th>
                      <th>Status</th>
                      <th>QC Review & Rework Tracking</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedList.items.map(item => (
                      <tr key={item.id} className={item.status === 'verified' ? styles.rowVerified : ''}>
                        <td className={styles.tdRoom}><strong>{item.room_name}</strong></td>
                        <td className={styles.tdTrade}>
                          <span className={`${styles.tradeTag} ${styles['trade_' + item.trade]}`}>
                            {TRADES.find(t => t.value === item.trade)?.label || item.trade}
                          </span>
                        </td>
                        <td className={styles.tdDesc}>{item.item_description}</td>
                        <td className={styles.tdAssignee}>
                          <select 
                            value={item.assignee_id || ''}
                            disabled={item.status === 'verified'}
                            className={styles.selectAssignee}
                            onChange={(e) => handleUpdateItemAssignee(item.id, e.target.value)}
                          >
                            <option value="">-- Unassigned --</option>
                            {teamUsers.map(u => (
                              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                            ))}
                          </select>
                        </td>
                        <td className={styles.tdStatus}>{getStatusBadge(item.status)}</td>
                        <td className={styles.tdQc}>
                          {item.status === 'open' && (
                            <Button size="xs" variant="primary" onClick={() => openResolveModal(item.id)}>
                              Close as QC Passed
                            </Button>
                          )}
                          
                          {item.status === 'resolved' && (
                            <div className={styles.qcPassedBlock}>
                              <div className={styles.qcReviewer}>✔ QC Review Done</div>
                              <div className={styles.qcNotes}>Note: "{item.qc_notes}"</div>
                              <Button size="xs" variant="success" style={{ marginTop: 6 }} onClick={() => handleVerifyItem(item.id)}>
                                Mark Verified (Client Sign-Off)
                              </Button>
                            </div>
                          )}

                          {item.status === 'verified' && (
                            <div className={styles.verifiedBlock}>
                              <div>✔ Client Verified</div>
                              <div className={styles.verifiedMeta}>
                                at {new Date(item.client_verified_at || item.updated_at).toLocaleDateString()}
                              </div>
                            </div>
                          )}
                        </td>
                        <td>
                          <button 
                            className={styles.deleteItemBtn}
                            onClick={() => handleDeleteItem(item.id)}
                            title="Delete Item"
                          >
                            🗑
                          </button>
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
                <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
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
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>
              <div className={styles.modalActions}>
                <Button type="button" variant="outline" onClick={() => setShowItemModal(false)}>Cancel</Button>
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
                <Button type="button" variant="outline" onClick={() => setShowResolveModal(false)}>Cancel</Button>
                <Button type="submit" variant="success">Resolve & Pass QC</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
