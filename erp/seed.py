# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Minimal foundation data reasserted after every migration."""

import frappe

from erp.utils import ensure_module_defs

ROLES = (
	{"role_name": "Trust Admin", "desk_access": 1},
	{"role_name": "Institution Admin", "desk_access": 1},
)

OBSOLETE_MODULES = ("Gate", "Admission", "Accounts", "Student")
OBSOLETE_ROLES = (
	"Admission Manager",
	"Admission Counsellor",
	"Gate Security",
	"Accounts User",
	"Accounts Manager",
)
OBSOLETE_PRINT_FORMATS = ("Fee Payment Receipt", "Admission Gate Pass Thermal")

INSTITUTION_TYPES = (
	{"type_name": "All", "is_group": 1},
	{"type_name": "School", "parent_institution_type": "All"},
	{"type_name": "Arts & Science", "parent_institution_type": "All"},
	{"type_name": "Professional", "parent_institution_type": "All", "is_group": 1},
	{"type_name": "Engineering", "parent_institution_type": "Professional"},
	{"type_name": "Medical", "parent_institution_type": "Professional"},
	{"type_name": "Polytechnic", "parent_institution_type": "Professional"},
	{"type_name": "Law", "parent_institution_type": "Professional"},
	{"type_name": "MBA", "parent_institution_type": "Professional"},
	{"type_name": "Nursing", "parent_institution_type": "Professional"},
	{"type_name": "Pharmacy", "parent_institution_type": "Professional"},
)

ACADEMIC_PATTERNS = (
	{"pattern_code": "ANNUAL", "pattern_name": "Annual", "cycle_type": "Annual", "period_count": 1, "period_label": "Year"},
	{"pattern_code": "SEMESTER", "pattern_name": "Semester", "cycle_type": "Semester", "period_count": 2, "period_label": "Semester"},
	{"pattern_code": "TRIMESTER", "pattern_name": "Trimester", "cycle_type": "Trimester", "period_count": 3, "period_label": "Trimester"},
	{"pattern_code": "TERM", "pattern_name": "Term", "cycle_type": "Term", "period_count": 3, "period_label": "Term"},
)

PROGRAMME_LEVELS = (
	{"level_code": "SCHOOL", "level_name": "School", "education_stage": "School", "sequence": 10},
	{"level_code": "CERTIFICATE", "level_name": "Certificate", "education_stage": "Higher Education", "sequence": 20},
	{"level_code": "DIPLOMA", "level_name": "Diploma", "education_stage": "Higher Education", "sequence": 30},
	{"level_code": "UNDERGRADUATE", "level_name": "Undergraduate", "education_stage": "Higher Education", "sequence": 40},
	{"level_code": "POSTGRADUATE", "level_name": "Postgraduate", "education_stage": "Higher Education", "sequence": 50},
	{"level_code": "DOCTORAL", "level_name": "Doctoral", "education_stage": "Higher Education", "sequence": 60},
)


def ensure_foundation():
	ensure_institution_types()
	ensure_academic_patterns()
	ensure_programme_levels()


def prepare_foundation():
	"""Create dependencies referenced by DocType JSON before model sync."""
	remove_obsolete_modules()
	ensure_module_defs()
	ensure_roles()


def remove_obsolete_modules():
	"""Remove module metadata left by the pre-reset application before schema discovery."""
	for workspace in frappe.get_all("Workspace", filters={"module": ("in", OBSOLETE_MODULES)}, pluck="name"):
		frappe.delete_doc("Workspace", workspace, force=True, ignore_permissions=True)

	frappe.db.delete("Module Def", {"app_name": "erp", "module_name": ("in", OBSOLETE_MODULES)})

	for print_format in OBSOLETE_PRINT_FORMATS:
		if frappe.db.exists("Print Format", print_format):
			frappe.delete_doc("Print Format", print_format, force=True, ignore_permissions=True)

	for role in OBSOLETE_ROLES:
		if frappe.db.exists("Role", role):
			frappe.delete_doc("Role", role, force=True, ignore_permissions=True)


def ensure_roles():
	for role in ROLES:
		if not frappe.db.exists("Role", role["role_name"]):
			frappe.get_doc({"doctype": "Role", **role}).insert(ignore_permissions=True)


def ensure_institution_types():
	for values in INSTITUTION_TYPES:
		standard_key = values["type_name"]
		if frappe.db.exists("Institution Type", {"standard_key": standard_key}):
			continue

		doc = frappe.get_doc(
			{
				"doctype": "Institution Type",
				**values,
				"is_standard": 1,
				"standard_key": standard_key,
			}
		)
		doc.flags.ignore_permissions = True
		doc.insert()


def ensure_academic_patterns():
	for values in ACADEMIC_PATTERNS:
		standard_key = values["pattern_code"]
		if frappe.db.exists("Academic Pattern", {"standard_key": standard_key}):
			continue

		doc = frappe.get_doc(
			{
				"doctype": "Academic Pattern",
				**values,
				"is_standard": 1,
				"standard_key": standard_key,
			}
		)
		doc.flags.ignore_permissions = True
		doc.insert()


def ensure_programme_levels():
	for values in PROGRAMME_LEVELS:
		standard_key = values["level_code"]
		existing = frappe.db.exists("Programme Level", {"standard_key": standard_key})
		existing = existing or frappe.db.exists("Programme Level", {"level_code": standard_key})
		existing = existing or frappe.db.exists("Programme Level", {"level_name": values["level_name"]})
		if existing:
			# Adopt matching legacy rows left from the pre-reset app instead of creating a
			# duplicate. This keeps existing Programme links valid through the reset.
			frappe.db.set_value(
				"Programme Level",
				existing,
				{
					"is_standard": 1,
					"standard_key": standard_key,
					"education_stage": values["education_stage"],
					"sequence": values["sequence"],
				},
				update_modified=False,
			)
			continue

		doc = frappe.get_doc(
			{
				"doctype": "Programme Level",
				**values,
				"is_standard": 1,
				"standard_key": standard_key,
			}
		)
		doc.flags.ignore_permissions = True
		doc.insert()
