import React, { useEffect, useState } from 'react';
import api from '../../api/axios';

export default function UnreadBadge({ approvalId, refreshCounter }) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    fetchUnread();
  }, [approvalId, refreshCounter]);

  const fetchUnread = async () => {
    try {
      const res = await api.get(`/api/financial-approvals/${approvalId}/comments/unread`);
      setUnread(res.data.data?.unread_count || 0);
    } catch (e) {
      console.error(e);
    }
  };

  if (unread === 0) return null;

  return (
    <span style={{ 
      background: 'red', 
      color: 'white', 
      borderRadius: '50%', 
      padding: '2px 6px', 
      fontSize: '10px', 
      marginLeft: '4px',
      fontWeight: 'bold'
    }}>
      {unread}
    </span>
  );
}
