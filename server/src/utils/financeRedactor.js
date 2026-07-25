/**
 * Redacts sensitive financial fields from objects or arrays of objects
 * based on the user's granular finance permissions.
 */

function redactFinancials(data, userPermissions = []) {
  if (!data) return data;

  const isSuperadmin = userPermissions.includes('*');
  const canViewCost = isSuperadmin || userPermissions.includes('finance:view_cost');
  const canViewProfit = isSuperadmin || userPermissions.includes('finance:view_profit');
  const canViewMargin = isSuperadmin || userPermissions.includes('finance:view_margin');
  const canViewDiscount = isSuperadmin || userPermissions.includes('finance:view_discount');

  // If the user has all permissions, no need to traverse and redact
  if (canViewCost && canViewProfit && canViewMargin && canViewDiscount) {
    return data;
  }

  const costFields = ['cost', 'vendor_cost', 'unit_cost', 'total_cost', 'base_cost', 'estimated_cost'];
  const profitFields = ['profit', 'expected_profit', 'net_profit', 'gross_profit'];
  const marginFields = ['margin', 'profit_margin', 'margin_percentage', 'markup_percentage'];
  const discountFields = ['discount', 'discount_amount', 'discount_percentage'];

  const redactObject = (obj) => {
    // Basic recursion protection and type checking
    if (typeof obj !== 'object' || obj === null || obj instanceof Date) {
      return obj;
    }

    const redacted = Array.isArray(obj) ? [] : {};
    
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      let shouldRedact = false;
      if (!canViewCost && costFields.some(f => lowerKey.includes(f))) shouldRedact = true;
      if (!canViewProfit && profitFields.some(f => lowerKey.includes(f))) shouldRedact = true;
      if (!canViewMargin && marginFields.some(f => lowerKey.includes(f))) shouldRedact = true;
      if (!canViewDiscount && discountFields.some(f => lowerKey.includes(f))) shouldRedact = true;

      if (shouldRedact) {
        // We omit the key or set it to undefined. Setting to undefined removes it from JSON.
        // Or we can set it to a static string like '[REDACTED]' if they prefer knowing it exists but is hidden.
        // Standard practice for REST APIs is to completely omit the field or return null.
        redacted[key] = null; // We use null to maintain schema shape without exposing data
      } else if (typeof value === 'object' && value !== null) {
        redacted[key] = redactObject(value);
      } else {
        redacted[key] = value;
      }
    }
    return redacted;
  };

  return redactObject(data);
}

module.exports = { redactFinancials };
