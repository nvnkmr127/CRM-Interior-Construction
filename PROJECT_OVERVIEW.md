# CRM Interior & Construction - Comprehensive Project Overview

## 1. 🏗️ Project Architecture & Design Philosophy
This project is an enterprise full-stack Customer Relationship Management (CRM) and Enterprise Resource Planning (ERP) platform purpose-built for interior design, turnkey architecture, and construction contractors. 

It leverages a modern **Modular Monolith** architecture with strict logical multi-tenancy, high-performance PostgreSQL persistence, event-driven workflows, and a dual-interface architecture (Internal Staff Application + External Client Portal).

---

## 2. 🛠️ Technology Stack

### Frontend Application (`/client`)
* **Framework**: React 19 (via Vite 8)
* **Styling & Design System**: 
  * Strict **Vanilla CSS Modules** (`*.module.css`) + centralized CSS Design System tokens (`src/index.css`).
  * Conforms strictly to predefined theme variables (`var(--color-bg)`, `var(--color-surface)`, `var(--color-accent)`, `var(--radius-lg)`, etc.).
* **State Management**: Zustand stores + scoped React Contexts (`AuthContext`, `ToastContext`, `BreadcrumbsContext`, `ConfirmContext`).
* **Routing**: React Router DOM (v7) with granular route-level permissions and subtab state persistence.
* **Interactive & Visual Libraries**:
  * Drag-and-Drop: `@dnd-kit/core` & `@dnd-kit/sortable` (for Kanban boards, Gantt timeline, and org trees).
  * Data Visualization & Charts: `recharts`
  * Document Generation & Export: `jspdf`, `jspdf-autotable`, `xlsx`
  * Rich-Text Editor: Tiptap (with extensions for tables, mentions, links, images)
  * Date Handling: `date-fns`, `react-datepicker`
* **API Client**: Axios with centralized interceptors, automatic JWT injection, and session token renewal.

### Backend Application (`/server`)
* **Runtime**: Node.js 20+
* **Web Framework**: Express 4 with security middleware (`helmet`, `cors`, `cookie-parser`).
* **Database & Persistence**: PostgreSQL 15+ (via `pg` connection pool with automatic transactions).
* **Caching & Background Queues**: Redis + BullMQ (with automatic in-memory fallback for local development).
* **Schema Validation**: Zod validators shared across client and server (`/shared/validators`).
* **Authentication & Authorization**:
  * Staff: Stateless JWT tokens with browser cookies or Authorization headers.
  * Multi-Factor Auth (MFA): TOTP (`otplib`) with QR codes and WebAuthn biometrics.
  * Client Portal: Phone-number OTP authentication with session-isolated portal tokens.
  * Access Control: 3-tier RBAC (Actions, Data Scoping, Field-Level Masking).
* **Storage & File Handling**: AWS S3 Client (`@aws-sdk/client-s3`) using secure presigned URLs; server never handles raw media bytes directly.
* **Artificial Intelligence**: Google Gemini API (`@google/genai`) for lead scoring, automated transcription, and project risk forecasting.
* **Document Processing**: `pdfkit`, `pdf-parse`, `dompurify`.

### Testing & Quality Assurance
* **Backend Unit & Integration**: Jest, Supertest
* **Frontend Component Tests**: Vitest, React Testing Library
* **End-to-End (E2E)**: Playwright
* **Code Quality**: ESLint (strictly configured for zero compiler warnings)

---

## 3. 📁 Directory Structure

