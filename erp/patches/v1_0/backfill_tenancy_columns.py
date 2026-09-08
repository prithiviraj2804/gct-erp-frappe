# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Fill every blank `trust` / `institution` from the record it should always have been derived from.

`institution` is the tenancy boundary, and Frappe's user-permission clause is
`IfNull(institution,'') = '' OR institution IN (...)` — verified at
`frappe/database/query.py:1503-1506`. **A row with a blank tenancy column is therefore readable by
every user in every institution.** Nullable tenancy columns are not "not filled in yet"; they are
holes, and this patch closes the ones that already exist.

The columns are now `reqd: 1`, which stops new holes. That is safe on a server-derived read-only
column because `validate()` runs inside `run_before_save_methods()` at `document.py:484` (insert)
and `:591` (update), while `_validate_mandatory` runs in `_validate()` immediately afterwards at
`:485` / `:595` — so the controllers' own `set_derived_ancestors()` has always populated the value
before it is checked.

Each backfill reads the *source of truth* for that doctype rather than guessing, and the update is
an inner join, so a row whose source is itself blank is left alone for
`enable_strict_user_permissions` to report rather than being filled with something invented.

Idempotent: every statement is `WHERE ifnull(target,'') = ''`, so a second run matches nothing.
"""

import frappe

# (doctype, column, source doctype, local link column, source column)
BACKFILLS = (
	("Admission Enquiry", "trust", "Institution", "institution", "trust"),
	("Admission Gate Pass", "trust", "Institution", "institution", "trust"),
	("Programme Intake", "trust", "Programme", "programme", "trust"),
	("Programme Intake", "institution", "Programme", "programme", "institution"),
	("Admission Application", "trust", "Programme", "programme", "trust"),
	("Admission Application", "institution", "Programme", "programme", "institution"),
	("Admission Follow-up", "trust", "Admission Enquiry", "enquiry", "trust"),
	("Admission Follow-up", "institution", "Admission Enquiry", "enquiry", "institution"),
	("Fee Payment", "trust", "Admission Enquiry", "admission_enquiry", "trust"),
	("Fee Payment", "institution", "Admission Enquiry", "admission_enquiry", "institution"),
	("Fee Refund", "trust", "Fee Payment", "fee_payment", "trust"),
	("Fee Refund", "institution", "Fee Payment", "fee_payment", "institution"),
)


def execute():
	for doctype, column, source_doctype, link_column, source_column in BACKFILLS:
		if not (frappe.db.table_exists(doctype) and frappe.db.has_column(doctype, column)):
			continue
		if not frappe.db.has_column(doctype, link_column):
			continue

		frappe.db.sql(
			f"""
			UPDATE `tab{doctype}` AS target
			  JOIN `tab{source_doctype}` AS source ON source.name = target.`{link_column}`
			   SET target.`{column}` = source.`{source_column}`
			 WHERE ifnull(target.`{column}`, '') = ''
			   AND ifnull(source.`{source_column}`, '') != ''
			"""
		)
