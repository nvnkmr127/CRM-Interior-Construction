import React from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import Button from './Button';

export default function PermissionButton({ module, action, permission, asChild, children, ...props }) {
  const { hasPermission } = usePermissions();

  let hasAccess = false;
  
  if (permission) {
    const parts = permission.split('||');
    hasAccess = parts.some(p => {
      const [m, a] = p.split(':');
      return hasPermission(m, a);
    });
  } else {
    hasAccess = hasPermission(module, action);
  }

  if (!hasAccess) {
    return null;
  }

  const hasButtonProps = Object.keys(props).length > 0;

  if (asChild) {
      if (React.isValidElement(children)) {
          return React.cloneElement(children, props);
      }
      return children;
  }

  if (hasButtonProps || typeof children === 'string') {
      return <Button {...props}>{children}</Button>;
  }

  return children;
}
