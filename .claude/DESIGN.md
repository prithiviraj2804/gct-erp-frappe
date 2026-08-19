---
name: ERP

# Contrast ratios below are measured against `surface` (#FFFFFF) unless noted.
# Several values were corrected because the originals failed the WCAG 2.2 AA bar this
# document itself mandates — see "Accessibility" at the bottom.
colors:

  # --- Sapphire. See "Ink & Sapphire" at the bottom for why these moved off #225DB6.
  primary: "#154FC3"        # white text 7.12:1 — AA pass
  primary-dark: "#0D40A4"   # white text 9.17:1 — the HOVER fill. Hover darkens, never lightens:
                            # lightening (bg-primary/80) drops white text below the AA bar.
  primary-light: "#4D82D1"  # white text 3.87:1 — large text / non-text only, never body copy
  primary-subtle: "#EEF3FE" # tint surface; `primary` on it 6.41:1

  # Exact logo blue — the Gnanamani "G". A BRAND-MOMENT colour (sign-in, institution mark),
  # deliberately NOT `primary`: the action blue above is a deeper sibling of the same hue that
  # hits 7.12:1 where this hits 6.35:1, so the button clicked all day is the accessible one and
  # the mark seen for a second is the literal one. Splitting brand from action is the point — a
  # logo hex on every button is the amateur move. Full reasoning under "Brand blue vs action blue".
  brand-blue: "#225DB6"        # white text 6.35:1 — AA pass; MAY carry large brand type
  brand-blue-subtle: "#EEF3FC" # wash for brand surfaces

  # Brand accent: charts, badges, illustration. NOT a button fill with white text, and NOT
  # mapped to shadcn's --secondary (that token is the neutral secondary-button surface, and
  # "Secondary -> White with border" below is Button's `outline` variant).
  secondary: "#0F766E"      # was #18B6A3 (white text 2.54:1 — failed even the 3.0 non-text bar)
  secondary-dark: "#115E59"
  secondary-light: "#18B6A3" # decorative only — never carries text

  accent: "#6F49CA"         # was #4F46E5, which sat 15 deg from the new sapphire and read as a
                            # second, slightly-wrong primary. Now a true violet, so it separates.

  background: "#F6F8FB"
  surface: "#FFFFFF"

  # --- Chrome ("Ink"). Module rail, module menu panel and the login identity panel all use
  # these, so signing in and arriving inside the product read as one continuous surface.
  sidebar: "#0C111D"           # ink. sidebar-text on it: 15.32:1
  sidebar-text: "#E4E8EE"
  sidebar-hover: "#1B222F"     # NEUTRAL — carries no chroma, so it can never be mistaken
                               # for the current page. 1.18:1 on ink.
  sidebar-active: "#132B5A"    # current page: a sapphire TINT, not a solid fill.
                               # sidebar-text on it 11.22:1; 1.16:1 vs sidebar-hover.
  sidebar-selected: "#1C58D0"  # the rail's solid selected square. white 6.25:1, 3.01:1 on ink.
  sidebar-indicator: "#6095FA" # the 2px current-item bar. 6.43:1 on ink, 4.66:1 on the tint —
                               # sidebar-selected is only 2.21:1 on the tint and would vanish.
  sidebar-border: "rgba(255,255,255,.10)"  # hairline. Light separates the planes, not a
                                           # lighter solid — that is what reads as depth.

  text: "#111827"           # 16.68:1 on background
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

  # Wired as the `--shadow-card` / `--shadow-raised` / `--shadow-overlay` utilities (index.css),
  # dark-mode aware. Card and the list/record surfaces layer these OVER a hairline — depth this
  # scale defined from the start but nothing used until the premium pass. Shadow colour is the
  # ink foreground so it reads as the surface's own cast, not a grey smear.
  sm: "0 1px 2px rgba(15,23,42,.06)"   # -> --shadow-card  (resting surfaces: Card, table, sections)
  md: "0 4px 12px rgba(15,23,42,.08)"  # -> --shadow-raised (popovers, menus, row-hover lift)
  lg: "0 8px 24px rgba(15,23,42,.10)"  # -> --shadow-overlay (dialogs, command palette)

layout:

  sidebarWidth: 260px
  collapsedSidebarWidth: 56px   # a 36px icon tile in a 10px gutter. The rail carries icons and
                                # nothing else, so its width is what the tile needs rather than
                                # a round number above it. Was 72px, around a 48px tile.
  topbarHeight: 52px            # was 64px. The bar holds an identity, a launcher and a user
                                # menu; none of them needed 64px, and every screen paid for it.
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