```text
/
├── client/                     # React 19 Vite Frontend
│   ├── src/
│   │   ├── api/                # Axios endpoints organized by domain
│   │   ├── components/         # Reusable UI components & domain widgets
│   │   │   ├── common/         # Search, filters, timeline, badges
│   │   │   ├── layout/         # Shell, Sidebar, Header, OfflineBanner
│   │   │   ├── leads/          # Kanban, drawer, forms, map, calendar
│   │   │   ├── projects/       # 30+ project tabs, timeline, Gantt, BOQ
│   │   │   ├── finance/        # Approvals, risk summary, budget validator
│   │   │   └── ui/             # Design-system buttons, inputs, modals
│   │   ├── constants/          # Navigation, permissions, field masks, roles
│   │   ├── hooks/              # Custom hooks (permissions, persisted tabs, etc.)
│   │   ├── pages/              # Routed pages (Leads, Projects, Finance, Analytics, Config)
│   │   ├── portal/             # Client-facing portal application & components
│   │   ├── store/              # Zustand stores & React contexts
│   │   └── index.css           # Global Design System tokens & CSS utilities
│   ├── package.json
│   └── vite.config.js
├── server/                     # Node.js Express Backend
│   ├── src/
│   │   ├── app.js              # Express app initialization, middleware & route mounting
│   │   ├── server.js           # HTTP server bootstrapping & port binding
│   │   ├── config/             # DB pool, Redis, S3, Swagger, and logger
│   │   ├── constants/          # Permissions, field lists, system defaults
│   │   ├── controllers/        # Domain request controllers
│   │   ├── middleware/         # Auth, RBAC, data scoping, field masking, rate limits
│   │   ├── migrations/         # 37+ SQL migration files (150+ tables)
│   │   ├── repositories/       # Isolated DB query repositories
│   │   ├── routes/             # REST endpoints organized by domain
│   │   ├── services/           # Core business logic & transaction orchestrators
│   │   └── utils/              # Helper utilities, logger, risk analyzer
│   └── package.json
├── shared/                     # Shared Zod validation schemas
├── docs/                       # Architecture, module, and integration documentation
├── tests/ & e2e/               # Jest, Vitest, and Playwright test suites
├── docker-compose.yml          # Local container orchestration
└── README.md                   # Quick-start setup guide
```

---

## 4. 🚀 Core Application Modules & Functional Footprint

### 1. Sales & Leads Pipeline
* Multi-view lead pipeline: **Kanban Board** (with drag-and-drop stage updates), **Table List**, **Interactive Calendar**, **Geographic Map View**, and **Sales Dashboard**.
* Detailed Lead Drawer: Client requirements, budget constraints, floor plans, design inspirations, measurement bookings, follow-up logs, and loss analytics.
* **Lead-to-Project Conversion**: Atomic one-way conversion workflow enforcing pre-conversion checklist guards (L-069) and duplicate conversion prevention (L-070).
* **Lead Capture Forms**: Visual form builder to create embeddable public forms (`/forms/:slug`) with auto-assignment and webhook ingestion.

### 2. Project Execution Suite (36 Specialized Tabs)
* Organized across 10 project lifecycle stages:
  1. **Initiation & Setup**: Overview, Phases & Schedule (Timeline & Gantt), Client Profile, Site Details, Team & Roles, Booking Confirmation, Baseline Assessment.
  2. **Design & Architectural Planning**: Design & Approvals, Drawing Register (revisions, DWG/PDFs), Design Brief, Design Assets, Design Reviews, Material Palettes, Substitutions, Coordination.
  3. **Financials & Client Cash Flow**: Financial Overview, Project Budget, Quotations & BOQ Builder, Milestone Payments, Change Orders, Budget Variance, Commercial Approvals.
  4. **Procurement & Sourcing**: Purchase Requests, Purchase Orders, Vendor Directory, Material Deliveries (Site GRN), Factory Production.
  5. **Site Execution & Monitoring**: Tasks Board, Room/Zone Progress, Site Visits (geo-tagging & photo evidence), Daily Site Reports (DSR), Weekly Progress Reports, Documents Repository, Meeting Minutes (MOM), Delay Notifications, MEP Checklists.
  6. **Quality Control & Pre-Handover**: Snag Lists, Handover Readiness Gates, Handovers.
  7. **Property Handover**: Formal Handover Checklist & Digital Client Sign-Off.
  8. **Closure & Retrospectives**: Project Closure Checklist, Team & Vendor Retrospectives.
  9. **Post-Handover & Maintenance**: Product Warranties, Annual Maintenance Contracts (AMCs), Service Tickets with SLAs, Customer Retention & Referrals.
  10. **Audit & Governance**: Chronological Activity Logs and Status Modals (Pause, Resume, Reopen, Cancel, Archive, Delete).

