# Modules and navigation

There is **no hardcoded navigation tree**. Every module, every screen and every route in the SPA is
derived from Frappe Module Defs and Workspaces at request time. This document traces that chain link
by link — each claim below was read out of the code, not out of a doc — and then states what adding a
module actually costs.

## 1. The modules that exist

`erp/modules.txt`, in file order: **`Erp`, `Gate`, `Master`, `Admission`, `Accounts`, `Student`**.
Six. (The [new-doctype](../.claude/skills/new-doctype/SKILL.md) skill still says three; it is stale,
this file is the list.)

Each is a Python package under `erp/`: `erp/gate/`, `erp/master/`, `erp/admission/`, `erp/accounts/`,
`erp/student/` — and `erp/erp/`, which holds nothing but `__init__.py`. `Erp` owns no doctype and no
workspace, which is why it never appears in the SPA. That is not a bug; see §3.

## 2. The chain, link by link

### 2.1 `erp/modules.txt` → the package

A doctype's `module` field must match a line in `modules.txt` exactly, and its files land in that
module's package (`erp/<snake_module>/doctype/<snake_name>/`). A module whose package directory is
missing is not a module.

### 2.2 The package → a `Module Def` row

`erp/hooks.py:27` wires `before_migrate = "erp.utils.ensure_module_defs"`, which inserts a
`Module Def` for every name `frappe.get_module_list("erp")` returns
(`erp/utils.py:96-115`). This is load-bearing and the docstring says why: **Frappe creates Module Defs
only in `install_app`, never on migrate.** A module added to `modules.txt` after installation has
none, so a doctype in it fails `get_controller`, which `remove_orphan_doctypes` reads as "the code is
gone" — and deletes the DocType it imported minutes earlier, in the same migrate, reporting success.

It runs as a hook rather than a patch so that the *next* module costs nothing: `before_migrate` fires
ahead of `sync_all` and of orphan removal on every migrate.

### 2.3 The `Module Def` → a Workspace

`erp/<module>/workspace/<name>/<name>.json`. Five exist, all lowercase directories:

| Workspace | module | `sequence_id` | icon | groups (Card Breaks) |
|---|---|---|---|---|
| `Master` | Master | 1 | *(none)* | Organisation · Academic · Admissions · People · Configuration |
| `Gate` | Gate | 2.0 | `unlock` | Admission |
| `Admission` | Admission | 3 | `users` | Enquiries · Intake · Reports |
| `Accounts` | Accounts | 4 | `es-line-payments` | Collections · Ledger · Setup |
| `Student` | Student | 5 | `graduation-cap` | Register |

Four fields decide whether a workspace is seen at all: `module` (must equal the Module Def name),
`public: 1`, `is_hidden: 0`, and `sequence_id`. The `links` child table is the menu: a row of
`type: "Card Break"` is a group heading, a row of `type: "Link"` is a screen.

**Editing a workspace JSON needs `bench migrate` to reach a running site** — the JSON is a fixture,
not a live read.

### 2.4 The Workspace → `erp/api/modules.py`

`get_allowed_modules()` (`erp/api/modules.py:11-41`) answers "which of this app's modules may this
user see". Three things about it are decisions, not incidentals:

- **Module access in Frappe is a denylist.** Every Module Def is visible unless the user has it in
  `block_modules`, so "allowed" is *all of this app's modules minus that set*; there is no allowlist
  to read (`modules.py:29`).
- **Scoped to `app_name == "erp"`** (`modules.py:31-36`). The site also registers Frappe's own
  modules — Core, Desk, Website — which are Desk internals, not features of this product.
- **No `allow_guest`.** A Guest caller is thrown a `PermissionError` (`modules.py:24-25`).

Known gap, flagged in the source (`modules.py:38-40`): `Module Def.restrict_to_domain` is not
handled, because no `erp` module sets it. A restricted module would leak into this list.

### 2.5 `erp/api/navigation.py` — the two endpoints the SPA actually calls

**`get_module_rail()`** (`erp/api/navigation.py:98-140`) layers workspace metadata onto
`get_allowed_modules()` rather than re-deriving the denylist, so module visibility has exactly one
implementation. For each allowed module it takes the first `public`, non-hidden Workspace
(`:109-116`), and:

- **A module with no workspace never reaches the rail** (`:117-122`) — the comment names `Erp` as the
  live case. Every navigation surface reads this one endpoint, so they agree by construction rather
  than by separate lists somebody keeps in sync.
- **Order comes from the workspace's `sequence_id`, not the module name** (`:134-138`).
  `get_allowed_modules` is alphabetical, which would put `Gate` ahead of `Master` however thin its
  menu is — and the shell opens on whatever comes first.
