# Copyright (c) 2026, Prithivi and Contributors
# See license.txt

"""Ancestry integrity across Institution → Campus → College → Department → Programme.

The rule under test is one rule, not four, so it lives in one module rather than being
split across the doctype test files: a document may only name ancestors that sit in its
own branch of the tree.

Fixtures build two complete, disjoint institution trees (A and B) so every test can reach
for a valid record and an alien one of the same doctype. They are created in `setUpClass`
and never committed — `IntegrationTestCase` rolls the connection back at class teardown.
"""

import frappe
from frappe.tests import IntegrationTestCase

from erp.master.hierarchy import HierarchyMismatchError

# Codes are prefixed `ZT` so they cannot collide with real master data on a dev site.
INSTITUTION_A = "ZTA"
INSTITUTION_B = "ZTB"
CAMPUS_A = "ZTA-MAIN"
CAMPUS_B = "ZTB-MAIN"
COLLEGE_A = "ZTACOL"
COLLEGE_B = "ZTBCOL"
DEPARTMENT_A = "ZTACOL-CSE"
DEPARTMENT_B = "ZTBCOL-MEC"
DEGREE = "ZTBE"
STRUCTURE = "ZTSEM"
YEAR_A = "ZTA-2030-31"
YEAR_B = "ZTB-2030-31"


