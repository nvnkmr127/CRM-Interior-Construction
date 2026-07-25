import React from 'react';
import Badge from './Badge';

export default function ApprovalBadge({ status, ...props }) {
  const getVariant = (st) => {
    switch (st?.toLowerCase()) {
      case 'approved': return 'success';
      case 'rejected': return 'danger';
      case 'pending': return 'warning';
      case 'draft': return 'default';
      default: return 'default';
    }
  };

  const getLabel = (st) => {
    switch (st?.toLowerCase()) {
      case 'approved': return '✅ Approved';
      case 'rejected': return '❌ Rejected';
      case 'pending': return '⏳ Pending Approval';
      case 'draft': return '📝 Draft';
      default: return st || 'Unknown';
    }
  };

  return (
    <Badge variant={getVariant(status)} {...props}>
      {getLabel(status)}
    </Badge>
  );
}
