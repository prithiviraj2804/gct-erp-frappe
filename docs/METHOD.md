# Method

How a slice gets built, start to finish.

> **No master is created without a feature slice that consumes it.**
> A master starts at the minimum fields its first consumer justifies, and grows one slice at a time.

The app's first eleven masters were built from a list, ahead of any feature. They look right, and
nothing has ever tested that belief. That is the whole reason this document exists.

The step-by-step procedure is the [feature-slice](../.claude/skills/feature-slice/SKILL.md) skill, and
**the skill is authoritative** — it is what a working session actually loads. This document is the
reasoning behind it plus the evidence that the project follows it: what the steps cost, what the git
history shows actually happened, and where the skill's own file paths have drifted from the tree.

## 1. What a slice is

One feature delivered end to end — journeys, doctypes, server logic, screens, and proof it works.
Not a layer, and not "all the masters for admissions". One thing a real person can do from start to
finish.

The unit matters because the alternative is the failure the app already contains. A layer built
across every future feature has no consumer to be wrong in front of, so it is never wrong; it is
merely unproven, indefinitely. A slice has a journey, a journey has a person, and a person notices.

## 2. Step 0 — the journey, written down, before the schema

A spec lands at `docs/features/<slice>.md` before a JSON file is touched. A journey names a
**persona**, what they **do**, what they **see**, and what **changes**. If it cannot be written that
concretely, the slice is not understood yet: ask, rather than modelling a guess, and park the
unknowns in the spec.

This step is not decoration, and the history proves the cost of skipping it. Commit `51ae81b`
(*"docs: the three admission journeys that were never written down (step 0)"*) records the finding:
`docs/features/` held two specs and **both described the same journey** — a TNEA engineering
admission, fee before counselling, an allotment recorded as Allotted To Us or Allotted Elsewhere.
Every configuration decision in the app had been made from that one journey. That is how
`admission_route` came to default to `Government Quota` for a school
(`erp/admission/doctype/admission_application/admission_application.json`), and how the counselling
gate came to be unconditional. Three journeys — school, arts & science, professional management quota
— had to be written *after* the code, and each opens with a section titled "where today's code
misfits this journey".

The shape the specs converge on, which a new one should follow: **Summary · Personas · Journeys ·
States · Where today's code misfits · Masters the journeys name · Decisions · What we do not know
and must ask · Proof · Documents this slice must correct · Explicitly not built.**

> The skill's step 1 says to copy `docs/features/TEMPLATE.md`. **That file does not exist** and never
> has. Copy the closest existing spec instead — `school-admission.md` is the fullest worked example.

## 3. Step 1 — the journeys name the masters

Walk the journeys, list every entity mentioned, build only those. Check each against the unbuilt-
masters backlog in [DATA-MODEL.md](DATA-MODEL.md) and **reuse the name and the intent** rather than
inventing a parallel concept. Appearing in that backlog is not permission to build; it is a name to
reuse when a journey asks.

Before creating any doctype, answer out loud: *which journey in the spec requires this?* If you
cannot name one, stop. Record each new master in the spec with the journey that justifies it, and
record what you were tempted by and skipped under "Explicitly not built".

The three journey docs are the model for the second half of that. `school-admission.md` names three
masters and is explicit about six it refuses to create; the refusals are the more useful half of the
list, because they are the ones a future session would otherwise build twice.

## 4. Step 2 — masters at minimum fields

Follow [new-doctype](../.claude/skills/new-doctype/SKILL.md). Non-negotiables: `module` matches a line
in `erp/modules.txt`; the `id` UUID field is present in `fields` **and** `field_order`; naming uses a
readable business key, not `autoname: UUID`.

Three fields a journey uses beats fifteen that nothing reads. Fields are cheap to add next slice and
expensive to remove once real data sits in them.

