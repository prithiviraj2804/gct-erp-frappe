# Copyright (c) 2026, Prithivi and contributors

import frappe
from frappe.tests import IntegrationTestCase

FOUNDATION_DOCTYPES = {
	"Academic Year",
	"Academic Pattern",
	"Campus",
	"Department",
	"Institution",
	"Institution Campus Assignment",
	"Institution Settings",
	"Institution Type",
	"Programme",
	"Programme Level",
	"Trust",
}


class IntegrationTestFoundation(IntegrationTestCase):
	def test_app_owns_only_the_phase_a_doctypes(self):
		owned = set(
			frappe.get_all(
				"DocType",
				filters={"module": ("in", frappe.get_module_list("erp"))},
				pluck="name",
			)
		)
		self.assertEqual(owned, FOUNDATION_DOCTYPES)

	def test_every_phase_a_doctype_has_a_uuid(self):
		for doctype in FOUNDATION_DOCTYPES:
			field = frappe.get_meta(doctype).get_field("id")
			self.assertIsNotNone(field, doctype)
			self.assertTrue(field.unique, doctype)
			self.assertTrue(field.read_only, doctype)
			self.assertTrue(field.no_copy, doctype)
