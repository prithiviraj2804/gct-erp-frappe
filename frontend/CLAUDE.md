# CLAUDE.md — `apps/erp/frontend`

The React/Vite SPA that Frappe serves at `/erp`. App-wide rules live in
[../CLAUDE.md](../CLAUDE.md); paths in this file are written relative to the app root (`apps/erp/`).

**The conventional Vite/shadcn top level over an enforced layering rule.** `components/`, `hooks/`,
`lib/`, `types/`, `global/` are the base layer and may import nothing above them; then `modules/` →
`pages/` → `auth/`/`shell/` → `app/`. `eslint.config.js` enforces it: a violation fails
`npm run lint`, not code review. Full rationale: [src/README.md](src/README.md). `@/` aliases
`src/`. `e2e/` holds Playwright specs, written per SHAPE (list, record), not per doctype.

The base layer is **five folders where it used to be one** (`shared/`) — the rule is unchanged,
it simply has to be stated five times. If you retarget those boundaries, prove they still reject
a violation: a rule that quietly matches nothing passes lint exactly like a correct one.

Naming: a file whose default export is a React component is **PascalCase**; everything else is
**kebab-case**. Route-level components are suffixed `Screen`.

- **Routing** — [frontend/src/routes.tsx](frontend/src/routes.tsx). Authenticated pages go inside the
  `RequireAuth` → `AppShell` layout routes so they keep their navigation context.
- **Navigation is data-driven** from Frappe Module Defs and Workspaces via
  `erp.api.navigation.get_module_rail` / `get_module_menu`. There is no hardcoded nav tree — adding a
  doctype to a workspace is what surfaces it. See [docs/MODULES.md](docs/MODULES.md).
- **Group headings AND individual screens carry icons**, each set on the workspace row that
  produces it — Card Break for a group, Link for a screen — resolved through `GROUP_ICONS` /
  `SCREEN_ICONS` in `shell/lib/module-icons.ts`. Per-item icons are allowed in the nav column and
  forbidden on the module overview cards, and the rule is the same in both places: an icon per
  row earns its pixels only when the icons DIFFER. Every overview card is a doctype list, so its
  icon would be one glyph repeated; these are a landmark, a pin, a calendar. Frappe
  ships the full lucide set under the same kebab-case ids the SPA uses, so one name serves both
  the Desk workspace editor and this app — giving a group an icon is a **workspace change, not a
  frontend one**. Two rules: the map is keyed on the icon NAME, never the label (labels are
  editable display text, so keying on them means a rename silently drops the icon); and it is an
  explicit map, never `icons[name]`, because a dynamic index defeats tree-shaking and ships all
  1600 glyphs. An unmapped name renders no icon rather than a placeholder.
  **Editing a workspace JSON needs `bench migrate` to reach a running site.**
- **The shell has one navigation model:** module rail → module menu → working page. `AppShell`
  resolves navigation and global shortcuts once and always renders `RailShell`. Users learn one
  stable hierarchy instead of choosing between different placements for the same information.
- **The desktop shell is three fixed planes around one scrolling page** — rail (56px, full
  height), nav column (220px, full height) and Trust context header (56px). Nothing is
  `position: fixed`; every plane is in flow. Below the desktop breakpoint the two navigation
  columns are replaced by a drawer, leaving the full viewport for the current task. Full reasoning: "Three planes" in
  [.claude/DESIGN.md](.claude/DESIGN.md).
