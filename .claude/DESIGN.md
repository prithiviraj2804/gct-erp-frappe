---
name: SucceedEx ERP

colors:

  primary: "#225DB6"
  primary-dark: "#1B4D99"
  primary-light: "#4D82D1"

  secondary: "#18B6A3"
  secondary-dark: "#119483"
  secondary-light: "#47CBBB"

  accent: "#4F46E5"

  background: "#F6F8FB"
  surface: "#FFFFFF"

  sidebar: "#1E293B"
  sidebar-hover: "#334155"

  text: "#111827"
  text-secondary: "#475569"

  border: "#E2E8F0"

  success: "#16A34A"
  warning: "#D97706"
  danger: "#DC2626"

  info: "#0284C7"

  neutral-50: "#F8FAFC"
  neutral-100: "#F1F5F9"
  neutral-200: "#E2E8F0"
  neutral-300: "#CBD5E1"
  neutral-400: "#94A3B8"
  neutral-500: "#64748B"
  neutral-600: "#475569"
  neutral-700: "#334155"
  neutral-800: "#1E293B"
  neutral-900: "#0F172A"

typography:

  primary:
    fontFamily: "Inter"

  display:
    fontFamily: "Inter"

  mono:
    fontFamily: "JetBrains Mono"

  h1:
    fontSize: 36px
    fontWeight: 700

  h2:
    fontSize: 30px
    fontWeight: 700

  h3:
    fontSize: 24px
    fontWeight: 600

  h4:
    fontSize: 20px
    fontWeight: 600

  body-lg:
    fontSize: 16px

  body-md:
    fontSize: 14px

  body-sm:
    fontSize: 12px

  sourceScale: "12 / 14 / 16 / 18 / 20 / 24 / 30 / 36"

spacing:

  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
  xxxl: 48px

radius:

  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px

shadow:

  sm: "0 1px 2px rgba(15,23,42,.06)"
  md: "0 4px 12px rgba(15,23,42,.08)"
  lg: "0 8px 24px rgba(15,23,42,.10)"

layout:

  sidebarWidth: 260px
  collapsedSidebarWidth: 72px
  topbarHeight: 64px
  contentMaxWidth: "100%"
  gridColumns: 12

table:

  rowHeight: 44px
  headerHeight: 48px
  borderColor: "#E2E8F0"

button:

  height: 40px
  radius: 8px

input:

  height: 40px
  radius: 8px

card:

  radius: 10px
  padding: 24px

---

# Overview

SucceedEx ERP follows an enterprise-first design philosophy built for large educational institutions operating multiple campuses and colleges under a single tenant architecture.

The system prioritizes productivity, clarity, accessibility, and scalability over decorative UI.

---

# Design Principles

- Enterprise-first
- High information density
- Consistent spacing
- Professional blue identity
- Accessible by default
- Responsive layouts
- Minimal visual noise

---

# Component Guidelines

## Buttons

- Primary → Brand Blue (#225DB6)
- Secondary → White with border
- Danger → Red
- Success → Green
- Loading state required

## Forms

- Labels above controls
- Inline validation
- Two-column layout preferred
- Required fields marked with *

## Tables

- Sticky header
- Zebra rows optional
- Server-side pagination
- Bulk actions
- Column visibility
- Export support

## Navigation

- Fixed top navigation
- Collapsible sidebar
- Breadcrumbs
- Context switcher for Institution / Campus / College

## Cards

- White surface
- Soft border
- Minimal shadow
- Consistent padding

---

# Accessibility

- WCAG 2.2 AA
- Keyboard-first navigation
- Visible focus indicators
- Minimum 4.5:1 text contrast
- Touch targets ≥ 44×44 px

---

# Motion

- Fast (150–200ms)
- Ease-out transitions
- No unnecessary animations
- Respect reduced-motion preferences