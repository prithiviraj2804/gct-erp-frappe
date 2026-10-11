---
name: ERP

# Contrast ratios below are measured against `surface` (#FFFFFF) unless noted.
# Several values were corrected because the originals failed the WCAG 2.2 AA bar this
# document itself mandates — see "Accessibility" at the bottom.
colors:

  # --- Brand. Hue 241.1, adopted from the Admin-CRM design (Succeedex-org/Admin-CRM) so the two
  # products read as one family. Their value is #0085C8; every step below was re-solved because
  # theirs does not clear WCAG AA — see "The blue" at the bottom, which carries the measurements.
  primary: "#017BB8"        # white text 4.63:1 — AA pass. Theirs, two steps deeper.
  primary-hover: "#00699E"  # white text 5.97:1 — the HOVER fill. Hover darkens, never lightens.
  primary-subtle: "#D4ECFE" # tint surface; its own foreground measures 6.01:1 on it

  background: "#F3F5F9"
  surface: "#FFFFFF"

  # --- Chrome. A saturated BLUE nav, the headline of the Admin-CRM design. One hue (241.1)
  # from the sign-in panel through the rail to the buttons.
  sidebar-deep: "#00476D"    # the rail. sidebar-text on it 9.76:1
  sidebar: "#005886"         # the nav column, one step up. sidebar-text 7.57:1
  sidebar-text: "#FCFEFF"
  sidebar-text-muted: "#B4CBDC"  # rest-state nav labels. TEXT, so 4.55:1 and no slack
  sidebar-hover: "rgba(0,0,0,.10)"   # BLACK alpha — white desaturates a blue slab to grey
  sidebar-active: "rgba(0,0,0,.20)"  # current row; the label jumps to 8.67:1 on it
  sidebar-border: "rgba(255,255,255,.20)"  # a seam must be LIGHTER than the slab
  brand-panel: "#003656"     # sign-in hero, the deepest step of the same ramp

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

# An ERP scale, not a website's. The block below REPLACES a 36/30/24 heading scale that this
# document carried from the start and that the app never used at any point — nothing has ever
# rendered at 36px or 30px outside the sign-in hero. That mismatch was not harmless: it left
# Tailwind's own defaults in charge, so `body` inherited 16px and page titles came out at 24px,
# and the whole app measured one step large. See "Density and the type scale" below.
#
# Benchmarks this was set against: Odoo 13px body / 20px title, Linear 13/21, ERPNext 13/20,
# SAP Fiori 14/20. This app is now at the dense end of that range, deliberately.
typography:

  primary:
    fontFamily: "Inter"

  display:
    fontFamily: "Inter"

  mono:
    fontFamily: "JetBrains Mono"

  # Steps are defined ON Tailwind's own names in index.css (`--text-sm` etc.), not beside them,
  # so there is one vocabulary and no component had to change when the scale moved.

  page-title:              # text-2xl. EVERY page title in the app, home included.
    fontSize: 20px
    lineHeight: 28px
    fontWeight: 600

  section-title:           # text-xl. A heading inside a page.
    fontSize: 18px
    lineHeight: 26px

  body-lg:                 # text-base. A lead line, a dialog's first sentence.
    fontSize: 14px
    lineHeight: 20px

  body-md:                 # text-sm. THE body size, and what `body` itself is pinned to.
    fontSize: 13px
    lineHeight: 18px

  body-sm:                 # text-xs. Card descriptions, hints, secondary cell text.
    fontSize: 12px
    lineHeight: 16px

  eyebrow:                 # text-2xs, with tracking-eyebrow (0.06em). Uppercase micro-labels.
    fontSize: 11px
    lineHeight: 16px

  # Left at Tailwind's defaults and used ONLY by the sign-in identity panel, which is the one
  # screen that should shout. Nothing inside the app shell may use these.
  hero: "30px (text-3xl) / 36px (text-4xl)"

  scale: "11 / 12 / 13 / 14 / 16 / 18 / 20  ·  hero: 30 / 36"

spacing:

  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
  xxxl: 48px

radius:

  # Base is 10px (Admin-CRM's 0.625rem), up from 8px.
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

  # The one that casts UPWARD, for a bar pinned to the bottom of a scrolling form. Named for the
  # situation rather than the depth — "lifted" would be a synonym of `raised` and leave an author
  # no rule for choosing. Same ink and geometry as md, y negated.
  pinned: "0 -4px 12px rgba(15,23,42,.10)"  # -> --shadow-pinned (the editor's sticky save bar)

