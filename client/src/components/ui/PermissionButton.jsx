import React from 'react';
import { usePermissions } from '../../hooks/usePermissions';

export default function PermissionButton({ module, action, children }) {
  const { hasPermission } = usePermissions();

  if (!hasPermission(module, action)) {
    return null;
  }

  return children;
}
