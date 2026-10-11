# Copyright (c) 2026, Prithivi and contributors

import frappe
from frappe.tests import IntegrationTestCase

from erp.seed import ensure_foundation


class IntegrationTestInstitutionType(IntegrationTestCase):
	def test_foundation_seeds_the_supported_type_tree(self):
		ensure_foundation()
		self.assertEqual(
			frappe.db.get_value("Institution Type", "Engineering", "parent_institution_type"),
			"Professional",
		)
		self.assertTrue(frappe.db.get_value("Institution Type", "School", "is_standard"))

	def test_a_custom_type_can_be_added_without_code(self):
		doc = frappe.get_doc(
			{
				"doctype": "Institution Type",
				"type_name": "Test Dental",
				"parent_institution_type": "Professional",
			}
		).insert()
		self.assertEqual(doc.parent_institution_type, "Professional")

	def test_a_standard_type_cannot_be_deleted(self):
		with self.assertRaises(frappe.ValidationError):
			frappe.delete_doc("Institution Type", "Medical")
