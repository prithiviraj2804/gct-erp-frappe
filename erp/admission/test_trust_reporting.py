# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""The trust's view of numbers, and the institution's view of the same numbers.

A trust runs institutions that each admit differently — different forms, different rules, different
vocabulary. What the trust needs back from all that variation is one comparable set of counts. So
the configuration layer is deliberately bounded: an institution may change its *process*, never the
columns a rollup reads.

These tests hold both halves of that: the same report answers "all institutions" and "mine"
depending only on who runs it, and a policy cannot govern a field the rollup depends on.
"""

import frappe
from frappe.tests import IntegrationTestCase

from erp.admission.report.admission_funnel.admission_funnel import execute
from erp.api.permission import institution_sql_clause


class IntegrationTestTrustReporting(IntegrationTestCase):
	TRUST = "ZR1"
	SCHOOL = "ZRSCH"
	ENGG = "ZRENG"

	TRUST_ADMIN = "zr-trust-admin@example.com"
	SCHOOL_ADMIN = "zr-school-admin@example.com"

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.ensure("Trust", cls.TRUST, {"trust_code": cls.TRUST, "trust_name": "Reporting Trust"})
		cls.ensure(
			"Admission Type",
			"ZRREG",
			{"type_code": "ZRREG", "type_name": "Regular", "default_entry_semester": 1},
		)
		for code, itype in ((cls.SCHOOL, "School"), (cls.ENGG, "Engineering")):
			cls.ensure(
				"Institution",
				code,
				{
					"trust": cls.TRUST,
					"institution_code": code,
					"institution_name": f"{code} Institution",
					"institution_type": itype,
				},
			)
		cls.dept = cls.ensure(
			"Department",
			f"{cls.ENGG}-ZRCSE",
			{
				"trust": cls.TRUST,
				"institution": cls.ENGG,
				"department_code": "ZRCSE",
				"department_name": "Computer Science",
			},
		)
		cls.school_programme = cls.make_programme(cls.SCHOOL, None, "ZRVI")
		cls.engg_programme = cls.make_programme(cls.ENGG, cls.dept, "ZRBE")

		# Two enquiries at the school, three at the engineering college.
		for _ in range(2):
			cls.make_enquiry(cls.SCHOOL, cls.school_programme)
		for _ in range(3):
			cls.make_enquiry(cls.ENGG, cls.engg_programme)

		cls.make_user(cls.TRUST_ADMIN, ["Trust Admin", "Admission Manager"])
		cls.make_user(cls.SCHOOL_ADMIN, ["Institution Admin", "Admission Manager"])
		cls.grant(cls.SCHOOL_ADMIN, cls.SCHOOL)

	# --- Fixtures ---------------------------------------------------------------------

	@staticmethod
	def ensure(doctype, name, values):
		if frappe.db.exists(doctype, name):
			return name
		return frappe.get_doc({"doctype": doctype, **values}).insert(ignore_permissions=True).name

	@classmethod
	def make_programme(cls, institution, department, code):
		name = f"{institution}-{code}"
		if frappe.db.exists("Programme", name):
			return name
		values = {
			"doctype": "Programme",
			"trust": cls.TRUST,
			"institution": institution,
			"programme_code": code,
			"programme_name": f"Programme {code}",
			"programme_level": "UG",
			"academic_structure": "SEM",
			"duration_years": 1,
			"total_terms": 2,
		}
		if department:
			values["department"] = department
		return frappe.get_doc(values).insert(ignore_permissions=True).name

	@classmethod
	def make_enquiry(cls, institution, programme):
		values = {
			"doctype": "Admission Enquiry",
			"student_name": "Rollup Probe",
			"phone_number": "9876500002",
			"institution": institution,
			"programme": programme,
			"admission_type": "ZRREG",
		}
		if institution == cls.ENGG:
			values["department"] = cls.dept
		return frappe.get_doc(values).insert(ignore_permissions=True).name

	@classmethod
	def make_user(cls, email, roles):
		if frappe.db.exists("User", email):
			return email
		user = frappe.new_doc("User")
		user.email = email
		user.first_name = email.split("@")[0]
		for role in roles:
			user.append("roles", {"role": role})
		user.flags.no_welcome_mail = True
		user.insert(ignore_permissions=True)
		return email

	@classmethod
	def grant(cls, email, institution):
		frappe.get_doc(
			{
				"doctype": "User Permission",
				"user": email,
				"allow": "Institution",
				"for_value": institution,
				"apply_to_all_doctypes": 1,
			}
		).insert(ignore_permissions=True)

	def run_report_as(self, user):
		frappe.set_user(user)
		try:
			_columns, data = execute({})
			return {row["institution"]: row for row in data}
		finally:
			frappe.set_user("Administrator")

	# --- The trust's view -------------------------------------------------------------

	def test_a_trust_admin_sees_every_institution_and_the_total(self):
		rows = self.run_report_as(self.TRUST_ADMIN)

		self.assertIn(self.SCHOOL, rows)
		self.assertIn(self.ENGG, rows)
		self.assertEqual(rows[self.SCHOOL]["enquiries"], 2)
		self.assertEqual(rows[self.ENGG]["enquiries"], 3)
		self.assertEqual(rows["Total"]["enquiries"], 5)

	def test_an_institution_admin_sees_only_their_own(self):
		"""The same report, the same code path. What differs is only who is asking."""
		rows = self.run_report_as(self.SCHOOL_ADMIN)

		self.assertIn(self.SCHOOL, rows)
		self.assertNotIn(self.ENGG, rows)
		self.assertEqual(rows[self.SCHOOL]["enquiries"], 2)

	def test_the_total_a_scoped_login_sees_is_their_own_total(self):
		"""A total that quietly included institutions the reader cannot see would be a leak of
		exactly the number they are not allowed to know."""
		rows = self.run_report_as(self.SCHOOL_ADMIN)
		self.assertEqual(rows["Total"]["enquiries"], 2)

	def test_institutions_of_different_kinds_stay_comparable(self):
		"""The school and the engineering college collect different fields — that is the point of
		Field Policy — and are still counted side by side in one table."""
		rows = self.run_report_as(self.TRUST_ADMIN)
		self.assertEqual(rows[self.SCHOOL]["institution_type"], "School")
		self.assertEqual(rows[self.ENGG]["institution_type"], "Engineering")

	# --- The bound on configuration ----------------------------------------------------

	def test_a_policy_cannot_govern_a_field_the_rollup_reads(self):
		"""An institution may change its process; it may not stop being countable alongside the
		others. `status` is what the funnel is made of."""
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc(
				{
					"doctype": "Field Policy",
					"document_type": "Admission Enquiry",
					"scope_institution": self.SCHOOL,
					"enabled": 1,
					"rules": [{"fieldname": "status", "requirement": "Hidden"}],
				}
			).insert(ignore_permissions=True)

	# --- The raw-SQL escape hatch -------------------------------------------------------

	def test_the_sql_clause_is_open_for_a_trust_admin(self):
		frappe.set_user(self.TRUST_ADMIN)
		try:
			self.assertEqual(institution_sql_clause("tabAdmission Enquiry"), "1=1")
		finally:
			frappe.set_user("Administrator")

	def test_the_sql_clause_pins_a_scoped_login(self):
		frappe.set_user(self.SCHOOL_ADMIN)
		try:
			clause = institution_sql_clause("tabAdmission Enquiry")
			self.assertIn(self.SCHOOL, clause)
			self.assertNotIn(self.ENGG, clause)
		finally:
			frappe.set_user("Administrator")

	def test_the_sql_clause_fails_closed(self):
		email = self.make_user("zr-ungranted@example.com", ["Admission Manager"])
		frappe.set_user(email)
		try:
			self.assertEqual(institution_sql_clause("tabAdmission Enquiry"), "1=0")
		finally:
			frappe.set_user("Administrator")