layout:

  sidebarWidth: 220px           # the permanent secondary sidebar (module screens). Was 260px as
                                # an overlay flyout; docked, it pays for its width in layout, so
                                # it is trimmed to what a screen label actually needs.
  collapsedSidebarWidth: 56px   # the module rail. DERIVED, never written: --rail-tile (40px) +
                                # 2 x --rail-gutter (8px), set in AppShell. Deriving it is the
                                # point — the previous 72px rail hard-coded a `-left-3.5`
                                # indicator offset that encoded the tile/gutter relationship and
                                # silently detached whenever either number moved.
  contextHeaderHeight: 56px     # Trust identity, current module and global search.
  contentMaxWidth: "100%"
  gridColumns: 12

# One app-wide preference with two steps, NOT a per-table control. See "Density" below.
# Comfortable is exactly the geometry the app had before the control existed, so switching the
# feature on changes nothing until a user asks it to. Every saving comes out of padding — never
# out of type size and never out of target size, which is the line between a density control and
# an accessibility regression.
density:

  comfortable:
    pageGutterX: 20px
    pageGutterY: 18px
    pageStack: 20px      # page header → body, AND between a page's top-level sections
    sectionStack: 14px   # between cards inside a section
    cardPadding: 16px    # every card, including the record/form section cards
    rowPadY: 10px        # a list row inside a card
    tableCellPadY: 6px   # lands the 40px row: 6 + 6 + the 28px row-actions button
    fieldStack: 16px     # field → field inside a section card, READ AND EDIT ALIKE

  compact:
    pageGutterX: 16px
    pageGutterY: 12px
    pageStack: 14px
    sectionStack: 10px
    cardPadding: 12px
    rowPadY: 6px
    tableCellPadY: 2px   # lands the 32px row. The 28px button is the floor.
    fieldStack: 12px     # 12, not 10: FormField hangs its description/error at 6px under the
                         # control, so 10px here would leave a helper line belonging to neither
                         # its own field nor the next. 12 holds 2:1 and still saves 4px a field.

table:

  # 40 / 32 by density, not one number. Both are `2 * --table-cell-pad-y + 28`, where 28px is
  # the row-actions button — the tallest thing in a row, and therefore the floor. Going below
  # 32 needs a smaller button, not less padding. Measured in the browser at 41 / 33 including
  # the 1px rule.
  rowHeight: 40px          # comfortable
  rowHeightCompact: 32px   # compact
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

- **One stable shell.** The hierarchy is module rail → named module menu → working page. The
  context header is not another navigation system: it keeps the Trust, current module and global
  search visible while the user moves between operational screens.
- **The rail carries the global set in a fixed order**: institution logo at the head, search
  under it, the modules, then appearance and the account pinned to the foot. Every one of them is
  module-independent, which is what lets the rail render unconditionally.
- **The nav column carries the local set and nothing else**: that module's screens, starting at
  the top. It has **no header** — the module's name was there and said what the rail's selected
  tile already says and what hovering that tile spells out, so a 52px band was the most expensive
  label on screen. The module's overview page is not orphaned by the removal: the rail tile links
  to `/{slug}` itself, which is where that header pointed.
- **The rail is icon-only, so every tile names itself on hover.** A glyph is a guess until you
  hover it; the label was always on the link for assistive tech, and the tooltip is the pointer
  user's half of the same thing. All five kinds of tile have one, because a column where some
  tiles answer and others do not reads as broken rather than as restrained.
- **Tooltip timing is 400ms with a 300ms skip**, not the primitive's 0. A rail is navigated by
  muscle memory and crossed constantly on the way somewhere else; at 0 every pass fires four
  tooltips in sequence. The skip window then lets a deliberate move *between* tiles show
  instantly, so the delay is paid once per visit to the column rather than once per tile.
- **The account is a 40px avatar tile at the FOOT of the rail**, drawn to the same tile spec as
  every other control in the column so a 56px strip reads as one instrument rather than five
  stacked widgets. It has lived in three places and each move followed the width available, not
  taste: a disc in the topbar (which could not spare 160px for a name), a named row in the 220px
  nav column (which could), and a tile in the 56px rail (which cannot again). The menu contents
  never changed; only the trigger did. Superseded reasoning follows.
- ~~**The account is a named row at the FOOT of the nav column.**~~ It was a bare 28px disc in the
  topbar, on the argument that the bar could not afford 160px to repeat the least-changing fact
  on screen while the institution's name genuinely decides what a click writes to. That argument
  was about the topbar's width. At the foot of a 220px column the width is already committed,
  the bottom-left corner is where every comparable product puts the account, and a row that
  names you is a better click target than a disc — so the name is back, and the institution
  keeps its own slot at the head of the same column where the two no longer compete.
