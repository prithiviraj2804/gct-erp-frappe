# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

from erp.master.hierarchy import validate_same_parent


class Programme(Document):
	def validate(self):
		self.set_derived_level()
		self.validate_department()
		self.validate_hierarchy()

	def set_derived_level(self):
		"""Keep `programme_level` in step with the Degree when there is one.

		A college programme names a Degree and the level rides on it — `fetch_from` fills the
		field on the form, but the field is now editable (a school programme has no degree and
		must set the level by hand), so a hand-edit could otherwise drift from the Degree. When
		a Degree is present, re-derive from it and let the Degree win; when it is blank, the
		hand-entered level stands and `reqd` guarantees it is there.
		"""
		if self.degree:
			self.programme_level = frappe.db.get_value("Degree", self.degree, "programme_level")

	def validate_department(self):
		"""Require a Department for every college that is not a School.

		`department` is optional on the schema because a school may have none (PRODUCT.md), but
		a degree-awarding college always sits under one. The rule is enforced here rather than
		with a static `reqd` so it can turn on the college's type, and — like a real `reqd`
		field — is skipped under `ignore_mandatory`.
		"""
		if self.department or self.flags.ignore_mandatory:
			return

		college_type = frappe.db.get_value("College", self.college, "college_type") if self.college else None
		if college_type != "School":
			frappe.throw(
				_("Department is required for this college."),
				title=_("Department Required"),
			)

	def validate_hierarchy(self):
		"""Keep `college`, `institution`, `campus` and `department` on one branch of the tree.

		`department` is the hole: it is the one ancestry field a user picks freely, and the
		Link accepts any Department in the system — including one belonging to a different
		college, or a different institution altogether. A blank department (a school's) is
		nothing to reconcile and `validate_same_parent` passes it silently.

		`institution` and `campus` are `fetch_from` college and so are rewritten from it on
		every save, but that rewrite happens in `_validate_links`, which any caller can skip
		by setting `flags.ignore_links`. Assert them here rather than let the invariant rest
		on a JSON attribute nothing points at.
		"""
		validate_same_parent(self, "department", "college")
		validate_same_parent(self, "college", "institution", "campus")
