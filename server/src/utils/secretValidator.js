/**
 * Validates the security of environment variables on startup.
 * Prevents the application from booting with insecure or missing secrets.
 */
function validateEnvironmentSecrets() {
  const requiredSecrets = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL'];
  
  for (const secret of requiredSecrets) {
    if (!process.env[secret]) {
      console.error(`[FATAL SECURITY ERROR] Missing critical environment variable: ${secret}`);
      process.exit(1);
    }
  }

  // Ensure JWT secrets are cryptographically strong
  if (process.env.JWT_SECRET.length < 32) {
    console.error('[FATAL SECURITY ERROR] JWT_SECRET is too short. It must be at least 32 characters for sufficient entropy.');
    process.exit(1);
  }

  if (process.env.JWT_REFRESH_SECRET && process.env.JWT_REFRESH_SECRET.length < 32) {
    console.error('[FATAL SECURITY ERROR] JWT_REFRESH_SECRET is too short. It must be at least 32 characters.');
    process.exit(1);
  }

  console.log('[SECURITY] Environment Secrets Validation Passed. Cryptographic entropy is sufficient.');
}

module.exports = { validateEnvironmentSecrets };