class IntegrationTestHierarchy(IntegrationTestCase):
	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		for code, name in ((INSTITUTION_A, "Alpha Institute"), (INSTITUTION_B, "Beta Institute")):
			frappe.get_doc(
				{"doctype": "Institution", "institution_code": code, "institution_name": name}
			).insert()

		for institution in (INSTITUTION_A, INSTITUTION_B):
			frappe.get_doc(
				{
					"doctype": "Campus",
					"institution": institution,
					"campus_code": "MAIN",
					"campus_name": f"{institution} Main Campus",
				}
			).insert()

		for institution, campus, code in (
			(INSTITUTION_A, CAMPUS_A, COLLEGE_A),
			(INSTITUTION_B, CAMPUS_B, COLLEGE_B),
		):
			frappe.get_doc(
				{
					"doctype": "College",
					"institution": institution,
					"campus": campus,
					"college_code": code,
					"college_name": f"{code} College",
				}
			).insert()

		for institution, college, code in (
			(INSTITUTION_A, COLLEGE_A, "CSE"),
			(INSTITUTION_B, COLLEGE_B, "MEC"),
		):
			frappe.get_doc(
				{
					"doctype": "Department",
					"institution": institution,
					"college": college,
					"department_code": code,
					"department_name": f"{code} Department",
				}
			).insert()

		frappe.get_doc(
			{"doctype": "Programme Level", "level_code": "ZTUG", "level_name": "Undergraduate"}
		).insert()
		frappe.get_doc(
			{
				"doctype": "Degree",
				"degree_code": DEGREE,
				"degree_name": "Bachelor of Engineering",
				"programme_level": "ZTUG",
			}
		).insert()
		frappe.get_doc(
			{
				"doctype": "Academic Structure",
				"structure_code": STRUCTURE,
				"structure_name": "Semester",
				"terms_per_year": 2,
				"term_label": "Semester",
			}
		).insert()

		for institution in (INSTITUTION_A, INSTITUTION_B):
			frappe.get_doc(
				{
					"doctype": "Academic Year",
					"institution": institution,
					"year_code": "2030-31",
					"title": f"{institution} 2030-31",
					"start_date": "2030-06-01",
					"end_date": "2031-05-31",
				}
			).insert()

	@staticmethod
	def make_programme(code, **overrides):
		values = {
			"doctype": "Programme",
			"college": COLLEGE_A,
			"department": DEPARTMENT_A,
			"programme_code": code,
			"programme_name": f"Programme {code}",
			"degree": DEGREE,
			"academic_structure": STRUCTURE,
			"duration_years": 4,
			"total_terms": 8,
		}
		values.update(overrides)
		return frappe.get_doc(values)

	# --- Programme: the reported bug ------------------------------------------------

	def test_rejects_department_from_another_college(self):
		"""The reported bug: a department sitting in a different college than the record."""
		programme = self.make_programme("CROSS", department=DEPARTMENT_B)

		with self.assertRaises(HierarchyMismatchError):
			programme.insert()

	def test_rejects_department_moved_to_another_college_on_update(self):
		"""The hole has to close on update too, not just on insert."""
		programme = self.make_programme("MOVED")
		programme.insert()

		programme.department = DEPARTMENT_B
		with self.assertRaises(HierarchyMismatchError):
			programme.save()

	def test_accepts_department_from_its_own_college(self):
		programme = self.make_programme("VALID")
		programme.insert()

		# ... and the ancestry columns agree with the college they were derived from.
		self.assertEqual(programme.institution, INSTITUTION_A)
		self.assertEqual(programme.campus, CAMPUS_A)

	def test_rejects_forced_institution_when_link_fetching_is_skipped(self):
		"""`institution` is `fetch_from` college, which normally rewrites any hostile value —
		but `flags.ignore_links` skips that rewrite, so the controller must catch it."""
		programme = self.make_programme("FORCEDINST", institution=INSTITUTION_B)
		programme.flags.ignore_links = True

		with self.assertRaises(HierarchyMismatchError):
			programme.insert()

	def test_rejects_forced_campus_when_link_fetching_is_skipped(self):
		programme = self.make_programme("FORCEDCAMP", institution=INSTITUTION_A, campus=CAMPUS_B)
		programme.flags.ignore_links = True

		with self.assertRaises(HierarchyMismatchError):
			programme.insert()

	def test_fetch_from_still_repairs_a_hostile_institution_and_campus(self):
		"""Normal path: the framework rewrites both from the college before validate runs."""
		programme = self.make_programme("REPAIRED", institution=INSTITUTION_B, campus=CAMPUS_B)
		programme.insert()

		self.assertEqual(programme.institution, INSTITUTION_A)
		self.assertEqual(programme.campus, CAMPUS_A)

	# --- Department: what Programme's check rests on --------------------------------

	def test_department_rejects_college_from_another_institution(self):
		department = frappe.get_doc(
			{
				"doctype": "Department",
				"institution": INSTITUTION_B,
				"college": COLLEGE_A,
				"department_code": "XDEP",
				"department_name": "Cross Department",
			}
		)

		with self.assertRaises(HierarchyMismatchError):
			department.insert()

	def test_department_accepts_college_from_its_own_institution(self):
		frappe.get_doc(
			{
				"doctype": "Department",
				"institution": INSTITUTION_A,
				"college": COLLEGE_A,
				"department_code": "OKDEP",
				"department_name": "Same Institution Department",
			}
		).insert()

	# --- College: where Programme's campus comes from -------------------------------

	def test_college_rejects_campus_from_another_institution(self):
		college = frappe.get_doc(
			{
				"doctype": "College",
				"institution": INSTITUTION_A,
				"campus": CAMPUS_B,
				"college_code": "ZTXCOL",
				"college_name": "Cross Campus College",
			}
		)

		with self.assertRaises(HierarchyMismatchError):
			college.insert()

	def test_college_accepts_a_blank_campus(self):
		"""Campus is optional — an omission is not a contradiction."""
		frappe.get_doc(
			{
				"doctype": "College",
				"institution": INSTITUTION_A,
				"college_code": "ZTNOCAMP",
				"college_name": "Single Location College",
			}
		).insert()

	# --- Programme Intake: the seat count downstream --------------------------------

	def test_intake_rejects_academic_year_from_another_institution(self):
		programme = self.make_programme("INTAKEX")
		programme.insert()

		intake = frappe.get_doc(
			{
				"doctype": "Programme Intake",
				"academic_year": YEAR_B,
				"programme": programme.name,
				"total_seats": 60,
			}
		)

		with self.assertRaises(HierarchyMismatchError):
			intake.insert()

	def test_intake_accepts_academic_year_from_its_own_institution(self):
		programme = self.make_programme("INTAKEOK")
		programme.insert()

		intake = frappe.get_doc(
			{
				"doctype": "Programme Intake",
				"academic_year": YEAR_A,
				"programme": programme.name,
				"total_seats": 60,
			}
		)
		intake.insert()

		self.assertEqual(intake.institution, INSTITUTION_A)
		self.assertEqual(intake.college, COLLEGE_A)
