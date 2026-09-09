# Data Model

The hierarchy, the tenancy contract, and the conventions every doctype obeys.

## 1. The hierarchy

```
Trust                        one row per site (Trust.assert_only_one)
│   tenant root: branding, default currency, financial year, chart of accounts
│
├── Campus                   shared — one campus may host several institutions
├── Academic Year            trust-wide label "2026-27"
├── Consultancy              referring agencies
├── Account / GL Entry       the books
│
└── Institution  ◄────────── THE TENANCY BOUNDARY
    │   institution_type ──► Institution Type (tree)
    │
    ├── Department
    ├── Staff                the User → tenant bridge
    └── Programme
        └── Programme Intake            (per Academic Year)
            ├── Programme Intake Seat       NOT BUILT — seat matrix by route × category
            └── Programme Intake Document   the checklist this intake publishes
```

`Trust` is the tenant root; `Institution` is the operating unit and carries the type as a **Link to
`Institution Type`**, a NestedSet tree (Engineering, Medical, School, Arts & Science, Polytechnic,
Law, MBA, Nursing, Pharmacy, …). The type is where configuration hangs, so every institution of a
kind inherits its rules — see [CONFIGURATION.md](CONFIGURATION.md).

Renamed from `Institution → Trust` and `College → Institution` in `3148e28`. The structure was
always this; only the names were wrong, and "College" could never honestly name a K-12 school or a
standalone nursing institute.

## 2. The tenancy contract

> **The tenancy boundary is `Institution`, not `Trust`.**

This is the single most important rule in the app, and it was violated by construction until the
tenancy slice. The reasoning:

`Trust.assert_only_one()` caps the site at one Trust row. So a
`User Permission {allow: "Trust", for_value: <the only trust>}` selects **every row in the
database** — it is not a restriction, it is a tautology. Scoping must therefore key on
`Institution`.

Three properties are required of every tenant-scoped doctype, and all three are load-bearing:

1. **The `institution` column exists.**
2. **It is `reqd: 1`.** Frappe's query engine emits
   `IfNull(institution,'') = '' OR institution IN (…)` — verified at
   `frappe/database/query.py:1503-1506`. A row with a blank `institution` is therefore visible to
   **every** user in **every** institution. Nullable tenancy columns are not "not yet filled in";
   they are holes.
3. **`apply_strict_user_permissions` is on**, which removes the `IfNull(...) = ''` disjunct
   altogether. Turn it on only after (2) holds everywhere, or existing blank rows vanish from
   their owners' lists.

### Which engine actually runs

`frappe.get_list` → `frappe/model/qb_query.py` → `frappe/database/query.py`. **Not**
`frappe/model/db_query.py`, which is the legacy engine and no longer on the path for Desk list
views, Report Builder, `/api/resource` or the SPA. Cite `query.py` when reasoning about
permissions.

Two consequences that surprise people:

- **Child-table queries evaluate the _parent's_ conditions.** `query.py:1548-1560` inner-joins the
  child to its parent. A `permission_query_conditions` hook is therefore called with the **parent**
  doctype for a child query and must emit `` `tabParent`.institution ``, never assume the queried
  table.
- **A Share defeats the tenancy hook itself.** `query.py:1590-1596` OR-s shared documents over the
  whole where-clause, including `permission_query_conditions`. Sharing is not a lesser permission;
  it is an override.

### Denormalised ancestors, and which are stamped

Doctypes denormalise their ancestors so reports filter without walking the tree, and
`erp/master/hierarchy.py:validate_same_parent` reconciles those claims against the linked record.

But **a transactional row's `institution` is stamped at the time of the event and must never be
re-derived.** A student who transfers from the school to the engineering college keeps their
original admission record, `Fee Payment` and `GL Entry` under the institution that took the money.
Re-deriving would move history across the tenancy boundary and hand it to the wrong institution.
Any reconciliation job must carry an explicit list of stamped columns it will not touch.

## 3. Conventions

### 3.1 The `id` UUID column — and its one live defect

Every doctype carries an `id` Data field holding a UUID, distinct from the primary key `name`,
filled by `erp.utils.set_uuid_id` via `doc_events = {"*": {"before_insert": ...}}`.

> ⚠️ **This does not work for child tables, and never has.**

`frappe/model/document.py:478` runs `run_method("before_insert")` for the **parent only**; children
are written at `:498-500` by `d.db_insert()`, a `BaseDocument` method. `doc_events` are composed in
`Document.hook`, reached only from `run_method`. So no child row ever gets an `id`.

Proven empirically: inserting a `Programme Intake` with two `Programme Intake Document` rows yields
a parent `id` of `c57a2655-…` and child `id`s of `None`. Because MariaDB permits unlimited NULLs in
a unique index, `unique: 1` on those columns has been silently inert since the convention was
written.

Affected today: `Admission Enquiry Education`, `Admission Application Document`,
`Admission Application Preference`, `Programme Intake Document`.

Either fix it in the parent's `before_insert` (walk `get_all_children()`), or stop declaring `id` on
child tables. Do not add `id` to a new child table believing the hook fills it.

### 3.2 The tri-state rule

`frappe/database/schema.py:182` — `NOT_NULL_TYPES = ("Check", "Int", "Currency", "Float",
"Percent")`. Those columns are `NOT NULL DEFAULT 0`.

> **A `Check` or an `Int` can never be NULL, and therefore can never mean "inherit" or
> "not stated".**

Anything that must distinguish *"no"* from *"not stated"* uses a `Select` with a blank first option
or a nullable `Data`. A cascade built on "NULL on a Check means inherit" silently overwrites a
parent's `1` with `0` on every override row.

### 3.3 Where a per-institution-type rule may live

Verified against frappe 16.31.0: **there is no mechanism by which one DocType, in one site,
presents a different _server-validated_ field set to two tenants.**

- Everything that can vary per row is client-side and so is not a validation boundary:
  `mandatory_depends_on` is evaluated in the browser (`form/save.js:269-282`) while the server reads
  only `reqd` (`base_document.py:973`); `link_filters` is client-side
  (`form/controls/link.js:846-863`) and `_validate_links` checks existence only.
- Everything that is enforced (`reqd`, DocPerm, permlevel, Custom Field, Property Setter) is
  **site-wide**.
- `DocType Layout` is the closest thing and is scoped **by route, not by row**. Useful for Desk
  presentation; never a rule. (Trap: `script_manager.js:194` skips `__custom_js` when a layout is
  active, so Client Script and DocType Layout do not compose.)
- Exactly **one Workflow** may be active per doctype — `workflow.py:113-120` silently deactivates
  the others. Per-type approval chains must be one workflow whose transitions carry
  `Workflow Transition.condition`.

> **Therefore the only honest home for an institution-type rule is Python `validate()`, reading
> configuration data.** See [CONFIGURATION.md](CONFIGURATION.md).

### 3.4 Style

ruff: tab indentation, double quotes, line length 110. `I` (import sorting), `RUF` and
`ruff format` are enforced by pre-commit.
