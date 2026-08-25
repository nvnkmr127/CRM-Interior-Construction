# Multi-Tenant Operations & Developer Guide

This guide details the operations, verification procedures, and architecture of the existing multi-tenant implementation within the CRM system.

---

## 1. Tenant Architecture

The application implements logical multi-tenancy using a **Shared Database + Shared Schema** model:
* **Database Layer**: Every tenant occupies a row in the `tenants` table. Transactional data tables partition information using `tenant_id UUID` foreign keys.
* **Tenant-Scoped Users**: The `users` table enforces a composite unique constraint `UNIQUE(tenant_id, email)` enabling identical emails to register across separate client organizations.
* **Tenant-Scoped Roles & Permissions**: Roles are bound to `tenant_id` and contain JSON-encoded action lists (e.g., `["leads:read"]`).
* **Tenant Security Settings**: Dynamic security controls (timeouts, MFA, geofencing) are mapped per-tenant in `tenant_security_settings`.

---

## 2. Tenant Provisioning

* **Script Path**: [server/scripts/provisionTenant.js](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/server/scripts/provisionTenant.js)
* **Execution Command**:
  ```bash
  node server/scripts/provisionTenant.js "<name>" "<slug>" "<adminEmail>" "<adminName>" "<adminPassword>"
  ```
* **Required Parameters**:
  1. `name`: Full legal display name of the client organization.
  2. `slug`: URL-safe unique lowercase routing handle (e.g., `client-a`).
  3. `adminEmail`: Initial workspace administrator email.
  4. `adminName`: Personal display name of the administrator.
  5. `adminPassword`: Password string (minimum 8 characters).

---

## 3. Creating a New Client (Workflow)

```
Create Tenant Row (slug lookup)
      ↓
Initialize Security Settings (timeout/IP rules)
      ↓
Generate Tenant Roles (Admin, Manager, User)
      ↓
Create Admin User (bcrypt password hashing)
      ↓
Initialize User Security Status (MFA checks)
      ↓
Verify Login Routing & Token Session
      ↓
Verify Tenant Isolation Boundaries
```

---

## 4. Three Client Setup Example

### Client A Setup
```bash
node server/scripts/provisionTenant.js "Client Organization A" "client-a" "admin@client-a.com" "Admin A" "SecurePasswordA1!"
```

### Client B Setup
```bash
node server/scripts/provisionTenant.js "Client Organization B" "client-b" "admin@client-b.com" "Admin B" "SecurePasswordB2!"
```

### Client C Setup
```bash
node server/scripts/provisionTenant.js "Client Organization C" "client-c" "admin@client-c.com" "Admin C" "SecurePasswordC3!"
```

---

## 5. Organization Settings Map

| Setting Name | Database Location | Configuration Method | Default Value | Active Effect | Scope |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Workspace Name** | `tenants.name` | Script argument / SQL update | *User input* | Client UI branding contexts | Tenant |
| **Workspace Slug** | `tenants.slug` | Script argument / SQL update | *User input* | Workspace login path lookup | Tenant |
| **Tenant Status** | `tenants.is_active` | SQL update statement | `true` | Session verification block | Tenant |
| **MFA Required** | `tenant_security_settings.mfa_required_all` | SQL update statement | `false` | Next login attempt | Tenant |
| **Session Timeout** | `tenant_security_settings.session_timeout_minutes` | SQL update statement | `120` | Dynamic validation interval | Tenant |
| **Concurrent Limit** | `tenant_security_settings.concurrent_login_limit` | SQL update statement | `3` | Next login verification check | Tenant |
| **Password Policy** | `tenant_security_settings.password_min_length` | SQL update statement | `8` | Next password modification | Tenant |
| **Allowed Countries** | `tenant_security_settings.allowed_countries` | SQL update statement | `[]` (unrestricted) | Next session validation | Tenant |
| **Allowed Networks** | `tenant_security_settings.allowed_ips` | SQL update statement | `[]` (unrestricted) | Next request validation check | Tenant |

---

## 6. Roles & Permissions (RBAC)

* **Storage Location**: Roles and JSON-encoded permissions arrays are stored in the `roles` table.
* **Tenant Scoping**: Roles are bound to a specific tenant using `tenant_id`. Users refer to a role via `role_id REFERENCES roles(id)`.
* **Authorization Checks**: [authorize.js](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/server/src/middleware/authorize.js) parses the JWT payload permissions array (`req.user.permissions`) on every endpoint request.

---

## 7. User Creation Flow

