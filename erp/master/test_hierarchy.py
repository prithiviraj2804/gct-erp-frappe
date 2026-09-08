# Copyright (c) 2026, Prithivi and Contributors
# See license.txt

"""Ancestry integrity across Trust → Campus → Institution → Department → Programme.

The rule under test is one rule, not four, so it lives in one module rather than being
split across the doctype test files: a document may only name ancestors that sit in its
own branch of the tree.

Fixtures build two complete, disjoint trust trees (A and B) so every test can reach
for a valid record and an alien one of the same doctype. They are created in `setUpClass`
and never committed — `IntegrationTestCase` rolls the connection back at class teardown.
"""

import frappe
from frappe.tests import IntegrationTestCase

from erp.master.hierarchy import HierarchyMismatchError

# Codes are prefixed `ZT` so they cannot collide with real master data on a dev site.
TRUST_A = "ZTA"
TRUST_B = "ZTB"
CAMPUS_A = "ZTA-MAIN"
CAMPUS_B = "ZTB-MAIN"
INSTITUTION_A = "ZTACOL"
INSTITUTION_B = "ZTBCOL"
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

		for code, name in ((TRUST_A, "Alpha Institute"), (TRUST_B, "Beta Institute")):
			frappe.get_doc({"doctype": "Trust", "trust_code": code, "trust_name": name}).insert()

		for trust in (TRUST_A, TRUST_B):
			frappe.get_doc(
				{
					"doctype": "Campus",
					"trust": trust,
					"campus_code": "MAIN",
					"campus_name": f"{trust} Main Campus",
				}
			).insert()

		for trust, campus, code in (
			(TRUST_A, CAMPUS_A, INSTITUTION_A),
			(TRUST_B, CAMPUS_B, INSTITUTION_B),
		):
			frappe.get_doc(
				{
					"doctype": "Institution",
					"trust": trust,
					"campus": campus,
					"institution_code": code,
					"institution_name": f"{code} Institution",
				}
			).insert()

		for trust, institution, code in (
			(TRUST_A, INSTITUTION_A, "CSE"),
			(TRUST_B, INSTITUTION_B, "MEC"),
		):
			frappe.get_doc(
				{
					"doctype": "Department",
					"trust": trust,
					"institution": institution,
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

		for trust in (TRUST_A, TRUST_B):
			frappe.get_doc(
				{
					"doctype": "Academic Year",
					"trust": trust,
					"year_code": "2030-31",
					"title": f"{trust} 2030-31",
					"start_date": "2030-06-01",
					"end_date": "2031-05-31",
				}
			).insert()

	@staticmethod
	def make_programme(code, **overrides):
		values = {
			"doctype": "Programme",
			"institution": INSTITUTION_A,
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

	def test_rejects_department_from_another_institution(self):
		"""The reported bug: a department sitting in a different institution than the record."""
		programme = self.make_programme("CROSS", department=DEPARTMENT_B)

		with self.assertRaises(HierarchyMismatchError):
			programme.insert()

	def test_rejects_department_moved_to_another_institution_on_update(self):
		"""The hole has to close on update too, not just on insert."""
		programme = self.make_programme("MOVED")
		programme.insert()

		programme.department = DEPARTMENT_B
		with self.assertRaises(HierarchyMismatchError):
			programme.save()

	def test_accepts_department_from_its_own_institution(self):
		programme = self.make_programme("VALID")
		programme.insert()

		# ... and the ancestry columns agree with the institution they were derived from.
		self.assertEqual(programme.trust, TRUST_A)
		self.assertEqual(programme.campus, CAMPUS_A)

	def test_rejects_forced_trust_when_link_fetching_is_skipped(self):
		"""`trust` is `fetch_from` institution, which normally rewrites any hostile value —
		but `flags.ignore_links` skips that rewrite, so the controller must catch it."""
		programme = self.make_programme("FORCEDINST", trust=TRUST_B)
		programme.flags.ignore_links = True

		with self.assertRaises(HierarchyMismatchError):
			programme.insert()

	def test_rejects_forced_campus_when_link_fetching_is_skipped(self):
		programme = self.make_programme("FORCEDCAMP", trust=TRUST_A, campus=CAMPUS_B)
		programme.flags.ignore_links = True

		with self.assertRaises(HierarchyMismatchError):
			programme.insert()

	def test_fetch_from_still_repairs_a_hostile_trust_and_campus(self):
		"""Normal path: the framework rewrites both from the institution before validate runs."""
		programme = self.make_programme("REPAIRED", trust=TRUST_B, campus=CAMPUS_B)
		programme.insert()

		self.assertEqual(programme.trust, TRUST_A)
		self.assertEqual(programme.campus, CAMPUS_A)

	# --- Department: what Programme's check rests on --------------------------------

	def test_department_rejects_institution_from_another_trust(self):
		department = frappe.get_doc(
			{
				"doctype": "Department",
				"trust": TRUST_B,
				"institution": INSTITUTION_A,
				"department_code": "XDEP",
				"department_name": "Cross Department",
			}
		)

		with self.assertRaises(HierarchyMismatchError):
			department.insert()

	def test_department_accepts_institution_from_its_own_trust(self):
		frappe.get_doc(
			{
				"doctype": "Department",
				"trust": TRUST_A,
				"institution": INSTITUTION_A,
				"department_code": "OKDEP",
				"department_name": "Same Trust Department",
			}
		).insert()

	# --- Institution: where Programme's campus comes from -------------------------------

	def test_institution_rejects_campus_from_another_trust(self):
		institution = frappe.get_doc(
			{
				"doctype": "Institution",
				"trust": TRUST_A,
				"campus": CAMPUS_B,
				"institution_code": "ZTXCOL",
				"institution_name": "Cross Campus Institution",
			}
		)

		with self.assertRaises(HierarchyMismatchError):
			institution.insert()

	def test_institution_accepts_a_blank_campus(self):
		"""Campus is optional — an omission is not a contradiction."""
		frappe.get_doc(
			{
				"doctype": "Institution",
				"trust": TRUST_A,
				"institution_code": "ZTNOCAMP",
				"institution_name": "Single Location Institution",
			}
		).insert()

	# --- Programme Intake: the seat count downstream --------------------------------

	def test_intake_rejects_academic_year_from_another_trust(self):
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

	def test_intake_accepts_academic_year_from_its_own_trust(self):
		programme = self.make_programme("INTAKEOK")
		programme.insert()

		intake = frappe.get_doc(
			{
				"doctype": "Programme Intake",
				"academic_year": YEAR_A,
				"programme": programme.name,
				"total_seats": 60,
				# Mandatory since the application-fee slice; the sibling test above never reached the
				# mandatory check because the hierarchy error fires first.
				"application_fee": 500,
			}
		)
		intake.insert()

		self.assertEqual(intake.trust, TRUST_A)
		self.assertEqual(intake.institution, INSTITUTION_A)
