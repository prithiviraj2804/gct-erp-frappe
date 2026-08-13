# Slice N — <Name> · `<Module>`

**Status:** draft / in progress / done
**Module:** `<Module>` · **Depends on:** <earlier slices, or "nothing">

> Copy this file to `docs/features/<slice>.md` and fill it in **top to bottom**. Journeys before
> schema — see [../METHOD.md](../METHOD.md). Delete the quoted guidance as you go.

## 1. Summary

> Two or three sentences. What can someone do after this ships that they couldn't before, and why
> this slice now rather than a different one.

## 2. Personas and roles

| Persona | What they do in this slice | Role to create |
|---|---|---|

> Roles are created here, in this slice, because a journey needs them — not in advance. Say
> explicitly which existing role a persona maps to if no new one is needed.

## 3. Journeys

> The core of the spec. Numbered, concrete, named persona, in order. Each step says what they see
> and what changes. If you can't write a journey this concretely, you don't understand the slice
> yet — go and ask.

### J1 — <the happy path>

1. …

### J2 — <the next journey>

1. …

### Exceptions

> What goes wrong, and what happens then. Rejections, timeouts, duplicates, someone leaving and not
> coming back, a record that shouldn't exist.

## 4. States and transitions

> If the slice has a workflow, draw it. Who can move it, and what's irreversible.

```
Draft → Submitted → Approved → Closed
              ↘ Rejected
```

## 5. Doctypes

### New masters

| Doctype | Justified by | Minimum fields |
|---|---|---|

> **Every row must name a journey (J1, J2…).** If no journey needs it, it doesn't get built.
> Minimum fields means minimum — fields are cheap to add next slice, expensive to remove once
> real data is in them.

### New transaction doctypes

| Doctype | Records what | Key links | Submittable? |
|---|---|---|---|

### Existing doctypes touched

| Doctype | Change | Why |
|---|---|---|

### Explicitly not built

> The masters this slice was tempted by and skipped, with the reason. This section is what stops
> the next person re-litigating it.

## 6. Server logic

- **Controller validations:** which invariants, on which doctype, in `validate` / `before_save` /
  `on_submit`.
- **Hierarchy:** does anything denormalise an ancestor? If so it calls `validate_same_parent` from
  [../../erp/master/hierarchy.py](../../erp/master/hierarchy.py) — see the contract in
  [../DATA-MODEL.md](../DATA-MODEL.md).
- **Hooks:** anything wired into [../../erp/hooks.py](../../erp/hooks.py).
- **Endpoints:** only where CRUD won't do — see the
  [frappe-api](../../.claude/skills/frappe-api/SKILL.md) skill. List each as
  `erp.api.<module>.<function>` with its method and what it returns.

## 7. Frontend

- **Routes:** `/<module-slug>/<page-slug>` — added to
  [../../frontend/src/app/routes.tsx](../../frontend/src/app/routes.tsx) inside the `AppShell` layout route.
- **Pages:** files under `frontend/src/screens/` (generic) or `frontend/src/modules/<module>/` (bespoke).
- **Workspace links:** the rows added to `erp/<module>/workspace/…` so the menu surfaces this — see
  [../MODULES.md](../MODULES.md).
- **Components / hooks / types:** which go where, per the folder layout in [../../CLAUDE.md](../../CLAUDE.md).

## 8. Other surfaces

> Print formats, QR/scan, notifications (email / SMS / WhatsApp), scheduled jobs, exports. Anything
> that isn't a page. "None" is a valid answer — say it rather than leaving the section empty.

## 9. Institution coverage

> How this behaves for a school versus a college ([../PRODUCT.md](../PRODUCT.md)). If the slice
> reads `terms_per_year`, `term_label` or `college_type`, say where. If it genuinely doesn't vary,
> say that.

## 10. Non-goals

> What this slice deliberately does not do, so scope creep has to argue with something written down.

## 11. Verification

> How we prove it works — the [verify](../../.claude/skills/verify/SKILL.md) skill.

- Backend: `bench --site erp.localhost run-tests --doctype "<Doctype>"` — which invariants are tested
- Data: the console walkthrough that creates a real record end to end
- Frontend: the browser walkthrough — which pages, what must be visible
- The journeys in §3, walked by hand in the running app

## 12. Open questions

> Anything unresolved, with who decides it. An open question here is better than a guess in the schema.
