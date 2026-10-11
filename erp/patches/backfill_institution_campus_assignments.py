import frappe
from frappe.utils import getdate


def execute():
	"""Preserve every legacy Institution.campus link as its first primary assignment."""
	if not frappe.db.has_column("Institution", "campus"):
		return

	legacy_assignments = frappe.db.sql(
		"""
		select name as institution, campus, creation
		from `tabInstitution`
		where campus is not null and campus != ''
		""",
		as_dict=True,
	)

	for legacy in legacy_assignments:
		if frappe.db.exists(
			"Institution Campus Assignment",
			{"institution": legacy.institution, "campus": legacy.campus},
		):
			continue

		frappe.get_doc(
			{
				"doctype": "Institution Campus Assignment",
				"institution": legacy.institution,
				"campus": legacy.campus,
				"assignment_type": "Main",
				"is_primary": 1,
				"effective_from": getdate(legacy.creation),
				"status": "Active",
			}
		).insert(ignore_permissions=True)
