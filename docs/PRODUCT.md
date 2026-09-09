# Product

The domain this app models: one trust, many institutions, one vocabulary that has two readings.

The app has **no product name**. Every screen identifies the *trust*, from the `Trust` record —
`erp/api/branding.py` publishes an allow-list of its fields to the sign-in screen
(`erp/api/branding.py:31-43`). `APP_NAME` (`frontend/src/lib/constants.ts:26`, the literal `'ERP'`)
appears only where `brand?.name` is null, i.e. on a bench with no Trust row yet
(`frontend/src/auth/pages/LoginScreen.tsx:99`). It is a fallback, not a brand.

## 1. Trust, campus, institution

The hierarchy contract is in [DATA-MODEL.md](DATA-MODEL.md#1-the-hierarchy); this is what the levels
*mean*.

- **Trust** — the legal body that owns everything. One per site, enforced by
  `Trust.assert_only_one` (`erp/master/doctype/trust/trust.py:13`). It is a cardinality check and
  not a Frappe Single deliberately: a Single has no `tab<DocType>` table, so converting would drop
  every Link that points at `Trust`, the `format:{trust}-…` naming on Account, Academic Year, Campus
  and Consultancy, the `{trust}-STU-.#####` register series
  (`erp/student/doctype/student/student.py:34`) and the Trust User Permissions the scoping model
  rides on. The check is skipped under `frappe.in_test` (`trust.py:33`), because several suites raise
  two trusts on purpose to prove one tenant cannot read another.
- **Campus** — a location. Shared: one campus may host several institutions, which is why `Campus`
  hangs off `Trust` and `Institution.campus` is optional
  (`erp/master/doctype/institution/institution.json`, `campus` description).
- **Institution** — the operating unit, and **the tenancy boundary**. Not the trust: because there is
  exactly one Trust row, a `User Permission` on `Trust` selects every row in the database and is a
  tautology. See [DATA-MODEL.md §2](DATA-MODEL.md#2-the-tenancy-contract).

### What a "trust type" is

`Trust.trust_type` is a blank-first `Select`: `University`, `Autonomous`, `Trust`, `College Group`,
`School Group` (`erp/master/doctype/trust/trust.json`). It is **descriptive only**. Grep the app and
it is read in exactly one place — the branding allow-list (`erp/api/branding.py:35`), surfaced as
`type` on the sign-in payload (`erp/api/branding.py:94`). No validation, no configuration and no
report branches on it. It was `institution_type` before the slice-0 rename
(`erp/patches/v1_0/rename_trust_and_institution_fields.py:54`), which is the origin of the confusion:
the field that carries behaviour is **`Institution.institution_type`**, one level down.

## 2. The institution types actually seeded

Nine kinds an institution can be, plus two groups that exist only to carry shared rules
(`Institution Type.is_group`, `erp/master/doctype/institution_type/institution_type.json`):

```
All                (is_group)
├── School                         requires_department = No     erp/seed.py:41
├── Arts & Science                 requires_department = Yes    erp/seed.py:42
└── Professional  (is_group)       requires_department = Yes    erp/seed.py:43-48
    ├── Engineering ├── Medical ├── Polytechnic ├── Law
    ├── MBA         ├── Nursing  └── Pharmacy        (state nothing; inherit)
```

Seeded by the `after_migrate` hook (`erp/hooks.py:33` → `erp/seed.py:126-131`) and marked
`is_standard`, so a shipped row may be relabelled or re-parented but not deleted
(`institution_type.py:44-56`). Adding a Dental college is an INSERT, not a deploy.

**What genuinely differs between them today is small, and that is the design.** One capability
exists — `requires_department`, resolved nearest-first up the tree by
`resolve_capability` (`institution_type.py:75-97`) — and two shipped Field Policies: `School` hides
the four entrance fields and relabels previous education (`erp/seed.py:94-108`), `Professional`
floors the cut-off and rank at zero (`erp/seed.py:109-122`). `Arts & Science` inherits **neither**,
because it is a sibling of both, and that hole is the subject of
[features/arts-science-admission.md](features/arts-science-admission.md).

Everything else that differs is a *journey*, not a schema, and each is written down rather than
restated here:

| Type | Journey doc | The difference in one line |
|---|---|---|
| School (K-12) | [school-admission.md](features/school-admission.md) | No counselling body, no entrance exam, a class under no department, a fee that must be waivable |
| Arts & Science | [arts-science-admission.md](features/arts-science-admission.md) | The institution computes merit itself; nothing in the app computes or records merit |
| Professional, management seat | [professional-management-quota-admission.md](features/professional-management-quota-admission.md) | The institution gives the seat itself, under a type whose default assumes an external allotment |

## 3. The vocabulary map

One schema, two readings. This table is the input to every future `label_override` decision — the
only supported way to change a word for one scope is `Field Policy Rule.label_override`
(`erp/master/doctype/field_policy_rule/field_policy_rule.json`; the rule's complete property list is
`fieldname`, `requirement`, `label_override`, `display_order`, `min_value`, `max_value`,
`description_override`). Every row below is grounded in a field or a seeded value; nothing here is
invented.

| App term | A school reads it as | A college reads it as | Grounded in |
|---|---|---|---|
| `Programme` | a Class / Standard ("Class 10") | a Degree + Branch (`BE-CSE`, `BCOM`, `MBA`) | `programme.json` `programme_code` description; `seed_school_admission_config.py:5-6` |
| `Programme.degree` | *blank* — a school awards no degree | B.E., B.Tech., MBA, MBBS | `programme.json` `degree` description |
| `Programme Level` | Primary / Middle / Secondary / Higher Secondary | Undergraduate / Postgraduate | `erp/seed.py:62-69` |
| `Academic Structure.term_label` | "Term", 3 per year | "Semester", 2 per year | `erp/seed.py:73-86`, comment at `:71-72` |
| `Department` | **absent** — a class sits under none | CSE, Commerce, Physics | `erp/seed.py:41` (`requires_department: "No"`); `institution_type.py:100-114` |
| `Admission Enquiry` | the registration a parent makes | the walk-in lead a counsellor owns | `admission_enquiry.json` `status` pipeline |
| `Admission Enquiry.programme` | the class asked for | the branch asked for — labelled "Preferred Programme" | `admission_enquiry.json` `programme` label |
| `Admission Enquiry.programme_level` | Primary / Secondary | UG / PG | that field's own description |
| Entrance & Merit section | not collected (hidden by policy) | TNEA / NEET / CAT exam, rank, cut-off | `erp/seed.py:101-105`; section description in `admission_enquiry.json` |
| `previous_education` | "Previous School Record" | prior qualification + board/university | `erp/seed.py:106` (`label_override`) |
| `Programme Intake.min_age` / `age_as_on` | the entry condition — age as on 1 June | ordinarily blank | `programme_intake.json` descriptions; enforced at `programme_intake.py:92-127` |
| `Programme Intake.min_percentage` | rarely used | the marks bar — **enforced nowhere today** | `professional-management-quota-admission.md` §4.3 |
| `Student` | pupil on the roll | student on the register | `student.json`; both are one row, one word |
| `Admission Type` | Regular / Transfer / Readmission | Regular / Lateral Entry / Transfer / Readmission | `admission_type.json` `type_code` description |
| `admission_route` | Direct (a school gives its own seats) | Government Quota / Management Quota / Direct | `admission_application.json` `admission_route` |
| `Institution` | "the school" (GIS) | "the college" (GCT, GCE) | `institution.json` `institution_code` description |

Two things this table is **not**:

- It is not a licence to relabel freely. `Field Policy.REPORTING_SPINE`
  (`erp/master/doctype/field_policy/field_policy.py:45-59`) refuses a `label_override` on the columns
  a trust-wide rollup reads — `institution`, `trust`, `status`/`application_state`, the date, the
  programme. Relabelling `status` would make one institution's funnel incomparable with the next.
  See [CONFIGURATION.md §7](CONFIGURATION.md#7-the-bound-on-configuration-the-trust-must-still-be-able-to-count).
- It is not a licence to add a doctype. A school-only doctype that duplicates an institution concept
  is the failure mode this map exists to prevent; the answer is a conditional field, a capability on
  the type, or a policy row.

**Where the label mechanism does not reach.** `label_override` acts on a scalar field the enforcer can
see. It cannot relabel a child-table *column* (`meta.has_field` is a flat lookup —
[CONFIGURATION.md §6](CONFIGURATION.md#6-the-worked-example--target-state-not-today)), and there is no
mechanism at all for varying `term_label` per row inside a shared print format. The vocabulary rows
above marked with a `label_override` citation are the ones actually implemented; the rest are read by
a human from the record's own `Academic Structure` and `Institution Type`.

## 4. Personas

The roles that exist in the code — every one appears in at least one doctype's `permissions` block,
and the two tenancy roles are created by `erp/patches/v1_0/create_tenancy_roles.py:26-28`:

| Persona | Role in code | Can | Cannot |
|---|---|---|---|
| **Admission Counsellor** | `Admission Counsellor` | Own a lead, raise the application, record the allotment, tick documents | Admit |
| **Admission Manager** | `Admission Manager` | Everything a counsellor can, plus confirm an admission — which writes the statutory register | Move money |
| **Accounts Manager** | `Accounts Manager` | Read every receipt and the ledger; cancel a receipt; pay money out | — |
| **Cashier** | `Cashier` | Take money in, print the receipt | Cancel, or refund |
| **Gate Security** | `Gate Security` | Issue and close an admission gate pass | Anything past the gate |
| **Trust Admin** | `Trust Admin` | Read every institution in one report; create institutions; edit configuration | — |
| **Institution Admin** | `Institution Admin` | Run their own institution's operational doctypes | Redefine trust-wide vocabulary |
| **System Manager** | `System Manager` | Bench-wide | — |

Two persona names in [docs/features/](features/) are **labels, not roles**, and the docs say so:

- **Admission Coordinator** — the school's word for the counsellor. "The role already exists as
  `Admission Counsellor`; a school calls the person something else and that is a label, not a second
  role" ([school-admission.md](features/school-admission.md) §2). Do not create the role.
- **Principal / Admission Committee** — the approval that today is a signature on paper.
  [arts-science-admission.md](features/arts-science-admission.md) §2 gives it a *state*, not a
  doctype and not a role.

**One unresolved inconsistency, recorded rather than papered over.**
[admission-application-to-student.md](features/admission-application-to-student.md) §2 calls the
Admission Manager a "per-trust admission head"; [school-admission.md](features/school-admission.md)
§2 calls the same persona "per-institution admission authority". The code does not settle it: the
role carries DocPerms, and *scope* comes from the `"*"` tenancy hook on the `institution` column
(`erp/hooks.py:159-171`), so an Admission Manager is per-institution exactly insofar as their `Staff`
row grants one Institution permission — and a `Staff` row grants exactly one, which is a known defect
in [ROADMAP.md](ROADMAP.md#known-defects-scheduled). Treat "per-institution" as the intent and the
trust-level reading as an artefact of the earlier doc.

## 5. The normal case

An engineering institution, an arts & science institution and a school **under one trust** is not an
edge case; it is the case. The real bench carries GEI as the trust with GIS (School), GCE (Arts &
Science) and GCT (Engineering) under it — named in
[school-admission.md](features/school-admission.md) §1 and
[arts-science-admission.md](features/arts-science-admission.md) §1. Anything built for one of them
must be checked against the other two before it is claimed done; the config layer's own test gate is
specified to instantiate one institution per Institution Type for precisely this reason, and is
**not built** ([CONFIGURATION.md §5](CONFIGURATION.md#5-where-configuration-comes-from-on-a-fresh-site)).