Two traps that cost real time, both documented in [DATA-MODEL.md §3](DATA-MODEL.md#3-conventions) and
both walked into anyway:

- **The `id` field on a child table.** Nothing errors if you omit `id`; the column is simply absent.
  And nothing errored when it was *present* on child tables either — no hook fired for a child row
  until `erp/utils.py:set_uuid_id` was taught to walk them from the parent (slice 2, `fd27e22`).
- **`Check` and `Int` cannot mean "not stated".** `frappe/database/schema.py:182` makes them
  `NOT NULL DEFAULT 0`. Anything that must distinguish *no* from *unstated* is a `Select` with a blank
  first option. Slice 6's commit message (`5decfc5`) records walking into this three files after the
  warning was written: `Field Policy Rule.min_value` was a `Float`, so a bound of zero could not be
  told from an unstated bound and silently vanished. Both bounds are `Data` now.

## 5. Step 3 — transaction doctypes

The record of what happened. Validation goes on the controller (`validate` / `before_save` /
`on_submit`), never in the caller — because Desk, `/api/resource`, Data Import, a console script and
the SPA are all callers, and only the controller sees all five.

If the doctype denormalises an ancestor (`trust`, `institution`, `campus`, `department`), call
`validate_same_parent` from `erp/master/hierarchy.py` in `validate`. A Link proves existence, not
branch membership. Do not hand-roll a second version of this check.

And a transactional row's `institution` is **stamped at the time of the event and never re-derived**
— re-deriving would move history across the tenancy boundary. See
[DATA-MODEL.md §2](DATA-MODEL.md#2-the-tenancy-contract).

## 6. Step 4 — endpoints only where CRUD won't do

`frappe-js-sdk`'s `db` handle already covers doctype CRUD with permissions enforced. Write a
whitelisted method only for aggregation, a multi-doctype transaction, or an external call — see
[frappe-api](../.claude/skills/frappe-api/SKILL.md). Everything lives under `erp/api/` so
`grep -rn "erp\.api\."` finds the whole public surface, and remember Desk client scripts call these
too.

## 7. Step 5 — surface it

A feature nobody can reach is not delivered.

- **Workspace links** are what put the module in the SPA rail and its doctypes in the menu. This is
  now enforced: `erp/test_conventions.py:174-202` fails if any non-child doctype in an `erp` module is
  in no workspace. It was written after `Institution Type` shipped without a link and found
  `Admission Follow-up` had been missing one since the slice that created it (`2dfb80e`).
- **SPA screens** are generic by default. The route stays `/:moduleSlug/:doctypeSlug` forever
  (`frontend/src/app/routes.tsx:43-49`) and per-doctype behaviour goes through the one registry seam,
  `frontend/src/pages/doctype/registry.ts`. Escalate levels rather than adding a route. Full chain:
  [MODULES.md](MODULES.md).

> The skill's step 6 names `frontend/src/screens/`. **That directory does not exist.** Generic
> rendering lives in `frontend/src/pages/doctype/`, and a module's overrides in
> `frontend/src/modules/<module>/screens.ts`.

## 8. Step 6 — prove it, and say what you ran

`tsc` passing says nothing about whether the page renders, and a green migrate says nothing about
whether the field landed. Exercise the change — [verify](../.claude/skills/verify/SKILL.md).

What the slice commits actually claim, and the shape to copy:

> *"Verified: 213 tests green (13 new), double migrate a clean no-op, and the three real
> institutions resolve as intended — GIS hides all four entrance fields and relabels previous
> education, GCT inherits the Professional bounds through the tree, GCE is governed by nothing and
> collects the superset."* — `5decfc5`

Three things in that sentence are the standard: a **test count with the delta**, a **double migrate
that is a no-op** (idempotence of seeds and patches), and the feature **exercised against the real
institutions** rather than against a fixture. Slice 6 found two bugs this way that the test suite did
not — the vanishing zero bound, and a policy memo that was never invalidated, so anything editing a
policy and then saving a governed document in the same request enforced the pre-edit policy.

"Build passed" is not the same claim as "the feature works", and only the second one answers the
question. If a step was skipped, say so.

## 9. Step 7 — close the loop

- Move the masters you built out of the backlog into the built table in [DATA-MODEL.md](DATA-MODEL.md).
- Tick the slice in [ROADMAP.md](ROADMAP.md), with the commit and the test count.
- Fill in what the slice taught us in its spec, including what was left out.
- Correct the docs the slice invalidated. The three journey specs each carry a "Documents this slice
  must correct" section for exactly this, because a doc that is 90% right is read as 100% right.

## 10. What the history shows

Slices 0–6b, from [ROADMAP.md](ROADMAP.md) and `git log`. The pattern worth noticing is that **four
of the seven are repairs**, and every one of them was found by a journey or by verification, not by a
review:

| # | Commit | What it was | Tests |
|---|---|---|---|
| 0 | `3148e28` | Rename `Institution → Trust`, `College → Institution`. Behaviour-preserving; two ordered patches | 168 |
| 1 | `798f65b` | Tenancy repair A — two roles, the `"*"` scoping hook, fail-closed scope assertion | 176 |
| 2 | `fd27e22` | Tenancy repair B — `reqd: 1` on tenancy columns, backfill, strict user permissions; child-row UUIDs | 184 |
| 3 | `6786d8d` | `Institution Type` as a NestedSet tree; both `!= "School"` literals deleted | 200 |
| — | `2dfb80e` | Every doctype in a workspace, enforced by a test | — |
| 6 | `5decfc5` | `Field Policy` — a configurable Admission Enquiry. Brought forward ahead of slices 4–5 | 213 |
| 6b | `4c9e89e` | Trust-wide rollups; the reporting spine configuration may not touch; a CI gate on report tenancy | 223 |
| — | `3da8a59` | Closing the silent failures in the Field Policy layer | — |
| — | `51ae81b` | The three journeys that were never written down | — |

Two lessons the order teaches:

1. **A slice may be brought forward, but not skipped.** Slice 6 shipped before slices 4 and 5 because
   it is the feature the ERP exists for and neither blocked it. That is a defensible reordering,
   argued in the commit message. What did not happen is a master built ahead of its consumer.
2. **A rule that saves must be a rule the enforcer carries out.** `3da8a59` and
   [CONFIGURATION.md §4](CONFIGURATION.md#4-three-layers-three-jurisdictions) state it: a policy that
   looks correct and does nothing is worse than no policy at all, because nobody goes looking for it.
   The corollary for this method is that a slice is not done when the form looks right; it is done
   when a writer that bypasses the form is refused too.

## 11. Checklist

- [ ] Spec at `docs/features/<slice>.md`, journeys written before any schema
- [ ] Every new doctype names the journey that justifies it
- [ ] Masters at minimum fields, each with the `id` UUID field, business-key naming
- [ ] Denormalised ancestors guarded by `validate_same_parent`
- [ ] Endpoints only where CRUD wouldn't do
- [ ] Workspace links added — `test_every_doctype_is_reachable_from_a_workspace` passes
- [ ] Exercised for real (backend console + a browser), not just compiled
- [ ] Double migrate is a clean no-op
- [ ] Checked against a school **and** a college, not one institution
- [ ] `DATA-MODEL.md`, `ROADMAP.md` and the spec updated