- The label falls back to `module_name.replace("_", " ")` when the workspace has none (`:128`).

**`get_module_menu(module)`** (`erp/api/navigation.py:144-217`) returns the permission-filtered menu
for one module. Deliberately *not* Frappe's `get_workspaces()`/`get_desktop_page()`, which return
Desk-shaped payloads (content blocks, charts, number cards, onboarding) that would only be discarded
and yield no SPA routes (`:147-151`). It:

- refuses a module outside `get_allowed_modules()` (`:158-160`);
- reads the Workspace with `ignore_permissions=True` on purpose — Workspace's own DocPerms gate the
  workspace *editor*, not who may read a menu; the real gating is per-workspace roles and per-link
  permission below (`:166-172`);
- checks `_is_workspace_permitted` (`:49-61`), a mirror of `Workspace.is_permitted()`, in which an
  **empty roles table means everyone, not no one** — getting that backwards would hide every
  workspace this app ships, since none sets roles;
- walks `workspace.links`, turning each `Card Break` into a group (`:194-199`) and each `Link` into a
  menu item through `_menu_item` (`:64-94`);
- drops groups whose every link was filtered out, so no heading sits over nothing (`:214-215`).

`_menu_item` is where a route is born. For a `DocType` link it checks `_is_doctype_allowed` and emits
`/{module_slug}/{slug}` — and **the module slug comes from the workspace, not from the doctype's own
module** (`:76-79`): a workspace may link to a doctype owned elsewhere, and routing by the doctype's
module would make one click jump the rail to another module. For a `Page` or `Report` link the route
is `None` (`:81-85`), surfaced so the UI can show it as unavailable rather than silently dropping it —
the `Admission Funnel` report row in the Admission workspace is exactly this case.

`_is_doctype_allowed` (`:25-46`) reimplements the DocType branch of
`frappe.desk.desk_views.DeskViews.is_item_allowed` rather than calling it, because that method reads
`self.can_read`, which `DeskViews.__init__` never sets — calling it directly raises `AttributeError`.

Slugs come from `erp.utils.slugify` (`erp/utils.py:12-19`), which is **not** `frappe.scrub`: scrub
produces underscores, which are Python identifiers rather than URL segments.

### 2.6 The endpoints → the SPA

| Layer | File | Role |
|---|---|---|
| Fetch | `frontend/src/lib/navigation.ts:9-16` | `fetchModuleRail` / `fetchModuleMenu`, and the query keys |
| Types | `frontend/src/types/navigation.ts` | `RailModule`, `MenuGroup`, `MenuItem`, `ModuleMenu` |
| Cache | `frontend/src/hooks/use-navigation.ts:9-83` | `useModuleRail`, `useModuleMenu`, `usePrefetchModuleMenus`, `useAllModuleMenus` |

