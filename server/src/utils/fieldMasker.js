/**
 * Utility to enforce field-level permissions (Hidden, Read Only)
 */

/**
 * Removes 'hidden' fields from outgoing API responses.
 * @param {Object|Array} data - The object or array of objects to filter
 * @param {string} moduleName - The module name (error.g., 'projects')
 * @param {Object} userFieldPermissions - User's field permissions (error.g., req.user.field_permissions)
 * @returns {Object|Array} The filtered data
 */
function filterAllowedFields(data, moduleName, userFieldPermissions = {}) {
  if (!data) return data;

  const modulePerms = userFieldPermissions[moduleName] || {};

  const filterObject = (obj) => {
    const filteredObj = { ...obj };
    for (const [field, perm] of Object.entries(modulePerms)) {
      if (perm === 'hidden') {
        delete filteredObj[field];
      }
    }
    return filteredObj;
  };

  if (Array.isArray(data)) {
    return data.map(filterObject);
  }

  return filterObject(data);
}

/**
 * Strips 'read_only' and 'hidden' fields from incoming req.body payloads.
 * @param {Object} body - The request body to sanitize
 * @param {string} moduleName - The module name (error.g., 'projects')
 * @param {Object} userFieldPermissions - User's field permissions
 * @returns {Object} Sanitized body
 */
function stripUnauthorizedEdits(body, moduleName, userFieldPermissions = {}) {
  if (!body) return body;

  const modulePerms = userFieldPermissions[moduleName] || {};
  const sanitizedBody = { ...body };

  for (const [field, perm] of Object.entries(modulePerms)) {
    if (perm === 'hidden' || perm === 'read_only') {
      delete sanitizedBody[field];
    }
  }

  return sanitizedBody;
}

/**
 * Masks sensitive fields based on user permissions.
 * @param {Object|Array} data - The data to mask.
 * @param {Array} userPermissions - Array of user permissions.
 * @param {Object} fieldPermissions - Mapping of field names to required permissions.
 * @returns {Object|Array} Masked data.
 */
function maskSensitiveFields(data, userPermissions = [], fieldPermissions = {}) {
  if (!data) return data;

  const permsList = Array.isArray(userPermissions)
    ? userPermissions
    : (userPermissions && userPermissions.actions ? userPermissions.actions : []);

  const hasPerm = (perm) => {
    if (!perm) return true;
    if (permsList.includes('*') || permsList.includes('*:*') || permsList.includes('all')) return true;
    if (permsList.includes(perm)) return true;

    // Fallback: If checking lead fields (phone, email, budget, etc.)
    if (perm.startsWith('leads:')) {
      if (permsList.length === 0) return true;
      return permsList.some(p => 
        p === '*' || 
        p === 'leads:*' || 
        p === 'leads:read' || 
        p === 'leads:view' || 
        p === 'leads:manage' || 
        p === 'leads:write' || 
        p === 'leads:update' || 
        p === 'leads:read_sensitive' ||
        (typeof p === 'string' && p.startsWith('leads:'))
      );
    }
    return false;
  };

  const maskObject = (obj) => {
    const maskedObj = { ...obj };
    for (const [field, requiredPerm] of Object.entries(fieldPermissions)) {
      if (maskedObj[field] !== undefined && !hasPerm(requiredPerm)) {
        if (typeof maskedObj[field] === 'string') {
          maskedObj[field] = '******';
        } else {
          maskedObj[field] = null;
        }
      }
    }
    return maskedObj;
  };

  if (Array.isArray(data)) {
    return data.map(maskObject);
  }
  return maskObject(data);
}

module.exports = {
  filterAllowedFields,
  stripUnauthorizedEdits,
  maskSensitiveFields
};
