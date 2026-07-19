---
name: ERP

# Contrast ratios below are measured against `surface` (#FFFFFF) unless noted.
# Several values were corrected because the originals failed the WCAG 2.2 AA bar this
# document itself mandates — see "Accessibility" at the bottom.
colors:

  primary: "#225DB6"        # white text 6.35:1 — AA pass
  primary-dark: "#1B4D99"   # white text 8.18:1 — the HOVER fill. Hover darkens, never lightens:
                            # lightening (bg-primary/80) gives #4E7DC5 -> 4.15:1, an AA failure.
  primary-light: "#4D82D1"  # white text 3.87:1 — large text / non-text only, never body copy

  # Brand accent: charts, badges, illustration. NOT a button fill with white text, and NOT
  # mapped to shadcn's --secondary (that token is the neutral secondary-button surface, and
  # "Secondary -> White with border" below is Button's `outline` variant).
  secondary: "#0F766E"      # was #18B6A3 (white text 2.54:1 — failed even the 3.0 non-text bar)
  secondary-dark: "#115E59"
  secondary-light: "#18B6A3" # decorative only — never carries text

  accent: "#4F46E5"         # white text 6.29:1

  background: "#F6F8FB"
  surface: "#FFFFFF"

  sidebar: "#1E293B"        # #F1F5F9 on it: 13.35:1
  sidebar-hover: "#334155"

  text: "#111827"           # 16.67:1 on background
  text-secondary: "#475569" # 7.12:1 on background. This is the muted-foreground token.
                            # neutral-500 #64748B is 4.47:1 on background — fails AA by 0.03.

  border: "#E2E8F0"         # DECORATIVE ONLY (card edges, dividers) — 1.23:1
  input-border: "#64748B"   # CONTROL boundaries — 4.76:1, per WCAG 1.4.11's 3:1 requirement

  success: "#15803D"        # was #16A34A (3.30:1) — now white text 5.02:1
  warning: "#B45309"        # was #D97706 (3.19:1) — now white text 5.02:1
  danger: "#DC2626"         # white text 4.83:1. NOTE: text-on-its-own-10%-tint is only
                            # 4.13:1, so tinted surfaces must use #B91C1C (5.54:1) instead.

  info: "#0369A1"           # was #0284C7 (4.10:1) — now white text 5.93:1

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
  xl: 10px   # cards. Was implied by card.radius below but missing from this scale.
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

  height: 40px       # form controls (login, dialogs, any real form)
  heightDense: 32px  # toolbars, table row actions, filter bars — the density this doc asks for
  radius: 8px

input:

  height: 40px
  radius: 8px

card:

  radius: 10px
  padding: 24px

---

# Overview

The ERP follows an enterprise-first design philosophy built for large educational institutions operating multiple campuses and colleges under a single tenant architecture.

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
- Minimum 4.5:1 text contrast (3:1 for non-text UI, per WCAG 1.4.11 — this is why
  `input-border` differs from `border`)
- Touch targets ≥ 44×44 px on coarse pointers.
  Note this is a **house rule**, not the AA bar: WCAG 2.2 Level AA is 2.5.8 Target Size
  (Minimum) = **24×24**. The 44×44 figure is 2.5.5 Target Size (Enhanced), Level **AAA**.
  A 40px `button.height` therefore passes AA comfortably; apply 44px under
  `@media (pointer: coarse)` rather than inflating desktop controls and fighting the
  density this document asks for elsewhere.

## Colour corrections

`secondary`, `success`, `warning` and `info` were darkened from their original values
because white text on them measured 2.54 / 3.30 / 3.19 / 4.10 — all below the 4.5:1 this
document mandates. `primary`, `danger`, `accent` and the sidebar were already compliant and
are unchanged. Any new colour must be measured against its intended foreground before it is
added here; a palette that fails its own accessibility bar is worse than no palette.

---

# Motion

- Fast (150–200ms)
- Ease-out transitions
- No unnecessary animations
- Respect reduced-motion preferences