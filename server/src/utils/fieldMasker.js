/**
 * Utility to mask sensitive fields based on user permissions.
 * @param {Object|Array} data - The object or array of objects to mask
 * @param {Array<string>} userPermissions - The permissions array of the user
 * @param {Object} fieldPermissionMap - Mapping of fields to required permissions
 * @returns {Object|Array} The masked data
 */
function maskSensitiveFields(data, userPermissions = [], fieldPermissionMap = {}) {
  if (!data) return data;

  const permissionsSet = new Set(userPermissions);
  // Superadmin bypass
  if (permissionsSet.has('*')) return data;

  const maskObject = (obj) => {
    const maskedObj = { ...obj };
    for (const [field, requiredPerm] of Object.entries(fieldPermissionMap)) {
      if (maskedObj[field] !== undefined && !permissionsSet.has(requiredPerm)) {
        maskedObj[field] = '*** MASKED ***';
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
  maskSensitiveFields
};
