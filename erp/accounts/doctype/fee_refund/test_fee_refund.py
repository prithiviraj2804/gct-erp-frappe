# Copyright (c) 2026, Prithivi and Contributors
# See license.txt

"""Giving the application fee back — a cash-out voucher, not a cancelled receipt.

The case: this institution collects the application fee *before* counselling, and counselling then
allots the applicant to a different institution. Nothing was wrong with the receipt, so it is not
cancelled; the money simply goes back. The two acts post different vouchers and mean different
things, and the lead keeps `application_fee_paid` set because the fee genuinely was paid.

Proved here: the refund posts a balanced mirror of the receipt, the ledger nets to zero across both,
the lead is flagged and dropped, refunding is idempotent and bounded by what was collected, an
admitted student cannot be refunded, cancelling reverses the ledger, and a Cashier may take money in
but not pay it out. Own fixtures under a `ZR` prefix.
"""

import itertools

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import flt, today

from erp.api.accounts.fee_payment import record_application_fee
from erp.api.accounts.fee_refund import refund_application_fee


class IntegrationTestFeeRefund(IntegrationTestCase):
	INST = "ZR1"
	COL = "ZR1COL"
	FEE = 750.0

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls._aadhaar = itertools.count(810000000001)

		cls.ensure(
			"Programme Level", "UG", {"level_code": "UG", "level_name": "Undergraduate", "level_order": 1}
		)
		cls.ensure(
			"Admission Type", "REG", {"type_code": "REG", "type_name": "Regular", "default_entry_semester": 1}
		)
		cls.ensure("Mode of Payment", "Cash", {"mode_name": "Cash", "type": "Cash"})
		structure = cls.ensure(
			"Academic Structure",
			"ZRSEM",
			{
				"structure_code": "ZRSEM",
				"structure_name": "R Semester",
				"terms_per_year": 2,
				"term_label": "Semester",
			},
		)

		# Inserting the trust builds its chart of accounts through the after_insert hook.
		cls.ensure("Trust", cls.INST, {"trust_code": cls.INST, "trust_name": "R Institute"})
		cls.ensure(
			"Institution",
			cls.COL,
			{
				"trust": cls.INST,
				"institution_code": cls.COL,
				"institution_name": "R Institution",
				"institution_type": "Engineering",
			},
		)
		cls.dept = cls.ensure(
			"Department",
			f"{cls.COL}-CSE",
			{
				"trust": cls.INST,
				"institution": cls.COL,
				"department_code": "CSE",
				"department_name": "R CSE",
			},
		)
		cls.programme = (
			frappe.get_doc(
				{
					"doctype": "Programme",
					"institution": cls.COL,
					"department": cls.dept,
					"programme_code": "ZRUG",
					"programme_name": "R B.Tech",
					"programme_level": "UG",
					"academic_structure": structure,
					"duration_years": 4,
					"total_terms": 8,
					"required_prior_qualification": "12th",
				}
			)
			.insert()
			.name
		)
		cls.year = (
			frappe.get_doc(
				{
					"doctype": "Academic Year",
					"trust": cls.INST,
					"year_code": "2060-61",
					"title": "R 2060-61",
					"start_date": "2060-06-01",
					"end_date": "2061-05-31",
					"is_admission_open": 1,
				}
			)
			.insert()
			.name
		)
		cls.intake = (
			frappe.get_doc(
				{
					"doctype": "Programme Intake",
					"academic_year": cls.year,
					"programme": cls.programme,
					"total_seats": 60,
					"status": "Open",
					"application_fee": cls.FEE,
				}
			)
			.insert()
			.name
		)

	# --- Fixture helpers ------------------------------------------------------------

	@staticmethod
	def ensure(doctype, name, values):
		if frappe.db.exists(doctype, name):
			return name
		return frappe.get_doc({"doctype": doctype, **values}).insert().name

	@classmethod
	def make_enquiry(cls):
		return (
			frappe.get_doc(
				{
					"doctype": "Admission Enquiry",
					"student_name": "Refund Case",
					"phone_number": "9876533333",
					"institution": cls.COL,
					"department": cls.dept,
					"programme": cls.programme,
					"admission_type": "REG",
					"programme_intake": cls.intake,
					"aadhaar_number": f"{next(cls._aadhaar):012d}",
					"previous_education": [{"qualification_level": "12th"}],
				}
			)
			.insert()
			.name
		)

	@classmethod
	def paid(cls):
		"""A lead with the fee collected — the state every refund starts from."""
		enquiry = cls.make_enquiry()
		return enquiry, record_application_fee(enquiry, "Cash")["name"]

	@staticmethod
	def voucher_gl(*vouchers):
		return frappe.get_all(
			"GL Entry",
			filters={"voucher_no": ["in", list(vouchers)]},
			fields=["account", "debit", "credit", "voucher_type"],
		)

	# --- The happy path: money out --------------------------------------------------

	def test_refunding_posts_the_mirror_of_the_receipt(self):
		_enquiry, payment = self.paid()
		result = refund_application_fee(payment, "Counselling allotted another institution", "Cash")

		self.assertTrue(result["created"])
		self.assertEqual(result["status"], "Refunded")
		self.assertEqual(flt(result["amount"]), self.FEE)
		self.assertTrue(result["name"].startswith("FREF-"), result["name"])

		refund = frappe.get_doc("Fee Refund", result["name"])
		gl = self.voucher_gl(refund.name)
		self.assertEqual(len(gl), 2)
		self.assertEqual(sum(flt(g.debit) for g in gl), sum(flt(g.credit) for g in gl))
		# Income is debited (given back), the till is credited (money leaves).
		debited = next(g.account for g in gl if flt(g.debit))
		credited = next(g.account for g in gl if flt(g.credit))
		self.assertEqual(debited, refund.income_account)
		self.assertEqual(credited, refund.refund_account)

	def test_the_ledger_nets_to_zero_across_payment_and_refund(self):
		_enquiry, payment = self.paid()
		refund = refund_application_fee(payment, "Allotted elsewhere", "Cash")["name"]

		net = {}
		for row in self.voucher_gl(payment, refund):
			net[row.account] = round(net.get(row.account, 0) + flt(row.debit) - flt(row.credit), 2)

		self.assertEqual(
			len(self.voucher_gl(payment, refund)), 4, "nothing is deleted; the ledger is append-only"
		)
		self.assertTrue(all(value == 0 for value in net.values()), net)

	def test_the_lead_is_dropped_but_still_remembers_paying(self):
		enquiry, payment = self.paid()
		refund = refund_application_fee(payment, "Allotted elsewhere", "Cash")

		lead = frappe.get_doc("Admission Enquiry", enquiry)
		self.assertEqual(lead.status, "Dropped")
		self.assertTrue(lead.application_fee_refunded)
		self.assertEqual(lead.application_fee_refund, refund["name"])
		self.assertTrue(lead.application_fee_paid, "the fee was paid; a refund does not unsay that")
		self.assertEqual(lead.application_fee_payment, payment)

	def test_refunding_is_idempotent(self):
		_enquiry, payment = self.paid()
		first = refund_application_fee(payment, "Allotted elsewhere", "Cash")
		second = refund_application_fee(payment, "again", "Cash")

		self.assertFalse(second["created"])
		self.assertEqual(first["name"], second["name"])
		self.assertEqual(frappe.db.count("Fee Refund", {"fee_payment": payment, "docstatus": 1}), 1)

	# --- Bounds and guards ------------------------------------------------------------

	def test_a_partial_refund_keeps_a_deduction(self):
		_enquiry, payment = self.paid()
		result = refund_application_fee(payment, "Less processing charge", "Cash", amount=500.0)
		self.assertEqual(flt(result["amount"]), 500.0)

	def test_a_refund_cannot_exceed_what_was_collected(self):
		_enquiry, payment = self.paid()
		with self.assertRaises(frappe.ValidationError) as caught:
			refund_application_fee(payment, "Too much", "Cash", amount=self.FEE + 1)
		self.assertIn("more than", str(caught.exception))

	def test_only_a_submitted_receipt_can_be_refunded(self):
		enquiry = self.make_enquiry()
		draft = frappe.get_doc(
			{
				"doctype": "Fee Payment",
				"admission_enquiry": enquiry,
				"posting_date": today(),
				"mode_of_payment": "Cash",
			}
		).insert()

		with self.assertRaises(frappe.ValidationError) as caught:
			refund_application_fee(draft.name, "Not submitted", "Cash")
		self.assertIn("submitted", str(caught.exception).lower())

	def test_an_admitted_student_is_not_refunded_here(self):
		"""They took the seat the fee bought; unwinding that is a withdrawal, not a refund."""
		enquiry, payment = self.paid()
		frappe.get_doc(
			{
				"doctype": "Student",
				"student_name": "Already In",
				"date_of_admission": today(),
				"status": "Active",
				"trust": self.INST,
				"institution": self.COL,
				"department": self.dept,
				"programme": self.programme,
				"academic_year": self.year,
				"programme_intake": self.intake,
				"admission_enquiry": enquiry,
			}
		).insert()

		with self.assertRaises(frappe.ValidationError) as caught:
			refund_application_fee(payment, "Changed their mind", "Cash")
		self.assertIn("admitted", str(caught.exception).lower())

	def test_a_reason_is_required(self):
		_enquiry, payment = self.paid()
		with self.assertRaises(frappe.ValidationError):
			refund_application_fee(payment, "", "Cash")

	# --- Reversal ---------------------------------------------------------------------

	def test_cancelling_a_refund_reverses_it_and_unflags_the_lead(self):
		enquiry, payment = self.paid()
		refund = refund_application_fee(payment, "Allotted elsewhere", "Cash")["name"]

		doc = frappe.get_doc("Fee Refund", refund)
		doc.cancel()

		self.assertEqual(frappe.db.get_value("Fee Refund", refund, "status"), "Cancelled")
		gl = self.voucher_gl(refund)
		self.assertEqual(len(gl), 4, "reversal is append-only: mirror rows, not deletions")
		self.assertEqual(sum(flt(g.debit) for g in gl), sum(flt(g.credit) for g in gl))

		lead = frappe.get_doc("Admission Enquiry", enquiry)
		self.assertFalse(lead.application_fee_refunded)
		self.assertIsNone(lead.application_fee_refund)

	def test_a_cancelled_refund_frees_the_receipt_to_be_refunded_again(self):
		_enquiry, payment = self.paid()
		first = refund_application_fee(payment, "Wrong amount", "Cash", amount=100.0)["name"]
		frappe.get_doc("Fee Refund", first).cancel()

		corrected = refund_application_fee(payment, "Corrected", "Cash")
		self.assertTrue(corrected["created"])
		self.assertEqual(flt(corrected["amount"]), self.FEE)

	# --- Who may pay money out ---------------------------------------------------------

	def test_a_cashier_may_take_money_in_but_not_pay_it_out(self):
		"""The asymmetry the Fee Payment permissions already set up: a Cashier submits receipts and
		cannot cancel them. Paying out is more sensitive still, so it is Accounts Manager's."""
		cashier = self.make_user("zr-cashier@example.com", "Cashier")
		_enquiry, payment = self.paid()

		frappe.set_user(cashier)
		try:
			self.assertFalse(frappe.has_permission("Fee Refund", "create"))
			with self.assertRaises(frappe.PermissionError):
				refund_application_fee(payment, "Trying", "Cash")
		finally:
			frappe.set_user("Administrator")

	@staticmethod
	def make_user(email, role):
		if frappe.db.exists("User", email):
			return email
		user = frappe.new_doc("User")
		user.email, user.first_name = email, email.split("@")[0]
		user.append("roles", {"role": role})
		user.flags.no_welcome_mail = True
		user.insert(ignore_permissions=True)
		return email
