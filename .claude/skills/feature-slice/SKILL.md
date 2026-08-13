---
name: feature-slice
description: Build a feature in apps/erp end to end — journeys first, then the masters those journeys name, then transaction doctypes, endpoints, SPA screens and proof. Use whenever starting or continuing a feature, or when about to create a doctype and needing to check whether it is justified.
---

# Building a feature slice

A **slice** is one feature delivered end to end — journeys, doctypes, server logic, screens, and
proof it works. Not a layer, not "all the masters for admissions". One thing a real person can do
from start to finish.

Full reasoning: [docs/METHOD.md](../../../docs/METHOD.md).

## The rule this skill exists to enforce

> **No master is created without a feature slice that consumes it.**
> A master starts at the minimum fields its first consumer justifies, and grows one slice at a time.

The app's first eleven masters were built from a list, ahead of any feature. They look right and
nothing has ever tested that belief. Don't add to that pile.

**Before creating any doctype, answer out loud: which journey in the spec requires this?** If you
can't name one, stop. That is the whole check.

## Steps

### 1. Spec before schema

Copy `docs/features/TEMPLATE.md` to `docs/features/<slice>.md`. Fill in §1–§4 — summary, personas,
**journeys**, states — before touching a JSON file.

A journey names a persona, what they do, what they see, and what changes. If it can't be written
that concretely, the slice isn't understood yet: ask the user rather than modelling a guess. Park
the unknowns in the spec's open questions and build the parts that don't depend on them.

### 2. Journeys name the masters

Walk the journeys, list every entity mentioned, and build only those. Check them against the
masters backlog in [docs/DATA-MODEL.md](../../../docs/DATA-MODEL.md) — reuse the name and the intent
rather than inventing a parallel concept. Appearing in that backlog is not permission to build;
it's a name to reuse when a journey asks.

Record each new master in the spec's §5 table with the journey that justifies it, and record what
you were tempted by and skipped under "Explicitly not built".

### 3. Masters, minimum fields

Follow the [new-doctype](../new-doctype/SKILL.md) skill. Non-negotiables: `module` matches a line in
`erp/modules.txt`; the `id` UUID field is present; naming uses a readable business key.

Three fields a journey uses beats fifteen that nothing reads. Fields are cheap to add next slice and
expensive to remove once real data sits in them.

### 4. Transaction doctypes

The record of what happened. Validation goes on the controller (`validate` / `before_save` /
`on_submit`), not in the caller.

If the doctype denormalises an ancestor (`institution`, `college`, `campus`, `department`), call
`validate_same_parent` from `erp/master/hierarchy.py` in `validate`:

```python
from erp.master.hierarchy import validate_same_parent

class GatePass(Document):
	def validate(self):
		validate_same_parent(self, "college", "institution")
```

A Link proves existence, not branch membership. Do not hand-roll a second version of this check —
see the contract in [docs/DATA-MODEL.md](../../../docs/DATA-MODEL.md).

### 5. Endpoints only where CRUD won't do

`frappe-js-sdk`'s `db` handle already covers doctype CRUD with permissions enforced. Write a
whitelisted method only for aggregation, multi-doctype transactions or external calls — see the
[frappe-api](../frappe-api/SKILL.md) skill.

### 6. Surface it

- **Workspace JSON** at `erp/<module>/workspace/<Name>/<Name>.json` — this is what puts the module in
  the SPA rail and its doctypes in the menu. A module with no workspace is invisible. See
  [docs/MODULES.md](../../../docs/MODULES.md).
- **SPA pages** under `frontend/src/screens/` (generic) or `frontend/src/modules/<module>/` (bespoke), routed in `frontend/src/app/routes.tsx` inside the
  `RequireAuth` → `AppShell` layout routes.
- Follow the [ui](../ui/SKILL.md) skill and the tokens in `.claude/DESIGN.md`.

### 7. Prove it, then close the loop

Exercise the feature — [verify](../verify/SKILL.md) skill. `tsc` passing says nothing about whether
the page renders. Then:

- move the masters you built out of the backlog into the built table in `docs/DATA-MODEL.md`
- tick the slice in `docs/ROADMAP.md`
- fill in what the slice taught us in its spec, including what was left out

## Every slice must work for a mixed group

An engineering college, an arts & science college and a school under one institution is the normal
case ([docs/PRODUCT.md](../../../docs/PRODUCT.md)). Vocabulary comes from `Academic Structure`
(`term_label`, `terms_per_year`) and `College.college_type` — read those rather than assuming
semesters. Never add a school-only doctype that duplicates a college concept; add a conditional
field instead.

## Checklist

- [ ] Spec exists at `docs/features/<slice>.md` with journeys written before any schema
- [ ] Every new doctype names the journey that justifies it
- [ ] Masters built at minimum fields, each with the `id` UUID field
- [ ] Denormalised ancestors guarded by `validate_same_parent`
- [ ] Endpoints only where CRUD wouldn't do
- [ ] Workspace links added, so the feature is reachable in the SPA
- [ ] Exercised for real (backend + browser), not just compiled
- [ ] `docs/DATA-MODEL.md` and `docs/ROADMAP.md` updated
