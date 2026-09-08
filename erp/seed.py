# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Vocabulary the app owns, replayed on every migrate.

These rows are **code**, not tenant data: the same set every education group needs, shipped so that
`bench install-app erp` produces a working site rather than an inert one. Nobody should have to key
"Undergraduate" in by hand before the first Programme can be saved.

**Why an `after_migrate` hook and not a patch.** A patch runs once and is then logged forever. On
this bench, `seed_school_admission_config` *and* the `reseed_school_vocabulary` written to repair it
are both in the Patch Log, and `Programme Level` and `Academic Structure` are both empty — the rows
were seeded and later removed, and no logged patch will ever put them back. Chasing that with a
third patch would buy one more repair and the same failure the next time. A hook re-asserts the
vocabulary on every migrate, so the rows cannot silently go missing, and adding to the list later
costs one entry rather than one patch.

Exactly the argument `erp.utils.ensure_module_defs` makes for running `before_migrate` rather than
as a patch, applied to data instead of Module Defs.

Idempotent and non-destructive: a row that already exists is left completely alone, including any
edits an operator has made to its label. Only absence is corrected.
"""

import frappe

# `level_code` is the business key — Programme Level autonames by it. The two ladders share a
# `level_order` namespace and that is deliberate: a school and a college never sort against each
# other, and forcing one combined ordering would make "Primary" and "Undergraduate" comparable,
# which they are not.
PROGRAMME_LEVELS = (
	{"level_code": "UG", "level_name": "Undergraduate", "level_order": 1},
	{"level_code": "PG", "level_name": "Postgraduate", "level_order": 2},
	{"level_code": "PRI", "level_name": "Primary", "level_order": 1},
	{"level_code": "MID", "level_name": "Middle", "level_order": 2},
	{"level_code": "SEC", "level_name": "Secondary", "level_order": 3},
	{"level_code": "HSC", "level_name": "Higher Secondary", "level_order": 4},
)

# `term_label` is what makes one shared Programme read "Term I" in a school and "Semester 1" in a
# college, with no doctype knowing which it is.
ACADEMIC_STRUCTURES = (
	{
		"structure_code": "SEM",
		"structure_name": "Semester System",
		"terms_per_year": 2,
		"term_label": "Semester",
	},
	{
		"structure_code": "TERM",
		"structure_name": "Term System",
		"terms_per_year": 3,
		"term_label": "Term",
	},
)


def ensure_shared_vocabulary():
	"""`after_migrate` hook. Re-assert every code-owned vocabulary row."""
	_ensure("Programme Level", "level_code", PROGRAMME_LEVELS)
	_ensure("Academic Structure", "structure_code", ACADEMIC_STRUCTURES)


def _ensure(doctype: str, key: str, rows: tuple[dict, ...]):
	for row in rows:
		if frappe.db.exists(doctype, row[key]):
			continue
		frappe.get_doc({"doctype": doctype, **row}).insert(ignore_permissions=True)
