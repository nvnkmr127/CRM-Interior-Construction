# Interior & Construction CRM

An enterprise full-stack Customer Relationship Management (CRM) and Enterprise Resource Planning (ERP) platform purpose-built for interior design, turnkey architecture, and construction contracting businesses.

Built by **DigiCloudify**. Technology Stack: **React 19 + Node.js 20 + PostgreSQL 15 + Redis/BullMQ**.

---

## ⚡ Quick Start (Local Development)

### 1. Prerequisites
* **Node.js**: `v20.x` or later
* **PostgreSQL**: `v15.x` or later (running locally on `localhost:5432`)
* **Redis**: (Optional; automatic in-memory fallback is active if Redis is unavailable)
* **AWS S3 Account**: For document, drawing, and media storage
* **Google Gemini API Key**: For AI insights, lead scoring, and automated transcription

### 2. Environment Setup

```bash
# Clone the repository
git clone [your-repo-url]
cd CRM-Interior-Construction

# Install dependencies across all workspaces (client and server)
npm install

# Configure environment variables
cp server/.env.example server/.env
cp client/.env.example client/.env

# Edit server/.env — set DATABASE_URL, GEMINI_API_KEY, JWT_SECRET, S3_* variables
```

### 3. Database Initialization

```bash
# Create PostgreSQL database
createdb crm_db

# Run all database migrations
node server/src/db/migrate.js

# Seed demo data (workspaces, users, leads, projects, templates)
node server/src/db/seeds/demoData.js
```

### 4. Run Development Servers

```bash
# Starts both Express backend (:4000) and Vite frontend (:5173) concurrently
npm run dev
```

* **Client Application**: http://localhost:5173
* **Backend API Server**: http://localhost:4000
* **API Documentation (Swagger)**: http://localhost:4000/api-docs
* **Default Admin Login**: `admin@demo.com` / `Admin@123`

---

## 🐳 Production Deployment (Docker Compose)

```bash
# Copy and configure production environment variables
cp .env.production.example .env.production

# Build and start all container services (PostgreSQL, Redis, Server, Client)
docker compose --env-file .env.production up -d --build

# Run migrations inside the server container
docker compose exec server node server/src/db/migrate.js

# Seed initial data (optional)
docker compose exec server node server/src/db/seeds/demoData.js
```

---

## 🧪 Testing & Validation

```bash
# Run server unit & API integration tests (Jest)
npm test -w server

# Run client component tests (Vitest)
npm run test -w client

# Run Playwright End-to-End (E2E) tests
npx playwright test

# Validate client build (must pass with 0 warnings)
npm run build -w client
```

---

## 🧭 Key Navigation Routes & URLs

### Core Workspace
| Path | Module | Description |
| :--- | :--- | :--- |
| `/dashboard/sales` | Dashboards | Executive sales, operational velocity, and revenue KPIs |
| `/leads` | Leads | Multi-view pipeline: Kanban, List, Calendar, Map, and Sales Dashboard |
| `/leads/forms` | Lead Capture | Form builder for embeddable public capture forms (`/forms/:slug`) |
| `/projects` | Projects | Project portfolio grid/list with filter presets |
| `/projects/:id` | Project Detail | 36 specialized tabs across the 10 project execution phases |
| `/tasks` | My Tasks | Personal task management, dependencies, and checklists |

### Project Workflows & Operations
| Path | Module | Description |
| :--- | :--- | :--- |
| `/projects/coordination` | Coordination | Cross-project factory-to-site timeline coordination |
| `/projects/handover-dashboard` | Handover | Pre-handover readiness gates, snags clearance, and sign-offs |
| `/projects/retention-dashboard` | Retention | Post-handover AMC tracking, warranties, and repeat client retention |
| `/projects/resources` | Capacity | Team resource capacity, utilization, and allocation heatmaps |
| `/projects/absences` | Leaves | Staff leave calendar, project resource coverage, and approvals |

### Vendors & Production
| Path | Module | Description |
| :--- | :--- | :--- |
| `/warehouse` | Inventory | Multi-warehouse stock, material receipts (GRN), dispatches, quarantine |
| `/factory/production` | Factory | Modular joinery production orders, cutting lists, and CNC requests |
| `/analytics/vendors` | Vendors | Vendor performance scorecard, quality ratings, and delivery delays |
| `/analytics/vendors-capacity` | Vendors | Vendor capacity utilization and active purchase orders |
| `/vendor-lead-times` | Settings | Sourcing lead-time thresholds per material category |

