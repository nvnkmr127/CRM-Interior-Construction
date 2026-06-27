import { useState, useEffect } from 'react';
import styles from './PortalPunchList.module.css';
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

export default function PortalPunchList() {
  const [punchLists, setPunchLists] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    loadPunchLists();
  }, []);

  const loadPunchLists = async (selectId = null) => {
    setLoading(true);
    try {
      const res = await api.get('/portal/punch-lists');
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
      const res = await api.get(`/portal/punch-lists/${id}`);
      setSelectedList(res.data?.data || null);
    } catch {
      toast.error('Failed to load walkthrough details');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyItem = async (itemId) => {
    try {
      await api.post(`/portal/punch-lists/items/${itemId}/verify`);
      toast.success('Rework verified successfully!');
      
      // Reload current details
      loadSingleList(selectedList.id);
      
      // Reload punch lists summary for counts
      const currentListId = selectedList.id;
      api.get('/portal/punch-lists').then(res => {
        setPunchLists(res.data?.data || []);
      });
    } catch {
      toast.error('Failed to verify item');
    }
  };

  const handleSignOff = async () => {
    if (!window.confirm('Are you sure you want to sign off on this pre-handover walkthrough? This signifies that all items have been rectified to your satisfaction.')) return;
    try {
      await api.post(`/portal/punch-lists/${selectedList.id}/sign-off`);
      toast.success('✓ Thank you! Walkthrough successfully signed off.');
      loadPunchLists(selectedList.id);
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to sign off walkthrough';
      toast.error(msg);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'open':
        return <span className={`${styles.badge} ${styles.badgeWarning}`}>Pending Rework</span>;
      case 'resolved':
        return <span className={`${styles.badge} ${styles.badgeInfo}`}>QC Passed (Ready for Review)</span>;
      case 'verified':
      case 'client_verified':
        return <span className={`${styles.badge} ${styles.badgeSuccess}`}>Verified by You</span>;
      default:
        return <span className={`${styles.badge} ${styles.badgeSecondary}`}>{status}</span>;
    }
  };

  const allItemsVerified = selectedList?.items && selectedList.items.length > 0 && selectedList.items.every(i => i.status === 'verified');

  return (
    <div className={styles.container}>
      {/* Sidebar for list selector */}
      <div className={styles.sidebar}>
        <h3 className={styles.sidebarTitle}>Pre-Handover Walkthroughs</h3>
        {punchLists.length === 0 ? (
          <div className={styles.emptySidebar}>
            No punch lists or walkthrough events are scheduled yet.
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
                  <span>📅 {l.walkthrough_date ? new Date(l.walkthrough_date).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div className={styles.itemCounts}>
                  <span>Resolved: {l.resolved_items}/{l.total_items}</span>
                  <span>Verified: {l.verified_items}/{l.total_items}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Workspace */}
      <div className={styles.workspace}>
        {loading ? (
          <div className={styles.loader}>Loading details...</div>
        ) : !selectedList ? (
          <div className={styles.emptyState}>
            <h2>No Walkthrough Records</h2>
            <p>Your pre-handover walkthrough punch list items will be displayed here for your review and sign-off.</p>
          </div>
        ) : (
          <div className={styles.detailWorkspace}>
            <div className={styles.detailHeader}>
              <div>
                <h2>{selectedList.title}</h2>
                <div className={styles.detailMetaInfo}>
                  <span><strong>Walkthrough Date:</strong> {selectedList.walkthrough_date ? new Date(selectedList.walkthrough_date).toLocaleDateString() : 'N/A'}</span>
                  <span><strong>Status:</strong> {selectedList.status?.toUpperCase().replace('_', ' ')}</span>
                </div>
              </div>

              {selectedList.signed_off_by_client ? (
                <div className={styles.signoffBlockSuccess}>
                  ✔ Walkthrough Signed Off on {new Date(selectedList.client_signed_off_at).toLocaleDateString()}
                </div>
              ) : allItemsVerified ? (
                <button className={styles.signoffBtn} onClick={handleSignOff}>
                  Sign Off on Walkthrough
                </button>
              ) : (
                <div className={styles.signoffPendingInfo}>
                  Sign-off becomes available once all items are verified.
                </div>
              )}
            </div>

            {selectedList.items?.length === 0 ? (
              <div className={styles.emptyItems}>
                There are currently no defect items recorded under this walkthrough event.
              </div>
            ) : (
              <div className={styles.itemsList}>
                {selectedList.items.map(item => (
                  <div 
                    key={item.id} 
                    className={`${styles.itemCard} ${item.status === 'verified' ? styles.itemCardVerified : ''}`}
                  >
                    <div className={styles.itemHeader}>
                      <span className={styles.roomName}>{item.room_name}</span>
                      <span className={`${styles.tradeTag} ${styles['trade_' + item.trade]}`}>
                        {TRADES.find(t => t.value === item.trade)?.label || item.trade}
                      </span>
                      {getStatusBadge(item.status)}
                    </div>
                    
                    <div className={styles.itemDesc}>
                      {item.item_description}
                    </div>

                    {item.qc_notes && (
                      <div className={styles.qcNotesContainer}>
                        <strong>QC Rectification Notes:</strong>
                        <p className={styles.qcNotesText}>"{item.qc_notes}"</p>
                        <span className={styles.qcPassedTag}>Passed QC Inspection</span>
                      </div>
                    )}

                    {item.status === 'resolved' && (
                      <div className={styles.actionsBlock}>
                        <button 
                          className={styles.verifyBtn} 
                          onClick={() => handleVerifyItem(item.id)}
                        >
                          Verify & Check Off
                        </button>
                      </div>
                    )}

                    {item.status === 'verified' && (
                      <div className={styles.verifiedSuccessBlock}>
                        ✔ You verified this rectification on {new Date(item.client_verified_at || item.updated_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
