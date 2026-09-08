# Copyright (c) 2026, Prithivi and Contributors
# See license.txt

"""Staff is identity-only, so the one invariant worth testing is the tenancy one: a Staff
record may not name an institution outside the trust it claims.

Fixtures build two single-institution trusts so every test has a valid institution and an
alien one to reach for. They are created in `setUpClass` and never committed —
`IntegrationTestCase` rolls the connection back at class teardown.
"""

import uuid

import frappe
from frappe.tests import IntegrationTestCase

from erp.master.hierarchy import HierarchyMismatchError

# Codes are prefixed `ZS` so they cannot collide with real master data on a dev site.
TRUST_A = "ZSA"
TRUST_B = "ZSB"
INSTITUTION_A = "ZSACOL"
INSTITUTION_B = "ZSBCOL"


class IntegrationTestStaff(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		for code, name in ((TRUST_A, "Alpha Institute"), (TRUST_B, "Beta Institute")):
			frappe.get_doc({"doctype": "Trust", "trust_code": code, "trust_name": name}).insert()

		for trust, code in ((TRUST_A, INSTITUTION_A), (TRUST_B, INSTITUTION_B)):
			frappe.get_doc(
				{
					"doctype": "Institution",
					"trust": trust,
					"institution_code": code,
					"institution_name": f"{code} Institution",
					"institution_type": "Engineering",
				}
			).insert()

	@staticmethod
	def make_staff(code, **overrides):
		values = {
			"doctype": "Staff",
			"trust": TRUST_A,
			"institution": INSTITUTION_A,
			"staff_code": code,
			"staff_name": f"Staff {code}",
		}
		values.update(overrides)
		return frappe.get_doc(values)

	def test_rejects_institution_from_another_trust(self):
		staff = self.make_staff("CROSS", institution=INSTITUTION_B)

		with self.assertRaises(HierarchyMismatchError):
			staff.insert()

	def test_accepts_institution_from_its_own_trust(self):
		staff = self.make_staff("VALID")
		staff.insert()

		self.assertEqual(staff.name, f"{INSTITUTION_A}-VALID")

	def test_id_is_populated_with_a_uuid(self):
		staff = self.make_staff("UUID")
		staff.insert()

		self.assertTrue(staff.id)
		# Round-tripping through `UUID` is the assertion — it throws on anything that isn't one.
		self.assertEqual(str(uuid.UUID(staff.id)), staff.id)
