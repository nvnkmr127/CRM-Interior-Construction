export const validators = {
  required: (label = 'This field') => (v) =>
    !v || String(v).trim() === '' ? `${label} is required` : null,

  minLen: (n, label = 'This field') => (v) =>
    v && v.length < n ? `${label} must be at least ${n} characters` : null,

  maxLen: (n, label = 'This field') => (v) =>
    v && v.length > n ? `${label} must be ${n} characters or fewer` : null,

  email: (v) =>
    !v ? null : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'Enter a valid email address' : null,

  phone: (v) =>
    !v ? null : !/^\d{10,15}$/.test(v.replace(/[\s-+]/g,'').replace(/^91/,''))
      ? 'Enter a valid phone number (10-15 digits)' : null,

  amount: (v) =>
    !v ? null : isNaN(Number(v)) || Number(v) < 0 ? 'Enter a valid amount' : null,

  match: (other, label = 'Passwords') => (v) =>
    v !== other ? `${label} do not match` : null,

  url: (v) =>
    !v ? null : !/^https?:\/\/.+/.test(v) ? 'Enter a valid URL (starting with https://)' : null,
}

// Compose multiple validators for a single field:
// run(validators.required(), validators.minLen(8))(value) → first error or null
export function run(...rules) {
  return (value) => {
    for (const rule of rules) {
      const err = rule(value)
      if (err) return err
    }
    return null
  }
}
