# CLAUDE.md — `apps/erp/frontend`

The React/Vite SPA that Frappe serves at `/erp`. App-wide rules live in
[../CLAUDE.md](../CLAUDE.md); paths in this file are written relative to the app root (`apps/erp/`).

**Five layers, each importing only the ones below it** — `app/` → `shell/` → `auth/` → `screens/` →
`modules/` → `shared/`. `eslint.config.js` enforces this: a violation fails `npm run lint`, not code
review. Full rationale: [src/README.md](src/README.md). `@/` aliases `src/`. `e2e/` holds Playwright
specs, written per SHAPE (list, record), not per doctype.

Naming: a file whose default export is a React component is **PascalCase**; everything else is
**kebab-case**. Route-level components are suffixed `Screen`.

- **Routing** — [frontend/src/routes.tsx](frontend/src/routes.tsx). Authenticated pages go inside the
  `RequireAuth` → `AppShell` layout routes so they keep their navigation context.
- **Navigation is data-driven** from Frappe Module Defs and Workspaces via
  `erp.api.navigation.get_module_rail` / `get_module_menu`. There is no hardcoded nav tree — adding a
  doctype to a workspace is what surfaces it. See [docs/MODULES.md](docs/MODULES.md).
- **The shell rests as the 72px rail alone.** No sidebar toggle: the menu panel flies out on
  hover/focus and retracts on leave. Because hover is not available to everyone, each rail item also
  links to `/{module-slug}` — a module overview page listing the same screens as cards. Never let
  the flyout become the only route to a screen. `/home` renders nothing; it redirects to the first
  allocated module.
- **The command palette (⌘K / Ctrl K) is the third route to every screen**, and the only one that
  crosses modules. It reads the same `get_module_menu` payload the rail and the module page do —
  no new endpoint, and a screen the user cannot open is absent from the payload, so it fails
  closed by construction. It jumps to **screens, never records**: the topbar's record-search slot
  is still empty and still documented, because there is no search endpoint yet. There is exactly
  one global key listener in the app, registered in `AppShell`.
- **Doctype screens are generated, not hand-written.** `/{module}/{doctype}` and
  `/{module}/{doctype}/{name}` are served by `screens/doctype/pages/DoctypeListScreen.tsx` and
  `DoctypeRecordScreen.tsx` for every doctype, driven by `erp.api.doctype.get_doctype_schema`.
  Adding a doctype to a workspace gives it working screens with no frontend change — list,
  record, **create and edit**, with the form generated from the same `layout` the record view
  renders.
- **Writes go straight through `/api/resource`** (`hooks/use-doctype-mutations.ts`), never
  through a whitelisted wrapper — METHOD.md step 5. Client-side validation is deliberately thin
  (required, numeric, JSON); the server is the authority and its refusals now reach the user,
  because `shared/lib/errors.ts` understands HTTP 417 + `_server_messages`. **That was the one
  thing blocking writes**, and it is why a controller `frappe.throw` no longer surfaces as
  "There was an error while updating the document". It returns *every* message, not the first.
- **A field the user may not write renders as a value, not a disabled input** — `read_only`,
  `fetch_from`, the `id` UUID, and the fields a `field:`/`format:` naming rule computed the key
  from (those are editable exactly once, at create; editing them later moves the column while
  `name` stays put, silently). `screens/doctype/lib/form.ts` owns all of it.
- **Every table in the app is `shared/components/table/BstTable.tsx`**, the seam over
  `@bloomskill/table-shadcn` (TanStack v9 underneath). `DoctypeGrid` is the list's use of it and
  `ChildTable` the record's. Read
  [DoctypeGrid.tsx](frontend/src/screens/doctype/components/DoctypeGrid.tsx) before changing
  either: the engine sorts, searches and paginates **in memory only** — `useBstTable` passes a
  fixed option set to `useTable` with no `manualPagination`/`manualSorting`/`rowCount` and no
  state callback — so a server page handed to it produces a footer and header clicks that lie.
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
  [screens/doctype/registry.ts](frontend/src/screens/doctype/registry.ts) is the one seam between
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
- **API access** — use the shared handles from `shared/lib/frappe.ts`; never construct a new
  `FrappeApp`.
- **Production** — `vite build` writes to `erp/public/dist/`; `erp/www/erp.html` includes it and
  `website_route_rules` maps `/erp` and `/erp/<path>` so client-side routing survives a hard refresh.
  `erp/www/erp.py` injects the CSRF token.
- **Development** — `vite.config.ts` proxies `^/(api|assets|files|private)` to the bench and forces the
  `X-Frappe-Site-Name` header, because `frappe-js-sdk` would otherwise send the dev server's hostname
  and Frappe couldn't resolve the site. Config in `frontend/.env`.
- **Styling** — Tailwind v4 with the shadcn oklch token set in `src/styles/index.css`. Dark mode is
  **class-driven** (`.dark` via `@custom-variant dark`) — do not add a `prefers-color-scheme` block
  that reassigns theme tokens; it silently overrides the class. `components.json` points shadcn at
  `src/styles/index.css`.
