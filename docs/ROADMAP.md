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
| **2** | Tenancy repair B — `institution`/`trust` `reqd: 1`, backfill, `apply_strict_user_permissions` on. Plus the child-row UUID fix and vocabulary replayed on every migrate. 184 tests green | — |

## Next — in this order

| # | Slice | Justifying journey | Proof |
|---|---|---|---|
| **3** | `Institution Type` tree; delete both `!= "School"` branches | *A Trust Admin onboards a Nursing college on a Tuesday without a developer.* Today the Select has no Nursing and two files branch on the literal `"School"` | Existing department tests pass unchanged; a Nursing row is added in Desk and a Programme under it saves with no Department |
| **4** | Config engine (`Config Setting`, `Config Value`, resolver, cache) + per-institution register series | *A CBSE school and an engineering college under one trust each need their own statutory admission register.* Today both draw from one `{trust}-STU-#####` counter | `test_shipped_config` green on a fresh site; two institutions produce different `tabSeries` keys; `explain()` renders the chain |
| **5** | Vocabulary masters — `Admission Route`, `Qualification`, `Education Board`, `Entrance Exam`, `Reservation Category`; retire the `GOVERNMENT_QUOTA` literal | *A K-12 application must not deadlock in "Awaiting Counselling".* It does today, out of the box: a school application defaults to `Government Quota` and is then blocked forever by the allotment gate | Raise a school application on route `Direct`; it reaches `Admitted`. Add an `NRI` route with `requires_allotment`; the gate fires with no code change |
| **6** | **`Field Policy` — the canonical slice** | *One school application recording previous school, board, class and marks; one engineering application recording cut-off, rank and allotment; both rows in `tabAdmission Application`* | Both raised through Desk **and** `/api/resource`, throwing identically; then filter by board and group by cut-off band in Report Builder with no code |
| **7** | `Eligibility Rule`, `Programme Intake Seat`, conditional checklists | *Standard VI wants age 10–12 as on 1 June; B.E. CSE wants 50% in 12th plus TNEA ≥ 100; both intakes open the same day* | Seeded rules reproduce today's throws exactly; then a new age window blocks an 8-year-old |
| **8** | Accounts + calendar minimum | *The trustee asks for the school's income separately from the engineering college's* | Trial balance identical before and after |
| **9** | Onboarding ergonomics | *A trust acquires an institution on a Tuesday and configures it that afternoon* | Clone one institution's config into another, change four things, checklist goes green |

## Known defects, scheduled

| Defect | Where | Slice |
|---|---|---|
| ~~Tenant isolation absent; `assert_trust_in_scope` fails **open**~~ — fixed in slice 1 | `erp/api/permission.py` | ✅ |
| ~~`institution` nullable on five doctypes; blank rows visible to everyone~~ — fixed in slice 2 | doctype JSONs | ✅ |
| The statutory admission register is keyed on the **trust**, so GIS/GCE/GCT share one run — while the docstring claims the opposite | `student.py:autoname` | 4 |
| `Trust.affiliated_university` is a Link to `Trust`. Affiliation belongs on `Institution` | `trust.json` | 3 |
| ~~Child tables never receive their UUID `id`~~ — fixed in slice 2 | `erp/utils.py:set_uuid_id` | ✅ |
| ~~`Programme Level` / `Academic Structure` empty despite both seed patches logged~~ — fixed in slice 2 by replaying vocabulary on every migrate | `erp/seed.py` | ✅ |
| A `Staff` row grants exactly one Institution permission, so one person cannot serve two institutions. A real case for shared trust-level staff; needs a modelling change, not a flag | `staff.py:sync_institution_permission` | backlog |
| `Trust Admin` and `Institution Admin` hold no DocPerms yet, so each must be paired with a functional role | doctype JSONs | 3 |
| A K-12 application deadlocks in *Awaiting Counselling* out of the box | `pipeline.py:142` | 5 |

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
