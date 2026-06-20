/**
 * AI Security Controls
 * Sanitizes inputs and validates outputs.
 */

// Simple heuristic for prompt injection
const DANGEROUS_PATTERNS = [
  'ignore previous instructions',
  'ignore all instructions',
  'disregard previous',
  'system prompt',
  'you are now',
  'from now on'
];

/**
 * Sanitizes a user prompt to prevent prompt injection.
 * @param {string} prompt 
 * @returns {string} sanitized prompt
 * @throws {Error} if malicious pattern is detected
 */
function sanitizePrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') return '';
  
  const lowerPrompt = prompt.toLowerCase();
  for (const pattern of DANGEROUS_PATTERNS) {
    if (lowerPrompt.includes(pattern)) {
      throw new Error('SECURITY_REJECTED: Potential prompt injection detected.');
    }
  }

  // Strip excessive length to prevent DoS via token exhaustion
  if (prompt.length > 5000) {
    throw new Error('SECURITY_REJECTED: Prompt exceeds maximum allowed length.');
  }

  // Basic HTML tag stripping
  return prompt.replace(/<[^>]*>?/gm, '');
}

/**
 * Validates AI JSON output against a generic expected structure or schema
 * @param {string|Object} output 
 * @returns {Object} Valid JSON
 */
function validateOutput(output) {
  let parsed;
  try {
    parsed = typeof output === 'string' ? JSON.parse(output) : output;
  } catch (e) {
    throw new Error('AI Output Validation Failed: Invalid JSON');
  }

  // Ensure it's an object and not an array or string
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('AI Output Validation Failed: Expected JSON object');
  }

  return parsed;
}

module.exports = {
  sanitizePrompt,
  validateOutput
};
