# CLAUDE.md — `apps/erp`

Guidance for Claude Code when working in this app. Bench-level facts (sites, the other apps) live in
`/workspace/development/frappe-bench/CLAUDE.md`.

## What this is

A multi-tenant Frappe v16 app (Python 3.14) for education groups: one Institution running many
Campuses and many Colleges, covering engineering, arts & science, polytechnic, medical, law and
MBA colleges **and** K-12 schools through one model. See [docs/PRODUCT.md](docs/PRODUCT.md).

The app has no product name in its UI. Screens identify the *institution*, from the Institution
record — see [erp/api/branding.py](erp/api/branding.py). `APP_NAME` ("ERP") is a last-resort
fallback for a bench with no Institution row yet, not a brand to put on screen.

Two halves: the Frappe app (`erp/` — Python + doctypes) and a React/Vite SPA (`frontend/`) that
Frappe serves at `/erp`.

## The build rule — read this before creating anything

> **No master is created without a feature slice that consumes it.**
> A master starts at the minimum fields its first consumer justifies, and grows one slice at a time.

We build features, and the feature's journeys name the masters it needs. If you are about to create
a doctype and cannot name the journey that requires it, don't create it. The procedure is
[docs/METHOD.md](docs/METHOD.md); the current slice is [docs/ROADMAP.md](docs/ROADMAP.md).

## Docs

| Doc | For |
|---|---|
| [docs/METHOD.md](docs/METHOD.md) | How a slice gets built, start to finish |
| [docs/PRODUCT.md](docs/PRODUCT.md) | The domain — institution types, the college/school vocabulary map, personas |
| [docs/DATA-MODEL.md](docs/DATA-MODEL.md) | What exists today, the hierarchy contract, the unbuilt-masters backlog |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Slice order |
| [docs/MODULES.md](docs/MODULES.md) | Modules and how SPA navigation is generated |
| [docs/features/](docs/features/) | One spec per slice |

Skills in [.claude/skills/](.claude/skills/) carry the step-by-step procedures: `feature-slice`,
`new-doctype`, `frappe-api`, `ui`, `verify`, `code-review`. Design tokens: [.claude/DESIGN.md](.claude/DESIGN.md).

## Commands

Run `bench` commands from the bench root (`/workspace/development/frappe-bench`), site-scoped with
`--site erp.localhost`.

```bash
bench start                                   # full dev stack (see Procfile)
bench --site erp.localhost migrate            # apply doctype/schema changes and patches
bench --site erp.localhost console            # python REPL with a site context
bench --site erp.localhost clear-cache        # after hook/config changes
bench build --app erp                         # desk assets only — NOT the SPA
bench --site erp.localhost run-tests --app erp
bench --site erp.localhost run-tests --doctype "Programme Intake"
bench --site erp.localhost run-tests --module erp.master.test_hierarchy
```

Frontend has its own toolchain:

```bash
cd apps/erp/frontend
npm run dev      # Vite on :5173, proxies /api to the bench
npm run build    # tsc -b && vite build → erp/public/dist/
npm run lint
npx playwright test           # e2e specs in frontend/e2e/
```

## Structure

- **Modules** — declared in [erp/modules.txt](erp/modules.txt): `Erp`, `Gate`, `Master`. Each is
  a Python package (`erp/erp/`, `erp/gate/`, `erp/master/`). Adding one: see
  [docs/MODULES.md](docs/MODULES.md).
- **Doctypes** — `erp/<module>/doctype/<snake_name>/` holding `<name>.json` (schema, the source of
  truth), `<name>.py` (controller subclassing `Document`), `<name>.js` (form scripting),
  `test_<name>.py`. There is **no `bench new-doctype` command in Frappe v16** — use the Desk UI at
  `/app/doctype/new` (developer_mode writes files back) or a scripted insert. Follow the
  [new-doctype](.claude/skills/new-doctype/SKILL.md) skill; the `id` field is mandatory and the UI
  will not add it for you.
- **[erp/hooks.py](erp/hooks.py)** — the integration manifest. Live entries: `website_route_rules`
  (serves the SPA at `/erp`) and the global `doc_events` UUID hook. Most other entries are still
  commented scaffolding.
- **[erp/patches.txt](erp/patches.txt)** — data migrations run by `bench migrate`, split
  `[pre_model_sync]` / `[post_model_sync]`. Idempotent patches go here, not ad-hoc scripts.
