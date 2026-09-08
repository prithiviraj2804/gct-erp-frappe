# Copyright (c) 2026, Prithivi and Contributors
# See license.txt

"""What an Admission Enquiry must record, refuse, and carry over from a gate pass.

Fixtures build two disjoint trusts (A and B) — each with a campus, institution and
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
TRUST_A = "ZEA"
TRUST_B = "ZEB"
INSTITUTION_A = "ZEACOL"
INSTITUTION_B = "ZEBCOL"
INSTITUTION_SCHOOL = "ZESCH"


class IntegrationTestAdmissionEnquiry(IntegrationTestCase):
	# Aadhaar is unique per trust per year and rows outlive one another (one rollback, at
	# class teardown), so the factory mints a fresh number per call; the dedup test pins its own.
	_aadhaar_counter = itertools.count(1)

	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		# --- Shared globals (reuse if present) ---
		cls.ensure(
			"Programme Level", "UG", {"level_code": "UG", "level_name": "Undergraduate", "level_order": 1}
		)
		cls.ensure(
			"Programme Level", "PG", {"level_code": "PG", "level_name": "Postgraduate", "level_order": 0}
		)
		cls.ug_degree = cls.ensure(
			"Degree",
			"ZEUGDEG",
			{"degree_code": "ZEUGDEG", "degree_name": "Test Bachelor", "programme_level": "UG"},
		)
		cls.pg_degree = cls.ensure(
			"Degree",
			"ZEPGDEG",
			{"degree_code": "ZEPGDEG", "degree_name": "Test Master", "programme_level": "PG"},
		)
		cls.structure = cls.ensure(
			"Academic Structure",
			"ZESEM",
			{
				"structure_code": "ZESEM",
				"structure_name": "Test Semester",
				"terms_per_year": 2,
				"term_label": "Semester",
			},
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

		# --- Two disjoint trusts ---
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

		cls.dept_a = cls.make_department(TRUST_A, INSTITUTION_A, "ZEACSE")
		cls.dept_b = cls.make_department(TRUST_B, INSTITUTION_B, "ZEBCSE")

		cls.programme_a_ug = cls.make_programme(
			INSTITUTION_A, cls.dept_a, cls.ug_degree, "ZEAUG", required_prior_qualification="12th"
		)
		cls.programme_a_pg = cls.make_programme(
			INSTITUTION_A, cls.dept_a, cls.pg_degree, "ZEAPG", required_prior_qualification="Undergraduate"
		)

		# --- A school under A: no degree, no department, a school-flavoured level ---
		cls.ensure(
			"Programme Level", "SEC", {"level_code": "SEC", "level_name": "Secondary", "level_order": 3}
		)
		frappe.get_doc(
			{
				"doctype": "Institution",
				"trust": TRUST_A,
				"institution_code": INSTITUTION_SCHOOL,
				"institution_name": f"{INSTITUTION_SCHOOL} School",
				"institution_type": "School",
			}
		).insert()
		# Class 10 — an entry-level class here: no prior qualification is required, so it may be
		# admitted with an empty Previous Education table.
		cls.programme_class_10 = cls.make_programme(
			INSTITUTION_SCHOOL, None, None, "ZECL10", programme_level="SEC"
		)
		# Class 11 — asks for the Class-10 board result, expressed as a "10th" requirement.
		cls.programme_class_11 = cls.make_programme(
			INSTITUTION_SCHOOL,
			None,
			None,
			"ZECL11",
			programme_level="SEC",
			required_prior_qualification="10th",
		)

		year_a = frappe.get_doc(
			{
				"doctype": "Academic Year",
				"trust": TRUST_A,
				"year_code": "2030-31",
				"title": f"{TRUST_A} 2030-31",
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
	def make_department(trust, institution, code):
		return (
			frappe.get_doc(
				{
					"doctype": "Department",
					"trust": trust,
					"institution": institution,
					"department_code": code,
					"department_name": f"{code} Department",
				}
			)
			.insert()
			.name
		)

	@classmethod
	def make_programme(
		cls, institution, department, degree, code, programme_level=None, required_prior_qualification=None
	):
		# The previous-education requirement now rides on the Programme, and the migrate-time backfill
		# never touches a row a test mints in a rolled-back transaction — so the fixture states it.
		values = {
			"doctype": "Programme",
			"institution": institution,
			"department": department,
			"degree": degree,
			"academic_structure": cls.structure,
			"programme_code": code,
			"programme_name": f"{code} Programme",
			"duration_years": 4,
			"total_terms": 8,
			"required_prior_qualification": required_prior_qualification,
		}
		if programme_level:
			values["programme_level"] = programme_level
		return frappe.get_doc(values).insert().name

	@classmethod
	def make_enquiry(cls, **overrides):
		values = {
			"doctype": "Admission Enquiry",
			"student_name": "Arun Kumar",
			"phone_number": "9876543210",
			"institution": INSTITUTION_A,
			"department": cls.dept_a,
			"programme": cls.programme_a_ug,
			"admission_type": "REG",
			"previous_education": [
				{
					"qualification_level": "12th",
					"board_university": "State Board",
					"year_of_passing": 2029,
					"percentage": 92.0,
				}
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
		# Ancestors are re-derived from the institution, and the year from the open admission cycle.
		self.assertEqual(enquiry.trust, TRUST_A)
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
			previous_education=[
				{"qualification_level": "Undergraduate", "board_university": "Anna University"}
			],
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

	# --- School admission (same doctype, different words) ----------------------------

	def test_school_entry_class_admits_with_no_department_or_previous_education(self):
		# A Class 10 admission at a School institution: no department, and no prior qualification is
		# required, so an empty Previous Education table is fine — the institution rule does not apply.
		enquiry = self.make_enquiry(
			institution=INSTITUTION_SCHOOL,
			department=None,
			programme=self.programme_class_10,
			previous_education=[],
			aadhaar_number=f"{next(self._aadhaar_counter):012d}",
		)
		enquiry.insert()

		self.assertEqual(enquiry.trust, TRUST_A)
		self.assertFalse(enquiry.department)
		self.assertEqual(enquiry.programme_level, "SEC")

	def test_school_class_requiring_a_prior_result_is_enforced(self):
		# Class 11 asks for the Class-10 board result ("10th"); without it the enquiry is refused,
		# with it it saves — the requirement read straight off the Programme.
		with self.assertRaises(frappe.ValidationError):
			self.make_enquiry(
				institution=INSTITUTION_SCHOOL,
				department=None,
				programme=self.programme_class_11,
				previous_education=[],
			).insert()

		ok = self.make_enquiry(
			institution=INSTITUTION_SCHOOL,
			department=None,
			programme=self.programme_class_11,
			previous_education=[{"qualification_level": "10th", "board_university": "State Board"}],
			aadhaar_number=f"{next(self._aadhaar_counter):012d}",
		)
		ok.insert()

	def test_department_is_still_required_for_a_non_school_institution(self):
		# The department is optional only for schools; a degree-awarding institution without one is refused.
		with self.assertRaises(frappe.ValidationError):
			self.make_enquiry(department=None).insert()

	# --- Tenant boundaries -----------------------------------------------------------

	def test_rejects_department_from_another_institution(self):
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
				"institution": INSTITUTION_A,
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
		self.assertEqual(enquiry.institution, INSTITUTION_A)
		self.assertEqual(enquiry.trust, TRUST_A)
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
				"institution": INSTITUTION_A,
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
		enquiry.append(
			"previous_education", {"qualification_level": "12th", "board_university": "State Board"}
		)
		enquiry.save()

		self.assertEqual(enquiry.aadhaar_number, aadhaar)
		self.assertEqual(enquiry.reference, "Direct Admission")
		self.assertEqual(enquiry.student_name, "Corrected Name")


class IntegrationTestAdmissionEnquiryScoping(IntegrationTestCase):
	"""Slice 1 authorization: who sees, and who may reassign, a lead.

	A counsellor sees and touches only the enquiries they own; an Admission Manager sees every
	lead (narrowed to their trust by a User Permission); and the `counsellor` field is
	permlevel-locked so a counsellor cannot hand a lead to someone else. Own fixtures under a `ZP`
	prefix so this stands apart from the validation suite above — IntegrationTestCase rolls it all
	back at teardown, the Users and User Permissions included.
	"""

	INST_1 = "ZP1"
	INST_2 = "ZP2"
	COL_1 = "ZP1COL"

	COUNSELLOR_A = "ze-scope-counsellor-a@example.com"
	COUNSELLOR_B = "ze-scope-counsellor-b@example.com"
	MANAGER = "ze-scope-manager@example.com"

	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		# Aadhaar is unique per trust per year; a counter keeps every enquiry distinct across
		# the shared class transaction.
		cls._aadhaar = itertools.count(400000000001)

		cls.ensure(
			"Programme Level", "UG", {"level_code": "UG", "level_name": "Undergraduate", "level_order": 1}
		)
		degree = cls.ensure(
			"Degree",
			"ZPDEG",
			{"degree_code": "ZPDEG", "degree_name": "Scope Bachelor", "programme_level": "UG"},
		)
		structure = cls.ensure(
			"Academic Structure",
			"ZPSEM",
			{
				"structure_code": "ZPSEM",
				"structure_name": "Scope Semester",
				"terms_per_year": 2,
				"term_label": "Semester",
			},
		)
		cls.ensure(
			"Admission Type", "REG", {"type_code": "REG", "type_name": "Regular", "default_entry_semester": 1}
		)

		# Two trusts: the second only has to exist, as a User Permission target that proves an
		# trust-scoped manager sees none of the first trust's leads.
		for code, name in ((cls.INST_1, "Scope One"), (cls.INST_2, "Scope Two")):
			cls.ensure("Trust", code, {"trust_code": code, "trust_name": name})

		cls.ensure(
			"Institution",
			cls.COL_1,
			{
				"trust": cls.INST_1,
				"institution_code": cls.COL_1,
				"institution_name": "Scope Institution",
				"institution_type": "Engineering",
			},
		)
		cls.dept = (
			frappe.get_doc(
				{
					"doctype": "Department",
					"trust": cls.INST_1,
					"institution": cls.COL_1,
					"department_code": "ZP1DEP",
					"department_name": "Scope Dept",
				}
			)
			.insert()
			.name
		)
		cls.programme = (
			frappe.get_doc(
				{
					"doctype": "Programme",
					"institution": cls.COL_1,
					"department": cls.dept,
					"degree": degree,
					"academic_structure": structure,
					"programme_code": "ZP1UG",
					"programme_name": "Scope UG",
					"duration_years": 4,
					"total_terms": 8,
					"required_prior_qualification": "12th",
				}
			)
			.insert()
			.name
		)
		frappe.get_doc(
			{
				"doctype": "Academic Year",
				"trust": cls.INST_1,
				"year_code": "2040-41",
				"title": "Scope 2040-41",
				"start_date": "2040-06-01",
				"end_date": "2041-05-31",
				"is_admission_open": 1,
			}
		).insert()

		cls.staff_a = cls.make_counsellor("ZPCA", cls.COUNSELLOR_A)
		cls.staff_b = cls.make_counsellor("ZPCB", cls.COUNSELLOR_B)
		cls.grant_institution(cls.make_user(cls.MANAGER, "Admission Manager"), cls.COL_1)

		# Two owned leads and one still in the managers' pool.
		cls.e_a = cls.make_enquiry(cls.staff_a)
		cls.e_b = cls.make_enquiry(cls.staff_b)
		cls.e_unassigned = cls.make_enquiry(None)

	# --- Fixture helpers ------------------------------------------------------------

	@staticmethod
	def ensure(doctype, name, values):
		if frappe.db.exists(doctype, name):
			return name
		return frappe.get_doc({"doctype": doctype, **values}).insert().name

	@classmethod
	def grant_institution(cls, email, institution):
		"""Provision the Institution User Permission a real deployment would give this login.

		Tenancy fails closed, so a login with no Institution permission and no trust-wide role sees
		nothing at all. A counsellor gets this automatically from their Staff record
		(`Staff.sync_institution_permission`); a manager without a Staff row has to be granted it
		the way an administrator would.
		"""
		if not frappe.db.exists(
			"User Permission", {"user": email, "allow": "Institution", "for_value": institution}
		):
			frappe.get_doc(
				{
					"doctype": "User Permission",
					"user": email,
					"allow": "Institution",
					"for_value": institution,
					"apply_to_all_doctypes": 1,
				}
			).insert(ignore_permissions=True)
		return email

	@classmethod
	def make_user(cls, email, role):
		if frappe.db.exists("User", email):
			return email
		user = frappe.new_doc("User")
		user.email = email
		user.first_name = email.split("@")[0]
		user.append("roles", {"role": role})
		user.flags.no_welcome_mail = True
		user.insert(ignore_permissions=True)
		return email

	@classmethod
	def make_counsellor(cls, code, email):
		cls.make_user(email, "Admission Counsellor")
		return (
			frappe.get_doc(
				{
					"doctype": "Staff",
					"trust": cls.INST_1,
					"institution": cls.COL_1,
					"staff_code": code,
					"staff_name": code,
					"user": email,
				}
			)
			.insert()
			.name
		)

	@classmethod
	def make_enquiry(cls, counsellor):
		# Inserted as Administrator, who bypasses permlevel, so the fixture can set an owner directly.
		doc = frappe.get_doc(
			{
				"doctype": "Admission Enquiry",
				"student_name": f"Scope {counsellor or 'pool'}",
				"phone_number": "9876500000",
				"institution": cls.COL_1,
				"department": cls.dept,
				"programme": cls.programme,
				"admission_type": "REG",
				"aadhaar_number": f"{next(cls._aadhaar):012d}",
				"previous_education": [
					{
						"qualification_level": "12th",
						"board_university": "State Board",
						"year_of_passing": 2039,
						"percentage": 90.0,
					}
				],
			}
		)
		if counsellor:
			doc.counsellor = counsellor
		doc.insert()
		return doc.name

	def _visible_to(self, user):
		frappe.set_user(user)
		try:
			return set(frappe.get_list("Admission Enquiry", pluck="name"))
		finally:
			frappe.set_user("Administrator")

	# --- Row visibility --------------------------------------------------------------

	def test_counsellor_sees_only_their_own_leads(self):
		visible = self._visible_to(self.COUNSELLOR_A)
		self.assertIn(self.e_a, visible)
		self.assertNotIn(self.e_b, visible)
		self.assertNotIn(self.e_unassigned, visible)

	def test_other_counsellor_sees_only_their_own_leads(self):
		visible = self._visible_to(self.COUNSELLOR_B)
		self.assertIn(self.e_b, visible)
		self.assertNotIn(self.e_a, visible)

	def test_manager_sees_every_lead_including_the_unassigned_pool(self):
		visible = self._visible_to(self.MANAGER)
		self.assertLessEqual({self.e_a, self.e_b, self.e_unassigned}, visible)

	def test_counsellor_without_a_staff_record_fails_closed(self):
		# A login with the role but no Staff link sees nothing — never everything.
		lonely = self.make_user("ze-scope-lonely@example.com", "Admission Counsellor")
		self.assertEqual(self._visible_to(lonely), set())

	# --- Single-record access --------------------------------------------------------

	def test_counsellor_cannot_read_another_counsellors_lead(self):
		frappe.set_user(self.COUNSELLOR_A)
		try:
			self.assertTrue(frappe.has_permission("Admission Enquiry", "read", doc=self.e_a))
			self.assertFalse(frappe.has_permission("Admission Enquiry", "read", doc=self.e_b))
		finally:
			frappe.set_user("Administrator")

	# --- The permlevel lock on the owner field ---------------------------------------

	def test_counsellor_cannot_reassign_their_own_lead(self):
		target = self.make_enquiry(self.staff_a)
		frappe.set_user(self.COUNSELLOR_A)
		try:
			doc = frappe.get_doc("Admission Enquiry", target)
			doc.counsellor = self.staff_b  # attempt to hand the lead off
			doc.remarks = "counsellor edited this"
			doc.save()
		finally:
			frappe.set_user("Administrator")

		reloaded = frappe.get_doc("Admission Enquiry", target)
		self.assertEqual(reloaded.counsellor, self.staff_a)  # locked — reassignment ignored
		self.assertEqual(reloaded.remarks, "counsellor edited this")  # level-0 edit still saved

	def test_manager_can_assign_a_lead(self):
		target = self.make_enquiry(None)
		frappe.set_user(self.MANAGER)
		try:
			doc = frappe.get_doc("Admission Enquiry", target)
			doc.counsellor = self.staff_a
			doc.save()
		finally:
			frappe.set_user("Administrator")

		self.assertEqual(frappe.get_doc("Admission Enquiry", target).counsellor, self.staff_a)

	# --- Manager tenant isolation via User Permission --------------------------------

	def test_manager_scoped_to_another_trust_sees_no_leads_here(self):
		# The manager hook returns "" (all rows); a User Permission on Trust is what pins a
		# manager to their tenant. Scoped to INST_2, they see none of INST_1's leads.
		email = self.make_user("ze-scope-mgr-inst2@example.com", "Admission Manager")
		frappe.get_doc(
			{"doctype": "User Permission", "user": email, "allow": "Trust", "for_value": self.INST_2}
		).insert(ignore_permissions=True)

		visible = self._visible_to(email)
		self.assertNotIn(self.e_a, visible)
		self.assertNotIn(self.e_b, visible)
		self.assertNotIn(self.e_unassigned, visible)