- **GLOBAL goes in the rail, LOCAL goes in the nav column.** That is the rule for deciding where
  anything new belongs. The rail: institution **logo** at the head, search tile, the modules,
  then appearance and the account at the foot (`AppearanceMenu`, `UserMenu`, sharing `RAIL_TILE`
  from `shell/lib/rail.ts` so a 56px strip reads as one instrument). The nav column: that
  module's screens, and **no header at all**. Putting the institution's name in the column was
  tried and reverted (it sat above the module's name at the same size and read as a breadcrumb
  that was not one); the module's own name went next, for saying what the rail's selected tile
  and its hover tooltip already say.
  - **The RAIL is unconditional; the nav column is gated by `hasModules`.** Whichever column
    holds the account must always render, or a user with no modules cannot sign out — the rail
    holds it, and its head/search/appearance/account are all module-independent, so it is never
    empty. The nav column has one job and no module means nothing to do, so it is hidden rather
    than left blank. There is an e2e test for exactly this; do not flip it back.
  - **Every rail tile names itself on hover** (Radix `Tooltip`, `side="right"`). The
    `TooltipProvider` is in `AppShell` at `delayDuration={400} skipDelayDuration={300}` — not the
    primitive's 0, which fires four tooltips whenever the pointer crosses the rail on its way
    somewhere else. Do not use the native `title` attribute on a rail control: it is ~1s,
    unstyled, and would stack with the Radix one.
  - **The nav column collapses** — ⌘B, or the toggle in the rail (`erp-nav-collapsed`). The
    toggle is in the RAIL deliberately: an edge handle lives on the thing it hides, so once
    collapsed there would be nothing to click. The column is **unmounted, not `w-0`** — a hidden
    column still runs its menu query and keeps its links in the tab order. ⌘B is registered in
    `AppShell`'s single key listener and reads `getNavCollapsed()` from the store rather than
    closing over React state, so the listener registers exactly once.
  - **The nav column has no header and no top padding** — the screen list starts at the top. A
    `pt-13` was tried, to line its first group label up with the rail's search tile; the
    alignment was real and imperceptible, and 52px of empty chrome just read as a bug. Do not
    reintroduce it. The module is still named to AT via the column's
    `aria-label="{module} screens"` landmark — a screen reader can neither see the selected rail
    tile nor hover it.
  - **The rail head shows the institution's LOGO** (`InstitutionMark` without `monogramOnly`),
    which is now the only place the institution appears — so the link's accessible name is the
    institution, not "Home". A landscape wordmark lands ~48x13 there and is not legible; that is
    a known limit of a 56px rail, not a bug to tune. `InstitutionMark` caps logo width on the
    **wrapper**, not the `<img>` — on the img it was a hard 160px floor that overflowed the rail
    instead of shrinking.
  - The rail lists modules; beside it the permanent nav column (`--sidebar-width`, 220px)
    lists the current module's screens — no hover, no toggle, no overlay. The rail's width is
    **derived** (`--rail-tile` + 2×`--rail-gutter`, set in `AppShell`) — never hard-code a number
    that encodes the tile/gutter relationship. Each rail item also links to `/{module-slug}` — a
    module overview page listing the same screens as cards — so the panel is never the only route
    to a screen. `/home` renders the dashboard (HomeScreen), it does not redirect.
  - The status bar holds system state (`useConnectionState` — offline / saving / syncing /
    ready, all read off TanStack Query's own counters, no new request) plus the shortcut sheet
    and a `Development` chip under `import.meta.env.DEV`. It does **not** carry theme/density any
    more: with the rail's appearance menu those existed in three places. Two access points is the
    limit — the rail menu and the account menu.
- **Appearance is `global/*`: theme (light/dark/system) and density
  (comfortable/compact).** Both are applied to `<html>` by an **inline boot script in
  `index.html`** before first paint — React would apply them one frame after the browser painted
  white, which is a full-screen flash for every dark-mode user. If you rename `erp-theme` or
  `erp-density`, rename them in that script too; both sites carry a comment saying so.
  - Theme runs through `next-themes` with `attribute="class"`, matching
    `@custom-variant dark (&:is(.dark *))`. Moving it to `data-theme` silently kills every
    `dark:` utility in the app.
  - **The chrome is themed too** — a saturated BLUE nav in light mode (adopted from
    Succeedex-org/Admin-CRM) and a neutral dark one in dark, one hue-241 ramp either way. Their
    `#0085C8` was re-solved to `#017BB8`/`#005886` because theirs fails AA on the two things a
    user reads most (button labels 3.86:1, nav text 3.69:1) and several of their tokens are
    outside sRGB. **Do not "restore" their exact hexes** — see "The blue" in DESIGN.md.
    On a coloured slab, states are **black** alpha: white desaturates the blue to grey. The rule is "chrome recedes, content is the
    lit plane", not "the sidebar is dark". Consequences worth knowing before you touch it:
    `--sidebar-accent` and `--sidebar-border` are **black** alphas in light and **white** in dark,
    so never hardcode `white/10` on a chrome surface; the selected rail tile is a sapphire plate
    with a white glyph in light and the inverse in dark, which is why `InstitutionMark` takes a
    `surface` prop (`content` | `chrome` | `brand`) rather than the old `onColor` boolean — a
    boolean cannot name three grounds.
  - **`--brand-panel` is the one surface that stays deep in both themes**: the sign-in identity
    panel. It is a hero, not chrome — following the light chrome there put a 1.09:1 grey slab
    beside a white form on 62% of the first screen anyone sees. Do not re-alias it to
    `--sidebar-deep`.
  - **Density is ONE app-wide preference, never per-table.** The grid package's own
    `showDensityToggle` is deliberately off — a user should not have to set density again on
    every doctype. `data-density` on `<html>` drives `--page-gutter-*`, `--page-stack`,
    `--section-stack`, `--card-pad`, `--row-pad-y` and `--table-cell-pad-y`; write
    `px-(--page-gutter-x)`, not `px-6`. Savings come out of padding only — never type size,
    never target size. The chrome keeps its heights in both modes.
  - **Page rhythm comes from tokens, never from a number.** `mt-8`/`gap-6`/`p-6` in a page is a
    parallel vocabulary that silently stops matching the moment the tokens move — there were
    three of them at once (tokens, 24px, 32px) until a sweep replaced 27 literals. Header→body
    and section→section are `--page-stack`; card→card is `--section-stack`; a card's own padding
    is `--card-pad`. Watch for literals that are load-bearing rather than cosmetic:
    `DoctypeEditor`'s sticky bar cancels its card's padding with `-mx-(--card-pad)`, and
    `HomeSkeleton` must use the same tokens as `HomeScreen` or it reflows on load — the exact
    jump a skeleton exists to prevent.
  - The same two controls appear in the rail's `AppearanceMenu` and in the account menu. That is
    one store with two affordances, not two settings — `global/*` is the single
    source, so they cannot disagree.
- **The command palette (⌘K / Ctrl K) is the third route to every screen**, and the only one that
  crosses modules. It reads the same `get_module_menu` payload the rail and the module page do —
  no new endpoint, and a screen the user cannot open is absent from the payload, so it fails
  closed by construction. It jumps to **screens, never records**: the topbar's record-search slot
  is still empty and still documented, because there is no search endpoint yet.
- **`?` opens the shortcut sheet** (`ShortcutsDialog`), which documents **only shortcuts that are
  actually wired** — a sheet naming a key nothing handles is worse than no sheet. There is still
  exactly **one** global key listener in the app, in `AppShell`, and it handles both keys. `?`
  yields while a text field or a `contentEditable` has focus; unlike ⌘K it is a printable
  character, so swallowing it there would eat a real keystroke.
- **Doctype screens are generated, not hand-written.** `/{module}/{doctype}` and
  `/{module}/{doctype}/{name}` are served by `pages/doctype/pages/DoctypeListScreen.tsx` and
  `DoctypeRecordScreen.tsx` for every doctype, driven by `erp.api.doctype.get_doctype_schema`.
  Adding a doctype to a workspace gives it working screens with no frontend change — list,
  record, **create and edit**, with the form generated from the same `layout` the record view
  renders.
- **Writes go straight through `/api/resource`** (`hooks/use-doctype-mutations.ts`), never
  through a whitelisted wrapper — METHOD.md step 5. Client-side validation is deliberately thin
  (required, numeric, JSON); the server is the authority and its refusals now reach the user,
  because `lib/errors.ts` understands HTTP 417 + `_server_messages`. **That was the one
  thing blocking writes**, and it is why a controller `frappe.throw` no longer surfaces as
  "There was an error while updating the document". It returns *every* message, not the first.
- **A field the user may not write renders as a value, not a disabled input** — `read_only`,
  `fetch_from`, the `id` UUID, and the fields a `field:`/`format:` naming rule computed the key
  from (those are editable exactly once, at create; editing them later moves the column while
  `name` stays put, silently). `pages/doctype/lib/form.ts` owns all of it.
- **Every table in the app is `components/table/BstTable.tsx`**, the seam over
  `@bloomskill/table-shadcn` (TanStack v9 underneath). `DoctypeGrid` is the list's use of it and
  `ChildTable` the record's. Read
  [DoctypeGrid.tsx](frontend/src/pages/doctype/components/DoctypeGrid.tsx) before changing
  either: the engine sorts, searches and paginates **in memory only** — `useBstTable` passes a
  fixed option set to `useTable` with no `manualPagination`/`manualSorting`/`rowCount` and no
  state callback — so a server page handed to it produces a footer and header clicks that lie.
- **The list page is header → table, and nothing between.** The status tab strip is gone: it was
  a full-width band that grew a tab per status word. It became one Select in the page header
  (`StatusFilter`) — **not** a table filter, because it narrows what the SERVER selects and the
  table's filters only narrow the ≤2000 rows already fetched, which is the only thing that helps
  past the cap. `?status=` is unchanged. The record count is a phrase in the header's meta line
  (`PageHeader`'s `count` + `note`), never a bare numeral beside the title; the truncation notice
  lives there too rather than in a banner of its own.
- **The grid's defaults are lean, and the settings gear is how power features come back.** Every
  `show*`/`enable*` used to be on at once. Off by default now: `showStatusBar` (duplicated the
  pagination footer), `enableColumnFilterRow` (a permanent row of inputs; the Filters button does
  it on demand), `showFormatBuilder`, and `enableRowPinning` (a pin button in every row of every
  list). Column pinning stays. Before adding a `show*` flag, ask whether it earns a permanent
  control on all forty screens.
- **The list therefore splits selection from presentation.** The **server selects**: search and
  filters are URL state sent to Frappe, up to `LIST_ROW_CAP` (2000) rows, and the screen says so
  out loud when it truncates. The **client presents**: sorting (shift-click adds a level), paging
  and column resizing are the engine's, over the rows already loaded. Sort, page and column
  widths are consequently **not** URL or localStorage state — the engine reports none of them
  back, and a param the table would ignore is worse than no param. Saved views remain in
  localStorage; they capture the state that decides which rows the server returns.
- **Typed per-column filters live on the toolbar, not in the headers** —
  `components/column-filters/ColumnFilterMenu.tsx`, writing `?f.<field>=<op>:<value>`
  (`like`/`between`/`eq`/…), a channel kept separate from the flat `?status=Active` Select/Check
  bar so old links stay valid; they are ANDed so `get_count` still sees them. They moved off the
  headers because the engine renders a header inside a single `role="button"` carrying the sort
  handler, and a control nested in one is invalid ARIA and is swallowed into that button's name.
  The header keeps a non-interactive marker showing which columns are constrained.
- **Overrides go through the registry, never through the router.**
  [pages/doctype/registry.ts](frontend/src/pages/doctype/registry.ts) is the one seam between
  the generic renderer and a doctype that needs something it cannot say — four escalating levels,
  from a data literal to a whole replacement page, all on the same route inside `RequireAuth` →
  `AppShell`. A module registers itself in `modules/<module>/screens.ts`; the renderer never
  imports a module. **The rule: an override may only override a default the renderer already
  produces — it may never supply something the doctype JSON could have said.** A column order, a
  filter, a label or a section belongs in the schema. Background:
  [docs/features/master-data-administration.md](docs/features/master-data-administration.md) §8.
- **`get_doctype_schema` publishes the authored form's full structure** — tabs → sections →
  columns, plus `collapsible` and `child_schemas`. Tab Break is not a Section Break and a Column
  Break is not decoration; flattening either loses an instruction the renderer cannot recover.
- **Link pickers use Frappe's own `frappe.desk.search.search_link`**, not `/api/resource` —
  it applies user permissions, honours the target's `search_fields` and any custom search query,
  and works for link targets outside this app (`Country` is a Frappe core doctype, so
  `get_doctype_schema` refuses it by design).
- **API access** — use the shared handles from `lib/frappe.ts`; never construct a new
  `FrappeApp`.
- **Production** — `vite build` writes to `erp/public/dist/`; `erp/www/erp.html` includes it and
  `website_route_rules` maps `/erp` and `/erp/<path>` so client-side routing survives a hard refresh.
  `erp/www/erp.py` injects the CSRF token.
- **Development** — `vite.config.ts` proxies `^/(api|assets|files|private)` to the bench and forces the
  `X-Frappe-Site-Name` header, because `frappe-js-sdk` would otherwise send the dev server's hostname
  and Frappe couldn't resolve the site. Config in `frontend/.env`.
- **The type scale is Tailwind's own names, redefined** — `--text-sm` is **13px**, `--text-2xl`
  is **20px**, and `body` is pinned to the 13px step. Write `text-sm` for body copy and
  `text-2xl` for a page title exactly as before; the sizes moved underneath, so there is one
  vocabulary and nothing to remember. Scale: **11 / 12 / 13 / 14 / 16 / 18 / 20**, with
  Tailwind's untouched 30 and 36 reserved for the sign-in hero and forbidden inside the shell.
  Do not add a parallel `text-body`-style utility, and do not set a `font-size` on `html` — that
  is the user's accessibility setting and every rem depends on it.
- **Styling** — Tailwind v4 with the shadcn oklch token set in `src/styles/index.css`. Dark mode is
  **class-driven** (`.dark` via `@custom-variant dark`) — do not add a `prefers-color-scheme` block
  that reassigns theme tokens; it silently overrides the class. `components.json` points shadcn at
  `src/styles/index.css`. Use the elevation utilities (`shadow-card` / `shadow-raised` /
  `shadow-overlay`) rather than a hand-written `shadow-[…]`: a literal cannot follow the token
  into dark mode, where a slate-tinted shadow on a near-black surface is invisible.