- **No layering to reason about.** Every plane is in flow and nothing overlays anything, so
  there is no z-index order to get wrong. The rule the old topbar z-index protected still holds
  and is now structural rather than declared: the institution's name may never be covered,
  because it is the answer to "whose records am I about to change?" — and a permanent in-flow
  column cannot be covered by construction.
- **Two docked nav columns, both permanent.** A 56px module rail on the deepest chrome plane
  (`sidebar-deep`), and beside it a 220px secondary sidebar (`sidebar`, one step lighter) listing
  the current module's screens. Neither flies out and neither has a toggle: the menu is in-flow,
  so it is reachable by pointer, keyboard and touch alike. Every rail item also links to a module
  page listing the same screens, so no route is chrome-only.
- **The rail marks "where you are" with a near-white plate carrying the brand glyph**, not a
  saturated square — on deep chrome the plate is 16.45:1 and satisfies WCAG 1.4.11 on the fill
  alone, so it needs no indicator bar. The menu panel's current ROW uses the raised ink plate
  plus a 2px bar instead; a column of full-width rows drawn like the rail becomes a block of light.
- Breadcrumbs
- Context switcher for Institution / Campus / College — **still a reserved, empty slot**. Campus
  and College doctypes now exist, but nothing scopes data by them and there is no endpoint to
  read or write an active context, so a picker that changed nothing would be a lie about how the
  system behaves. `TopBar.ContextSwitcher` documents the unblocking conditions.
- **What the topbar refuses now has somewhere to go.** The "three things and no fourth" rule kept
  producing homeless controls — theme, density, a shortcut sheet — that are neither identity, nor
  a launcher, nor an account, and are not page content either. They are *workspace chrome*, and
  workspace chrome belongs on the status bar (below), which is why adding that plane was the fix
  rather than relaxing the rule.

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

# The blue

The palette is adopted from **Succeedex-org/Admin-CRM**, so the two products read as one family.
Everything below supersedes "Ink & Sapphire", which is kept underneath because its reasoning is
still the reason this version is built the way it is.

## What was taken, and what had to change

Their design sets `--sidebar` to `--primary` outright: one saturated mid-blue slab, `#0085C8`.
That look is the point and it is adopted. Two things could not come with it:

| Pair | Theirs | Here | Why |
|---|---|---|---|
| white on `--primary` | **3.86:1** | 4.63:1 | the label on every button in the product |
| nav text on the slab | **3.69:1** | 7.57:1 | the most-read text in the app |
| `--success` with white | **3.67:1** | kept ours | — |

Four of their tokens are also **outside the sRGB gamut** (`--primary`, `--success`, `--warning`,
`--destructive`), which browsers clip silently — so the colour on screen is not the colour in the
file, and no amount of reading the CSS tells you what it actually is.

So the hue is theirs (241.1) and every step was re-solved. `#017BB8` against their `#0085C8` is a
difference you have to hold side by side to see, and it is the difference between a product that
passes AA and one that does not.

## The slab could not stay at their lightness

At `#0085C8` the slab is 4.56:1 from pure white — **enough for one text tone and no more**. That
is why their nav text fails: there is no room under white for a second tier.

This app's nav needs two, because the current row is marked by a luminance jump on its label. So
the slab is taken to `L 0.44` (`#005886`), which buys:

- white at **7.57:1**
- a muted rest-state tier at **4.55:1** — and that tier is *text*, so it answers to 4.5, not to
  the 3:1 non-text bar
- a current row at **8.67:1** for its label

The literal brand blue is not lost. It is `--primary` — every button, link and focus ring, and
the glyph on the selected rail tile.

## States on a coloured slab are BLACK alpha

White over a saturated blue **desaturates it**: 12% white turns `#005886` into the grey-blue
`#617D9B` and drops the label to 4.20:1. Black keeps the hue, deepens the plate, and *raises*
text contrast. The seam goes the other way — a hairline has to be lighter than the slab or it
reads as another state rather than an edge.

## Dark mode inverts the button pairing

The dark primary is lifted so a button reads as a button against a dark card — which makes it too
light to carry white text (3.59:1). Dark mode therefore pairs a light primary with a **dark**
label. It is the one place the two themes differ in kind rather than in value, and it is why
`--primary-foreground` is a token rather than hardcoded white.

Admin-CRM's dark sidebar is the card colour rather than blue, and that is kept: the blue slab is
a light-mode idea, and at dark-mode lightness it would be a navy smear.

---

# Ink & Sapphire — SUPERSEDED by "The blue" above

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

## Light chrome — the theme that was only half a theme

The chrome above was ink in **both** themes. That was a defensible look and its reasoning holds
for the dark half, but it meant "Light" was never a theme: the rail and the menu panel are the
left 276px of every screen — about 18% of a 1512px viewport — and they did not change. Light and
dark differed only in the content area, which is why the light theme read to its first reviewer
as "the dark one".

