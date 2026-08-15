# Copyright (c) 2026, Prithivi and Contributors
# See license.txt

"""What an Admission Enquiry must record, refuse, and carry over from a gate pass.

Fixtures build two disjoint institutions (A and B) — each with a campus, college and
department — plus, under A, an undergraduate and a postgraduate programme, an open admission
year, and a lateral-entry admission type. That gives every test a legitimate record and an
alien one of the same doctype, and both a UG and a PG programme to exercise the
previous-education rules against.

Globals that are not this slice's to own (Programme Level, Degree, Academic Structure, the
Regular admission type) are reused if the site already has them and created otherwise, so the
suite runs on a bare site as well as a seeded one. Nothing is committed: IntegrationTestCase
rolls the connection back at class teardown.
"""

import itertools
import uuid

import frappe
from frappe.tests import IntegrationTestCase

from erp.master.hierarchy import HierarchyMismatchError

# `ZE` prefix keeps test codes clear of real master data on a dev site.
INSTITUTION_A = "ZEA"
INSTITUTION_B = "ZEB"
COLLEGE_A = "ZEACOL"
COLLEGE_B = "ZEBCOL"


class IntegrationTestAdmissionEnquiry(IntegrationTestCase):
	# Aadhaar is unique per institution per year and rows outlive one another (one rollback, at
	# class teardown), so the factory mints a fresh number per call; the dedup test pins its own.
	_aadhaar_counter = itertools.count(1)

	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		# --- Shared globals (reuse if present) ---
		cls.ensure("Programme Level", "UG", {"level_code": "UG", "level_name": "Undergraduate", "level_order": 1})
		cls.ensure("Programme Level", "PG", {"level_code": "PG", "level_name": "Postgraduate", "level_order": 0})
		cls.ug_degree = cls.ensure(
			"Degree", "ZEUGDEG", {"degree_code": "ZEUGDEG", "degree_name": "Test Bachelor", "programme_level": "UG"}
		)
		cls.pg_degree = cls.ensure(
			"Degree", "ZEPGDEG", {"degree_code": "ZEPGDEG", "degree_name": "Test Master", "programme_level": "PG"}
		)
		cls.structure = cls.ensure(
			"Academic Structure",
			"ZESEM",
			{"structure_code": "ZESEM", "structure_name": "Test Semester", "terms_per_year": 2, "term_label": "Semester"},
		)
		# Regular is seeded on real sites; recreate on a bare one. Lateral is this suite's own.
		cls.ensure(
			"Admission Type", "REG", {"type_code": "REG", "type_name": "Regular", "default_entry_semester": 1}
		)
		cls.lateral_type = cls.ensure(
			"Admission Type",
			"ZELAT",
			{"type_code": "ZELAT", "type_name": "Lateral (test)", "default_entry_semester": 3},
		)

		# --- Two disjoint institutions ---
		for code, name in ((INSTITUTION_A, "Alpha Institute"), (INSTITUTION_B, "Beta Institute")):
			frappe.get_doc({"doctype": "Institution", "institution_code": code, "institution_name": name}).insert()

		for institution, code in ((INSTITUTION_A, COLLEGE_A), (INSTITUTION_B, COLLEGE_B)):
			frappe.get_doc(
				{
					"doctype": "College",
					"institution": institution,
					"college_code": code,
					"college_name": f"{code} College",
				}
			).insert()

		cls.dept_a = cls.make_department(INSTITUTION_A, COLLEGE_A, "ZEACSE")
		cls.dept_b = cls.make_department(INSTITUTION_B, COLLEGE_B, "ZEBCSE")

		cls.programme_a_ug = cls.make_programme(COLLEGE_A, cls.dept_a, cls.ug_degree, "ZEAUG")
		cls.programme_a_pg = cls.make_programme(COLLEGE_A, cls.dept_a, cls.pg_degree, "ZEAPG")

		year_a = frappe.get_doc(
			{
				"doctype": "Academic Year",
				"institution": INSTITUTION_A,
				"year_code": "2030-31",
				"title": f"{INSTITUTION_A} 2030-31",
				"start_date": "2030-06-01",
				"end_date": "2031-05-31",
				"is_admission_open": 1,
			}
		)
		year_a.insert()
		cls.year_a = year_a.name

	# --- Fixture helpers ------------------------------------------------------------

	@staticmethod
	def ensure(doctype, name, values):
		if frappe.db.exists(doctype, name):
			return name
		return frappe.get_doc({"doctype": doctype, **values}).insert().name

	@staticmethod
	def make_department(institution, college, code):
		return frappe.get_doc(
			{
				"doctype": "Department",
				"institution": institution,
				"college": college,
				"department_code": code,
				"department_name": f"{code} Department",
			}
		).insert().name

	@classmethod
	def make_programme(cls, college, department, degree, code):
		return frappe.get_doc(
			{
				"doctype": "Programme",
				"college": college,
				"department": department,
				"degree": degree,
				"academic_structure": cls.structure,
				"programme_code": code,
				"programme_name": f"{code} Programme",
				"duration_years": 4,
				"total_terms": 8,
			}
		).insert().name

	@classmethod
	def make_enquiry(cls, **overrides):
		values = {
			"doctype": "Admission Enquiry",
			"student_name": "Arun Kumar",
			"phone_number": "9876543210",
			"college": COLLEGE_A,
			"department": cls.dept_a,
			"programme": cls.programme_a_ug,
			"admission_type": "REG",
			"previous_education": [
				{"qualification_level": "12th", "board_university": "State Board", "year_of_passing": 2029, "percentage": 92.0}
			],
		}
		values.update(overrides)
		return frappe.get_doc(values)

	# --- The happy path -------------------------------------------------------------

	def test_valid_enquiry_inserts(self):
		enquiry = self.make_enquiry(aadhaar_number=f"{next(self._aadhaar_counter):012d}")
		enquiry.insert()

		self.assertTrue(enquiry.name.startswith("AENQ-"), enquiry.name)
		self.assertEqual(str(uuid.UUID(enquiry.id)), enquiry.id)
		self.assertEqual(enquiry.status, "New")
		# Ancestors are re-derived from the college, and the year from the open admission cycle.
		self.assertEqual(enquiry.institution, INSTITUTION_A)
		self.assertEqual(enquiry.programme_level, "UG")
		self.assertEqual(enquiry.academic_year, self.year_a)
		# Child rows carry the UUID convention too.
		self.assertEqual(str(uuid.UUID(enquiry.previous_education[0].id)), enquiry.previous_education[0].id)

	def test_phone_number_is_normalised(self):
		enquiry = self.make_enquiry(phone_number="+91 98765 43210")
		enquiry.insert()
		self.assertEqual(enquiry.phone_number, "9876543210")

	# --- Previous-education rules ----------------------------------------------------

	def test_programme_with_no_education_rows_is_refused(self):
		enquiry = self.make_enquiry(previous_education=[])
		with self.assertRaises(frappe.ValidationError):
			enquiry.insert()

	def test_undergraduate_requires_a_twelfth_record(self):
		enquiry = self.make_enquiry(
			previous_education=[{"qualification_level": "10th", "board_university": "State Board"}]
		)
		with self.assertRaises(frappe.ValidationError):
			enquiry.insert()

	def test_postgraduate_requires_an_undergraduate_record(self):
		# A 12th record does not satisfy a PG programme — it wants a degree.
		with self.assertRaises(frappe.ValidationError):
			self.make_enquiry(
				programme=self.programme_a_pg,
				previous_education=[{"qualification_level": "12th", "board_university": "State Board"}],
			).insert()

		ok = self.make_enquiry(
			programme=self.programme_a_pg,
			previous_education=[{"qualification_level": "Undergraduate", "board_university": "Anna University"}],
		)
		ok.insert()
		self.assertEqual(ok.programme_level, "PG")

	def test_lateral_entry_requires_a_diploma(self):
		# A lateral entrant joins mid-programme on a diploma; a 12th record is not enough.
		with self.assertRaises(frappe.ValidationError):
			self.make_enquiry(
				admission_type=self.lateral_type,
				previous_education=[{"qualification_level": "12th", "board_university": "State Board"}],
			).insert()

		self.make_enquiry(
			admission_type=self.lateral_type,
			previous_education=[{"qualification_level": "Diploma", "board_university": "DOTE"}],
		).insert()

	# --- Tenant boundaries -----------------------------------------------------------

	def test_rejects_department_from_another_college(self):
		enquiry = self.make_enquiry(department=self.dept_b)
		with self.assertRaises(HierarchyMismatchError):
			enquiry.insert()

	# --- Duplicate detection ---------------------------------------------------------

	def test_rejects_a_second_enquiry_for_the_same_aadhaar_in_one_year(self):
		aadhaar = "123456789012"
		self.make_enquiry(aadhaar_number=aadhaar).insert()

		with self.assertRaises(frappe.ValidationError):
			self.make_enquiry(aadhaar_number=aadhaar).insert()

	# --- Start from a gate pass ------------------------------------------------------

	def test_start_from_gate_pass_prefills_and_is_idempotent(self):
		from erp.api.admission.enquiry import start_from_gate_pass

		gate_pass = frappe.get_doc(
			{
				"doctype": "Admission Gate Pass",
				"student_name": "Divya Ramesh",
				"phone_number": "9000011111",
				"aadhaar_number": f"{next(self._aadhaar_counter):012d}",
				"parent_name": "Ramesh K",
				"native_place": "Salem",
				"college": COLLEGE_A,
				"reference": "Direct Admission",
				"reference_staff_1": "Front Desk",
				"photo": "/private/files/ze-test.png",
				"in_time": "2030-06-01 09:00:00",
			}
		).insert()

		result = start_from_gate_pass(gate_pass.name)
		self.assertTrue(result["created"])

		enquiry = frappe.get_doc("Admission Enquiry", result["name"])
		self.assertEqual(enquiry.gate_pass, gate_pass.name)
		self.assertEqual(enquiry.student_name, "Divya Ramesh")
		self.assertEqual(enquiry.phone_number, "9000011111")
		self.assertEqual(enquiry.college, COLLEGE_A)
		self.assertEqual(enquiry.institution, INSTITUTION_A)
		self.assertEqual(enquiry.academic_year, self.year_a)
		self.assertEqual(enquiry.status, "New")

		# A second call returns the same enquiry rather than raising a duplicate.
		again = start_from_gate_pass(gate_pass.name)
		self.assertFalse(again["created"])
		self.assertEqual(again["name"], result["name"])

	def test_gate_pass_locks_aadhaar_and_reference(self):
		from erp.api.admission.enquiry import start_from_gate_pass

		aadhaar = f"{next(self._aadhaar_counter):012d}"
		gate_pass = frappe.get_doc(
			{
				"doctype": "Admission Gate Pass",
				"student_name": "Locked Case",
				"phone_number": "9000022222",
				"aadhaar_number": aadhaar,
				"parent_name": "Ravi K",
				"native_place": "Erode",
				"college": COLLEGE_A,
				"reference": "Direct Admission",
				"reference_staff_1": "Front Desk",
				"photo": "/private/files/ze-test.png",
				"in_time": "2030-06-01 09:00:00",
			}
		).insert()

		enquiry = frappe.get_doc("Admission Enquiry", start_from_gate_pass(gate_pass.name)["name"])
		self.assertEqual(enquiry.aadhaar_number, aadhaar)
		self.assertEqual(enquiry.reference, "Direct Admission")

		# The Aadhaar and reference are the gate desk's record, not editable: an attempt to rewrite
		# them is reverted to the pass on save. Name stays the counsellor's to correct.
		enquiry.aadhaar_number = "999999999999"
		enquiry.reference = "Staff Reference"
		enquiry.student_name = "Corrected Name"
		enquiry.department = self.dept_a
		enquiry.programme = self.programme_a_ug
		enquiry.admission_type = "REG"
		enquiry.append("previous_education", {"qualification_level": "12th", "board_university": "State Board"})
		enquiry.save()

		self.assertEqual(enquiry.aadhaar_number, aadhaar)
		self.assertEqual(enquiry.reference, "Direct Admission")
		self.assertEqual(enquiry.student_name, "Corrected Name")
