# How a slice gets built

A **slice** is one feature delivered end to end — journeys, doctypes, server logic, screens, and
proof that it works. It is not a layer, and it is not "all the masters for admissions". It is one
thing a real person can do from start to finish.

## Why this order

Masters-first looks efficient and isn't. A master built ahead of its consumer is a guess about
which fields matter, and the guess never gets corrected, because nothing reads it. The eleven
masters listed in [DATA-MODEL.md](DATA-MODEL.md) were built that way — they look right, and no
journey has ever tested that belief.

Feature-first inverts the risk. Either a journey names the field, or the field doesn't exist yet.

## The steps

### 1. Write the spec before the schema

Copy [features/TEMPLATE.md](features/TEMPLATE.md) to `features/<slice>.md` and fill in the
journeys **first**. If a journey can't be written concretely — who does it, what they see, what
changes — the slice isn't understood yet. That's a signal to go and ask, not to start modelling.

### 2. Let the journeys name the masters

Walk the journeys and list every entity they mention. That list, and nothing past it, is what gets
built. A master appearing in the [DATA-MODEL.md](DATA-MODEL.md) backlog is **not** permission to
build it — it's a name to reuse when a slice finally asks for it.

**Every new master needs a one-line justification naming the journey that requires it.** No
justification, no doctype.

### 3. Build the masters at minimum viable fields

Follow the [new-doctype](../.claude/skills/new-doctype/SKILL.md) skill. Non-negotiables:

- `module` matches a line in [../erp/modules.txt](../erp/modules.txt)
- the `id` UUID field is present — filled by `set_uuid_id` in [../erp/utils.py](../erp/utils.py)
  via the global `before_insert` hook in [../erp/hooks.py](../erp/hooks.py)
- naming uses a readable business key, not `UUID`

A master with three fields a journey actually uses beats fifteen that nothing reads. Fields are
cheap to add next slice and expensive to remove once real data sits in them.

### 4. Build the transaction doctypes

The record of what actually happened — the pass, the application, the invoice. Validation goes on
the controller (`validate` / `before_save` / `on_submit`), not in whatever called it.

If the doctype carries denormalised ancestor columns (`institution`, `college`, `campus`, …), guard
them with `validate_same_parent` from [../erp/master/hierarchy.py](../erp/master/hierarchy.py). The
reasoning is in the denormalisation contract in [DATA-MODEL.md](DATA-MODEL.md). Do not hand-roll a
second version of that check.

### 5. Server endpoints only where CRUD won't do

`frappe-js-sdk`'s `db` handle already covers doctype CRUD with permissions enforced by the
framework. Write a whitelisted method only for aggregation, multi-doctype transactions, or external
calls — see the [frappe-api](../.claude/skills/frappe-api/SKILL.md) skill. An endpoint that just
wraps `get_list` adds a permission surface and buys nothing.

### 6. Surface it

- **Workspace JSON** at `erp/<module>/workspace/<name>/<name>.json` — this is what puts the module
  in the SPA rail and its links in the menu. Details in [MODULES.md](MODULES.md).
- **SPA pages** under `frontend/src/pages/`, routed in
  [../frontend/src/routes.tsx](../frontend/src/routes.tsx) inside the `AppShell` layout route, so
  the page never loses its navigation context.
- Follow the [ui](../.claude/skills/ui/SKILL.md) skill and the tokens in
  [../.claude/DESIGN.md](../.claude/DESIGN.md).

### 7. Prove it, then write it down

Exercise the feature for real — the [verify](../.claude/skills/verify/SKILL.md) skill: backend via
`bench console` and `run-tests`, frontend via a browser. `tsc` passing says nothing about whether
the page renders. Then close the loop:

- move the masters you built out of the backlog and into the built table in [DATA-MODEL.md](DATA-MODEL.md)
- tick the slice in [ROADMAP.md](ROADMAP.md)
- record what the slice taught us in its own spec — **including what we decided not to build**

## Standing rules

| Rule | Where it lives |
|---|---|
| Every doctype carries an `id` UUID field | `set_uuid_id` in [../erp/utils.py](../erp/utils.py), global `before_insert` |
| Denormalised ancestors are validated, never trusted | `validate_same_parent` in [../erp/master/hierarchy.py](../erp/master/hierarchy.py) |
| Python is tab-indented, double-quoted, 110 cols | ruff, via pre-commit |
| Frontend files go in the existing `src/` folders | [../CLAUDE.md](../CLAUDE.md) |
| `apps/frappe` and `apps/erpnext` are read-only | vendored dependencies, never edited |

## When the rule bends

Two things are allowed to exist slightly ahead of a consumer:

- **A supporting lookup the slice itself names** — a status or type list the journey references but
  doesn't transact against.
- **A shared master a later slice will obviously need**, when the current slice already reads it and
  building it now costs nothing extra.

Everything else waits. If you find yourself arguing for a third exception, write the argument into
the spec's open questions and let it be decided there rather than in a commit.
