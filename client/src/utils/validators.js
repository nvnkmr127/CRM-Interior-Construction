export const validators = {
  required: (v) => !v || v.toString().trim() === '' ? 'This field is required' : null,
  phone: (v) => !v ? null : !/^[6-9]\d{9}$/.test(v.replace(/\s/g,'')) ? 'Enter a valid 10-digit Indian mobile number' : null,
  email: (v) => !v ? null : !/^[^@]+@[^@]+\.[^@]+$/.test(v) ? 'Enter a valid email address' : null,
  minLen: (n) => (v) => v && v.length < n ? `Must be at least ${n} characters` : null,
  maxLen: (n) => (v) => v && v.length > n ? `Must be ${n} characters or fewer` : null,
  amount: (v) => !v ? null : isNaN(Number(v)) || Number(v) < 0 ? 'Enter a valid amount' : null,
};
