export function formatCurrency(amount, short = false) {
  if (amount == null || isNaN(Number(amount))) return '₹0'
  const n = Number(amount)
  if (short) {
    if (n >= 10000000) return `₹${(n/10000000).toFixed(1)}Cr`
    if (n >= 100000)   return `₹${(n/100000).toFixed(1)}L`
    if (n >= 1000)     return `₹${(n/1000).toFixed(0)}k`
    return `₹${n}`
  }
  // Indian numbering: lakhs and crores
  return '₹' + n.toLocaleString('en-IN')
}

export function getInitials(name = '') {
  return name.trim().split(/\s+/).slice(0,2).map(w => w[0]?.toUpperCase() || '').join('')
}

export function truncate(str, maxLen = 50) {
  if (!str) return ''
  return str.length <= maxLen ? str : str.slice(0, maxLen - 3) + '...'
}

export function pluralize(n, singular, plural) {
  return `${n} ${n === 1 ? singular : (plural || singular + 's')}`
}

export function capitalize(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

export function slugify(str) {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}
