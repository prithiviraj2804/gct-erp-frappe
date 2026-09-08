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
| **Field Policy / Field Policy Rule** | per-field behaviour — required / hidden / read-only / relabelled, per scope | one `assert_field_policy(doc)` call, server-side |
| **DocType Layout** | Desk *presentation* only — order, subset, labels, per route | nothing. It is not a rule. |

The layers are disjoint. Presentation never enforces; enforcement never renders.

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
| `Field Policy` at Institution Type | **code** | seed patch | Config Manager |
| `Field Policy` below that | **operator** | never seeded | Config Manager; Institution Admin within their own |
| Vocabulary masters | **code** for seeded values, **operator** for additions | seed patch matching today's Select values verbatim | Trust Admin |

**Test gate.** `erp/config/test_shipped_config.py` builds a fresh Trust plus one Institution per
Institution Type and asserts `get_many(ALL_KEYS, institution=…)` equals a checked-in dict. Without
it the config layer rots invisibly.

## 6. The worked example

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
superset typed rather than reaching for an attribute store.

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
