# Interior & Construction CRM

Full-stack CRM for interior design and construction companies.
Built by DigiCloudify. Stack: React + Node.js + PostgreSQL.

## Quick Start (Local Development)

### 1. Prerequisites
- Node.js 20+
- PostgreSQL 15+ running on localhost:5432
- AWS account (for S3 document storage)

### 2. Setup

```bash
git clone [your-repo-url]
cd crm
npm install            # installs all workspaces

# Configure environment
cp server/.env.example server/.env
cp client/.env.example client/.env
# Edit server/.env — set DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, S3_* vars
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
/tests           Playwright E2E tests
/.github         CI/CD workflows
```

## Key URLs

| Path | Description |
|------|-------------|
| /dashboard | Main dashboard |
| /leads | Lead management (Kanban) |
| /projects | Project list and detail |
| /config | Admin configuration centre |
| /portal/login | Client-facing portal |
| /analytics/leads | Lead funnel analytics |

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@demo.com | Admin@123 |
| PM | priya@demo.com | Demo@123 |
| Designer | rahul@demo.com | Demo@123 |
| Sales | ananya@demo.com | Demo@123 |
| Portal Client | Phone: 9876543210 | OTP in server console |

## Architecture Decisions

- **Tenant isolation**: every DB query includes `WHERE tenant_id = $tenantId`
- **Refresh token rotation**: each refresh invalidates the previous token
- **S3 presigned URLs**: client uploads direct to S3, server never handles file bytes
- **Automation queue**: pg-based polling every 5s — no BullMQ dependency in v1
- **Config Centre**: zero hardcoded business rules — all stages, fields, templates configurable
- **Portal auth**: OTP-based, separate from staff JWT — portal token can never access staff routes

---
Built with Claude · DigiCloudify · 2025
