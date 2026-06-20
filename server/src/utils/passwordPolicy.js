const z = require('zod');

// Password must be at least 12 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character
const passwordSchema = z.string()
  .min(12, 'Password must be at least 12 characters long')
  .max(100, 'Password is too long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[\W_]/, 'Password must contain at least one special character');

/**
 * Validates a password against enterprise complexity rules.
 * Throws an error if the password is too weak.
 */
function validatePasswordComplexity(password) {
  const result = passwordSchema.safeParse(password);
  if (!result.success) {
    const messages = result.error.issues.map(i => i.message).join(', ');
    throw new Error(`WEAK_PASSWORD: ${messages}`);
  }
  return true;
}

module.exports = { validatePasswordComplexity };
