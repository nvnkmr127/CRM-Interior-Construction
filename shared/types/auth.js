/**
 * IMPORTANT: This file acts as the primary data contract between the frontend (client) 
 * and the backend (server). Any shape change or field addition/removal here MUST 
 * strictly be coordinated and implemented across both sides simultaneously.
 */

/**
 * @typedef {Object} Tenant
 * @property {string} id
 * @property {string} name
 * @property {string} slug
 * @property {string} plan
 * @property {Object} config
 * @property {boolean} is_active
 * @property {string|Date} created_at
 */

/**
 * @typedef {Object} Role
 * @property {string} id
 * @property {string} tenant_id
 * @property {string} name
 * @property {string[]} permissions
 * @property {boolean} is_system
 */

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} tenant_id
 * @property {string} name
 * @property {string} email
 * @property {string} status
 * @property {string} avatar_url
 * @property {Role} role
 * @property {string|Date} created_at
 */

/**
 * @typedef {Object} Session
 * @property {string} id
 * @property {string} user_id
 * @property {string} tenant_id
 * @property {string|Date} expires_at
 * @property {string} ip_address
 * @property {string} user_agent
 */

/**
 * @typedef {Object} AuthTokens
 * @property {string} accessToken
 * @property {string} refreshToken
 */

module.exports = {};