1. **Routing and Slug Resolution**: Handled in [auth.js](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/server/src/routes/auth.js#L35-L45) where `tenantSlug` resolves to the corresponding `tenantId`.
2. **User Data Insertion**: Scoped in [register.js](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/server/src/services/auth/register.js#L26-L40).
3. **User Security Record**: Set up in [register.js:L44](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/server/src/services/auth/register.js#L44) inside `user_security`.
4. **Session Association**: Decoded context and resolved pool is initialized on request routing inside [authenticate.js](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/server/src/middleware/authenticate.js#L175-L178).

---

## 8. Data Isolation

All business data repositories restrict operations using combined identifier lookups:
* **Leads**: [leadRepository.js](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/server/src/repositories/leadRepository.js#L142) query contains `WHERE l.tenant_id = $1 AND l.id = $2`.
* **Projects**: [projectRepository.js](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/server/src/repositories/projectRepository.js#L166) query contains `WHERE p.tenant_id = $1 AND p.id = $2`.
* **Search**: [searchController.js](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/server/src/controllers/searchController.js) filters all subqueries.

---

## 9. Security Verification Procedure

Evaluate boundaries by running cross-tenant verification request scripts:
* **Positive Validation (A → A)**: Log in as `admin@client-a.com` and verify that Lead A returns a `200 OK`.
* **Negative Validation (A → B)**: Authenticated as `admin@client-a.com`, attempt to retrieve Lead B using its ID. The request must return `404 Not Found` or `403 Forbidden`.
* **IDOR Validation**: Attempt to patch Project B authenticated under a Client A session token. Confirm the payload fails with an access error.

---

## 10. Production Checklist

- [ ] New tenant configured in the `tenants` table.
- [ ] Mapped unique routing slug.
- [ ] Initialize default entries in `tenant_security_settings`.
- [ ] Create initial administrative role.
- [ ] Provision administrator account under the client slug.
- [ ] Verify administrator login and JWT parsing.
- [ ] Run cross-tenant request tests using Lead IDs from another tenant.
- [ ] Validate search outputs return only active tenant information.
- [ ] Confirm export scripts output only scoped CSV data.

---

## 11. "Where Do I Configure This?" Quick Map

* **Tenant creation**:
  * [provisionTenant.js](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/server/scripts/provisionTenant.js) → `provisionTenant()` → `node server/scripts/provisionTenant.js`
* **Tenant security**:
  * [provisionTenant.js](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/server/scripts/provisionTenant.js) → `INSERT INTO tenant_security_settings`
* **Roles**:
  * [roles.js](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/server/src/routes/roles.js) → `INSERT INTO roles`
* **Users**:
  * [register.js](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/server/src/services/auth/register.js) → `registerUser()` → `INSERT INTO users`
* **Isolation**:
  * [authenticate.js](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/server/src/middleware/authenticate.js) → `authenticate` middleware → `req.tenantId` query context
* **Session**:
  * [authenticate.js](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/server/src/middleware/authenticate.js) → `SELECT * FROM sessions`

---

## 12. What NOT To Touch

Do not modify the following files during standard tenant management procedures to avoid breaking tenant routing schemas:
* [server/src/middleware/authenticate.js](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/server/src/middleware/authenticate.js) (Auth middleware)
* [server/src/middleware/authorize.js](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/server/src/middleware/authorize.js) (RBAC routing)
* [server/src/db/tenantResolver.js](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/server/src/db/tenantResolver.js) (Connection pool routing)

---

## 13. Emergency Tenant Deactivation

To disable a tenant immediately, update the `is_active` flag inside the `tenants` table. Active sessions will be terminated on the next request verification step:
```sql
UPDATE tenants SET is_active = false WHERE slug = 'client-a';
```

---

## 14. Architecture & Request Flow

### Architecture Diagram
```
Tenant (tenants table)
  ↓
Users (users table)
  ↓
Roles (roles table)
  ↓
Permissions (actions permissions arrays)
  ↓
Tenant-Scoped Resources (leads, projects, tasks)
  ↓
tenant_id constraint filtering
  ↓
PostgreSQL Database
```

### Request Flow
```
User Login Request (with tenantSlug)
      ↓
Tenant ID mapped to JWT token payload
      ↓
Token validated via authenticate middleware
      ↓
req.tenantId populated on request context
      ↓
authorize / dataScope checks verified
      ↓
Database query executes: WHERE tenant_id = req.tenantId
      ↓
Response returned containing only tenant-owned data
```
