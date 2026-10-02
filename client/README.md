# CRM Interior & Construction - Frontend Client Application

This directory contains the single-page React frontend application for the Interior Design & Construction CRM platform.

---

## 🛠️ Technology Stack

* **Framework**: React 19 (SPA via Vite 8)
* **Styling**: Vanilla CSS Modules (`*.module.css`) + Global CSS Design System tokens (`src/index.css`)
* **State Management**: Zustand stores + React Contexts (`AuthContext`, `ToastContext`, `ConfirmContext`, `BreadcrumbsContext`)
* **Routing**: React Router DOM (v7) with route guards, lazy loading, and tab persistence
* **Libraries**:
  * Drag & Drop: `@dnd-kit/core` & `@dnd-kit/sortable`
  * Data Visualization: `recharts`
  * Document Generation: `jspdf`, `jspdf-autotable`, `xlsx`
  * Rich Text Editing: Tiptap
  * Icons: `react-icons`

---

## 📁 Directory Structure

```text
client/src/
├── api/                # Domain-specific Axios wrappers (leads, projects, financials, etc.)
├── assets/             # Logos, brand graphics, and static SVGs
├── components/         # Reusable UI & Domain Components
│   ├── common/         # Search bars, timelines, badges, filters, sort dropdowns
│   ├── finance/        # Approval dashboards, SLA trackers, risk summaries
│   ├── layout/         # Shell, Sidebar, Header, OfflineBanner
│   ├── leads/          # Kanban boards, drawers, lead tables, map, calendar
│   ├── projects/       # 30+ project tabs, timeline, Gantt, BOQ, QC checklists
│   └── ui/             # Design-system buttons, inputs, modals, cards, badges
├── constants/          # Navigation groups, 3-tier permissions, role defaults, field permissions
├── context/            # Specialized context providers
├── hooks/              # Custom hooks (permissions, persisted tabs, debouncing, breadcrumbs)
├── pages/              # Routed pages
│   ├── analytics/      # 11 analytics dashboards + Reports Hub
│   ├── auth/           # Login, registration, password recovery
│   ├── config/         # System settings (stages, custom fields, templates, org chart)
│   ├── dashboard/      # Executive sales & operational dashboards
│   ├── developer/      # API Keys, sandbox playground, webhooks
│   ├── factory/        # Global factory production & CNC orders
│   ├── finance/        # Finance dashboard & financial approvals
│   ├── leads/          # Leads pipeline & sales management
│   ├── profile/        # User profile & security settings (MFA)
│   ├── projects/       # Projects list, grid, detail page (36 tabs)
│   ├── public/         # Public lead capture forms
│   ├── settings/       # Company settings, audit trail, approval matrix
│   ├── tasks/          # My Tasks board & task dependencies
│   └── warehouse/      # Warehouse inventory, dispatch, and quarantine
├── portal/             # Client-Facing Portal Application
│   ├── components/     # Portal shell, navigation, header
│   ├── pages/          # Portal overview, timeline, approvals, snags, invoices
│   └── store/          # Portal auth context (OTP-based)
├── store/              # Zustand stores & core app contexts
├── styles/             # Modular helper stylesheets
├── index.css           # CRM Design System tokens (colors, typography, spacing, shadows)
├── App.jsx             # Top-level route hierarchy & lazy-loaded imports
└── main.jsx            # Application bootstrap
```

---

## 🎨 UI Aesthetic & Design System Guidelines

All components and styling must strictly follow the CRM Design System defined in [src/index.css](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/client/src/index.css):

### Design Tokens
* **Surfaces & Backgrounds**: `var(--color-bg)`, `var(--color-surface)`, `var(--color-surface-2)`
* **Typography**: `var(--text-2xl)`, `var(--text-xl)`, `var(--text-base)`, `var(--text-sm)`, `var(--text-xs)`
* **Brand Accents**: `var(--color-accent)`, `var(--color-accent-hover)`, `var(--color-accent-bg)`
* **Status Colors**: `var(--color-success)`, `var(--color-warning)`, `var(--color-danger)`, `var(--color-info)`
* **Borders & Radii**: `var(--color-border)`, `var(--radius-sm)`, `var(--radius-md)`, `var(--radius-lg)`
* **Shadows & Transitions**: `var(--shadow-sm)`, `var(--shadow-md)`, `var(--transition-fast)`

### Aesthetic Standards
* Components must use subtle hover elevation (`transform: translateY(-2px)`).
* Do not introduce raw hex/rgb values in individual components; reference theme tokens instead.
* Avoid placeholder or falsy fallback values (`value || 12`) when `0` or empty string is a valid backend response.

---

## 🔐 Navigation & Sidebar Rules

The navigation structure is governed by [src/components/layout/Sidebar.jsx](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/client/src/components/layout/Sidebar.jsx) and [src/constants/navigation.js](file:///d:/Digicloudify%20softwares/CRM-Interior-Construction/client/src/constants/navigation.js):

1. **Developer / SuperAdmin Bypass**:
   Inside `filterItem` in `Sidebar.jsx`, the bypass `if (isAdmin) return true;` must always remain at the very top. Superadmin / Platform Developers must always see all navigation tabs immediately for verification and testing.
2. **Subscription Plan Filtering**:
   For all standard users, tab visibility is filtered dynamically against `user.sidebarConfig.planTabs` or fallback `PLAN_DEFAULTS` for the client's subscription tier (`Starter`, `Growth`, `Enterprise`).
3. **Role & Permission Guards**:
   Individual routes and tabs verify `isTabPermitted()` and action-level permissions via `usePagePermissions()`.

---

## 🚀 Development Commands

```bash
# Start Vite development server
npm run dev

# Run Vitest component tests
npm test

# Build production bundle (must pass with 0 compiler warnings)
npm run build
```
