# Copyright (c) 2026, Prithivi and Contributors
# See license.txt

"""What a Programme must accept and derive across an institution and a school.

An institution programme names a Degree and rides its level; a school programme has no Degree and no
department and states its level by hand. Fixtures give both a School institution and an ordinary one so
the department-required rule can be exercised from each side. Globals not this test's to own
(Programme Level, Degree, Academic Structure) are reused if present and created otherwise, so the
suite runs on a bare site as well as a seeded one.
"""

import frappe
from frappe.tests import IntegrationTestCase

# On IntegrationTestCase, the doctype test records and all
# link-field test record dependencies are recursively loaded
# Use these module variables to add/remove to/from that list
EXTRA_TEST_RECORD_DEPENDENCIES = []  # eg. ["User"]
IGNORE_TEST_RECORD_DEPENDENCIES = []  # eg. ["User"]

TRUST = "ZPINST"
INSTITUTION = "ZPCOL"
SCHOOL = "ZPSCH"


class IntegrationTestProgramme(IntegrationTestCase):
	"""Integration tests for Programme."""

	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.ensure(
			"Programme Level", "UG", {"level_code": "UG", "level_name": "Undergraduate", "level_order": 1}
		)
		cls.ensure(
			"Programme Level", "SEC", {"level_code": "SEC", "level_name": "Secondary", "level_order": 3}
		)
		cls.degree = cls.ensure(
			"Degree",
			"ZPDEG",
			{"degree_code": "ZPDEG", "degree_name": "Test Bachelor", "programme_level": "UG"},
		)
		cls.structure = cls.ensure(
			"Academic Structure",
			"ZPSEM",
			{
				"structure_code": "ZPSEM",
				"structure_name": "Test Semester",
				"terms_per_year": 2,
				"term_label": "Semester",
			},
		)

		frappe.get_doc({"doctype": "Trust", "trust_code": TRUST, "trust_name": "Prog Institute"}).insert()
		for code, institution_type in ((INSTITUTION, "Engineering"), (SCHOOL, "School")):
			frappe.get_doc(
				{
					"doctype": "Institution",
					"trust": TRUST,
					"institution_code": code,
					"institution_name": f"{code} Institution",
					"institution_type": institution_type,
				}
			).insert()
		cls.department = (
			frappe.get_doc(
				{
					"doctype": "Department",
					"trust": TRUST,
					"institution": INSTITUTION,
					"department_code": "ZPCSE",
					"department_name": "ZPCSE Department",
				}
			)
			.insert()
			.name
		)

	@staticmethod
	def ensure(doctype, name, values):
		if frappe.db.exists(doctype, name):
			return name
		return frappe.get_doc({"doctype": doctype, **values}).insert().name

	def make_programme(self, **overrides):
		values = {
			"doctype": "Programme",
			"institution": INSTITUTION,
			"department": self.department,
			"degree": self.degree,
			"academic_structure": self.structure,
			"programme_code": "ZPP",
			"programme_name": "ZPP Programme",
			"duration_years": 4,
			"total_terms": 8,
		}
		values.update(overrides)
		return frappe.get_doc(values)

	def test_institution_programme_derives_level_from_degree(self):
		programme = self.make_programme(programme_code="ZPPUG")
		programme.insert()
		self.assertEqual(programme.programme_level, "UG")

	def test_degree_overrides_a_hand_entered_level(self):
		# The level is editable now, but a Degree still wins — it is re-derived on save.
		programme = self.make_programme(programme_code="ZPPDRIFT", programme_level="SEC")
		programme.insert()
		self.assertEqual(programme.programme_level, "UG")

	def test_school_programme_needs_no_degree_or_department(self):
		programme = self.make_programme(
			institution=SCHOOL,
			department=None,
			degree=None,
			programme_level="SEC",
			programme_code="ZPCL10",
			programme_name="Class 10",
		)
		programme.insert()
		self.assertEqual(programme.programme_level, "SEC")
		self.assertFalse(programme.degree)
		self.assertFalse(programme.department)

	def test_non_school_programme_requires_a_department(self):
		with self.assertRaises(frappe.ValidationError):
			self.make_programme(department=None, programme_code="ZPPNODEPT").insert()
