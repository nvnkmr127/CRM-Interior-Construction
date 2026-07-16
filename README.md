# Interior & Construction CRM

Full-stack CRM for interior design and construction companies.
Built by DigiCloudify. Stack: React + Node.js + PostgreSQL.

## Quick Start (Local Development)

### 1. Prerequisites
- Node.js 20+
- PostgreSQL 15+ running on localhost:5432
- Redis (Optional, fallback to in-memory available)
- AWS account (for S3 document storage)
- Google Gemini API Key (for AI features)

### 2. Setup

```bash
git clone [your-repo-url]
cd crm
npm install            # installs all workspaces

# Configure environment
cp server/.env.example server/.env
cp client/.env.example client/.env
# Edit server/.env — set DATABASE_URL, GEMINI_API_KEY, JWT_SECRET, S3_* vars
```

### 3. Database

```bash
# Create database
createdb crm_db

# Run migrations (auto-runs on server start, or manually:)
node server/src/db/migrate.js

# Seed demo data
node server/src/db/seeds/demoData.js
```

### 4. Start Development

```bash
npm run dev   # starts both server (:4000) and client (:5173)
```

Open http://localhost:5173
Login: admin@demo.com / Admin@123

## Production Deployment (Docker)

```bash
# Copy and fill in production env
cp .env.production.example .env.production
# Edit .env.production

# Start all services
docker compose --env-file .env.production up -d --build

# Run migrations
docker compose exec server node server/src/db/migrate.js

# Seed demo data (optional)
docker compose exec server node server/src/db/seeds/demoData.js
```

## Running Tests

```bash
npm test -w server            # backend unit + API tests
npm run test -w client        # frontend component tests
npx playwright test           # E2E tests (requires running app)
```

## Project Structure

```
/client          React + Vite frontend
/server          Node.js + Express backend
/shared          Shared type definitions
/docs            Architecture and module documentation
/tests           Playwright E2E tests
/.github         CI/CD workflows
```

## Key URLs

| Path | Description |
|------|-------------|
| /dashboard | Main dashboard |
| /leads | Lead management (Kanban) |
| /projects | Project execution, milestones, and tasks |
| /config | Admin configuration centre |
| /portal/login | Client-facing portal |
| /analytics/leads | Lead funnel analytics |
| /analytics/projects | Project performance analytics |
| /financials | Financial dashboard and invoice tracking |
| /handover | Handover checklists and sign-offs |

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@demo.com | Admin@123 |
| PM | priya@demo.com | Demo@123 |
| Designer | rahul@demo.com | Demo@123 |
| Sales | ananya@demo.com | Demo@123 |
| Portal Client | Phone: 9876543210 | OTP in server console |

## Architecture Decisions

- **Tenant isolation**: Every DB query is scoped with `WHERE tenant_id = $tenantId`.
- **Modular Monolith**: Organized into domains (Leads, Projects, Analytics, Portal).
- **AI Integration**: AI-driven insights and workflow assistance via Gemini API.
- **Automation Queue**: Redis + BullMQ (with in-memory fallback) for background jobs and escalation rules.
- **Config Centre**: Zero hardcoded business rules — all stages, fields, and templates are configurable.
- **Portal Auth**: OTP-based, separate from staff JWT — portal token cannot access internal staff routes.
- **S3 Presigned URLs**: Client uploads directly to S3; server never handles file bytes.

---
Built with Claude · DigiCloudify · 2026
