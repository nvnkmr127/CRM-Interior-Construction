/* eslint-disable no-undef */
import { validators, run } from '../../utils/validators'

describe('validators', () => {
  describe('required', () => {
    it('returns error for empty string', () => {
      expect(validators.required()('')).toBeTruthy()
    })
    it('returns null for non-empty string', () => {
      expect(validators.required()('hello')).toBeNull()
    })
    it('returns error for whitespace only', () => {
      expect(validators.required()('   ')).toBeTruthy()
    })
  })

  describe('phone', () => {
    it('accepts valid Indian mobile', () => {
      expect(validators.phone('9876543210')).toBeNull()
      expect(validators.phone('6876543210')).toBeNull()
    })
    it('rejects 5xxxxxxxx (starts with 5)', () => {
      expect(validators.phone('5876543210')).toBeTruthy()
    })
    it('rejects 9-digit number', () => {
      expect(validators.phone('987654321')).toBeTruthy()
    })
    it('strips +91 prefix before validation', () => {
      expect(validators.phone('+919876543210')).toBeNull()
    })
    it('returns null for empty (phone is optional)', () => {
      expect(validators.phone('')).toBeNull()
    })
  })

  describe('email', () => {
    it('accepts valid email', () => {
      expect(validators.email('test@example.com')).toBeNull()
    })
    it('rejects missing @', () => {
      expect(validators.email('testexample.com')).toBeTruthy()
    })
    it('returns null for empty (email is optional)', () => {
      expect(validators.email('')).toBeNull()
    })
  })

  describe('run (compose)', () => {
    it('returns first failing error', () => {
      const validator = run(validators.required('Name'), validators.minLen(3, 'Name'))
      expect(validator('')).toMatch(/required/i)
      expect(validator('ab')).toMatch(/3 characters/)
      expect(validator('abc')).toBeNull()
    })
  })
})
