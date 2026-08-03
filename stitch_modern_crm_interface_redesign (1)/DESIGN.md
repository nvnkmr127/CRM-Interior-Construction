---
name: Nexus Enterprise
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#434655'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#006b5f'
  on-secondary: '#ffffff'
  secondary-container: '#6df5e1'
  on-secondary-container: '#006f64'
  tertiary: '#3e3fcc'
  on-tertiary: '#ffffff'
  tertiary-container: '#585be6'
  on-tertiary-container: '#f1eeff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#71f8e4'
  secondary-fixed-dim: '#4fdbc8'
  on-secondary-fixed: '#00201c'
  on-secondary-fixed-variant: '#005048'
  tertiary-fixed: '#e1e0ff'
  tertiary-fixed-dim: '#c0c1ff'
  on-tertiary-fixed: '#07006c'
  on-tertiary-fixed-variant: '#2f2ebe'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-margin: 24px
  gutter-desktop: 24px
  gutter-mobile: 16px
  card-padding: 20px
  section-gap: 32px
---

## Brand & Style

This design system is built for a high-performance CRM environment where clarity and efficiency are paramount. The aesthetic is rooted in **Modern Corporate** principles—drawing inspiration from industry leaders like Linear and Vercel. It prioritizes functional density without sacrificing the "breathable" feel of a premium SaaS product.

The target audience consists of power users and executives who require a tool that feels reliable, fast, and sophisticated. The UI leverages a "Software as a Service" (SaaS) utility aesthetic: high-contrast typography, ample whitespace to delineate data, and a restrained use of color to highlight actionable insights. The emotional response should be one of control, precision, and institutional trust.

## Colors

The palette is anchored by a crisp **Light Neutral** background to ensure UI elements appear layered rather than flat. 

- **Primary Blue (#2563EB):** Used for primary actions, active navigation states, and progress indicators.
- **Secondary Teal (#14B8A6):** Employed for positive growth metrics, success states, and secondary visual accents.
- **Neutrals:** A strict scale of Cool Greys ensures that the hierarchy remains clear. Borders are kept subtle to allow the layout to be defined by whitespace and soft shadows rather than heavy lines.
- **Functional Colors:** Use standard semantic reds for errors/alerts and ambers for warnings, but keep them desaturated to maintain the premium feel.

## Typography

The typography system relies exclusively on **Inter** to achieve a systematic, utilitarian, and clean look. 

- **Hierarchy:** Use bold weights for headlines to create clear entry points for the eye. 
- **Readability:** For data-heavy tables and CRM feeds, `body-sm` is the workhorse. 
- **Micro-copy:** Use `label-caps` for section headers in sidebars or small metadata descriptors to provide contrast against standard body text.
- **Spacing:** Tighten letter-spacing on larger headlines (`-0.02em`) to maintain a modern, "compact" editorial feel.

## Layout & Spacing

The system follows a strict **8px grid** to ensure mathematical harmony across all components.

- **Grid Model:** A 12-column fluid grid is used for the main content area, while the side navigation remains fixed at 240px or 280px.
- **Responsiveness:** 
  - **Desktop (1280px+):** 24px margins and gutters.
  - **Tablet (768px - 1279px):** 16px margins; sidebar collapses into an icon-only rail or hamburger menu.
  - **Mobile (<767px):** 16px margins; cards stack vertically; typography scales down using mobile-specific tokens.
- **Rhythm:** Use `section-gap` between major dashboard modules and `card-padding` for internal content alignment.

## Elevation & Depth

Visual hierarchy is achieved through **Tonal Layering** and **Ambient Shadows** rather than stark borders.

- **Level 0 (Background):** #F8FAFC. The foundation of the app.
- **Level 1 (Cards/Surfaces):** Pure white (#FFFFFF) with a 1px border (#E5E7EB) and a very soft, diffused shadow: `0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)`.
- **Level 2 (Popovers/Modals):** Pure white with a more pronounced shadow: `0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)`.
- **Interaction:** On hover, cards may slightly increase shadow depth or shift border color to Primary Blue at 20% opacity to signal interactivity.

## Shapes

The design system utilizes a **Rounded** shape language to balance the professional tone with a contemporary, approachable feel.

- **Small Components:** Checkboxes and small tags use 4px (`rounded-sm`).
- **Standard Components:** Buttons, input fields, and small cards use 8px (`rounded-md`).
- **Container Elements:** Dashboard cards and main content wrappers use 12px or 16px (`rounded-lg` / `rounded-xl`) to soften the overall interface and frame content elegantly.

## Components

### Buttons
- **Primary:** Solid Primary Blue background, white text. No gradient. 8px radius.
- **Secondary:** White background, 1px border (#E5E7EB), Primary Blue text.
- **Ghost:** No background or border; appears as text until hover, where a light grey (#F1F5F9) background emerges.

### Input Fields
- **Default:** White background, 1px border (#E5E7EB), 8px radius. Use `body-md` for text.
- **Focus State:** Border changes to Primary Blue with a 2px outer glow (Primary Blue at 10% opacity).

### Chips & Tags
- **Status Tags:** Use light tinted backgrounds (e.g., light green for "Active") with dark saturated text of the same hue. Pill-shaped (fully rounded).

### Cards
- Always use a white background. Header sections within cards should be separated by a subtle horizontal rule or a distinct 4px vertical accent bar on the left for "Priority" items.

### Icons
- Use **Lightweight Line Icons** (2px stroke width). Icons should be monochromatic (muted grey) unless they are active or represent a specific semantic state.

### Lists & Tables
- **Tables:** No vertical borders. Use horizontal dividers only. Header row should have a light grey background (#F8FAFC) or be differentiated by `label-caps` typography.