### Financial Management & Governance
| Path | Module | Description |
| :--- | :--- | :--- |
| `/finance` | Finance | Cash flow overview, tax invoices, receipts, and master project ledger |
| `/financial-approvals` | Governance | High-value commercial approval queue, SLA tracking, and budget validation |
| `/analytics/profitability` | Analytics | Realized project gross margins, labor vs material cost breakdown |
| `/analytics/collection-forecast`| Analytics | Expected milestone cash collections and payment aging schedules |
| `/financial-settings` | Settings | Commercial threshold limits, tax rules, and approval matrix rules |

### Analytics & Reports
| Path | Module | Description |
| :--- | :--- | :--- |
| `/reports` | Reports Hub | Central hub to generate and export all reports to PDF and Microsoft Excel |
| `/analytics/leads` | Analytics | Pipeline conversion funnel, acquisition sources, sales velocity |
| `/analytics/projects` | Analytics | Milestone completion rates, schedule/cost variance indicators |
| `/analytics/csat` | Analytics | Client satisfaction (CSAT) trends, Net Promoter Scores (NPS) |
| `/analytics/delay-analysis` | Analytics | Root-cause taxonomy of project delays and contractor delay metrics |
| `/analytics/boq-variance` | Analytics | Estimated BOQ budget vs actual material and execution expenditures |

### Team, Security & Administration
| Path | Module | Description |
| :--- | :--- | :--- |
| `/team/members` | Team | Staff directory, employee profile management, and onboarding |
| `/team/roles` | RBAC | 3-Tier security: Granular Actions, Data Scopes, Field-level masking |
| `/organization` | Org Hierarchy| Interactive organizational chart with drag-and-drop reporting tree |
| `/settings/superadmin` | Superadmin | Platform Command Center: Multi-workspace provisioning & plan tabs |
| `/settings/company` | Settings | Tenant branding, company details, GST/tax registrations |
| `/login-history` | Security | User login audit logs with IP geolocation and device fingerprints |
| `/settings/audit-trail` | Audit | Global audit trail recording all entity modifications |

### Developer Tools & External Client Portal
| Path | Module | Description |
| :--- | :--- | :--- |
| `/developer/api` | Developer | API keys management, granular scopes, and interactive API Sandbox |
| `/developer/webhooks` | Webhooks | Inbound lead webhooks (Meta, Google, IndiaMART) & outbound event webhooks |
| `/portal/login` | Portal | Secure client login with mobile phone OTP authentication |
| `/portal/overview` | Portal | Client-facing project tracker, design asset approvals, change orders, snags |

---

## 🔑 Demo Credentials

| Role | Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **Superadmin / Developer** | `admin@demo.com` | `Admin@123` | Full access across all workspaces and platform command center |
| **Project Manager** | `priya@demo.com` | `Demo@123` | Project execution, site reports, milestones, and task assignment |
| **Interior Designer** | `rahul@demo.com` | `Demo@123` | Design assets, 2D/3D reviews, material palettes, and BOQ |
| **Sales Executive** | `ananya@demo.com` | `Demo@123` | Leads management, site visits, quotes, and conversion |
| **Client Portal** | Phone: `9876543210` | OTP printed to server log | Secure client access to project progress, approvals, and invoices |

---

## 📐 Architecture Highlights

* **Multi-Tenancy**: Shared database, shared schema with strict `tenant_id` query isolation.
* **3-Tier RBAC**: Combines Granular Action Permissions, SQL Data Scoping (Own, Team, Dept, Branch, All), and Field-Level Data Redaction.
* **Design Token System**: Vanilla CSS Modules with strict CSS variable tokens (`var(--color-bg)`, `var(--color-surface)`, etc.).
* **Presigned S3 Uploads**: File uploads stream directly from browser to AWS S3; API server stays lightweight.
* **Event-Driven Architecture**: Internal EventBus handles automated notifications, AI analysis, timeline generation, and webhook triggers.

---
Built by DigiCloudify · 2026