### 3. Financials & Commercial Governance
* **Financial Approvals Center** (`/financial-approvals`): Review and decisioning for invoices, offline payments, discounts, credit notes, refunds, and change orders.
* Risk evaluation engines: Project Budget Overrun Validator, Construction Progress Validator, and Multi-Tier Approval Chain builder.
* **Finance Dashboard** (`/finance`): Master Cash Flow, Invoices, Receipts, Master Ledger, Cross-Project Collections, and Project Profitability.

### 4. Warehouse & Inventory Management (`/warehouse`)
* Multi-warehouse management with bin locations.
* Material Receipts (Inward GRN), Dispatches to Site, Site Returns, Defective Goods Quarantine, and complete stock transaction ledgers.

### 5. Factory Production & Joinery (`/factory/production`)
* Modular millwork and joinery production orders.
* CNC cutting requests, panel optimization status, factory-to-site coordination timeline.

### 6. Client Collaboration Portal (`/portal/*`)
* Dedicated client experience authenticated via mobile phone OTP.
* Real-time milestone progress tracking, interactive design asset reviews, material palette approvals, change order approvals, digital payments, snag submissions, warranty certificates, and service ticket logging.

### 7. Analytics Suite & Reports Hub (`/reports`)
* 11 dedicated analytics dashboards covering Lead Funnel, Project Health, CSAT & NPS, Delay Taxonomy, BOQ Variance, Team Capacity, Team Workload, Vendor Performance, Vendor Capacity, Project Profitability, and Cash Collection Forecasts.
* Direct export of comprehensive reports to PDF and Microsoft Excel format.

### 8. Team Management & Granular RBAC (`/team/*` & `/organization`)
* Interactive Organizational Chart with drag-and-drop reporting hierarchy (Branches, Departments, Roles).
* 3-Tier Security Matrix: Granular Action Permissions (60+ action strings), Data Scopes (Own, Assigned, Team, Department, Branch, All), and Field-Level Redaction (Hidden, Read-Only, Editable).
* Staff profile approvals and role versioning.

### 9. Developer Tools, API & Webhooks (`/developer/*`)
* Custom API Key generation with granular scopes and expiration.
* Interactive API Sandbox / Playground and real-time API latency logs.
* Inbound Webhooks: Native parsing for Meta/Facebook Lead Ads, Google Ads, IndiaMART, Justdial, and Zapier.
* Outbound Webhooks: Event-driven webhooks with HMAC-SHA256 signature verification and delivery retries.

### 10. Platform Command Center (`/settings/superadmin`)
* Multi-workspace provisioning, plan tier assignment (Starter, Growth, Enterprise), dynamic sidebar tab configurator, global database health metrics, and tenant security enforcement.

---

## 5. 🔒 Security & Data Strategy

* **Tenant Isolation**: Every database interaction is scoped to `tenant_id`. Cross-tenant data leakage is prevented at the database and application levels.
* **Dual-Token Architecture**: Internal staff tokens (JWT) and external client portal tokens (OTP) are kept completely distinct. Portal tokens are rejected if presented to internal administration routes.
* **Direct S3 Uploads**: Media, drawings, and invoices are uploaded directly from client browsers to AWS S3 using presigned URLs with verified content types, keeping the Node.js API server lightweight and immune to memory exhaustion attacks.
* **Design Token Integrity**: The entire application strictly respects design tokens defined in the CRM Design System, maintaining a visually cohesive and premium interface across all modules.
