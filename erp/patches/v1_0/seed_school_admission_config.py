# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Seed the shared vocabulary a school admission needs, and preserve the institution rule it replaces.

Schools reuse the institution admission doctypes with different words (docs/PRODUCT.md): a "Class 10"
is a Programme, a school level is a Programme Level, "Term" is an Academic Structure's `term_label`.
None of that vocabulary is a tenant's own data — it is the same shared set every school group would
add — so it is seeded here rather than left for each site to key in by hand.

The previous-education requirement moved off a hardcoded UG→12th / PG→Undergraduate map and onto
`Programme.required_prior_qualification`, which defaults blank. Left blank, existing institution
programmes would silently stop requiring a school-leaving record, so the same patch backfills that
field from each programme's level, keeping the rule exactly where it was.

Runs in `[post_model_sync]`: it writes rows and reads the new field, both of which need the schema
already migrated. Idempotent — every step guards on what is already there, so re-running on any
installed site is a no-op.
"""

import frappe

# Primary → Higher Secondary, the K-12 counterpart of UG/PG. `level_code` is the business key
# (Programme Level autonames by it); `level_order` sorts them the way UG=1/PG=2 sorts institution levels.
SCHOOL_PROGRAMME_LEVELS = (
	{"level_code": "PRI", "level_name": "Primary", "level_order": 1},
	{"level_code": "MID", "level_name": "Middle", "level_order": 2},
	{"level_code": "SEC", "level_name": "Secondary", "level_order": 3},
	{"level_code": "HSC", "level_name": "Higher Secondary", "level_order": 4},
)

# A school runs three terms a year and calls a term a "Term" — the label that makes the shared
# Programme read "Term I" instead of "Semester 1" downstream, with no doctype knowing which it is.
SCHOOL_ACADEMIC_STRUCTURE = {
	"structure_code": "TERM",
	"structure_name": "Term System",
	"terms_per_year": 3,
	"term_label": "Term",
}

# The straight-through institution rule, now expressed as data so it survives the move off the map.
PRIOR_QUALIFICATION_BY_LEVEL = {
	"UG": "12th",
	"PG": "Undergraduate",
}


def execute():
	seed_school_vocabulary()
	backfill_required_prior_qualification()


def seed_school_vocabulary():
	for level in SCHOOL_PROGRAMME_LEVELS:
		if not frappe.db.exists("Programme Level", level["level_code"]):
			frappe.get_doc({"doctype": "Programme Level", **level}).insert(ignore_permissions=True)

	if not frappe.db.exists("Academic Structure", SCHOOL_ACADEMIC_STRUCTURE["structure_code"]):
		frappe.get_doc({"doctype": "Academic Structure", **SCHOOL_ACADEMIC_STRUCTURE}).insert(
			ignore_permissions=True
		)


def backfill_required_prior_qualification():
	for level, qualification in PRIOR_QUALIFICATION_BY_LEVEL.items():
		frappe.db.sql(
			"""
			UPDATE `tabProgramme`
			SET required_prior_qualification = %(qualification)s
			WHERE programme_level = %(level)s
			  AND (required_prior_qualification IS NULL OR required_prior_qualification = '')
			""",
			{"qualification": qualification, "level": level},
		)
