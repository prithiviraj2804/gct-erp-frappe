# CLAUDE.md — `apps/erp`

Guidance for Claude Code when working in this app. Bench-level facts (sites, the other apps) live in
`/workspace/development/frappe-bench/CLAUDE.md`.

## What this is

A multi-tenant Frappe v16 app (Python 3.14) for education groups: one Trust running many
Campuses and many Institutions, covering engineering, arts & science, polytechnic, medical, law and
MBAn institutions **and** K-12 schools through one model. See [docs/PRODUCT.md](docs/PRODUCT.md).

The app has no product name in its UI. Screens identify the *trust*, from the Trust
record — see [erp/api/branding.py](erp/api/branding.py). `APP_NAME` ("ERP") is a last-resort
fallback for a bench with no Trust row yet, not a brand to put on screen.

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
| [docs/DATA-MODEL.md](docs/DATA-MODEL.md) | What exists today, the hierarchy contract, the unbuilt-masters backlog |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Slice order |

Skills in [.claude/skills/](.claude/skills/) carry the step-by-step procedures: `feature-slice`,
`new-doctype`, `frappe-api`, `ui`, `verify`, `code-review`. Design tokens: [.claude/DESIGN.md](.claude/DESIGN.md).

## Commands

`bench` commands and the frontend toolchain (`npm run dev` / `build` / `lint`, `npx playwright test`)
are the standard invocations — see `/workspace/development/frappe-bench/CLAUDE.md` and
`frontend/package.json`. Run `bench` from the bench root, site-scoped with `--site erp.localhost`.
`bench build --app erp` builds desk assets only — **not** the SPA.

## Structure

- **Modules** — declared in [erp/modules.txt](erp/modules.txt): `Erp`, `Master`. `Master` owns the
  four foundation DocTypes; `Erp` holds the app shell.
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
- **[erp/master/hierarchy.py](erp/master/hierarchy.py)** — verifies that an Institution's Campus
  belongs to the same Trust.
- `erp/www/` standalone pages · `erp/templates/` Jinja · `erp/public/` bundled assets **plus the
  built SPA in `erp/public/dist/` (generated — never edit by hand)** · `erp/config/` Desk module config.

## Conventions

### The `id` UUID column

Every doctype carries a separate `id` field holding an auto-generated UUID, distinct from Frappe's
primary key `name`. `name` stays the readable business key (e.g. `institution_code`) and Links reference
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

Doctypes denormalise their ancestors (`trust`, `institution`, `campus`, `department`) so reports can
filter without walking the tree. A Link proves existence, not branch membership, so those columns are
independent claims that must be reconciled. Any doctype carrying them calls `validate_same_parent`
from [erp/master/hierarchy.py](erp/master/hierarchy.py) in `validate`. Do not write a second version
of this check. Full reasoning: [docs/DATA-MODEL.md](docs/DATA-MODEL.md).

### Style

ruff-enforced: **tab indentation**, double quotes, line length 110. Do not reformat to spaces.
Pre-commit runs ruff + eslint + prettier + pyupgrade.

## Frontend

React + TypeScript SPA in `frontend/`, served by Frappe at `/erp`. Its layering rule, naming
convention and the traps in the generic doctype renderer live in
[frontend/CLAUDE.md](frontend/CLAUDE.md), which loads when you work under `frontend/`.

## Verify before you claim it works

`tsc` passing says nothing about whether a page renders, and a migrated doctype says nothing about
whether the field landed. Exercise the change — [verify](.claude/skills/verify/SKILL.md) skill.
