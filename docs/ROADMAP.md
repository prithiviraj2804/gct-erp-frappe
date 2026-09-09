# Roadmap

Slice order for the configurable multi-institution backend. Backend and database only — no SPA
work in this phase.

The project's build rule is not negotiable: **no master is created without a feature slice that
consumes it.** Every slice below names the journey that justifies it and the step that proves it.

## Done

| # | Slice | Commit |
|---|---|---|
| **0** | `Institution → Trust`, `College → Institution`. Behaviour-preserving; two ordered patches; 168 tests green | `3148e28` |
| **1** | Tenancy repair A — `Trust Admin` / `Institution Admin` roles, a `"*"` scoping hook over every doctype carrying `institution`, fail-closed `assert_institution_in_scope`, Staff→User Permission provisioning, `share` dropped where it crossed the boundary. 176 tests green | `798f65b` |
| **2** | Tenancy repair B — `institution`/`trust` `reqd: 1`, backfill, `apply_strict_user_permissions` on. Plus the child-row UUID fix and vocabulary replayed on every migrate. 184 tests green | `fd27e22` |
| **3** | `Institution Type` as a NestedSet tree; both `!= "School"` branches deleted; DocPerms so the two tenancy roles stand alone; workspace links + a guard test for reachability. 200 tests green | `6786d8d` |
| **6** | `Field Policy` — a configurable Admission Enquiry. Brought forward ahead of slices 4-5 because it is the feature the ERP exists for. 213 tests green | `5decfc5` |
| **6b** | Trust-wide rollups: the Admission Funnel report (one report, scoped by who runs it), the reporting spine that configuration may not touch, and a CI gate so no future report bypasses tenancy. 223 tests green | — |
| **0'** | The three admission journeys that had never been written down. `docs/features/` held two files and both described the same TNEA process, which is how `admission_route` came to default to `Government Quota` for a school. Plus the four docs `CLAUDE.md` referenced eleven times and which had never existed | `51ae81b` |
| **1'** | Slice 6 hardened. Every fix was for a failure that produced no error: `Read Only` enforced only in the browser, a bound on a Data field blocking *every* save, `Required` locking counsellors out of records raised before the rule, a policy for an ungoverned doctype saving green and enforcing nothing, `get_policy` unscoped, an Institution Type rename forking the taxonomy on the next migrate. 238 tests green | `3da8a59` |
| **2'** | Cardinality. An applicant could hold exactly one application in the whole trust per year — composed from two rules that each looked reasonable — which forbade a TNEA choice list spanning GCT and GCE, and a parent applying to two schools. 247 tests green | `4e3188f` |
| **3'** | Field Policy on **Admission Application**, and `erp/admission/stages.py`: one stage table replacing five literals, with per-institution-type gates. 273 tests green | `81c1b62` |
| **4'** | `Admission Route` with `requires_allotment` and `Education Board`; the `GOVERNMENT_QUOTA` literal retired; `Institution Type.default_admission_route` replacing the static default that parked school applications in *Awaiting Counselling*. 280 tests green | `e0a212f` |
| **5'** | `Reservation Category` and `Programme Intake Seat` — seat pools by route and category, enforced as a gate rather than filed. `reservation_category` on the statutory register. 291 tests green | `ca89c88` |
| **6'** | The config engine (`Config Setting`, `Config Value`, `erp/config/resolver.py`, `explain`), the per-institution register series, and the §5 test gate — asserting not just that keys resolve but that an enquiry *saves* and the funnel *counts it* at one institution of every type. 319 tests green | `b678caa` |
| **7'** | Entry conditions enforced. `min_percentage` was collected, range-checked and read by nothing. Plus the per-subject marks table and `Examination Subject`, without which a PCB or weighted-cut-off rule was inexpressible. 342 tests green | `989eebd` |

## Next — in this order

Slices 3 to 7 are **done**, in a different order from the one below and with two slices inserted
that this roadmap did not have. What changed, and why, is recorded in the commits; the short version:

* **5 before 4.** This roadmap's own text argued for it — slice 5's justifying journey was a
  present-tense defect, slice 4's was a register-series concern that blocked no admission journey.
* **Slice 4 later is a better slice 4.** Its key list here was one item. After the admission work
  it is the five keys four real gates and one naming rule actually ask for. The same argument the
  project used to bring slice 6 forward, which worked.
* **Two slices inserted.** *Cardinality* (`4e3188f`), and *Field Policy on Admission Application*
  (`81c1b62`) — the second being literally what the configurability work was for, and scheduled
  nowhere: slice 6 was marked "done for Admission Enquiry" and nothing extended it.
* **Slice 7 grew a prerequisite.** An Eligibility Rule keyed on the single aggregate `percentage`
  in `Admission Enquiry Education` cannot express PCB, PCM or a weighted cut-off, so the
  per-subject marks table shipped with it rather than behind it.

| # | Slice | Justifying journey | Proof |
|---|---|---|---|
| **8** | Accounts + calendar minimum | *The trustee asks for the school's income separately from the engineering college's* | Trial balance identical before and after |
| **9** | Onboarding ergonomics | *A trust acquires an institution on a Tuesday and configures it that afternoon* | Clone one institution's config into another, change four things, checklist goes green |

### Named by the journeys, deliberately not built

`docs/features/school-admission.md` names `Fee Concession Category`, and the fee remains the one
part of the school journey that does not work: `fee_gate` and `start_application` both refuse an
unpaid lead outright, `Fee Payment` re-derives the amount from the intake on every save, and
`admission_route` lives on the application rather than the lead — so the order is fixed as fee,
then application, then route, and a quota-dependent or waived fee is impossible in principle. The
type-level switch (`requires_application_fee`) covers a wholly fee-free institution and nothing
finer. **An RTE seat at a fee-charging school still cannot be expressed.**

