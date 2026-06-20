const express = require('express');
const { success, fail } = require('../utils/response');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

/**
 * WebAuthn (Passkey / Biometric) foundational routes.
 * Requires '@simplewebauthn/server' for full implementation in production.
 */

// Generate registration options (Challenge)
router.post('/generate-options', authenticate, async (req, res, next) => {
  try {
    const user = req.user;
    // STUB: In production, generate options using generateRegistrationOptions()
    // from @simplewebauthn/server and save the challenge to the DB session.
    
    const mockOptions = {
      challenge: 'mock_base64url_challenge',
      rp: { name: 'CRM Interior Construction', id: 'crm.example.com' },
      user: {
        id: Buffer.from(user.userId).toString('base64url'),
        name: user.email || 'user',
        displayName: user.name || 'User'
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 }
      ],
      authenticatorSelection: {
        userVerification: 'preferred'
      }
    };

    return success(res, { options: mockOptions });
  } catch (err) {
    next(err);
  }
});

// Verify registration response
router.post('/verify', authenticate, async (req, res, next) => {
  try {
    const { credential } = req.body;
    if (!credential) return fail(res, 'Missing credential', 400);

    // STUB: In production, use verifyRegistrationResponse()
    // from @simplewebauthn/server against the saved challenge.
    // Save the verified public key to the user's authenticators table.

    return success(res, { verified: true, message: 'Passkey registered successfully (Simulated).' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
