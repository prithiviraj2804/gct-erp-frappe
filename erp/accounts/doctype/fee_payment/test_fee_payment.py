# Copyright (c) 2026, Prithivi and Contributors
# See license.txt

"""What collecting an application fee does — to the ledger, to the lead, and to who may see it.

Recording a fee posts a balanced double-entry voucher, flags the lead paid and advances it into the
pipeline; the fee gate blocks an unpaid lead from advancing through either status-writer; GL entries
are immutable; recording is idempotent; cancelling reverses the ledger and unflags the lead; and a
receipt is visible only within its own institution. Own fixtures under a `ZG` prefix; the tenant's
chart of accounts is built automatically when the institution is created.
"""

import itertools

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, flt, today

from erp.api.accounts.fee_payment import cancel_application_fee, record_application_fee


class IntegrationTestFeePayment(IntegrationTestCase):
	INST = "ZG1"
	OTHER_INST = "ZG2"
	COL = "ZG1COL"
	FEE = 500.0

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls._aadhaar = itertools.count(600000000001)

		cls.ensure("Programme Level", "UG", {"level_code": "UG", "level_name": "Undergraduate", "level_order": 1})
		degree = cls.ensure("Degree", "ZGDEG", {"degree_code": "ZGDEG", "degree_name": "G Bachelor", "programme_level": "UG"})
		structure = cls.ensure(
			"Academic Structure",
			"ZGSEM",
			{"structure_code": "ZGSEM", "structure_name": "G Semester", "terms_per_year": 2, "term_label": "Semester"},
		)
		cls.ensure("Admission Type", "REG", {"type_code": "REG", "type_name": "Regular", "default_entry_semester": 1})
		cls.ensure("Mode of Payment", "Cash", {"mode_name": "Cash", "type": "Cash"})

		# Inserting the institution triggers the after_insert hook that builds its chart of accounts.
		cls.ensure("Institution", cls.INST, {"institution_code": cls.INST, "institution_name": "G Institute"})
		cls.ensure("College", cls.COL, {"institution": cls.INST, "college_code": cls.COL, "college_name": "G College"})
		cls.dept = frappe.get_doc(
			{"doctype": "Department", "institution": cls.INST, "college": cls.COL, "department_code": "ZG1DEP", "department_name": "G Dept"}
		).insert().name
		cls.programme = frappe.get_doc(
			{
				"doctype": "Programme",
				"college": cls.COL,
				"department": cls.dept,
				"degree": degree,
				"academic_structure": structure,
				"programme_code": "ZG1UG",
				"programme_name": "G B.Tech",
				"duration_years": 4,
				"total_terms": 8,
				"required_prior_qualification": "12th",
			}
		).insert().name
		cls.year = frappe.get_doc(
			{
				"doctype": "Academic Year",
				"institution": cls.INST,
				"year_code": "2060-61",
				"title": "G 2060-61",
				"start_date": "2060-06-01",
				"end_date": "2061-05-31",
				"is_admission_open": 1,
			}
		).insert().name
		cls.intake = frappe.get_doc(
			{
				"doctype": "Programme Intake",
				"academic_year": cls.year,
				"programme": cls.programme,
				"total_seats": 60,
				"status": "Open",
				"application_fee": cls.FEE,
			}
		).insert().name

	# --- Fixture helpers ------------------------------------------------------------

	@staticmethod
	def ensure(doctype, name, values):
		if frappe.db.exists(doctype, name):
			return name
		return frappe.get_doc({"doctype": doctype, **values}).insert().name

	@classmethod
	def make_enquiry(cls):
		return frappe.get_doc(
			{
				"doctype": "Admission Enquiry",
				"student_name": "Fee Case",
				"phone_number": "9876522222",
				"college": cls.COL,
				"department": cls.dept,
				"programme": cls.programme,
				"admission_type": "REG",
				"programme_intake": cls.intake,
				"aadhaar_number": f"{next(cls._aadhaar):012d}",
				"previous_education": [
					{"qualification_level": "12th", "board_university": "State Board", "year_of_passing": 2059, "percentage": 89.0}
				],
			}
		).insert().name

	def _voucher_gl(self, payment):
		return frappe.get_all("GL Entry", filters={"voucher_no": payment}, fields=["account", "debit", "credit"])

	# --- The happy path: money in, lead advances ------------------------------------

	def test_recording_a_fee_posts_balanced_gl_and_advances_the_lead(self):
		enquiry = self.make_enquiry()
		result = record_application_fee(enquiry, "Cash")

		self.assertTrue(result["created"])
		self.assertEqual(flt(result["amount"]), self.FEE)
		self.assertEqual(result["enquiry_status"], "Application Submitted")

		enq = frappe.get_doc("Admission Enquiry", enquiry)
		self.assertTrue(enq.application_fee_paid)
		self.assertEqual(enq.application_fee_payment, result["name"])

		gl = self._voucher_gl(result["name"])
		self.assertEqual(len(gl), 2)
		self.assertEqual(sum(flt(g.debit) for g in gl), sum(flt(g.credit) for g in gl))
		self.assertEqual(sum(flt(g.debit) for g in gl), self.FEE)

	def test_amount_is_the_intake_fee_not_a_client_value(self):
		payment = record_application_fee(self.make_enquiry(), "Cash")["name"]
		self.assertEqual(flt(frappe.db.get_value("Fee Payment", payment, "amount")), self.FEE)

	def test_recording_is_idempotent(self):
		enquiry = self.make_enquiry()
		first = record_application_fee(enquiry, "Cash")
		second = record_application_fee(enquiry, "Cash")

		self.assertTrue(first["created"])
		self.assertFalse(second["created"])
		self.assertEqual(first["name"], second["name"])
		self.assertEqual(frappe.db.count("Fee Payment", {"admission_enquiry": enquiry, "docstatus": 1}), 1)

	# --- Cancellation reverses the ledger -------------------------------------------

	def test_cancellation_reverses_the_ledger_and_unflags_the_lead(self):
		enquiry = self.make_enquiry()
		payment = record_application_fee(enquiry, "Cash")["name"]

		cancel_application_fee(payment, "Collected in error")

		# Every account on the voucher nets to zero after the mirror entries.
		gl = self._voucher_gl(payment)
		self.assertEqual(len(gl), 4)
		by_account = {}
		for row in gl:
			by_account[row.account] = by_account.get(row.account, 0) + flt(row.debit) - flt(row.credit)
		self.assertTrue(all(abs(net) < 0.005 for net in by_account.values()))

		enq = frappe.get_doc("Admission Enquiry", enquiry)
		self.assertFalse(enq.application_fee_paid)
		self.assertFalse(enq.application_fee_payment)

	def test_a_cancelled_payment_lets_the_fee_be_re_collected(self):
		enquiry = self.make_enquiry()
		first = record_application_fee(enquiry, "Cash")["name"]
		cancel_application_fee(first, "Wrong mode")

		second = record_application_fee(enquiry, "Cash")
		self.assertTrue(second["created"])
		self.assertNotEqual(second["name"], first)

	# --- The ledger is immutable ----------------------------------------------------

	def test_gl_entries_cannot_be_edited(self):
		payment = record_application_fee(self.make_enquiry(), "Cash")["name"]
		gl_name = frappe.get_all("GL Entry", filters={"voucher_no": payment}, pluck="name")[0]
		gl = frappe.get_doc("GL Entry", gl_name)
		gl.remarks = "tampered"
		with self.assertRaises(frappe.ValidationError):
			gl.save()

	# --- The fee gate: unpaid leads cannot advance ----------------------------------

	def test_unpaid_lead_cannot_advance_by_direct_edit(self):
		enquiry = frappe.get_doc("Admission Enquiry", self.make_enquiry())
		enquiry.status = "Application Submitted"
		with self.assertRaises(frappe.ValidationError):
			enquiry.save()

	def test_unpaid_lead_cannot_advance_through_a_follow_up(self):
		enquiry = self.make_enquiry()
		follow_up = frappe.get_doc(
			{
				"doctype": "Admission Follow-up",
				"enquiry": enquiry,
				"channel": "Call",
				"outcome": "Interested",
				"follow_up_on": today(),
				"new_status": "Application Submitted",
			}
		)
		with self.assertRaises(frappe.ValidationError):
			follow_up.insert()

	def test_a_paid_lead_is_past_the_fee_gate(self):
		"""Paying satisfies the fee gate for good — whatever stops the lead next is not the fee.

		The lead can be re-saved inside the gated region without the fee gate firing again. Advancing
		*beyond* Application Submitted is now stopped by the document gate instead, which is the
		point: this suite owns the fee rule, and the rules layered on top of it are proved in
		test_admission_application.
		"""
		enquiry = self.make_enquiry()
		record_application_fee(enquiry, "Cash")  # now paid, at Application Submitted

		enq = frappe.get_doc("Admission Enquiry", enquiry)
		enq.remarks = "re-saved inside the gated region"
		enq.save()
		self.assertEqual(frappe.db.get_value("Admission Enquiry", enquiry, "status"), "Application Submitted")

		enq.status = "Documents Verified"
		with self.assertRaises(frappe.ValidationError) as caught:
			enq.save()
		self.assertNotIn("application fee", str(caught.exception).lower())

	# --- Provisioning + tenant isolation --------------------------------------------

	def test_chart_of_accounts_is_provisioned_for_a_new_institution(self):
		self.assertTrue(frappe.db.exists("Account", f"{self.INST}-Application Fees"))
		self.assertTrue(frappe.db.exists("Account", f"{self.INST}-Cash"))
		self.assertTrue(frappe.db.exists("Account", f"{self.INST}-Bank"))

	def test_cashier_scoped_to_another_institution_sees_no_receipts_here(self):
		self.ensure("Institution", self.OTHER_INST, {"institution_code": self.OTHER_INST, "institution_name": "G Two"})
		payment = record_application_fee(self.make_enquiry(), "Cash")["name"]

		email = "zg-cashier-other@example.com"
		if not frappe.db.exists("User", email):
			user = frappe.new_doc("User")
			user.email = email
			user.first_name = "G Cashier Two"
			user.append("roles", {"role": "Cashier"})
			user.flags.no_welcome_mail = True
			user.insert(ignore_permissions=True)
		if not frappe.db.exists("User Permission", {"user": email, "allow": "Institution", "for_value": self.OTHER_INST}):
			frappe.get_doc(
				{"doctype": "User Permission", "user": email, "allow": "Institution", "for_value": self.OTHER_INST}
			).insert(ignore_permissions=True)

		frappe.set_user(email)
		try:
			visible = set(frappe.get_list("Fee Payment", pluck="name"))
		finally:
			frappe.set_user("Administrator")

		self.assertNotIn(payment, visible)