- Primary → Sapphire (#154FC3)
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
- Permanent 72px module rail; its menu panel flies out on hover/focus over the content rather
  than collapsing the layout. No toggle control — every rail item also links to a module page
  listing the same screens, so nothing is hover-only.
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
document mandates. Any new colour must be measured against its intended foreground before it
is added here; a palette that fails its own accessibility bar is worse than no palette.

---

# Ink & Sapphire

The chrome was `#1E293B` (Tailwind `slate-800`) and the primary was `#225DB6`. Both were
accessible and both were *defaults* — slate-800 is the most-used sidebar fill on the web, and
a mid-chroma blue at that lightness reads as an admin template rather than as an institution's
system. Two moves fixed it, and they pull in opposite directions on purpose:

- **The chrome went deeper and less saturated** — OKLCH `L 0.2795 → 0.18`, `C 0.0368 → 0.025`
  — and its dividers became translucent-white hairlines instead of a solid lighter slate.
  Separating two planes with *light* rather than with a value jump is most of the difference
  between "deep" and "flat".
- **The accent went deeper and more saturated** — `C 0.1538 → 0.19`. Chroma concentrated in a
  small accent reads as intent; chroma spread across a large fill reads as noise.

There is a second reason the chrome is near-neutral, specific to this app: it sits directly
beside an arbitrary tenant's logo, and a committed navy fights a maroon or green college
crest. Ink flatters all of them, and lets the institution's mark be the brightest object on
the panel — which is the entire point of the sign-in screen.

**Hover and current-page are different colours, not different intensities of one.** Hover
(`sidebar-hover`) is deliberately chroma-free; the current page (`sidebar-active`) is a
sapphire tint. shadcn's own sidebar cva uses one token for both, which is unusable in an ERP
navigated by muscle memory. The rail keeps a solid `sidebar-selected` square because there is
only ever one and it anchors the shell; the menu panel does not, because a column of
saturated full-width rows is a block of colour rather than a list.

All values were picked in OKLCH and then measured. `primary-subtle` is `C 0.015` rather than
`0.018` because `0.018` leaves the sRGB gamut at that lightness and the browser silently
clips it; dark-mode `primary` is `L 0.555` rather than `0.58` because `0.58` puts white text
at 4.39:1, missing AA.

## Brand blue vs action blue

The institution's logo blue (`#225DB6`) and the app's action blue (`#154FC3`) are **not** the
same token, on purpose. They are the same hue family — `#154FC3` is `#225DB6` pushed deeper and
more saturated (OKLCH `L 0.491 → 0.47`, `C 0.154 → 0.19`) — so they read as one blue. But they
do different jobs, and a colour does its job best when it isn't also doing another:

- **`brand-blue` (#225DB6)** asserts the institution where the brand is the subject: the sign-in
  identity panel, the institution mark, brand illustration. Seen briefly, so its literal fidelity
  to the crest matters more than its repetition cost. White text on it is 6.35:1 (AA).
- **`primary` (#154FC3)** is the action system: every button, link and focus ring. Seen ten
  thousand times a day, so the extra contrast (7.12:1, AAA) and the calmer, deeper cast matter
  more than matching the logo pixel-for-pixel.

This is what mature systems do (Stripe, Linear, Atlassian all run a brand colour distinct from
their product/action colour). Putting the exact logo hex on every button is the move that reads
as an admin template — the same trap the chrome avoided by going to ink. Do not "correct"
`primary` back to `#225DB6`; that reverses a deliberate decision.

---

# Motion

- Fast (150–200ms)
- Ease-out transitions
- No unnecessary animations
- Respect reduced-motion preferences

**Durations by what is moving.** 150ms suits a colour or a state change on something small — a
button, a menu row, an icon. A large surface travelling a distance needs longer or it reads as a
blink rather than a movement: the module flyout enters over **260ms** and leaves over **170ms**.

**Asymmetric entrance and exit.** Arriving should decelerate and settle; leaving should get out of
the way. Same duration both directions makes an exit feel like lag. The flyout uses
`cubic-bezier(0.16, 1, 0.3, 1)` in and `cubic-bezier(0.33, 0, 0.2, 1)` out — both ease-out in
character, the entrance simply steeper than the default. These two curves are now tokens —
`ease-emphasized` (in) and `ease-exit` (out), plus `--ease-*` vars for hand-written transitions —
so every surface in the app settles the same way rather than each re-deriving a bezier.

**Move something, not just its opacity.** A fade alone is not motion. Pair opacity with a translate
big enough to perceive — 16px, not 8; at 8 the movement is invisible next to the fade.

> **Tailwind v4 trap, found the hard way.** `-translate-x-4` compiles to the standalone `translate`
> CSS property, *not* `transform`. So `transition-[opacity,transform]` silently animates nothing but
> the opacity, and the element jumps its full distance in one frame. The `transition-transform`
> utility is safe (v4 expands it to `transform, translate, scale, rotate`); a hand-written
> `transition-[…]` list is not — name `translate`. Verify with `getComputedStyle`, not by eye: this
> failure looks like "the animation is a bit abrupt", not like a bug.