# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class AdmissionType(Document):
	def validate(self):
		self.validate_entry_semester()

	def validate_entry_semester(self):
		if self.default_entry_semester is not None and self.default_entry_semester < 1:
			frappe.throw(_("Default Entry Semester must be 1 or greater."))
