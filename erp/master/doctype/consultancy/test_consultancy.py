# Copyright (c) 2026, Prithivi and Contributors
# See license.txt

"""Consultancy: institution scoping and what the format naming buys.

A Consultancy has no ancestry to reconcile, so there is nothing here for
`test_hierarchy.py` to cover. What is worth pinning is the scoping of the code:
`consultancy_code` is deliberately not `unique`, so two institutions may reuse a code —
and within one institution they may not. The institution prefix in `autoname` covers only
half of that (inserts), so both halves are asserted here, including the edit that walks
straight past the naming.

Fixtures are created in `setUpClass` and never committed — `IntegrationTestCase` rolls the
connection back at class teardown.
"""

import uuid

import frappe
from frappe.tests import IntegrationTestCase

# Codes are prefixed `ZC` so they cannot collide with real master data on a dev site.
INSTITUTION_A = "ZCA"
INSTITUTION_B = "ZCB"


class IntegrationTestConsultancy(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		for code, name in ((INSTITUTION_A, "Gamma Institute"), (INSTITUTION_B, "Delta Institute")):
			frappe.get_doc(
				{"doctype": "Institution", "institution_code": code, "institution_name": name}
			).insert()

	@staticmethod
	def make_consultancy(code, **overrides):
		values = {
			"doctype": "Consultancy",
			"institution": INSTITUTION_A,
			"consultancy_code": code,
			"consultancy_name": f"{code} Educational Services",
			"contact_person": "Ravi Kumar",
			"mobile": "9876543210",
			"city": "Coimbatore",
			"state": "Tamil Nadu",
		}
		values.update(overrides)
		return frappe.get_doc(values)

	def test_inserts_with_the_expected_defaults(self):
		consultancy = self.make_consultancy("BRIGHT")
		consultancy.insert()

		self.assertTrue(frappe.db.exists("Consultancy", consultancy.name))
		self.assertEqual(consultancy.status, "Active")

	def test_name_is_the_institution_and_code(self):
		consultancy = self.make_consultancy("NAMED")
		consultancy.insert()

		self.assertEqual(consultancy.name, f"{INSTITUTION_A}-NAMED")

	def test_id_is_a_uuid(self):
		"""Filled by the global `before_insert` hook, not by this controller."""
		consultancy = self.make_consultancy("UUID")
		consultancy.insert()

		self.assertTrue(consultancy.id)
		# Parses or raises — asserts a real UUID rather than merely a non-empty string.
		uuid.UUID(consultancy.id)

	def test_two_institutions_may_share_a_consultancy_code(self):
		"""The point of the format naming: the code is unique per institution, not globally."""
		first = self.make_consultancy("SHARED")
		first.insert()

		second = self.make_consultancy("SHARED", institution=INSTITUTION_B)
		second.insert()

		self.assertEqual(first.name, f"{INSTITUTION_A}-SHARED")
		self.assertEqual(second.name, f"{INSTITUTION_B}-SHARED")
		# Both rows survive under one code — the assertion a `unique` constraint would break.
		self.assertTrue(frappe.db.exists("Consultancy", first.name))
		self.assertTrue(frappe.db.exists("Consultancy", second.name))

	def test_rejects_a_second_agency_with_the_same_code_in_one_institution(self):
		self.make_consultancy("TWICE").insert()

		duplicate = self.make_consultancy("TWICE")
		with self.assertRaises(frappe.ValidationError):
			duplicate.insert()

	def test_rejects_a_code_edited_onto_one_already_in_the_institution(self):
		"""The hole the format naming leaves open: `name` is computed once, so an edit to
		`consultancy_code` never re-collides with the key that was supposed to guard it."""
		self.make_consultancy("KEEP").insert()
		mover = self.make_consultancy("MOVE")
		mover.insert()

		mover.consultancy_code = "KEEP"
		with self.assertRaises(frappe.ValidationError):
			mover.save()
