# Multi-Tenant Architecture & Data Isolation Guide

This document describes the multi-tenant mode setup, database-level isolation policies, settings, permissions system, user creation, and organization management. 

To maintain system integrity, these database structures and patterns enforce tenant boundaries **without altering any existing application logic, frontend UI components, or backend routing code**.

---

## 1. Core Architecture & Tenant Isolation

The system uses a **Shared Database, Shared Schema** multi-tenancy model. Every client organization (tenant) is represented as a row in the `tenants` table, and all transactional tables isolate data logical-level via `tenant_id` foreign keys.

### Database Tables Schema
* **Tenants**: [001_baseline_schema.sql](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/server/migrations/001_baseline_schema.sql#L4-L13)
  * Stores unique tenant identification data, plans, and system status configuration.
* **Transactional Tables**: Every table referencing tenant-related data (e.g., `users`, `leads`, `projects`, `sessions`, `audit_logs`) includes a `tenant_id` column:
  ```sql
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
  ```

### Data Isolation Enforcement
* **Application Level**: Queries are restricted to the context of the logged-in user's tenant by explicitly filtering by `tenant_id`. For example, in [add_attachment_routes.js](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/add_attachment_routes.js#L27-L30):
  ```javascript
  const tenantId = req.tenantId || (req.user && req.user.tenantId);
  const approvalRes = await pool.query(
    'SELECT 1 FROM financial_approvals WHERE id = $1 AND tenant_id = $2', 
    [id, tenantId]
  );
  ```

---

## 2. Organization Settings

Tenant-wide configurations and security requirements are stored in the database layer. This ensures that changing configurations for one organization does not affect any other tenants on the shared infrastructure.

* **Tenant Security Settings**: [20260723_enterprise_security.sql](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/server/migrations/20260723_enterprise_security.sql#L4-L18)
  * Defines features such as Multi-Factor Authentication requirements (`mfa_required_all`), session timeouts (`session_timeout_minutes`), concurrent login limits, password policies, and geofence restrictions (`allowed_ips`, `allowed_countries`).
* **Runtime Verification**: The session validation logic dynamically loads configuration from this schema:
  ```javascript
  const settingsRes = await pool.query(
    'SELECT session_timeout_minutes FROM tenant_security_settings WHERE tenant_id = $1',
    [decoded.tenantId]
  );
  ```

---

## 3. Rules & Permissions (RBAC)

Role-Based Access Control is isolated at the tenant level. Each tenant manages its own custom set of roles, which map directly to granular application permissions.

* **Tenant Roles Schema**: [001_baseline_schema.sql](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/server/migrations/001_baseline_schema.sql#L19-L26)
  * Defines roles scoped to individual tenants (`tenant_id`).
  * The `permissions` column holds an array of string descriptors representing allowed actions (e.g., `["leads:read", "leads:write"]` or `["*"]` for full superadmin access).
* **Authorization Middleware**: [authorize.js](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/server/src/middleware/authorize.js) and [dataScope.js](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/server/src/middleware/dataScope.js)
  * The server decodes roles and checks active permissions arrays before authorizing routes:
    ```javascript
    if (permissions.includes(requiredPermission) || permissions.includes('*')) {
      return next();
    }
    ```

---

## 4. User Creation & Registration Flow

Users are bound strictly to their respective organization from the moment of account creation.

* **User Mapping**: [auth.js](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/server/src/routes/auth.js#L22-L58)
  * User registration accepts a `tenantSlug` to lookup the corresponding `tenantId`.
  * The backend inserts a user record bound to that specific `tenant_id` and checks unique constraints per tenant:
    ```sql
    UNIQUE(tenant_id, email)
    ```
  * During user setup, an empty profile is initialized in the `user_security` table to manage login attempts and MFA settings on a per-user basis.

---

## 5. Scripted Tenant Provisioning Utility

To create new tenants, configure settings, define default roles, and assign users without changing runtime source code, a dedicated database utility has been established at [provisionTenant.js](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/server/scripts/provisionTenant.js).

### Running the Utility
To provision a clean tenant environment with predefined roles (Admin, Manager, User) and an admin user, execute:
```bash
node server/scripts/provisionTenant.js
```
