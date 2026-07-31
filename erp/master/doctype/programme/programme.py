# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

from frappe.model.document import Document

from erp.master.hierarchy import validate_same_parent


class Programme(Document):
	def validate(self):
		self.validate_hierarchy()

	def validate_hierarchy(self):
		"""Keep `college`, `institution`, `campus` and `department` on one branch of the tree.

		`department` is the hole: it is the one ancestry field a user picks freely, and the
		Link accepts any Department in the system — including one belonging to a different
		college, or a different institution altogether.

		`institution` and `campus` are `fetch_from` college and so are rewritten from it on
		every save, but that rewrite happens in `_validate_links`, which any caller can skip
		by setting `flags.ignore_links`. Assert them here rather than let the invariant rest
		on a JSON attribute nothing points at.
		"""
		validate_same_parent(self, "department", "college")
		validate_same_parent(self, "college", "institution", "campus")
