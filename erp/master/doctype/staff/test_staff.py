# Copyright (c) 2026, Prithivi and Contributors
# See license.txt

"""Staff is identity-only, so the one invariant worth testing is the tenancy one: a Staff
record may not name a college outside the institution it claims.

Fixtures build two single-college institutions so every test has a valid college and an
alien one to reach for. They are created in `setUpClass` and never committed —
`IntegrationTestCase` rolls the connection back at class teardown.
"""

import uuid

import frappe
from frappe.tests import IntegrationTestCase

from erp.master.hierarchy import HierarchyMismatchError

# Codes are prefixed `ZS` so they cannot collide with real master data on a dev site.
INSTITUTION_A = "ZSA"
INSTITUTION_B = "ZSB"
COLLEGE_A = "ZSACOL"
COLLEGE_B = "ZSBCOL"


class IntegrationTestStaff(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		for code, name in ((INSTITUTION_A, "Alpha Institute"), (INSTITUTION_B, "Beta Institute")):
			frappe.get_doc(
				{"doctype": "Institution", "institution_code": code, "institution_name": name}
			).insert()

		for institution, code in ((INSTITUTION_A, COLLEGE_A), (INSTITUTION_B, COLLEGE_B)):
			frappe.get_doc(
				{
					"doctype": "College",
					"institution": institution,
					"college_code": code,
					"college_name": f"{code} College",
				}
			).insert()

	@staticmethod
	def make_staff(code, **overrides):
		values = {
			"doctype": "Staff",
			"institution": INSTITUTION_A,
			"college": COLLEGE_A,
			"staff_code": code,
			"staff_name": f"Staff {code}",
		}
		values.update(overrides)
		return frappe.get_doc(values)

	def test_rejects_college_from_another_institution(self):
		staff = self.make_staff("CROSS", college=COLLEGE_B)

		with self.assertRaises(HierarchyMismatchError):
			staff.insert()

	def test_accepts_college_from_its_own_institution(self):
		staff = self.make_staff("VALID")
		staff.insert()

		self.assertEqual(staff.name, f"{COLLEGE_A}-VALID")

	def test_id_is_populated_with_a_uuid(self):
		staff = self.make_staff("UUID")
		staff.insert()

		self.assertTrue(staff.id)
		# Round-tripping through `UUID` is the assertion — it throws on anything that isn't one.
		self.assertEqual(str(uuid.UUID(staff.id)), staff.id)
