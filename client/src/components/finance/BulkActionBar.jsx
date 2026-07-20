import React, { useState } from 'react';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';
import styles from './BulkActionBar.module.css';

export default function BulkActionBar({ selectedIds, clearSelection, refreshData }) {
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  if (!selectedIds || selectedIds.size === 0) return null;

  const handleBulkAction = async (actionStr) => {
    if (!window.confirm(`Are you sure you want to ${actionStr} ${selectedIds.size} items?`)) return;
    
    setLoading(true);
    try {
      const idsArray = Array.from(selectedIds);
      const res = await api.post('/api/financial-approvals/bulk-action', {
        ids: idsArray,
        action: actionStr,
        comments: `Bulk ${actionStr} applied.`
      });
      
      toast.success(res.data.message || `Successfully processed ${idsArray.length} items.`);
      clearSelection();
      refreshData();
    } catch (err) {
      toast.error(err.response?.data?.error || `Bulk ${actionStr} failed.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.actionBarContainer}>
      <div className={styles.actionBar}>
        <div className={styles.selectionCount}>
          <span className={styles.countBadge}>{selectedIds.size}</span>
          Transaction{selectedIds.size === 1 ? '' : 's'} Selected
        </div>
        <div className={styles.actionButtons}>
          <button 
            disabled={loading}
            onClick={() => handleBulkAction('approve')} 
            className={`${styles.btn} ${styles.btnApprove}`}>
            ✅ Approve All
          </button>
          <button 
            disabled={loading}
            onClick={() => handleBulkAction('reject')} 
            className={`${styles.btn} ${styles.btnReject}`}>
            ❌ Reject All
          </button>
          <div className={styles.divider}></div>
          <button 
            disabled={loading}
            onClick={clearSelection} 
            className={`${styles.btn} ${styles.btnCancel}`}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
