# CLAUDE.md — `apps/erp`

Guidance for Claude Code when working in this app. Bench-level facts (sites, the other apps) live in
`/workspace/development/frappe-bench/CLAUDE.md`.

## What this is

**ERP for Colleges** — a multi-tenant Frappe v16 app (Python 3.14) for education groups: one
Institution running many Campuses and many Colleges, covering engineering, arts & science,
polytechnic, medical, law and MBA colleges **and** K-12 schools through one model. See
[docs/PRODUCT.md](docs/PRODUCT.md).

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
- **[erp/api/](erp/api/)** — whitelisted endpoints and shared server helpers: `modules.py`,
  `navigation.py`, `permission.py`, `session.py`. Add one only when CRUD won't do —
  [frappe-api](.claude/skills/frappe-api/SKILL.md) skill.
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

React 19 + TypeScript + Vite, Tailwind v4 + shadcn, TanStack Query, Zustand, react-router,
`frappe-js-sdk`. `@/` aliases `frontend/src/`.

```
src/
  assets/images/group/   # static images
  components/            # brand/, shell/, auth/, modules/, ui/ (shadcn output)
  global/                # query-client, ui-store
  hooks/                 # use-session, use-login, use-modules, use-navigation, …
  lib/                   # frappe.ts (shared db/call/auth/file), navigation.ts, modules.ts, utils.ts, schemas/
  pages/                 # route-level components
  styles/                # index.css — Tailwind/theme entry point
  types/                 # shared TS types
e2e/                     # Playwright specs
```

- **Routing** — [frontend/src/routes.tsx](frontend/src/routes.tsx). Authenticated pages go inside the
  `RequireAuth` → `AppShell` layout routes so they keep their navigation context.
- **Navigation is data-driven** from Frappe Module Defs and Workspaces via
  `erp.api.navigation.get_module_rail` / `get_module_menu`. There is no hardcoded nav tree — adding a
  doctype to a workspace is what surfaces it. See [docs/MODULES.md](docs/MODULES.md).
- **API access** — use the shared handles from `src/lib/frappe.ts`; never construct a new `FrappeApp`.
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