- **[erp/api/](erp/api/)** — every whitelisted endpoint, under one dotted prefix so
  `grep -rn "erp\.api\."` finds the whole public surface. **A file at the root is app-wide**
  (`session.py`, `branding.py`, `modules.py`, `navigation.py`, `doctype.py`, plus the
  non-whitelisted `permission.py`); **a subpackage is a Frappe module** (`gate/gate_pass.py` →
  `erp.api.gate.gate_pass.mark_exit`). Add one only when CRUD won't do, and remember Desk
  client scripts call these too — [frappe-api](.claude/skills/frappe-api/SKILL.md) skill.
  `session.py` and `branding.py` are the only `allow_guest` endpoints, because the sign-in
  screen is rendered to an anonymous visitor. Both publish a fixed allow-list of fields and
  nothing else; treat adding a field to either as a change to the app's public surface.
- **[erp/utils.py](erp/utils.py)** — app-level helpers used by hooks: `set_uuid_id`, `slugify`.
- **[erp/master/hierarchy.py](erp/master/hierarchy.py)** — `validate_same_parent`, the ancestry guard.
- `erp/www/` standalone pages · `erp/templates/` Jinja · `erp/public/` bundled assets **plus the
  built SPA in `erp/public/dist/` (generated — never edit by hand)** · `erp/config/` Desk module config.

## Conventions

### The `id` UUID column

Every doctype carries a separate `id` field holding an auto-generated UUID, distinct from Frappe's
primary key `name`. `name` stays the readable business key (e.g. `college_code`) and Links reference
it; `id` is a stable identifier for external systems.

```json
{
 "fieldname": "id", "fieldtype": "Data", "label": "ID",
 "unique": 1, "read_only": 1, "no_copy": 1, "in_standard_filter": 1,
 "description": "Auto-generated UUID"
}
```

Filled automatically by `set_uuid_id` in [erp/utils.py](erp/utils.py) via
`doc_events = {"*": {"before_insert": "erp.utils.set_uuid_id"}}`. The hook only acts on doctypes that
define the field and never overwrites an explicit value — just add the field to `fields` and
`field_order`. Omitting it errors nowhere, which is why it's easy to miss.

### Hierarchy validation

Doctypes denormalise their ancestors (`institution`, `college`, `campus`, `department`) so reports can
filter without walking the tree. A Link proves existence, not branch membership, so those columns are
independent claims that must be reconciled. Any doctype carrying them calls `validate_same_parent`
from [erp/master/hierarchy.py](erp/master/hierarchy.py) in `validate`. Do not write a second version
of this check. Full reasoning: [docs/DATA-MODEL.md](docs/DATA-MODEL.md).

### Style

ruff-enforced: **tab indentation**, double quotes, line length 110. Do not reformat to spaces.
Pre-commit runs ruff + eslint + prettier + pyupgrade:

```bash
cd apps/erp && pre-commit install     # one-time
cd apps/erp && pre-commit run --all-files
```

## Frontend

React 19 + TypeScript + Vite, Tailwind v4 + shadcn, TanStack Query, react-router, `frappe-js-sdk`.
`@/` aliases `frontend/src/`.

**Five layers, each importing only the ones below it.** `eslint.config.js` enforces this — a
violation fails `npm run lint`, not code review. Full rationale:
[frontend/src/README.md](frontend/src/README.md).

```
src/
  app/        # composition root — routes.tsx, query-client, App, NotFoundScreen
  shell/      # the authenticated frame: rail, flyout, topbar, command palette,
              #   module overview page
  auth/       # sign-in screen, RequireAuth, login/logout hooks
  screens/    # the GENERIC doctype renderer
    doctype/  #   pages/ (list, record) · components/ (DoctypeGrid, ListToolbar, cells,
              #   ChildTable, RecordSummary, ViewMenu, BulkBar) · hooks/ · lib/ · registry.ts
  modules/    # one folder per Frappe module (gate/, master/), mirroring erp/<module>/.
              #   Screen overrides and bespoke task screens live here.
  shared/     # bottom layer — ui/ (shadcn output), lib/, hooks/, types/, components/
  styles/     # index.css — Tailwind/theme entry point
  assets/
e2e/          # Playwright specs — written per SHAPE (list, record), not per doctype
```

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

## Verify before you claim it works

`tsc` passing says nothing about whether a page renders, and a migrated doctype says nothing about
whether the field landed. Exercise the change — [verify](.claude/skills/verify/SKILL.md) skill.
