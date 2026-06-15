export function formatCurrency(amount, currency = 'INR') {
  if (amount === null || amount === undefined) return '';
  
  // Format dynamically based on Indian Numbering System
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatShortCurrency(amount) {
  if (amount === null || amount === undefined) return '';
  
  // Format shorthand abbreviations
  if (amount >= 10000000) {
    const crores = amount / 10000000;
    return `₹${crores % 1 !== 0 ? crores.toFixed(1) : crores}Cr`;
  } else if (amount >= 100000) {
    const lakhs = amount / 100000;
    return `₹${lakhs % 1 !== 0 ? lakhs.toFixed(1) : lakhs}L`;
  } else if (amount >= 1000) {
    const thousands = amount / 1000;
    return `₹${thousands % 1 !== 0 ? thousands.toFixed(1) : thousands}K`;
  }
  
  return `₹${amount}`;
}
