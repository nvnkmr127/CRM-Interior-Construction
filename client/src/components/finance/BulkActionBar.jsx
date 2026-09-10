import React, { useState } from 'react';
import api from '../../api/axios';
import { useToast } from '../../store/toastContext';
import styles from './BulkActionBar.module.css';

import { useConfirm } from '../../store/confirmContext';

export default function BulkActionBar({ selectedIds, clearSelection, refreshData }) {
  const { confirm } = useConfirm();

  const [loading, setLoading] = useState(false);
  const toast = useToast();

  if (!selectedIds || selectedIds.size === 0) return null;

  const handleBulkAction = async (actionStr) => {
    if (!await confirm(`Are you sure you want to ${actionStr} ${selectedIds.size} items?`)) return;
    
    setLoading(true);
    try {
      const idsArray = Array.from(selectedIds);
      const res = await api.post('/financial-approvals/bulk-action', {
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
    <div className={styles.bar}>
      <div className={styles.left}>
        <span className={styles.countBadge}>{selectedIds.size}</span>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)' }}>
          Transaction{selectedIds.size === 1 ? '' : 's'} Selected
        </span>
      </div>
      <div className={styles.actions}>
        <button 
          disabled={loading}
          onClick={async () => handleBulkAction('approve')} 
          className={`${styles.actionBtn} ${styles.approve}`}>
          ✅ Approve All
        </button>
        <button 
          disabled={loading}
          onClick={async () => handleBulkAction('reject')} 
          className={`${styles.actionBtn} ${styles.reject}`}>
          ❌ Reject All
        </button>
        <button 
          disabled={loading}
          onClick={clearSelection} 
          className={styles.clearBtn}>
          Cancel
        </button>
      </div>
    </div>
  );
}
