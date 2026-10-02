# Interior & Construction CRM - Documentation Hub

Welcome to the comprehensive documentation directory for the **Interior Design & Construction CRM** platform.

This directory contains in-depth architectural guides, API endpoint references, database schema models, permission matrices, and operational manuals designed for software engineers, devops operators, and AI coding agents.

---

## 📚 Master Documentation Index

| Document | Primary Domain | Key Topics Covered |
| :--- | :--- | :--- |
| **[project.md](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/docs/project.md)** | Project Execution Suite | Complete 36-tab execution workspace, 10 lifecycle stages, Gantt charts, BOQ, drawing register, QC, handover gates, and sub-router APIs. |
| **[financial-approvals.md](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/docs/financial-approvals.md)** | Financial Governance | Commercial approval queue, SLA tracking, multi-tier approval chains, budget overrun validator, risk analyzer, and bulk actions. |
| **[lead-project-relation.md](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/docs/lead-project-relation.md)** | Sales & Conversion | 1-to-1 lead-to-project relation, pre-conversion checklist guard (L-069), duplicate guard (L-070), and BOQ migration. |
| **[lead_import_schema.md](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/docs/lead_import_schema.md)** | Lead Ingestion | 17-field CSV import specification, column mapping rules, duplicate checks, and sample compliant CSV templates. |
| **[ProjectAnalytics.md](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/docs/ProjectAnalytics.md)** | Analytics & Reports | 11 specialized analytics dashboards, formula definitions, zero-fake fallback rules, and Reports Hub PDF/Excel export. |
| **[warehouse-and-inventory.md](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/docs/warehouse-and-inventory.md)** | Supply Chain | Multi-warehouse stock tracking, Inward Goods Receipt (GRN), site dispatches, site returns, defective quarantine, and stock ledgers. |
| **[factory-production.md](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/docs/factory-production.md)** | Manufacturing | Modular joinery & millwork orders, panel cutting lists, CNC routing requests, and factory-to-site timeline coordination. |
| **[client-portal.md](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/docs/client-portal.md)** | Client Portal | White-labeled client experience, mobile phone OTP authentication, dual-token security, design approvals, change orders, and snags. |
| **[developer-and-integrations.md](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/docs/developer-and-integrations.md)** | Developer Tools | Versioned REST API (`/api/v1`), API Sandbox, Inbound Webhooks (Meta, Google, IndiaMART), Outbound HMAC webhooks, and S3 upload pipeline. |
| **[Roles_And_Permissions.md](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/docs/Roles_And_Permissions.md)** | Security & RBAC | 3-Tier security: Granular Action Permissions (60+ actions), SQL Data Scopes (Own, Team, Dept, Branch, All), and Field-Level Data Redaction. |
| **[TENANT_OPERATOR_GUIDE.md](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/docs/TENANT_OPERATOR_GUIDE.md)** | Multi-Tenancy & Operations | Shared DB / Shared Schema isolation, Platform Command Center UI (`/settings/superadmin`), CLI provisioning utility, and security policies. |

---

## 🏗️ Core Architectural Principles

When building, extending, or maintaining this codebase, adhere strictly to these established architectural standards:

1. **Sidebar Visibility & Developer Bypass**:
   * Platform Developers and Superadmins (`isAdmin`) must immediately see all navigation tabs for testing.
   * The developer bypass check (`if (isAdmin) return true;`) in `Sidebar.jsx` must remain at the very top of `filterItem`.
2. **Real Database Data (Zero Fake Fallbacks)**:
   * Numerical, percentage, and currency metrics must render the actual database values. Never use `value || default` fallback syntax when `0` or empty string is a valid data state.
3. **CRM Design System Tokens**:
   * Use Vanilla CSS Modules (`*.module.css`) referencing central theme variables (`var(--color-bg)`, `var(--color-surface)`, `var(--color-accent)`, etc.) defined in `client/src/index.css`.
4. **Tenant Scoping & Security**:
   * Every database query must enforce `tenant_id = $tenantId`.
   * Internal staff routes must never accept external client portal tokens.
5. **Direct S3 Uploads**:
   * All media, drawings, and documents must upload directly to AWS S3 using presigned URLs; the Node.js server never processes raw binary file uploads directly.

---
Maintained by DigiCloudify Engineering
