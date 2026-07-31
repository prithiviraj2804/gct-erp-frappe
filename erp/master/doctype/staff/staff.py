# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

from frappe.model.document import Document

from erp.master.hierarchy import validate_same_parent


class Staff(Document):
	def validate(self):
		self.validate_hierarchy()

	def validate_hierarchy(self):
		"""`institution` is picked by hand here, not fetched, so it can flatly contradict
		`college`. The Admission Gate Pass trusts a Staff record's `institution` to keep
		referrers inside one tenant, so this check is what makes that trust worth anything.
		"""
		validate_same_parent(self, "college", "institution")
