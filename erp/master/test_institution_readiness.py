import uuid

import frappe
from frappe.tests import IntegrationTestCase

from erp.master.hierarchy import HierarchyMismatchError


class IntegrationTestInstitutionReadiness(IntegrationTestCase):
	def setUp(self):
		suffix = uuid.uuid4().hex[:8].upper()
		self.trust = frappe.get_doc(
			{"doctype": "Trust", "trust_code": f"T{suffix}", "trust_name": f"Test Trust {suffix}"}
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
		self.campus = frappe.get_doc(
			{
				"doctype": "Campus",
				"trust": self.trust.name,
				"campus_code": f"C{suffix}",
				"campus_name": f"Test Campus {suffix}",
			}
		).insert()
		self.undergraduate_level = frappe.db.get_value(
			"Programme Level", {"standard_key": "UNDERGRADUATE"}
		)
		self.school_level = frappe.db.get_value("Programme Level", {"standard_key": "SCHOOL"})
		self.semester_pattern = frappe.db.get_value("Academic Pattern", {"standard_key": "SEMESTER"})
		self.annual_pattern = frappe.db.get_value("Academic Pattern", {"standard_key": "ANNUAL"})

	def test_complete_institution_readiness_journey(self):
		campus_assignment = frappe.get_doc(
			{
				"doctype": "Institution Campus Assignment",
				"institution": self.institution.name,
				"campus": self.campus.name,
				"assignment_type": "Main",
				"is_primary": 1,
				"effective_from": "2026-06-01",
			}
		).insert()
		year = frappe.get_doc(
			{
				"doctype": "Academic Year",
				"institution": self.institution.name,
				"academic_year_name": "2026-27",
				"start_date": "2026-06-01",
				"end_date": "2027-05-31",
				"status": "Active",
			}
		).insert()
		settings = frappe.get_doc(
			{
				"doctype": "Institution Settings",
				"institution": self.institution.name,
				"default_academic_year": year.name,
			}
		).insert()
		department = frappe.get_doc(
			{
				"doctype": "Department",
				"institution": self.institution.name,
				"department_code": "CSE",
				"department_name": "Computer Science and Engineering",
			}
		).insert()
		programme = frappe.get_doc(
			{
				"doctype": "Programme",
				"institution": self.institution.name,
				"department": department.name,
				"programme_code": "BE-CSE",
				"programme_name": "B.E. Computer Science and Engineering",
				"programme_level": self.undergraduate_level,
				"academic_pattern": self.semester_pattern,
				"duration": 4,
			}
		).insert()

		for doc in (campus_assignment, year, settings, department, programme):
			self.assertEqual(doc.trust, self.trust.name)
			self.assertTrue(doc.id)

	def test_academic_year_cannot_overlap(self):
		frappe.get_doc(
			{
				"doctype": "Academic Year",
				"institution": self.institution.name,
				"academic_year_name": "2026-27",
				"start_date": "2026-06-01",
				"end_date": "2027-05-31",
			}
		).insert()
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc(
				{
					"doctype": "Academic Year",
					"institution": self.institution.name,
					"academic_year_name": "Overlap",
					"start_date": "2027-01-01",
					"end_date": "2027-12-31",
				}
			).insert()

	def test_department_codes_are_unique_inside_an_institution(self):
		frappe.get_doc(
			{
				"doctype": "Department",
				"institution": self.institution.name,
				"department_code": "CSE",
				"department_name": "Computer Science",
			}
		).insert()
		with self.assertRaises(frappe.DuplicateEntryError):
			frappe.get_doc(
				{
					"doctype": "Department",
					"institution": self.institution.name,
					"department_code": "CSE",
					"department_name": "Duplicate Code",
				}
			).insert()

	def test_school_programme_does_not_require_a_department(self):
		programme = frappe.get_doc(
			{
				"doctype": "Programme",
				"institution": self.institution.name,
				"programme_code": "GRADE-10",
				"programme_name": "Grade 10",
				"programme_level": self.school_level,
				"academic_pattern": self.annual_pattern,
				"duration": 1,
				"education_pattern": "Annual",
			}
		).insert()
		self.assertFalse(programme.department)

	def test_programme_rejects_department_from_another_institution(self):
		suffix = uuid.uuid4().hex[:8].upper()
		other = frappe.get_doc(
			{
				"doctype": "Institution",
				"trust": self.trust.name,
				"institution_code": f"I{suffix}",
				"institution_name": f"Other Institution {suffix}",
				"institution_type": "Engineering",
			}
		).insert()
		department = frappe.get_doc(
			{
				"doctype": "Department",
				"institution": other.name,
				"department_code": "CSE",
				"department_name": "Computer Science",
			}
		).insert()
		with self.assertRaises(HierarchyMismatchError):
			frappe.get_doc(
				{
					"doctype": "Programme",
					"institution": self.institution.name,
					"department": department.name,
					"programme_code": "INVALID",
					"programme_name": "Invalid Programme",
					"programme_level": self.undergraduate_level,
					"academic_pattern": self.semester_pattern,
					"duration": 4,
				}
			).insert()