So the chrome is themed now. Light mode runs a near-white ramp at the same hue 258:

| | rail (`sidebar-deep`) | panel (`sidebar`) | page | card |
|---|---|---|---|---|
| light | `#E1E5EB` L 0.920 | `#EBEFF4` L 0.950 | `#F3F5F9` L 0.970 | `#FFFFFF` |
| dark | `#060E1C` L 0.165 | `#0F1826` L 0.208 | `#0A0E18` | `#161C27` |

**The rule was never "the sidebar is dark" — it was "the chrome recedes and the content is the
lit plane".** Light mode keeps that exactly, starting further down the ramp. What inverts is only
the mechanics:

- **Hover and hairlines flip from white alpha to BLACK alpha.** One token still composites over
  both chrome planes; it is just the other end of the scale.
- **The selected rail tile flips.** Dark: a near-white plate carrying a sapphire glyph. Light: a
  solid sapphire plate carrying a white glyph. Same rule — the selected tile is the one saturated
  object in the nav — solved for its own ground. A pale tint was tried first and is unusable:
  `primary-subtle` is L 0.92 against a rail at L 0.920, i.e. literally invisible.
- **The menu panel gained a right hairline it never had.** Its old comment argued none was needed
  because "the panel|content edge is already 12.9:1 on its own". True of a dark panel against a
  white page; in light mode the two are **1.061:1** and merge without a line. *Separating planes
  with light works when the planes are dark. Between two near-whites you need an actual rule.*
  That single sentence is the whole lesson of this pass.

The ramp is 0.920 / 0.950 and not the 0.928 / 0.958 first tried, because at the lighter pair the
panel measured **1.036:1** against the page background and physically disappeared into it.

### `--brand-panel`: the one surface that does not follow

The sign-in identity panel is **deep in both themes**. It used to ride `sidebar-deep`, which was
the same value while the chrome was ink and is wrong now: at `#E1E5EB` beside a white form column
it measures 1.09:1 — an almost uniform white rectangle with a monogram floating in it, on 62% of
the first screen anyone ever sees.

It is not chrome; it is a hero, and identity is its entire job. A product with a light app can
still have a deep sign-in. The deep-ink reasoning below therefore still applies — to this panel,
which is the surface it was always really about.

## The 2026 premium pass — and the round trip that proves the rule

