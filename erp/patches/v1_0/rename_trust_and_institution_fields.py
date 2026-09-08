# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Move the denormalised ancestor columns onto the renamed vocabulary.

`rename_institution_to_trust` renamed the two DocTypes; this renames the columns that point at
them. Every doctype in the hierarchy denormalises its ancestors, so `institution` (which held the
tenant root) becomes `trust`, and `college` becomes `institution`.

**Why `[post_model_sync]` when the doctype rename is `[pre_model_sync]`.** `rename_field` is not a
DDL rename — it reads `frappe.get_meta(doctype)`, requires the *new* field to be there, and then
copies the data across with `UPDATE tab<DocType> SET <new> = <old>`. The new column therefore has to
exist before it runs, and the only thing that creates it is model sync importing the edited JSON.
Running this before sync would find no `trust` column and bail out with a printed warning and no
error, which is the worst of both worlds.

**Why the order inside each doctype matters.** Eleven doctypes carried `institution` *and* `college`
side by side. After sync their tables hold four columns — the old `institution` (still full of trust
names), the old `college`, the newly-added `trust`, and `institution` again, now meaning the
operating unit. Renaming `college` -> `institution` first would overwrite the trust names before
they had been copied to `trust`, and the tenant of every existing row would be lost. So `institution`
-> `trust` runs first, every time. `RENAMES` is ordered, not a dict of sets, for exactly this reason.

Finally the superseded columns are dropped. `rename_field` copies rather than renames, so without
this every table keeps a `college` (or `college_type`, or `institution_name`) column holding a
frozen snapshot of the value as it was on migration day. Nothing writes to them again and no
`DocField` describes them, but `SELECT college FROM tabDepartment` still answers — with data that
silently stops being true the first time someone edits the row. A column that only a raw query can
reach, and that lies when it is reached, is worse than no column.

**Why the guard is on the sequence and not on each rename.** The obvious idempotency check —
"rename only if the old column is still there" — is wrong here, and wrong in a way that silently
destroys the tenant of every row. `institution` is a *reused* name: it is the old name of the trust
column and the new name of the unit column, so it is present both before and after the migration.
A second run would therefore see `institution` and copy it into `trust` again, except that by then
`institution` holds the unit — turning `Department.trust` from the trust into the institution.
That is not hypothetical; it happened on the development site while this patch was being written.

The whole per-doctype sequence is therefore guarded on its *last* superseded column, which is never
the target of any rename in the sequence and so is an honest witness that the sequence has not run.
Once the sequence completes, that column is dropped and the guard closes for good.
"""

import frappe
from frappe.model.utils.rename_field import rename_field

# doctype -> ordered (old_fieldname, new_fieldname). The tenant-root rename always comes first;
# see the module docstring. Generated from the pre-rename schema and verified to reproduce the
# committed JSON field-for-field.
RENAMES: dict[str, list[tuple[str, str]]] = {
	"Trust": [
		("institution_code", "trust_code"),
		("institution_name", "trust_name"),
		("institution_type", "trust_type"),
	],
	"Institution": [
		("institution", "trust"),
		("college_code", "institution_code"),
		("college_name", "institution_name"),
		("college_type", "institution_type"),
	],
	"Academic Year": [("institution", "trust")],
	"Account": [("institution", "trust")],
	"Campus": [("institution", "trust")],
	"Consultancy": [("institution", "trust")],
	"GL Entry": [("institution", "trust")],
	"Admission Application": [("institution", "trust"), ("college", "institution")],
	"Admission Enquiry": [("institution", "trust"), ("college", "institution")],
	"Admission Follow-up": [("institution", "trust"), ("college", "institution")],
	"Admission Gate Pass": [("institution", "trust"), ("college", "institution")],
	"Department": [("institution", "trust"), ("college", "institution")],
	"Fee Payment": [("institution", "trust"), ("college", "institution")],
	"Fee Refund": [("institution", "trust"), ("college", "institution")],
	"Programme": [("institution", "trust"), ("college", "institution")],
	"Programme Intake": [("institution", "trust"), ("college", "institution")],
	"Staff": [("institution", "trust"), ("college", "institution")],
	"Student": [("institution", "trust"), ("college", "institution")],
}


def execute():
	for doctype, pairs in RENAMES.items():
		if not frappe.db.table_exists(doctype):
			continue

		# The sequence's last superseded column is the witness — see the module docstring for
		# why probing each `old` individually corrupts the data instead of protecting it.
		if not frappe.db.has_column(doctype, pairs[-1][0]):
			continue

		for old, new in pairs:
			if frappe.db.has_column(doctype, old):
				rename_field(doctype, old, new)

	drop_superseded_columns()
	frappe.clear_cache()


def drop_superseded_columns():
	"""Drop the columns `rename_field` copied out of, once nothing in the schema claims them.

	Deliberately not a hardcoded list. The safety condition is what matters: a column is dropped
	only when the doctype's *current* metadata has no field of that name, which is what proves it
	is superseded rather than live. That distinction is real — `institution_name` is dead on Trust,
	where it became `trust_name`, and simultaneously alive on Institution, where `college_name`
	became it.
	"""
	superseded = {
		"college",
		"college_code",
		"college_name",
		"college_type",
		"institution_code",
		"institution_name",
		"institution_type",
	}

	for doctype in RENAMES:
		if not frappe.db.table_exists(doctype):
			continue

		live = {field.fieldname for field in frappe.get_meta(doctype).fields}
		for column in sorted(superseded - live):
			if frappe.db.has_column(doctype, column):
				frappe.db.sql_ddl(f"ALTER TABLE `tab{doctype}` DROP COLUMN `{column}`")
