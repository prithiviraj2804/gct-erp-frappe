# Copyright (c) 2026, Prithivi and contributors

import frappe
from frappe.tests import IntegrationTestCase

from erp.master.hierarchy import HierarchyMismatchError


class IntegrationTestHierarchy(IntegrationTestCase):
	def setUp(self):
		for trust in ("TEST-TRUST-A", "TEST-TRUST-B"):
			if not frappe.db.exists("Trust", trust):
				frappe.get_doc({"doctype": "Trust", "trust_code": trust, "trust_name": trust}).insert()

		for trust in ("TEST-TRUST-A", "TEST-TRUST-B"):
			name = f"{trust}-MAIN"
			if not frappe.db.exists("Campus", name):
				frappe.get_doc(
					{
						"doctype": "Campus",
						"trust": trust,
						"campus_code": "MAIN",
						"campus_name": f"{trust} Main Campus",
					}
				).insert()

	def test_institution_accepts_a_campus_from_its_trust(self):
		institution = frappe.get_doc(
			{
				"doctype": "Institution",
				"trust": "TEST-TRUST-A",
				"institution_code": "TEST-INST-A",
				"institution_name": "Test Institution A",
				"institution_type": "Engineering",
			}
		).insert()
		assignment = frappe.get_doc(
			{
				"doctype": "Institution Campus Assignment",
				"institution": institution.name,
				"campus": "TEST-TRUST-A-MAIN",
				"effective_from": "2026-01-01",
			}
		).insert()
		self.assertEqual(assignment.trust, "TEST-TRUST-A")

	def test_institution_rejects_a_campus_from_another_trust(self):
		institution = frappe.get_doc(
			{
				"doctype": "Institution",
				"trust": "TEST-TRUST-A",
				"institution_code": "TEST-INST-X",
				"institution_name": "Cross Trust Institution",
				"institution_type": "Engineering",
			}
		).insert()
		doc = frappe.get_doc(
			{
				"doctype": "Institution Campus Assignment",
				"institution": institution.name,
				"campus": "TEST-TRUST-B-MAIN",
				"effective_from": "2026-01-01",
			}
		)
		with self.assertRaises(HierarchyMismatchError):
			doc.insert()
