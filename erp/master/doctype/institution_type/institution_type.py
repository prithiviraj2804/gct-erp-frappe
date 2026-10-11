# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils.nestedset import NestedSet


class InstitutionType(NestedSet):
	"""A configurable hierarchy of institution kinds."""

	nsm_parent_field = "parent_institution_type"

	def on_update(self):
		super().on_update()

	def on_trash(self):
		self.assert_not_standard()
		self.assert_unused()
		super().on_trash()

	def assert_not_standard(self):
		if self.is_standard:
			frappe.throw(
				_("{0} ships with the app and cannot be deleted. Edit it instead.").format(
					frappe.bold(self.name)
				),
				title=_("Standard Institution Type"),
			)

	def assert_unused(self):
		institutions = frappe.get_all("Institution", filters={"institution_type": self.name}, pluck="name")
		if institutions:
			frappe.throw(
				_("{0} is in use by {1}.").format(
					frappe.bold(self.name), frappe.bold(", ".join(institutions))
				),
				title=_("Institution Type In Use"),
			)
