const { Pool } = require('pg');
const primaryPool = require('./pool');

// Cache of connection pools for dedicated databases
const tenantPools = new Map();

// In a real scenario, this mapping would be fetched from a central "Tenant Directory" DB,
// Redis cache, or environment configuration.
// For demonstration, we use an in-memory map or env variable.
const enterpriseTenantsConfig = process.env.ENTERPRISE_TENANT_DB_MAPPING 
  ? JSON.parse(process.env.ENTERPRISE_TENANT_DB_MAPPING) 
  : {
      // Example: Tenant ID 99 gets their own dedicated DB
      // "99": "postgres://user:pass@dedicated-host:5432/crm_tenant_99"
    };

/**
 * Resolves the database pool for a specific tenant.
 * @param {string|number} tenantId 
 * @returns {Pool} The configured database pool for the tenant
 */
function getTenantPool(tenantId) {
  const tId = String(tenantId);
  
  // Check if tenant has a dedicated DB mapped
  if (enterpriseTenantsConfig[tId]) {
    // If we haven't created a pool for this dedicated DB yet, create one
    if (!tenantPools.has(tId)) {
      console.log(`[TenantResolver] Initializing dedicated DB pool for tenant ${tId}`);
      
      const connectionString = enterpriseTenantsConfig[tId];
      const useSSL = connectionString && !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1');

      const newPool = new Pool({
        connectionString,
        ssl: useSSL ? { rejectUnauthorized: false } : false,
        max: 20, // Dedicated DB might need different limits
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      newPool.on('error', (err) => {
        console.error(`[TenantResolver] Error on idle client for dedicated tenant ${tId}`, err);
      });

      tenantPools.set(tId, newPool);
    }
    
    return tenantPools.get(tId);
  }

  // Fallback to shared primary pool for standard multi-tenant
  return primaryPool;
}

module.exports = {
  getTenantPool,
  // Helper to expose mapping updates dynamically (e.g., from a webhook when a tenant upgrades)
  registerDedicatedTenant: (tenantId, dbUrl) => {
    enterpriseTenantsConfig[String(tenantId)] = dbUrl;
  }
};
