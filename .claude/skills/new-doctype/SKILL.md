---
name: new-doctype
description: Create a new doctype in the erp app correctly — pick the module, add the mandatory id UUID field, wire naming, migrate, and verify. Use whenever adding a doctype or when a doctype's JSON needs auditing against project conventions.
---

# Creating a doctype in `apps/erp`

## Step 0 — is this doctype justified?

**Name the feature slice and the journey that requires it.** If you can't, don't create it.

This app builds features first: no master exists without a consumer that reads it. Eleven masters
were built ahead of any feature and none has been proven by a journey — don't add to that pile.
Check the masters backlog in [docs/DATA-MODEL.md](../../../docs/DATA-MODEL.md) first and reuse the
name and intent if the concept is already listed there; being listed is not permission to build it.

The procedure a doctype should be arriving from: [feature-slice](../feature-slice/SKILL.md) skill
and [docs/METHOD.md](../../../docs/METHOD.md).

## There is no `bench new-doctype` command

Frappe v16 does **not** ship a `new-doctype` CLI command — neither `bench new-doctype`
nor `bench --site erp.localhost new-doctype` exists. Do not suggest it. Use one of:

1. **Desk UI** (normal route): <http://erp.localhost:8000/app/doctype/new>.
   `developer_mode` is on in `sites/common_site_config.json`, so saving writes the
   files back to `apps/erp/erp/<module>/doctype/<snake_name>/`.
2. **Scripted** (`bench --site erp.localhost console`), when you need it reproducible:

```python
import frappe
frappe.get_doc({
    "doctype": "DocType",
    "name": "Visitor Pass",
    "module": "Gate",                # must match a line in erp/modules.txt
    "custom": 0,
    "naming_rule": "By fieldname",
    "autoname": "field:pass_code",
    "fields": [
        {"fieldname": "id", "fieldtype": "Data", "label": "ID", "unique": 1,
         "read_only": 1, "no_copy": 1, "in_standard_filter": 1,
         "description": "Auto-generated UUID"},
        {"fieldname": "pass_code", "fieldtype": "Data", "label": "Pass Code", "reqd": 1},
    ],
    "permissions": [{"role": "System Manager", "read": 1, "write": 1, "create": 1, "delete": 1}],
}).insert()
frappe.db.commit()
```

## Step 1 — pick the module

Modules are declared in `erp/modules.txt`: `Erp`, `Gate`, `Master`. The doctype's
`module` field must match one exactly, and the files land in that module's package
(`erp/gate/doctype/...`, `erp/master/doctype/...`). Adding a new module means adding
it to `modules.txt` **and** creating the package directory with `__init__.py` and `doctype/`.

## Step 2 — the mandatory `id` UUID field

**Every doctype in this app carries an `id` field holding an auto-generated UUID.** This is
separate from Frappe's primary key `name`. The Desk UI will not add it — you must, every time.

Add to `fields` and to `field_order` (conventionally right after the first section break):

```json
{
 "fieldname": "id",
 "fieldtype": "Data",
 "label": "ID",
 "unique": 1,
 "read_only": 1,
 "no_copy": 1,
 "in_standard_filter": 1,
 "description": "Auto-generated UUID"
}
```

The value is populated by `set_uuid_id` in `erp/utils.py`, wired as a global `before_insert`
in `erp/hooks.py`. It only acts on doctypes that define the field and never overwrites an
explicit value — so no per-doctype code is needed. If you skip the field, nothing errors;
the column is simply absent. That silence is why this step is easy to miss.

## Step 3 — naming

Prefer a readable business key so `name` stays human-meaningful and Links read well:

```json
"naming_rule": "By fieldname",
"autoname": "field:institution_code"
```

`Institution` follows this and is the pattern to copy.

Avoid `"autoname": "UUID"`. It makes `name` itself a UUID, which duplicates exactly what the
`id` column exists to provide and leaves list views showing an opaque string. A doctype that
did this was removed from the app rather than kept as precedent. Only reach for UUID naming
when there is genuinely no business key, and say so explicitly rather than defaulting to it.

## Step 4 — apply and verify

```bash
cd /workspace/development/frappe-bench
bench --site erp.localhost migrate
```

Then confirm the field actually landed — do not assume:

```bash
bench --site erp.localhost console
```
```python
frappe.get_meta("Visitor Pass").has_field("id")   # must be True
d = frappe.get_doc({"doctype": "Visitor Pass", "pass_code": "P-1"}).insert()
print(d.id)   # must be a UUID, not None
```

## Step 5 — controller, tests, style

`<name>.py` subclasses `Document`; put validation in `validate`/`before_save`/`on_submit`
rather than calling code directly from elsewhere. Tests use Frappe's unittest runner:

```bash
bench --site erp.localhost run-tests --doctype "Visitor Pass"
bench --site erp.localhost run-tests --module erp.gate.doctype.admission_gate_pass.test_admission_gate_pass
```

Python style is ruff-enforced: **tab indentation**, double quotes, line length 110. Do not
reformat to spaces.

## Checklist

- [ ] a feature slice and a named journey require this doctype
- [ ] fields are the minimum that journey uses, not everything it might one day want
- [ ] `module` matches a line in `erp/modules.txt`
- [ ] `id` field present in both `fields` and `field_order`
- [ ] `autoname` uses a business key unless justified
- [ ] `permissions` block set (at minimum System Manager)
- [ ] `bench migrate` run, `has_field("id")` verified True
- [ ] a real insert produces a non-null UUID `id`