Three surfaces consume the same payload, which is the point: the shell's rail/sidebar, the module
overview page (`frontend/src/shell/pages/ModuleScreen.tsx` — "renders the SAME payload as the
flyout … so the two can never disagree"), and the command palette
(`frontend/src/shell/components/CommandPalette.tsx:69`, via `useAllModuleMenus`).

**Routing.** `frontend/src/app/routes.tsx:40-54` declares four generic routes inside the
`RequireAuth` → `AppShell` layout: `/:moduleSlug`, `/:moduleSlug/:doctypeSlug`, `…/new`, `…/:name`.
`useDoctypeRoute` (`frontend/src/pages/doctype/hooks/use-doctype-route.ts:38-56`) resolves the two
slugs against the cached rail and the menu's `doctype_by_slug`. It **fails closed by construction
rather than by a check**: that map is built only from links that passed `_is_doctype_allowed`
server-side, so a doctype the user cannot read is simply absent and resolves to `unknown-doctype` —
indistinguishable, correctly, from a typo. Costs no extra request; both queries are already warm.

### 2.7 The registry seam — per-doctype behaviour without a per-doctype route

`frontend/src/pages/doctype/registry.ts` is the one seam between the generic renderer and a doctype
that needs something it cannot say. A module contributes one table,
`frontend/src/modules/<name>/screens.ts`, registered in `MODULE_TABLES` (`registry.ts:101-105`).
Three exist today: `master`, `gate`, `admission`.

- Collisions are **surfaced, not resolved**: a `console.warn` in DEV, first registration wins in
  production (`registry.ts:115-130`). Two modules claiming one doctype is a real possibility, since a
  workspace may link to another module's doctype.
- Four escalating levels — absent, data literals (`statusTones` / `list` / `record`), a `slots`
  component, or a whole `ListScreen`/`RecordScreen` (`registry.ts:33-38`). Level 3 still renders
  inside `RequireAuth` → `AppShell` on the generic route, so a bespoke screen cannot lose its
  navigation, breadcrumbs or permission gate by being bespoke.
- The rule that keeps it honest (`registry.ts:29-31`): **an override may only override a default the
  renderer already produces; it may never supply something the doctype JSON could have said.** A
  column order or a label belongs in the schema, where Desk and the SPA read the same answer.

Status words declared here are cross-checked against the doctype JSON by
`erp/test_conventions.py:302-424` — a literal duplicated across a JSON, Python and TypeScript drifts
silently, and it already had: `'Application Submit'` against a schema saying
`'Application Submitted'`, which made every submitted lead render with no tone and no current step.

### 2.8 Icons

`Module Def` carries no icon field, so `MODULE_ICONS` (`frontend/src/shell/lib/module-icons.ts:52-60`)
maps Module Def **name** → lucide component, with `BoxIcon` as the fallback (`:62`). A module absent
from the map is not an error — which is why it took a while to notice that `Student` was missing.
Workspace-row icons (Card Break and Link alike) go through one `NAV_ICONS` map (`:91-124`) and
`navIcon` (`:140-151`), which warns once per unknown name in DEV because the failure mode of the map
is silence. Giving something an icon is a **workspace change**; the map only translates the name.

> `frontend/CLAUDE.md` still names `GROUP_ICONS` / `SCREEN_ICONS` and puts routing at
> `frontend/src/routes.tsx`. Both are stale: the two icon maps were merged into `NAV_ICONS`
> (the split was "a bug generator, not an abstraction"), and routes live at
> `frontend/src/app/routes.tsx`.

## 3. What adding a module costs

Every step below is required; the first four are server-side and the rest is presentation.

1. **`erp/modules.txt`** — add the name. Nothing else declares a module.
2. **The package** — `erp/<snake_module>/__init__.py` and `erp/<snake_module>/doctype/`.
3. **`bench --site <site> migrate`** — `before_migrate` creates the `Module Def`
   (`erp/utils.py:96-115`). Do this *before* importing doctypes into the module, or see §2.2.
4. **A Workspace** at `erp/<module>/workspace/<name>/<name>.json` with `module`, `public: 1`,
   `is_hidden: 0`, a `sequence_id` that places it in the rail, a `label`, and one `Link` row per
   screen grouped under `Card Break` rows. **Without this the module is invisible** — it never
   reaches `get_module_rail` (`erp/api/navigation.py:117-122`). Then `bench migrate` again.
5. **DocPerms on every doctype** — a link the caller cannot `read` is dropped from the menu by
   `_is_doctype_allowed`, so a workspace full of unpermitted links renders as an empty module.
6. **`MODULE_ICONS`** — add the Module Def name in `frontend/src/shell/lib/module-icons.ts`, and any
   new workspace icon name to `NAV_ICONS`. Skipping this is silent: a generic box, or no glyph.
7. **`frontend/src/modules/<name>/screens.ts` + `MODULE_TABLES`** — only if a doctype in the module
   needs a status vocabulary, a summary strip or a bespoke screen. An **empty table is the healthy
   state**; eleven of the app's masters need no entry at all.
8. **Nothing in `routes.tsx`.** The generic routes already cover the module. Adding a static route is
   how the routing table becomes the override mechanism and the second renderer arrives by accident.

Cost per module in the frontend, therefore: one optional icon entry and one optional screens table.
Everything else is server data.

## 4. Two invariants, both enforced by tests

- **Every doctype is reachable from a workspace.** `erp/test_conventions.py:174-202` compares every
  non-child doctype in an `erp` module against every `Workspace Link` of type `DocType` and fails
  with the list. Child tables are exempt — they are edited inside their parent. Written after
  `Institution Type` shipped without a link, and it immediately found `Admission Follow-up` missing
  one since the slice that created it.
- **Every declared status literal exists in the schema** (`erp/test_conventions.py:302-424`), which is
  what stops the registry from drifting from the doctype JSON.

## 5. What `erp/config/` is not

`CLAUDE.md` lists `erp/config/` as "Desk module config". Today it contains **only an empty
`__init__.py`** — no `desktop.py`, no module config, nothing that affects navigation. Desk's own
module tiles are generated from Workspaces in current Frappe, and the SPA reads Workspaces directly.
Separately, `CONFIGURATION.md §3` describes `erp/config/resolver.py`; that file does not exist either
— the config engine is slice 4 and unbuilt. Do not read either as a navigation input.
