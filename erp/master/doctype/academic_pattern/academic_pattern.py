# Copyright (c) 2026, Prithivi and contributors

import frappe
from frappe import _
from frappe.model.document import Document


class AcademicPattern(Document):
	"""A global, reusable academic cycle definition."""

	def on_trash(self):
		if self.is_standard:
			frappe.throw(
				_("{0} ships with the app and cannot be deleted. Edit it instead.").format(
					frappe.bold(self.name)
				),
				title=_("Standard Academic Pattern"),
			)

		if frappe.db.exists("Programme", {"academic_pattern": self.name}):
			frappe.throw(
				_("{0} is in use by a Programme and cannot be deleted.").format(frappe.bold(self.name)),
				title=_("Academic Pattern In Use"),
			)