The chrome was briefly moved to a flat `#235DB6` — the literal brand blue — across the rail, the
secondary sidebar and the login panel: **20.28%** of a 1440×900 viewport, and 62.2% of the sign-in
screen, in one mid-chroma slab. It read as an admin template, exactly as the section above predicts.
It has been taken back down its own hue to a deep-sapphire ramp (`sidebar-deep` #01173C for the
rail and login panel, `sidebar` #162A48 one step up for the menu panel), and the full-chroma brand
hex now covers **well under 1%** of the screen — all of it on marks a user actively looks for.

The lesson is worth stating twice, because it was learned twice: **the hue was never the problem;
the AREA was.** Keeping the brand colour and shrinking its footprint gives you both — an
unmistakably blue app, and one that looks like an instrument. When someone asks to "make the
sidebar the brand colour", the premium answer is to make the *selected item, the mark, the buttons
and the focus ring* the brand colour, and let the plane behind them go deep.

The same pass split two tokens that could not do their jobs while shared, and both were flagged in
their own comments as unfixable before the split:
- `sidebar-active` served as the menu's current-row plate **and** the topbar's avatar disc — one
  value asked to work on ink and on white. The avatar moved to `avatar`.
- `primary-subtle` was 1.013:1 against white, so every plate drawn on it rendered as a plain grey
  square. It was deepened and given a `primary-subtle-foreground` solved for it.

## Brand blue vs action blue

**Superseded by the pass above.** These are now ONE token: `primary` is the literal `#235DB6`, and
the `brand-*` family was deleted (it had zero consumers). Two blues three degrees apart read as one
blue rendered inconsistently, not as two meanings. The reasoning below is kept because the *shape*
of the argument still holds — a colour does its job best when it is not also doing another — but
the specific split it describes is no longer how the app is built.

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

# The list page

The page every doctype gets. It had **six horizontal bands of chrome above the first row** —
breadcrumb, title, status tabs, table toolbar, column headers, a column-filter row — and **two
footers** saying the same thing. On a two-record master that is chrome with data trapped inside
it. Three principles fixed it, and they are the ones to apply to any new screen.

## 1. A count is a phrase, not a numeral beside the title

`College  2` is the default every admin template reaches for and it is wrong for the same reason
every time: an unlabelled 13px figure against a 20px heading has no unit, no name and nothing to
align with, so it reads as a rendering artifact. Phrased and moved to a **meta line** under the
title it becomes a sentence the page can add to:

```
Master › College                                   ← breadcrumb, 11px eyebrow
College                     [All statuses ▾] [+ New]  ← title + actions, one line
2 records · showing the first 2,000 of 5,431        ← meta line, 13px muted
```

The meta line also absorbed the truncation warning, which used to be a **warning-tinted banner of
its own** — a seventh band to say one sentence. "2,000 records · showing the first 2,000 of 5,431"
is one fact, not two, and needs no coloured box to look important.

## 2. Filters belong to the table — except the one that does not

The status tab strip is gone. It cost a full-width band with its own rule, and it grew a tab per
word in the vocabulary.

But it did **not** simply fold into the table's filters, and the distinction matters:

| | Narrows | Useful past `LIST_ROW_CAP` (2000)? |
|---|---|---|
| Table filters | rows **already fetched** | no |
| Status scope | what the **server selects** | yes |

On a 5,000-row list, filtering "Active" in the table searches the first 2,000 rows; the status
scope asks the server for the Active ones. So it stays a page-level control — one Select, on the
action row that already existed, instead of a band of its own. `?status=` is unchanged, so links,
the record screen's return path and the registry overrides all still work.

What was genuinely lost: the per-status counts the tabs printed. They cost one `get_count` per
word on every render, and the meta line now carries the count for the scope actually in view.

## 3. The grid's default should be Tuesday, not a demo

Every feature was switched on at once. The settings gear exists precisely so power features can
be **added back per table**, which means the default should be the view someone wants on an
ordinary day:

- `showStatusBar` — printed "2 rows" directly under a footer already saying "1–2 of 2".
- `enableColumnFilterRow` — a permanent row of text inputs under every header. The Filters button
  opens the same thing on demand.
- `showFormatBuilder` — conditional formatting; a real feature, not one that earns a permanent
  button on every screen.
- `enableRowPinning` — put a pin button in **every row of every list**, a whole column of chrome
  between the checkbox and the first real value. Column pinning stays: reading a wide table is
  something an ERP does constantly.

**And style what the library leaves raw.** "Rows per page" is a native `<select>` — on a page
where every other control is a styled trigger, one browser-chrome dropdown makes the whole page
look unfinished. It is restyled, not replaced: the element is keyboard accessible and opens the
platform picker on touch, and a hand-built listbox would be a worse control with more code.

---

# Three shells, one default

The app ships **three navigation arrangements**, chosen by a stored preference alongside theme
and density. `rail` is the default and is the one every test above exercises; the others are
opt-in. They are a preference rather than a fork so alternatives can be compared on real data,
in one build, without the default ever being at risk.

| Layout | Modules | A module's screens | Costs | Suits |
|---|---|---|---|---|
| **`rail`** (default) | 56px icon rail | 220px column beside it | a guess per glyph | someone who lives in two modules |
| **`topnav`** | 240px sidebar, by name | group menus across a top bar | 184px of page width | someone learning the system |
| **`stacked`** | 260px sidebar | nested under each module, in place | width, and a long list | someone working across modules |

**None of them is better in the abstract, and that is why all three exist.** The rail buys the
page 184px by spending 56 on glyphs; `topnav` spends the width on words instead and moves screens
into 40px of height rather than 220px of width; `stacked` answers "which module?" and "which
screen?" in one column, so crossing modules is one click instead of two moves in two planes.

## The rules that make this safe

- **A layout owns no state.** `AppShell` resolves the rail query, the active module, the module to
  show and the global key handling once, and hands each layout the same props. Two arrangements
  that share no state cannot disagree about what the app *does* — only about where things sit.
- **Three things never move into a layout**: the single global key listener (so there is still
  exactly one, however many layouts exist), the skip link (it must be the first focusable thing
  in the document regardless of arrangement) and the two dialogs (a layout owning one would mean
  switching layouts could lose an open dialog).
- **Every layout owes the same contract**: you can always tell whose system this is, search it,
  and sign out of it. There is an e2e test that asserts exactly those three, parameterised over
  all three layouts — a new arrangement is not finished until it passes it.
- **The screens differ by shape on purpose** — a link column, a menu item, a tree leaf — so that
  contract deliberately does NOT assert them; each layout's own test covers its own shape.

## Icons in the nav column

Group headings **and** individual screens both carry one, each set on the workspace row that
produces it — Card Break for a group, Link for a screen — and resolved through `GROUP_ICONS` /
`SCREEN_ICONS`. Frappe ships the full lucide set under the same kebab-case ids the SPA uses, so
one name serves the Desk editor and this app: giving anything an icon is a **workspace change**,
not a frontend one.

**Per-item icons are allowed here and forbidden on the module overview cards, and the difference
is the whole rule.** Every card in that grid is a doctype list, so a per-card icon is the same
glyph repeated — decoration pretending to be information. These are all different, and each says
something the label needs a beat to say: a pin for Campus, a landmark for Institution, a calendar
for Academic Year. An icon per row earns its pixels exactly when the icons differ. The moment a
workspace starts reusing one, it stops earning them — and the fix is the data, not the renderer.

---

## `rail`: the nav column collapses

⌘B, or the toggle in the rail. Collapsing gives the page the column's 220px back, and the choice
is a stored preference — someone who works a wide table wants it collapsed tomorrow too.

Three decisions in it:

- **The toggle is in the RAIL, not on the column's own edge.** An edge handle is the commoner
  pattern and has one fatal property here: it lives on the thing it hides, so once collapsed
  there is nothing left to click. In the rail it is in one fixed place in both states — which is
  why the *glyph* flips rather than the button moving.
- **The column is UNMOUNTED, not hidden.** A `w-0` column still runs its menu query and keeps its
  links in the tab order, so a "hidden" panel would quietly hand keyboard users a column they
  cannot see.
- **Collapsing hides a route to the screens, never the only one.** The palette still finds every
  screen and the module's overview page still lists them — which is what makes hiding the column
  a preference rather than a loss. There is an e2e asserting exactly that.

`topnav` and `stacked` have nothing to collapse: the first keeps screens in its top bar, and the
second is a single column whose collapse is already per-module.

---

## `topnav`: groups become menus, not tabs

The obvious build for a top bar is a flat strip of every screen as a tab. It does not survive
contact with an ERP: Master alone has eight screens, a real module will have twenty, and a strip
that wide either wraps — moving the page under the cursor as you navigate — or scrolls
horizontally, hiding navigation behind a gesture with no affordance.

Groups solve it and cost nothing, because the grouping is already in the payload: the same Card
Break structure the rail's column renders as headings. Four menus fit any width, scale to any
number of screens, and preserve the classification an admin authored rather than flattening it.
It is also the shape every desktop ERP menubar has converged on.

---

# Three planes

The shell is three fixed surfaces around one scrolling page, and every one of them is in flow —
nothing is `position: fixed`, nothing overlays anything else, and there is no z-index race:

| Plane | Size | Surface | Holds |
|---|---|---|---|
| Rail | 56px, full height | `sidebar-deep` | **Global**: logo · search · modules · appearance · account. |
| Nav column | 220px, full height | `sidebar` | **Local**: the current module's screens. No header. |
| Status bar | 26px, content column | `card` | System state, and the shortcut sheet. |

## What replaced the nav column's header: nothing

Removing the module name left the column with nothing at the top, and the rail beside it still
has a 52px logo compartment with a rule under it. The first attempt kept the space — `pt-13` on
the screen list, putting its first group label at y=60, level with the rail's search tile — on
the theory that the two columns should stay registered.

**That was wrong, and how it was wrong is the useful part.** The alignment was real and
measurable, and *nobody perceived it*: there is no shared rule or edge for the eye to run along
between the two columns, so 52px of empty chrome read as unexplained emptiness rather than as
registration. It got asked about twice, which is the only verdict that counts — a deliberate
choice that reads as a bug to the person using it is a bad choice, however good the reason.

The list starts at the top now. The two columns are simply allowed to begin at different
heights, because that is the truth: the rail has a brand compartment at its top and the nav
column does not. **Alignment is worth paying for only when there is something to align against.**

**The module is still named, just not drawn.** The column's landmark is
`<nav aria-label="{module} screens">` and the `Sidebar` keeps `aria-label="{module} menu"`. A
screen reader cannot see which rail tile is selected, and cannot hover it, so the landmark is
where that user gets the module — this is the one channel for which the visible label was never
redundant.

## Global goes in the rail, local goes in the column

That split is the rule, and it is what settled where each of the topbar's orphans landed. The
rail answers *whose system is this, how do I search it, which module am I in, how does it look,
who am I*. The column answers *what is in the module I am in*. Nothing is in both.

It took one wrong turn to find. The identity, the launcher and the account went into the nav
column first, which put the institution's name directly above the module's name at the same size
— and the two read as a breadcrumb that was not one. Moving the global set into the rail fixes
that by construction: they are in different columns, so they cannot be mistaken for a hierarchy.

**The rail is therefore the unconditional column, and the nav column is the conditional one.**
This is the inverse of what it was, and the flip followed the account: whichever column holds it
must always render, or a user with no modules is stranded with no way to sign out. The rail's
head, search, appearance and account are all module-independent, so it is never empty. The nav
column has exactly one job, and with no module there is nothing for it to do — a blank 220px
column is worse than none. There is an e2e test on exactly this.

## The topbar was deleted, not emptied

There were four planes. The fourth was a 52px topbar carrying exactly three things — the
institution's identity, the palette launcher and the account — under a standing rule that it
could carry no fourth. That rule was right, and following it far enough is what removed the bar:
a plane admitting only three controls, two of them small and one of them a name, is 52px of
*every screen* spent on a row that is mostly empty in the middle.

All three moved into the nav column, which was already permanent, already full-height and
already had the width. Nothing was lost:

| Was | Is |
|---|---|
| topbar leading slot: mark + name | rail head — the institution's **logo** (monogram only as fallback) |
| topbar trailing slot: "Jump to…" chip | rail, a search tile under the head; the shortcut moved to its tooltip |
| topbar trailing slot: 28px avatar | rail foot — a 40px avatar tile |

**The institution is now a logo, not a name.** The nav column's name was removed and the rail's
`monogramOnly` with it, so the mark carries the identity and its `title`/`aria-label` carry the
full name. Two consequences worth stating plainly:

- The identity rule ("must be true on every screen") is still met, but by an *image*. For an
  institution whose logo is a square crest that is an upgrade. For one whose logo is a landscape
  wordmark it is not: 56px of rail gives it roughly 48x13, which is a coloured smudge. The honest
  fix there is a wider rail or a square variant of the mark — not a smaller font.
- The image's 160px cap moved from the `<img>` to its wrapper. On the img it was a hard floor no
  container could get under, so a wide logo blew straight through the 56px column instead of
  shrinking into it.

**The identity rule survived the move intact.** In a multi-tenant ERP the answer to "whose
records am I about to change?" has to be true on every screen and may never be covered. A
permanent in-flow column satisfies that at least as well as a bar did — better, in fact, because
it no longer depends on a z-index being right.

**One thing had to change with it.** The nav column used to be hidden alongside the rail when a
user had no modules, on the reasoning that an empty rail reads as broken. That was harmless
while a topbar carried the account; without one it would have left that user with no institution
named, no search, and **no way to sign out**. So the rail is still conditional and the column
never is — only its list is empty. There is an e2e test guarding exactly this.

**The status bar is not sticky, and that is the point.** It is a flex sibling of the scrolling
page inside a viewport-height shell, so it is never scrolled past *and* it can never cover the
last row of a table — which is the failure mode of every status bar built with `position: fixed`.
It spans the content column, not the viewport: the two nav columns run the full height of the
window, and a bar drawn across the true bottom of the screen would cut both off at the ankles.

## What the status bar is for

Two jobs, and it was added because both were previously homeless:

1. **System state the page cannot say.** A save in flight was invisible unless the button you
   clicked happened to still be on screen; a dropped network was invisible until something
   failed. `useConnectionState` ranks offline > saving > syncing > ready and shows one. Every
   input is state TanStack Query already keeps — no poll, no heartbeat, no new endpoint.
   The colour budget goes almost entirely to `offline`: a bar that shouts "Connected" in green
   all day trains people to ignore it, and then it cannot get their attention on the one
   afternoon it matters.
2. ~~**Workspace chrome.**~~ SUPERSEDED. Theme and density lived here while the shell had nowhere
   else for them; the rail's foot is that place now. Between the rail menu, this bar and the
   account menu the same two controls existed in THREE places, which stops being convenience and
   becomes clutter — so the bar's copies were removed. Two access points is the limit: the rail
   is the accelerator, the account menu is where a first-time user looks. One store either way
   (`shared/appearance/*`), so they cannot disagree.

It also carries a **Development** chip under `import.meta.env.DEV`. That is compile-time, so it
is absent from the production bundle rather than hidden at runtime. It is the highest-value item
on the bar: the dev site and the live site are the same app with the same institution's branding,
and until now the only thing distinguishing them was the URL.

---

# Appearance

Two preferences, both persisted, both applied to `<html>` **before first paint** by an inline
script in `index.html`. That script is not an optimisation — React applies a theme in an effect,
which is one frame after the browser has already painted a white document, so without it every
dark-mode user gets a full-screen white flash on every load.

## Theme — light / dark / system

Three states, not a boolean. `system` is a real choice, not the absence of one, and a two-state
switch cannot express it: someone who picks light explicitly stays light at 9pm, and someone on
`system` does not.

The `.dark` token block in `index.css` shipped complete, measured and **unreachable** — nothing
added the class, so half the palette was dead code. It is now driven by `next-themes`
(`attribute="class"`, storage key `erp-theme`). Two consequences worth knowing:

- `shared/ui/sonner.tsx` already called `useTheme()`. With no provider it resolved to `system`,
  so a toast could render dark on a light app. That was a live bug the provider fixed for free.
- Switching the provider to `data-theme` would silently disable every `dark:` utility in the app,
  because `@custom-variant dark (&:is(.dark *))` is keyed to the class.

## The spacing pass — three vocabularies, one rhythm

The type scale dropped to a 13px body and the spacing did not follow it, so the page read as
loose against its own text. Measuring found the real cause, and it was not the token values:

**Three parallel spacing vocabularies were in use at once.** The density tokens (16/24), a
hardcoded 24px (`-6`), and a hardcoded 32px (`-8`) — the last two never wired to anything. On the
module page the header/body gap and the gap between groups were both **32px against 13px text**,
which is where "too much space" actually lived. 27 literals across nine files.

They are all tokens now, each replaced by the one that names what it does:

| Was | Means | Token |
|---|---|---|
| `mt-8` after a page header | header → body | `--page-stack` |
| `gap-8` between groups | section → section | `--page-stack` |
| `mt-6` / `gap-6` | card → card in a section | `--section-stack` |
| `p-6` on a record/form section | a card's own padding | `--card-pad` |
| `px-6 py-8` on `RecordFrame` | the page gutter | `--page-gutter-*` |

The values were then tightened once (gutter 24→20/18, stack 24→20, section 16→14, row 12→10),
which is a smaller change than it sounds next to killing the 32s.

**Two of those literals were load-bearing and would have broken silently:**

- `DoctypeEditor`'s sticky save bar bleeds to its card's edge with `-mx-6 … px-6`. That is the
  card's padding, spelled as a number. Moving the card to `--card-pad` without moving this would
  leave a hairline stopping short of one edge and overhanging the other — which reads as a
  rendering fault, not a spacing bug.
- `HomeSkeleton` was written with literals while `HomeScreen` used tokens, so the two drifted the
  moment the tokens moved. **A skeleton that is the wrong size is worse than none**: it promises
  a layout and then reflows into a different one, which is the exact jump it exists to prevent.

The rule that falls out: **page rhythm comes from tokens, never from a number.** A literal
`gap-6` in a page is not a small decision, it is a fourth vocabulary.

---

## Density and the type scale

**"Everything looks zoomed" was measured, and it turned out to be the scale, not a zoom.** A
census of every element that owns visible text found no scaling of any kind — `devicePixelRatio`
1, no `zoom`, no `transform: scale`, `html` at the browser's untouched 16px — but it found the
app running on Tailwind's *website* defaults: `body` inheriting 16px, page titles at 24px, body
copy at 14px. Against Odoo (13/20), Linear (13/21), ERPNext (13/20) and Fiori (14/20) that is a
step large everywhere, which is exactly what reads as zoom without being it.

Three separate faults, with three different causes:

1. **`body` inherited 16px.** A latent trap rather than a live bug — the census found every
   visible string setting its own size, so nothing actually *rendered* at 16px. But the next
   component to forget a `text-` class would have rendered a full step large. `body` is now
   pinned to the body step. `html` is deliberately NOT touched: that is the user's own
   accessibility setting, and every rem in the app is built on it.
2. **Page titles disagreed** — 24px everywhere, 20px on home, so the greeting read as a
   subheading of nothing. One step now, `text-2xl`, everywhere.
3. **This document described a scale the app had never used.** h1: 36px, h2: 30px — a marketing
   scale in an ERP's design doc, which is precisely why the code was free to drift onto
   Tailwind's defaults instead. The doc was the thing that was wrong.

**The fix is a redefinition, not an addition.** The steps are set on Tailwind's own names
(`--text-sm` is 13px now, `--text-2xl` is 20px), so every existing utility moved at once, no
component changed, and there is no second vocabulary for anyone to forget.

## Density — comfortable / compact

**One app-wide preference, not a per-table control.** The grid package ships its own per-table
density toggle; it is switched off. A registrar who wants tight rows wants them on all forty
screens, and setting it forty times — then again on every new doctype — is a chore, not a
preference. `data-density` on `<html>` is the authority, and it is an attribute rather than a
class because it is an enumeration.

**Savings come out of padding only.** Never type size, never target size. That is the line
between a density control and an accessibility regression, and it is why the scale above moves
gutters, stacks, card padding and cell padding, and moves nothing else.

**The chrome does not change with density.** Rail, panel, topbar and status bar keep their
heights in both modes — density is a property of content, and a shell that resizes underneath
you while you read is disorienting for the ~15% it saves.

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
