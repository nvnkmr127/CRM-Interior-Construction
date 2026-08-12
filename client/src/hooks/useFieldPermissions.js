import { useAuth } from '../store/authContext';
import { useMemo } from 'react';

export function useFieldPermissions(moduleName) {
  const { user } = useAuth();
  
  const fieldPermissions = useMemo(() => {
    if (!user || !user.role) return {};
    
    // Superadmin override
    const rName = user.role.name?.toLowerCase();
    if (user.role === 'superadmin' || rName === 'superadmin' || rName === 'super admin' || (user.role.permissions && user.role.permissions.includes('*'))) {
       return new Proxy({}, {
           get: () => 'editable'
       });
    }
    
    const perms = user.role.permissions || {};
    // If permissions is still a flat array on the frontend (e.g. from old session)
    if (Array.isArray(perms)) {
        return new Proxy({}, {
           get: () => 'editable' // default to editable if no strict field perms found
       });
    }

    const fields = perms.fields || {};
    return fields[moduleName] || {};
  }, [user, moduleName]);

  /**
   * Check if a field should be hidden
   * @param {string} fieldName - The field identifier
   * @returns {boolean} True if the field is hidden
   */
  const isHidden = (fieldName) => {
    return fieldPermissions[fieldName] === 'hidden';
  };

  /**
   * Check if a field should be read-only
   * @param {string} fieldName - The field identifier
   * @returns {boolean} True if the field is read-only
   */
  const isReadOnly = (fieldName) => {
    return fieldPermissions[fieldName] === 'readonly' || fieldPermissions[fieldName] === 'hidden';
  };

  return {
    fieldPermissions,
    isHidden,
    isReadOnly
  };
}
