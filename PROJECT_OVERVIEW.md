# CRM-Interior-Construction - Project Overview

## 🏗️ Project Architecture
This project is a full-stack Customer Relationship Management (CRM) platform explicitly designed for interior design and construction companies. It leverages a modern **Modular Monolith** architecture with strict tenant isolation for a multi-tenant environment.

## 🛠️ Technology Stack

### Frontend (Client)
- **Framework**: React 19 (via Vite)
- **Styling**: Tailwind CSS 3.4 + Autoprefixer
- **State Management**: Zustand
- **Routing**: React Router DOM
- **UI & Data Visualization**: React Grid Layout, Recharts
- **Rich Text Editing**: Tiptap (with extensions for tables, mentions, links)
- **API Client**: Axios

### Backend (Server)
- **Environment**: Node.js
- **Web Framework**: Express
- **Database**: PostgreSQL (via `pg` client)
- **Caching & Job Queues**: Redis + BullMQ (with in-memory fallback options)
- **Validation**: Zod
- **Authentication**: JWT & OTP (otplib)
- **Storage/Files**: AWS S3 Client (`@aws-sdk/client-s3`), Multer
- **AI Integrations**: Google Gemini API (`@google/genai`)
- **Document Generation**: PDFKit, pdf-parse
- **Security**: Helmet, Express Rate Limit, CORS, bcryptjs

### Testing & Tooling
- **Backend Tests**: Jest, Supertest
- **Frontend Tests**: Vitest, React Testing Library
- **End-to-End (E2E)**: Playwright
- **Code Quality**: ESLint

## 📁 Directory Structure

```text
/
├── client/                 # React frontend application
│   ├── src/                # UI components, pages, state (Zustand), and assets
│   ├── public/             # Static assets
│   ├── tests/              # Frontend component tests (Vitest)
│   ├── package.json        # Frontend dependencies
│   ├── tailwind.config.js  # Styling configuration
│   └── vite.config.js      # Build tool configuration
├── server/                 # Node.js backend application
│   ├── src/                # Express controllers, routes, models, and services
│   ├── migrations/         # Database migration scripts
│   ├── tests/              # Backend unit and integration tests (Jest)
│   └── package.json        # Backend dependencies
├── shared/                 # Shared code and type definitions between client & server
├── docs/                   # Additional architecture and module documentation
├── e2e/                    # Playwright end-to-end tests
├── tests/                  # General project testing resources
├── .github/                # CI/CD workflows for automated deployment/testing
├── docker-compose.yml      # Multi-container orchestration (DB, Server, Client)
└── README.md               # Quick-start setup instructions
```

## 🚀 Key Modules & Features

1. **Leads & Pipeline Management**: Kanban boards, funnel tracking, and status transitions.
2. **Project Execution**: Tasks, milestones, task dependencies, and project performance tracking.
3. **Financial Dashboard**: Invoice tracking, budget monitoring, and financial health metrics.
4. **Client Portal**: Dedicated secure portal for clients with OTP-based authentication.
5. **Config Centre**: Dynamic configuration for business rules, stages, fields, and templates (no hardcoded rules).
6. **AI Assistant**: Automated insights, data extraction, and workflow assistance powered by the Google Gemini API.
7. **Document & Media Handling**: Direct S3 uploads (via presigned URLs), PDF parsing, and document generation.

## 🔒 Security & Data Strategy
- **Tenant Isolation**: Every database query is strictly scoped via `WHERE tenant_id = $tenantId`.
- **Stateless Auth**: Separate tokens are used for staff (JWT) and external portal clients (OTP). Internal routes are protected against portal token usage.
- **Direct S3 Uploads**: The server never parses raw file bytes; clients directly interact with S3 buckets using presigned URLs, keeping the backend highly performant.
