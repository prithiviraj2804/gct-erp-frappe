# Data model — what exists today

Everything below is built and migrated. Everything in the [backlog](#masters-backlog) at the bottom
is **not built**, and stays that way until a slice asks for it ([METHOD.md](METHOD.md)).

## The hierarchy

```
Institution
 └── Campus
      └── College            (College links Institution directly; Campus is optional)
           └── Department
                └── Programme
                     └── Programme Intake   (Programme × Academic Year → seats)
```

Supporting masters sit beside the chain rather than inside it: Programme Level, Degree, Academic
Structure, Academic Year, Admission Type.

## Built doctypes

### `Master` module — [../erp/master/doctype/](../erp/master/doctype/)

Every one carries the `id` UUID field.

| Doctype | Naming | Scope | Key links | Controller logic |
|---|---|---|---|---|
| [Institution](../erp/master/doctype/institution/institution.json) | `field:institution_code` | root | `affiliated_university` → Institution, `country` | — |
| [Campus](../erp/master/doctype/campus/campus.json) | `format:{institution}-{campus_code}` | institution | `institution` (reqd) | — |
| [College](../erp/master/doctype/college/college.json) | `field:college_code` | institution | `institution` (reqd), `campus` | campus must belong to the same institution |
| [Department](../erp/master/doctype/department/department.json) | `format:{college}-{department_code}` | college | `institution` (reqd), `college` (reqd) | college must belong to the claimed institution |
| [Programme](../erp/master/doctype/programme/programme.json) | `format:{college}-{programme_code}` | college | `college`, `institution`, `department`, `campus`, `degree`, `programme_level`, `academic_structure` | department must belong to the college; college must match institution **and** campus |
| [Programme Level](../erp/master/doctype/programme_level/programme_level.json) | `field:level_code` | global | — | — |
| [Degree](../erp/master/doctype/degree/degree.json) | `field:degree_code` | global | `programme_level` (reqd) | — |
| [Academic Structure](../erp/master/doctype/academic_structure/academic_structure.json) | `field:structure_code` | global | — | carries `terms_per_year` + `term_label` |
| [Academic Year](../erp/master/doctype/academic_year/academic_year.json) | `format:{institution}-{year_code}` | institution | `institution` (reqd) | date ordering; admission window inside the year; `is_current` / `is_admission_open` are per-institution singletons |
| [Admission Type](../erp/master/doctype/admission_type/admission_type.json) | `field:type_code` | global | — | — |
| [Programme Intake](../erp/master/doctype/programme_intake/programme_intake.json) | `format:{academic_year}-{programme}` | college | `academic_year` (reqd), `programme` (reqd), `institution`, `college` | seats > 0; percentage 0–100; one intake per programme per year; programme and year on the same institution |
| [Staff](../erp/master/doctype/staff/staff.json) | `format:{college}-{staff_code}` | college | `institution` (reqd), `college` (reqd) | college must belong to the claimed institution |
| [Consultancy](../erp/master/doctype/consultancy/consultancy.json) | `format:{institution}-{consultancy_code}` | institution | `institution` (reqd) | no ancestry check — institution is the root; `consultancy_code` unique per institution, enforced in `validate` because naming only guards inserts (see below) |

### `Gate` module — [../erp/gate/doctype/](../erp/gate/doctype/)

| Doctype | Naming | Scope | Key links | Controller logic |
|---|---|---|---|---|
| [Admission Gate Pass](../erp/gate/doctype/admission_gate_pass/admission_gate_pass.json) | `AGP-.YYYY.-.#####` (naming series) | college | `college` (reqd), `institution`, `academic_year`, `staff_reference`, `consultancy` (the typed referrers are Data, not Links) | four ancestry checks — the two Link referrers included; `academic_year` re-derived when the college moves tenant; conditional fields enforced server-side; Aadhaar 12 digits and phone 10 digits, both normalised on save; unused reference route cleared; three distinct staff; `out_time` after `in_time`; `status` derived |

Staff and Consultancy were added by Slice 1
([features/admission-gate-pass.md](features/admission-gate-pass.md)) because its journeys named
them — nothing more. A **Student** master was built in the same slice and then deleted: the referring
student became a typed name, which left Student with no consumer, and a master with no consumer does
not exist here. The People & Identity slice rebuilds it properly.

**Scope** is who owns the record. `global` masters are shared by every tenant on the site —
Programme Level, Degree, Academic Structure and Admission Type are vocabulary, not data, so one
list serves everyone. Everything else belongs to exactly one institution and must never be read
across that boundary.

### Fetched fields

Several ancestor columns are populated by Frappe's `fetch_from` rather than typed by hand:

- `Programme.institution` ← `college.institution`, `Programme.campus` ← `college.campus`
- `Programme.programme_level` ← `degree.programme_level`
- `Programme.terms_per_year` ← `academic_structure.terms_per_year`
- `Programme Intake.institution` / `.college` ← `programme.*`

`fetch_from` is a convenience, **not** a guarantee — see below.

## The denormalisation contract

Read [../erp/master/hierarchy.py](../erp/master/hierarchy.py); this section is its summary.

Descendants carry copies of their ancestors — a Programme holds `college`, `institution`, `campus`
and `department` side by side — because reports, seat counts and fee structures filter on those
columns directly instead of walking the tree.

But **a Link field only proves its target exists, never that the target sits in the same branch.**
Those four columns are four independent claims that nothing reconciles on its own. Unchecked, a
Programme can name a Department belonging to a different college entirely, and every number derived
from it inherits the contradiction silently.

`validate_same_parent(doc, link_field, *shared_fields)` is the guard. It re-reads the linked record
and asserts that the ancestors it claims are the ones this document claims:

```python
validate_same_parent(self, "department", "college")          # Programme
validate_same_parent(self, "college", "institution", "campus")
```

It stays silent when either side is blank (that's `reqd`'s job, not a contradiction) and on a
dangling link (`_validate_links` reports that better). It raises `HierarchyMismatchError` otherwise.

**Why not rely on `fetch_from`?** Because the rewrite happens inside `_validate_links`, which any
caller can skip with `flags.ignore_links`. An invariant that rests on a JSON attribute nothing
points at is not an invariant. Tests: [../erp/master/test_hierarchy.py](../erp/master/test_hierarchy.py).

**Rule for new doctypes:** any doctype that denormalises an ancestor calls `validate_same_parent`
in its `validate`. Do not write a second version of this check.

## Two Frappe behaviours that look like guarantees and are not

Both were found by writing a probe against the running site rather than by reading the JSON, and
both had already shipped as silent holes in this slice before they were caught.

**`format:` naming does not enforce uniqueness.** `format:{institution}-{consultancy_code}` makes
the primary key unique, so a *duplicate insert* fails — but `name` is computed once and never
recomputed. Edit `consultancy_code` on a saved row and the column moves while the key stays put, and
two agencies in one institution end up sharing a code. Any figure grouped by that code then credits
one for the other's enquiries. Consultancy closes this in `validate`; **Staff, Department
and Programme all still carry the same hole** for their own codes. Worth one pass across all four.

**`mandatory_depends_on` is never checked on save.** It appears nowhere in `frappe/model/` —
`_get_missing_mandatory_fields` reads `reqd` alone — so it is a Desk *form* rule and nothing more.
Any API write, and the React SPA (which never loads Desk form scripts at all), sails straight past
it. A conditional field that must actually hold a value needs an explicit check in `validate`; see
`validate_conditionally_mandatory` in
[../erp/gate/doctype/admission_gate_pass/admission_gate_pass.py](../erp/gate/doctype/admission_gate_pass/admission_gate_pass.py).
The JSON rule is still worth keeping — it drives the form — but treat it as presentation.

The same distinction applies to link filtering, with a sharper edge. **`link_filters` in the JSON
applies everywhere the *Desk* picker appears** (form, quick-entry dialog, list-view filter), whereas
a client script's `set_query` only applies on the form. So within Desk, scoping a Link to its tenant
belongs in `link_filters` — `college.json`, `department.json`, `programme.json` and `staff.json` all
do it that way, and a `set_query` alone leaves the quick-entry dialog offering every tenant's records.

But it is **not enforced on save, and it never reaches the SPA**. `link_filters` appears nowhere in
Frappe's Python model layer except a JSON-shape validator
(`frappe/core/doctype/doctype/doctype.py`); its only runtime consumer is the Desk link control
(`frappe/public/js/frappe/form/controls/link.js`), which parses it and passes the result to
`search_link`. It is a **picker convenience, not an invariant**. Two consequences:

- The React SPA gets nothing for free and carries its own copy — parsed server-side by
  `parse_link_filters` in [../erp/api/doctype.py](../erp/api/doctype.py) and applied client-side.
  Change one, change the other.
- **Tenant scoping rests entirely on `validate_same_parent`.** A doctype that gains a Link needing
  tenant scoping and relies on `link_filters` alone is scoped in the UI and unscoped in the API —
  the most dangerous configuration, because it looks correct.

## The `id` UUID column

Every doctype carries an `id` Data field — unique, read-only, no-copy — separate from Frappe's
primary key `name`. `name` stays the readable business key and all Links point at it; `id` is the
stable identifier for external systems.

It is filled by `set_uuid_id` in [../erp/utils.py](../erp/utils.py), wired as a global
`before_insert` in [../erp/hooks.py](../erp/hooks.py):

```python
doc_events = {"*": {"before_insert": "erp.utils.set_uuid_id"}}
```

The hook only touches doctypes that define the field and never overwrites a value that was supplied
explicitly, so no per-doctype code is needed — just add the field. Skipping it errors nowhere; the
column is simply missing. That silence is why the [new-doctype](../.claude/skills/new-doctype/SKILL.md)
checklist exists.

## Known gaps

Recorded, not fixed. Each gets resolved by the slice that first makes it matter — fixing them now
would be masters-first thinking.

- **College codes are globally unique.** `field:college_code` means two institutions cannot both use
  the code `ENG`. Campus, Department, Programme and Academic Year avoid this by naming on a
  `format:` expression that includes the parent. College should probably follow, but changing a
  naming rule after data exists is a migration, so it waits for a slice that hits the collision.
- **A person is barely modelled.** Staff exists as an identity record — enough to be picked from a
  dropdown and nothing more. There is no Student, no Guardian, no employment record, no academic
  history, and the referring student on a gate pass is a typed name rather than a record. `erpnext` is **not** installed on `erp.localhost` (only `frappe` and `erp`), so
  its `Employee` and `Student` doctypes are unavailable and everything gets built here. The People &
  Identity slice is where these grow — and every slice that touches a person inherits whatever shape
  it settles on.
- **The three referrer masters have no de-duplication.** Two Staff rows for the same person under
  different codes will split a referral report between them, and nothing detects it.
- **Only one real role.** `Gate Security` exists (created by
  [../erp/patches/v1_0/create_gate_roles.py](../erp/patches/v1_0/create_gate_roles.py)); everything
  else is still System Manager. And no role is scoped to a college — a Gate Security user sees every
  institution's passes. User Permissions would fix that when a second campus makes it matter.

## Masters backlog

Candidate masters, carried over from the old `master_modules.txt` (deleted — it was the
masters-first shopping list this method replaces). **None of these is approved to build.** This
table exists so that when a slice asks for one, we reuse the name and the intent instead of
inventing a parallel concept.

| Master | Status | Expected to arrive with |
|---|---|---|
| Branch | Not built | Enrollment / academics — may turn out to be `Programme.specialization`, already a field |
| Semester | Not built | Enrollment — check first whether Academic Structure + `terms_per_year` already covers it |
| Course | Not built | Curriculum / attendance |
| Section | Not built | Enrollment / attendance |
| Shift | Not built | Attendance / timetable |
| Hostel | Not built | Hostel |
| Transport | Not built | Transport |
| Building | Not built | Infrastructure — likely with exams or timetable |
| Floor | Not built | Infrastructure |
| Room | Not built | Infrastructure / hostel / exams |
| Classroom | Not built | Timetable — may be a `Room` type rather than its own doctype |
| Staff Category | Not built | HR / staff — `Staff` itself now exists, but with no category field |
| Student Category | Not built | Admissions — `Student` itself is still unbuilt |
| Religion | Not built | Admissions (student demographics) |
| Community | Not built | Admissions (reservation / quota) |
| Nationality | Not built | Admissions — Frappe already ships `Country`; check before building |
| Blood Group | Not built | Admissions / health — likely a Select, not a doctype |
| Fee Head | Not built | Fees |
| Scholarship | Not built | Fees |
| Quota | Not built | Admissions (seat allocation) |
| Admission Source | Not built | Admissions — Slice 1 modelled the five referral routes as a Select on the pass instead; this becomes a master when someone needs to add a route without a schema change |

Slice 1 took **Staff** and **Consultancy** out of this backlog and built them, at the fields its
journeys named and no more. Everything else is still untouched.
