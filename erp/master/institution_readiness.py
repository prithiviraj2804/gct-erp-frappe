# Copyright (c) 2026, Prithivi and contributors

import frappe
from frappe import _
from frappe.utils import getdate

from erp.master.hierarchy import inherit_parent_value, validate_same_parent


def validate_institution_scope(doc) -> None:
	inherit_parent_value(doc, "institution", "trust")
	validate_same_parent(doc, "institution", "trust")


def validate_academic_year_dates(doc) -> None:
	if not doc.start_date or not doc.end_date:
		return

	if getdate(doc.end_date) <= getdate(doc.start_date):
		frappe.throw(_("End Date must be after Start Date."))

	overlap = frappe.db.exists(
		"Academic Year",
		{
			"name": ("!=", doc.name or ""),
			"institution": doc.institution,
			"start_date": ("<=", doc.end_date),
			"end_date": (">=", doc.start_date),
		},
	)
	if overlap:
		frappe.throw(
			_("Academic Year overlaps with {0} for this Institution.").format(frappe.bold(overlap))
		)
