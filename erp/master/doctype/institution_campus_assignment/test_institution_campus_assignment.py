# Copyright (c) 2026, Prithivi and contributors

import uuid

import frappe
from frappe.tests import IntegrationTestCase

from erp.master.hierarchy import HierarchyMismatchError


class IntegrationTestInstitutionCampusAssignment(IntegrationTestCase):
	def setUp(self):
		suffix = uuid.uuid4().hex[:8].upper()
		self.trust = frappe.get_doc(
			{"doctype": "Trust", "trust_code": f"T{suffix}", "trust_name": f"Test Trust {suffix}"}
		).insert()
		self.other_trust = frappe.get_doc(
			{
				"doctype": "Trust",
				"trust_code": f"O{suffix}",
				"trust_name": f"Other Trust {suffix}",
			}
		).insert()
		self.institution = frappe.get_doc(
			{
				"doctype": "Institution",
				"trust": self.trust.name,
				"institution_code": f"I{suffix}",
				"institution_name": f"Test Institution {suffix}",
				"institution_type": "Engineering",
			}
		).insert()
		self.campus_a = self._campus(self.trust.name, f"A{suffix}")
		self.campus_b = self._campus(self.trust.name, f"B{suffix}")
		self.other_campus = self._campus(self.other_trust.name, f"X{suffix}")

	def _campus(self, trust, code):
		return frappe.get_doc(
			{
				"doctype": "Campus",
				"trust": trust,
				"campus_code": code,
				"campus_name": f"Campus {code}",
			}
		).insert()

	def _assignment(self, campus, **values):
		return frappe.get_doc(
			{
				"doctype": "Institution Campus Assignment",
				"institution": self.institution.name,
				"campus": campus.name,
				"effective_from": "2026-06-01",
				**values,
			}
		)

	def test_institution_can_operate_on_multiple_campuses(self):
		primary = self._assignment(self.campus_a, assignment_type="Main", is_primary=1).insert()
		teaching = self._assignment(self.campus_b, assignment_type="Teaching").insert()

		self.assertEqual(primary.trust, self.trust.name)
		self.assertEqual(teaching.trust, self.trust.name)
		self.assertNotEqual(primary.name, teaching.name)

	def test_campus_must_belong_to_the_institution_trust(self):
		with self.assertRaises(HierarchyMismatchError):
			self._assignment(self.other_campus).insert()

	def test_effective_to_cannot_precede_effective_from(self):
		with self.assertRaises(frappe.ValidationError):
			self._assignment(self.campus_a, effective_to="2026-05-31").insert()

	def test_same_campus_period_cannot_overlap(self):
		self._assignment(self.campus_a, effective_to="2026-12-31").insert()

		with self.assertRaises(frappe.ValidationError):
			self._assignment(
				self.campus_a,
				effective_from="2026-12-01",
				effective_to="2027-05-31",
			).insert()

	def test_only_one_primary_campus_can_apply_at_a_time(self):
		self._assignment(
			self.campus_a,
			is_primary=1,
			effective_to="2026-12-31",
		).insert()

		with self.assertRaises(frappe.ValidationError):
			self._assignment(
				self.campus_b,
				is_primary=1,
				effective_from="2026-09-01",
			).insert()

	def test_non_overlapping_primary_assignments_are_allowed(self):
		self._assignment(
			self.campus_a,
			is_primary=1,
			effective_to="2026-12-31",
		).insert()
		later = self._assignment(
			self.campus_b,
			is_primary=1,
			effective_from="2027-01-01",
		).insert()

		self.assertTrue(later.name)

	def test_institution_admin_cannot_read_or_change_another_institutions_assignment(self):
		own_assignment = self._assignment(self.campus_a).insert()
		suffix = uuid.uuid4().hex[:8].upper()
		other_institution = frappe.get_doc(
			{
				"doctype": "Institution",
				"trust": self.trust.name,
				"institution_code": f"J{suffix}",
				"institution_name": f"Other Institution {suffix}",
				"institution_type": "Engineering",
			}
		).insert()
		other_assignment = frappe.get_doc(
			{
				"doctype": "Institution Campus Assignment",
				"institution": other_institution.name,
				"campus": self.campus_b.name,
				"effective_from": "2026-06-01",
			}
		).insert()
		user = frappe.get_doc(
			{
				"doctype": "User",
				"email": f"institution-admin-{suffix.lower()}@example.com",
				"first_name": "Institution Admin",
				"send_welcome_email": 0,
				"roles": [{"role": "Institution Admin"}],
			}
		).insert(ignore_permissions=True)
		frappe.get_doc(
			{
				"doctype": "User Permission",
				"user": user.name,
				"allow": "Institution",
				"for_value": self.institution.name,
			}
		).insert(ignore_permissions=True)

		try:
			frappe.set_user(user.name)
			frappe.flags.erp_allowed_institutions = {}
			visible = frappe.get_list("Institution Campus Assignment", pluck="name")
			self.assertIn(own_assignment.name, visible)
			self.assertNotIn(other_assignment.name, visible)
			self.assertFalse(other_assignment.has_permission("read"))

			other_assignment.assignment_type = "Research"
			with self.assertRaises(frappe.PermissionError):
				other_assignment.save()
		finally:
			frappe.set_user("Administrator")
			frappe.flags.erp_allowed_institutions = {}