`docs/features/arts-science-admission.md` names `Admission Merit List` / `Admission Merit List
Entry`. Deferred on purpose: seat-pool integrity and the category column are where wrong data
accumulates irreversibly, and a merit list is reconstructible afterwards from stored marks. It needs
the offices' actual roster rules rather than a guess at them.

`Admission Application Allotment` — multi-round counselling — is still unbuilt, so
`allotment_reference` remains a scalar and recording Round 2 destroys Round 1.

## Known defects, scheduled

| Defect | Where | Slice |
|---|---|---|
| ~~Tenant isolation absent; `assert_trust_in_scope` fails **open**~~ — fixed in slice 1 | `erp/api/permission.py` | ✅ |
| ~~`institution` nullable on five doctypes; blank rows visible to everyone~~ — fixed in slice 2 | doctype JSONs | ✅ |
| ~~The statutory admission register is keyed on the **trust**, so GIS/GCE/GCT share one run — while the docstring claims the opposite~~ — fixed in `b678caa`. `student_register_series` resolves through the config chain; the shipped default is byte-identical so no site renumbers, and one `Config Value` row gives an institution its own `tabSeries` run | `student.py:autoname` | ✅ |
| `Trust.affiliated_university` is a Link to `Trust`. Affiliation belongs on `Institution` | `trust.json` | 3 |
| ~~Child tables never receive their UUID `id`~~ — fixed in slice 2 | `erp/utils.py:set_uuid_id` | ✅ |
| ~~`Programme Level` / `Academic Structure` empty despite both seed patches logged~~ — fixed in slice 2 by replaying vocabulary on every migrate | `erp/seed.py` | ✅ |
| A `Staff` row grants exactly one Institution permission, so one person cannot serve two institutions. A real case for shared trust-level staff; needs a modelling change, not a flag | `staff.py:sync_institution_permission` | backlog |
| An **Institution Admin cannot read the Field Policies or Config Values that govern their own institution.** Both shipped policy classes are Institution-Type-scoped, so `scope_institution` is NULL, and with `apply_strict_user_permissions` on the list clause matches nothing. The read DocPerm granted in slice 3 is dead in practice. The one-line fix is wrong on its own: `ignore_user_permissions` alone would expose every *other* institution's rows, because the `"*"` tenancy hook keys on a column named `institution` and cannot see `scope_institution`. Needs the flag paired with a scope-aware condition | `field_policy.json`, `config_value.json`, `erp/api/permission.py` | backlog |
| **Configuration has no time dimension.** `Required` now binds on insert and on changed fields only, which closes the lockout — but last year's records are still re-judged by this year's rules whenever anyone touches them, and nothing previews an edit's blast radius. `academic_year` as a policy scope is the shape the fix should take | `field_policy.json` | backlog |
| **Bulk import into a governed doctype silently drops columns.** Data Import runs every row through `validate`, so importing a school's legacy leads whose marks sit in a Hidden column writes NULL for every row and reports success. The revert now says so via `msgprint`, which a UI shows and an import does not. Policy has two modes — mutate or throw — and no batch or report mode | `erp/field_policy.py` | backlog |
| **Two rollups still define "conversion" differently.** The funnel is admitted-over-applications; `erp/api/admission/dashboard.py` is enquiries-at-status-Admitted over all enquiries, all time. `IntegrationTestReportTenancy` globs `*/report/*` only, so nothing under `erp/api/` is checked for metric consistency | `erp/api/admission/dashboard.py` | backlog |
| **The SPA cannot draw a governed form.** `get_doctype_schema` publishes `governed` and the renderer now refuses rather than drawing the ungoverned superset — the honest answer, not the finished one. Removing the flag needs an `institution` parameter on the endpoint, that institution in the query key (it is `['doctype','schema',doctype]` today), a current-institution concept in the session, and a mid-form re-resolve | `erp/api/doctype.py`, `frontend/src/pages/doctype/lib/governed.ts` | backlog |
| ~~`Trust Admin` / `Institution Admin` hold no DocPerms~~ — fixed in slice 3 | doctype JSONs | ✅ |
| ~~A K-12 application **defaults** into *Awaiting Counselling* out of the box~~ — fixed in `e0a212f`. The static default is gone; `Institution Type.default_admission_route` supplies `Direct` for School and Arts & Science. Earlier wording here said "deadlocks" and "blocked forever"; both were wrong, and slice 5's own Proof column contradicted them | `application_state.py` | ✅ |

## Reserved, not built

`Programme Section` (K-12 sections) and — more urgently — a **per-year enrolment record**.
`Student` today is one row with scalar `academic_year` and `programme`, so promoting Class 6 → 7
overwrites the Class 6 record, and a second `Student` row is impossible because `name` is the
statutory register number and `allow_rename: 0`. Attendance, exams, report cards, per-year fees and
TC generation all hang off the missing level, and retrofitting it under 200k students is the one
change here that cannot be done incrementally. Reserved now; built when the attendance slice starts.

Also backlog: `Academic Calendar`/`Academic Term`, `Fee Head`/`Fee Structure`,
`Document Checklist Template`, `Admission Application Allotment` (multi-round counselling — today
`allotment_reference` is a scalar, so recording Round 2 destroys Round 1), `Enquiry Source`,
`Attribute Definition` (see the promotion boundary in [CONFIGURATION.md](CONFIGURATION.md#7-the-promotion-boundary)).
