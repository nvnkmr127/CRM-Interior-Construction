/**
 * Utility to enforce field-level permissions (Hidden, Read Only)
 */

/**
 * Removes 'hidden' fields from outgoing API responses.
 * @param {Object|Array} data - The object or array of objects to filter
 * @param {string} moduleName - The module name (e.g., 'projects')
 * @param {Object} userFieldPermissions - User's field permissions (e.g., req.user.field_permissions)
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
 * @param {string} moduleName - The module name (e.g., 'projects')
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

module.exports = {
  filterAllowedFields,
  stripUnauthorizedEdits
};
