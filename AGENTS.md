# CRM Development Guidelines & Constraints

You are an expert developer working on the Interior & Construction CRM. Follow these strict rules to ensure correct logic, sidebar visibility, data integrity, and visual styling:

## 1. Sidebar Tab Visibility & Developer Bypass
- **Rule**: The developer/superadmin (`isAdmin`) must always see all navigation tabs immediately for testing and management.
- **Implementation**: Inside the `filterItem` function in `Sidebar.jsx`, the bypass `if (isAdmin) return true;` must remain at the very top. Never place subscription plan filters (`planTabs` checks) above this admin bypass check.
- **Client Restrictions**: Keep the `planTabs` checking intact for all other roles to ensure client accounts are filtered correctly according to their subscription package.

## 2. Real Database Values vs. Fake Fallbacks (KPIs & Reports)
- **Rule**: Always display the actual database response values. Never use fake fallback placeholders for numerical or currency metrics.
- **Avoid Falsy Fallback Pitfalls**: Do not use `value || default_value` syntax when `0`, `0%`, or empty strings are valid data states returned by the backend. 
- **Example Check**: 
  - *Incorrect*: `activeProjects || 12` (Displays 12 if activeProjects is 0)
  - *Correct*: `activeProjects !== undefined ? activeProjects : 0` or simply `activeProjects`

## 3. UI Aesthetics & Theme Variable Integrity
- **Rule**: All UI components and modules must strictly use the predefined CRM Design System tokens. Do not introduce raw HSL/RGB/HEX colors or ad-hoc margins.
- **Design Token References**:
  - Backgrounds & Surfaces: `var(--color-bg)`, `var(--color-surface)`
  - Typography: `var(--text-2xl)`, `var(--text-xl)`, `var(--text-sm)`, `var(--text-xs)`
  - Margins & Padding: `var(--space-6)`, `var(--space-4)`, `var(--space-2)`
  - Theme Accents: `var(--color-accent)`, `var(--color-success)`, `var(--color-warning)`, `var(--color-info)`
  - Shadows & Transitions: `var(--shadow-sm)`, `var(--transition-fast)`
- **Aesthetic standard**: Cards must have subtle hover states (`transform: translateY(-2px)`), card dividers/accent indicators on top, and fit within the responsive grid layouts of the page.

## 4. Preservation of Functionality
- **Rule**: When adding or refactoring tabs, groups, or pages, verify that you do not change existing routing, backend APIs, or middleware validation policies.
- **Verification**: Run `npm run build -w client` after making frontend changes to ensure zero compiler warnings.
