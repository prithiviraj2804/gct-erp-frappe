# Configuration

How one codebase serves a school, an engineering college, a medical college and an arts &
science college without branching on their type.

## 1. The rule

> **Most specific wins. A blank is not an answer. An unregistered key is a bug, not a missing
> value.**
>
> Resolution walks this chain and returns the first *stated* value:
>
> **1.** Programme Intake → **2.** Programme → **3.** Institution → **4.** Institution Type, then
> its ancestors nearest-first → **5.** Trust → **6.** the key's registered default → **7.** throw
> if the key is `is_required`, else `None`.

"Stated" means a non-blank string — see the tri-state rule in
[DATA-MODEL.md](DATA-MODEL.md#32-the-tri-state-rule).

Anchors are *completed*, not required: given a Programme Intake the resolver derives its Programme,
thence its Institution, thence its Institution Type and Trust. A caller passing only `institution=`
gets levels 3–7.

## 2. Institution Type is a tree — **built**

```
All  (is_group)
├── School
├── Arts & Science
└── Professional  (is_group)
    ├── Engineering
    ├── Medical
    ├── Polytechnic
    ├── Law
    ├── MBA
    ├── Nursing        ← adding one is an INSERT, not a deploy
    └── Pharmacy
```

A rule set at `Professional` is inherited by seven types without a duplicated row.
`frappe.utils.nestedset.get_ancestors_of(..., order_by="lft desc")` returns ancestors nearest-first,
which is exactly the order the resolver needs.

Shipped in slice 3, seeded by the `after_migrate` hook and marked `is_standard` so a shipped row
cannot be deleted. Capabilities live on the type as **`Select` with a blank option**, never `Check`
— see the tri-state rule in [DATA-MODEL.md](DATA-MODEL.md#32-the-tri-state-rule); blank means
inherit. `erp/master/doctype/institution_type/institution_type.py:resolve_capability` walks the
chain and is the seed of the full resolver in §3.

The first capability is `requires_department`, which replaced two byte-identical
`if institution_type != "School"` branches in `programme.py` and `admission_enquiry.py`.

## 3. The resolver

`erp/config/resolver.py` is the only module permitted to read `tabConfig Value` — the same
single-seam discipline `erp/accounts/provisioning.py:resolve_account` already uses.

```python
get_config(key, *, programme_intake=None, programme=None, institution=None, trust=None, default=_UNSET) -> Any
get_many(keys, **anchors) -> dict[str, Any]      # shares node reads; use this in validate()
explain(key, **anchors) -> ConfigTrace           # backs the Effective Configuration report
clear_cache(scope_type=None, scope_name=None)
```

Cache **per node**, not per resolved question, so a new key costs no new cache entries:

```
frappe.cache.hget(f"erp_config::{generation}", f"{scope_type}|{scope_name}") -> {setting_key: raw}
```

- **Request memo** on `frappe.local.erp_config_nodes` so a 300-row import resolves each node once.
- **Surgical invalidation** on `Config Value` save/trash: `hdel` that node **and** pop the request
  memo — otherwise a `validate()` that writes config then reads it sees the pre-write value.
- **Wholesale invalidation** by one `INCR` of `erp_config_generation`: `Config Setting` save,
  `Institution Type` save (a re-parent reshuffles ancestry), `Institution.institution_type`
  changed, `Field Policy` save.

## 4. Three layers, three jurisdictions

| Layer | Answers | Enforced by |
|---|---|---|
| **Config Setting / Config Value** | scalar behaviour — "does this institution require a Department?", "what is the register series?" | Python `validate()` reading `get_config` |
| **Field Policy / Field Policy Rule** | per-field behaviour — required / hidden / read-only / relabelled / bounded, per scope | one `apply_field_policy(doc)` call, server-side |
| **DocType Layout** | Desk *presentation* only — order, subset, labels, per route | nothing. It is not a rule. |

The layers are disjoint. Presentation never enforces; enforcement never renders.

**"Enforced by" is a claim to keep honest.** `Read Only` was in this table before it was in the
code: the verb was offered, the Desk form greyed the control, and any other writer — `/api/resource`,
Data Import, a console script, the Admission Follow-up `set_value` path — could write it freely. It
is now enforced as a *revert*, which makes it the same enforcement as `Hidden` and a different
presentation: Hidden is not drawn, Read Only is drawn and greyed, neither may be written.

Two other rule forms had the same shape of problem — a bound on a non-numeric field, and `Hidden`
on a child table — and both now fail at policy-save time rather than at document-save time. See
`erp.field_policy.fieldtype_objection`. The rule the layer holds itself to:

> **A rule form that saves is a rule form the enforcer carries out.** Anything else is a policy that
> looks correct and does nothing, which is worse than no policy at all — nobody goes looking for it.

That rule is also why `Field Policy.document_type` is not a free Link to DocType. A policy may name
only a doctype in `erp.field_policy.GOVERNED_DOCTYPES`, whose controller actually calls the enforcer;
`erp/test_conventions.py` asserts the registry matches the source in both directions.

## 5. Where configuration comes from on a fresh site

`bench install-app erp` must produce a **working** site, not an inert one. Every code-owned row is
replayed by an idempotent seed patch, guarded on `frappe.db.exists` so an operator edit is never
clobbered.

| Row class | Owner | Ships how | Editable by |
|---|---|---|---|
| `Config Setting` (key registry) | **code** | seed patch, keyed on `setting_key` | System Manager only |
| `Institution Type` rows | **code** | seed patch; `is_standard` guards `on_trash` | Trust Admin may add |
| `Config Value` at Institution Type / Trust | **code** (shipped defaults) | seed patch | Trust Admin |
| `Config Value` at Institution / Programme / Intake | **operator** | never seeded | Trust Admin; Institution Admin within their own |
| `Field Policy` at Institution Type | **code** | `after_migrate` seed | Trust Admin |
| `Field Policy` below that | **operator** | never seeded | Trust Admin |
| Vocabulary masters | **code** for seeded values, **operator** for additions | seed patch matching today's Select values verbatim | Trust Admin |

**There is no `Config Manager` role.** This table used to assign the Field Policy layer to one, and
to "Institution Admin within their own". Neither is true: the role exists in no patch and no
doctype, and the actual DocPerms are System Manager (full), Trust Admin (create/read/write/delete)
and Institution Admin (read/report/export). `erp/patches/v1_0/create_tenancy_roles.py` argues for
that on purpose — "a bad policy row is an outage across every institution of that type" — so the
table is corrected to match the code rather than the reverse.

Granting a scoped role *write* here is not a permission toggle, and that is the reason it has not
been done: the `"*"` tenancy hook keys on a column literally named `institution`, and a policy's
scope column is `scope_institution`. The hook cannot see it, so a scoped writer would be unscoped.
The same blindness is why an Institution Admin's read permission is presently dead in practice —
with `apply_strict_user_permissions` on, an Institution-Type-scoped policy has `scope_institution`
NULL and the list clause matches nothing. Fixing it needs `ignore_user_permissions` on
`scope_institution` **paired with** a scope-aware permission condition; the flag alone would expose
every other institution's policies. `Institution Type` already carries that flag for the same
reason (`institution_type.json`), so the pattern exists — it was simply not applied here.

**Test gate — built, and doing both halves.** `erp/config/test_shipped_config.py` builds a fresh
Trust plus one Institution per Institution Type and asserts `get_many(ALL_KEYS, institution=…)`
equals a checked-in dict. Without it the config layer rots invisibly.

As specified it asserted config scalars only, and so would not have caught the live gap it was
meant to: `Arts & Science` hangs off `All` and therefore inherited neither shipped Field Policy.
No scalar was wrong. Nothing resolved to the wrong value. The type simply had no policy, and no
test noticed because **no test instantiated an institution of that type** — seven of the nine types
this app ships had never been instantiated by any test at all.

So the gate also asserts that an Admission Enquiry **saves** at one institution of every type and
that the trust-wide funnel **counts it**. That is the half that would have caught it, and the half
every future slice needs: a governed field added for a school otherwise gets proved for School and
Engineering and shipped for nine.

## 6. The worked example — **target state, not today**

> **This section describes where the two policies are going, not what is built.** Read it as a
> specification and check each field before writing a rule from it. As written it does not run, and
> the gap is instructive:
>
> - `previous_school`, `education_board`, `previous_class`, `marks_percentage` and `cutoff_band`
>   occur nowhere in the app but this file. `validate_fields_exist` hard-throws on all five. The
>   real prior-education data is a **child table** — `previous_education` → `Admission Enquiry
>   Education`, with `board_university` and `percentage` as row fields — and it hangs off the
>   *enquiry*. Admission Application has no previous-education table at all, so for a K-12 school
>   there is currently nowhere on the application to record the previous school and its marks.
>   Field Policy cannot govern a child column either: `meta.has_field` is a flat lookup.
> - "**default** `Direct`" and "**Required when** `admission_route.requires_allotment`" have no
>   property to live in. Field Policy Rule's complete field list is `id`, `fieldname`,
>   `requirement`, `label_override`, `display_order`, `min_value`, `max_value`,
>   `description_override`. The conditional is the load-bearing one: *required only for this route,
>   quota or board* is the single commonest shape of a real admission rule, in every institution
>   type, and the layer cannot express it.
> - It targets **Admission Application**, which is not in `GOVERNED_DOCTYPES` — nothing applies a
>   policy to it, so every rule here would have been inert. A policy for it is now refused at save
>   rather than accepted and ignored.
>
> So the three things this section actually specifies are a schema decision (promote the school's
> prior schooling to scalars on the application, or teach policy to reach into a child table), two
> new Rule properties (`default_value` and a condition), and extending enforcement to Admission
> Application. Each is a slice; none is a footnote.

The canonical case, both rows in `tabAdmission Application`, both filterable in Report Builder,
zero code branches.

**School (GIS)** — Field Policy at Institution Type `School`:

| field | rule |
|---|---|
| `previous_school`, `education_board`, `previous_class`, `marks_percentage` | Required |
| `cutoff_marks`, `entrance_exam`, `entrance_rank`, `allotment_reference` | Hidden |
| `admission_route` | default `Direct` |

**Engineering (GCT)** — Field Policy at Institution Type `Engineering`:

| field | rule |
|---|---|
| `cutoff_marks`, `entrance_exam`, `entrance_rank` | Required |
| `allotment_reference` | Required when `admission_route.requires_allotment` |
| `previous_school`, `education_board` | Optional |

Both are real columns on one table, so `WHERE education_board = 'CBSE'` and
`GROUP BY cutoff_band` work in Report Builder with no code. That is the point of keeping the
superset typed rather than reaching for an attribute store — and it is exactly the claim the
target-state notice above qualifies: it is true of the *design*, and false of those two field names
today, because neither column exists yet.

## 7. The bound on configuration: the trust must still be able to count

A trust runs institutions that admit differently, and what it needs back from all that variation is
**one comparable set of numbers** — total admissions across every institution, and each institution
separately. Those two requirements pull against each other, and the resolution is a line drawn on
purpose:

> **An institution configures its process. It never changes the columns a rollup reads.**

That line is the **reporting spine** — declared per doctype in
`erp/master/doctype/field_policy/field_policy.py:REPORTING_SPINE`, and refused by
`Field Policy.validate`. Hiding `institution` would drop a row from every total; relabelling
`status` would make one institution's funnel incomparable with the next. Everything outside the
spine is yours to configure.

This is also why the superset stays **typed columns on one table** rather than an attribute store.
`WHERE institution_type = 'Engineering'`, `GROUP BY institution` and a Report Builder filter all
keep working precisely because a school enquiry and an engineering enquiry are rows in the same
table with the same spine.

### One report, two readers

The trust-wide view and the institution's view are **the same report**, not two:

| Runs it | Sees |
|---|---|
| Trust Admin | every institution, plus a Total |
| Institution Admin | their own institution, and a Total equal to their own numbers |

Nothing branches on the role. It falls out of the row filter, because every count goes through
`frappe.get_list`. Two reports would eventually disagree; one cannot.

> **Rule for every module from here: a report reads rows through `frappe.get_list`.**

- `frappe.get_all` sets `ignore_permissions=True` (`frappe/__init__.py:1400`) — it counts other
  institutions' rows.
- `frappe.db.count` builds its own query and never reaches the permission layer.
- A **Query Report** cannot be scoped at all: `frappe/core/doctype/report/report.py:181` runs
  `frappe.db.sql(self.query, filters)` raw, and a static SQL string cannot call a helper. Write a
  Script Report.
- Where raw SQL is genuinely unavoidable, `erp.api.permission.institution_sql_clause` is the one
  supported way to scope it — `1=1` for a trust-wide caller, `IN (…)` for a scoped one, `1=0` for
  an ungranted one.

Both rules are enforced by `erp/test_conventions.py:IntegrationTestReportTenancy`, so the next
module's report cannot quietly get this wrong.

Worked example: `erp/admission/report/admission_funnel/`.

## 8. The promotion boundary

A new field is a **DocField and a `bench migrate`** — not an attribute row — until *both* hold:

1. an institution needs a field the superset lacks, **and**
2. nobody will ever filter, sort, group or total on it.

Only then does `Attribute Definition` / `Admission Attribute` earn its place. Stated now so the
decision is not made ad hoc later, under deadline.
