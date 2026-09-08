# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

from frappe.model.document import Document

from erp.master.hierarchy import validate_same_parent


class Department(Document):
	def validate(self):
		self.validate_hierarchy()

	def validate_hierarchy(self):
		"""`trust` is picked by hand here, not fetched, so it can flatly contradict
		`institution`. Programme trusts a Department's `institution` to place it in the tree, so
		this check is what makes that trust worth anything.
		"""
		validate_same_parent(self, "institution", "trust")
