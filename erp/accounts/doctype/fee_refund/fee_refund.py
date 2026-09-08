# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt

from erp.accounts.general_ledger import make_gl_entries, post_reversal
from erp.accounts.provisioning import resolve_account
from erp.master.hierarchy import validate_same_parent

STATUS_BY_DOCSTATUS = {0: "Draft", 1: "Refunded", 2: "Cancelled"}


class FeeRefund(Document):
	"""Money genuinely paid back to an applicant — not the same act as cancelling a receipt.

	Cancelling a Fee Payment says the receipt was a mistake and reverses the booking. A refund says
	the money was really collected and is really leaving the till: it posts its own voucher, debiting
	the fee income and crediting the cash or bank it goes out of. The Fee Payment stays submitted and
	the lead's `application_fee_paid` flag stays set, because both are what happened.

	The case this exists for: the institution collects the application fee *before* counselling, and
	counselling then allots the applicant to a different institution. Nothing was wrong with the receipt;
	the student simply never joins.

	Submittable for the same reason Fee Payment is — posted money must be immutable and reversible.
	"""

	def validate(self):
		self.set_ancestors_and_amount()
		self.resolve_accounts()
		self.validate_refundable()
		self.validate_hierarchy()
		self.status = STATUS_BY_DOCSTATUS.get(self.docstatus, "Draft")

	def on_submit(self):
		self.flag_enquiry()
		if flt(self.amount) > 0:
			self.post_gl_entries()
		self.db_set("status", "Refunded")

	def on_cancel(self):
		if flt(self.amount) > 0:
			post_reversal("Fee Refund", self.name, trust=self.trust, remark=self.remarks)
		self.unflag_enquiry()
		self.db_set("status", "Cancelled")

	# --- validate helpers ------------------------------------------------------------

	def set_ancestors_and_amount(self):
		"""Re-derive tenant, names and the ceiling on the amount from the receipt being refunded.

		Derived rather tha trusted for the same reason a Fee Payment derives its amount from the
		intake: `fetch_from` is a Desk convenience `ignore_links` skips, and a posted amount must
		never be a client's word. The amount itself *is* enterable here — an institution may keep a
		processing charge — but it is bounded by what was actually collected.
		"""
		if not self.fee_payment:
			return

		payment = frappe.db.get_value(
			"Fee Payment",
			self.fee_payment,
			["admission_enquiry", "student_name", "trust", "institution", "amount", "docstatus"],
			as_dict=True,
		)
		if not payment:
			return

		self.admission_enquiry = payment.admission_enquiry
		self.student_name = payment.student_name
		self.trust = payment.trust
		self.institution = payment.institution

		if self.amount is None or flt(self.amount) == 0:
			self.amount = flt(payment.amount)

		if flt(self.amount) > flt(payment.amount):
			frappe.throw(
				_("A refund of {0} is more than the {1} collected on {2}.").format(
					frappe.bold(flt(self.amount, 2)),
					frappe.bold(flt(payment.amount, 2)),
					frappe.bold(self.fee_payment),
				),
				title=_("Refund Exceeds Payment"),
			)

	def resolve_accounts(self):
		"""Debit the fee income back out; credit whatever the money physically leaves from."""
		if not self.trust:
			return

		self.income_account = resolve_account(self.trust, "Income Account")
		mode_type = frappe.db.get_value("Mode of Payment", self.mode_of_payment, "type")
		self.refund_account = resolve_account(self.trust, mode_type)

	def validate_refundable(self):
		"""Refuse a refund that would contradict the record.

		Three ways it could: refunding a receipt that was never submitted (or was cancelled, which
		already reversed the booking — refunding on top would hand back money twice); refunding an
		applicant who has actually been admitted, since they took the seat the fee bought; and a
		second live refund against one receipt.
		"""
		if not self.fee_payment:
			return

		docstatus = frappe.db.get_value("Fee Payment", self.fee_payment, "docstatus")
		if docstatus != 1:
			frappe.throw(
				_("Only a submitted (Paid) Fee Payment can be refunded. {0} is {1}.").format(
					frappe.bold(self.fee_payment),
					frappe.bold({0: "a draft", 2: "cancelled"}.get(docstatus, "not available")),
				),
				title=_("Not Refundable"),
			)

		admitted = frappe.db.get_value("Student", {"admission_enquiry": self.admission_enquiry}, "name")
		if admitted:
			frappe.throw(
				_("{0} has been admitted as {1}. An admitted student's fee is not refunded here.").format(
					frappe.bold(self.student_name or self.admission_enquiry), frappe.bold(admitted)
				),
				title=_("Already Admitted"),
			)

		duplicate = frappe.db.get_value(
			"Fee Refund", {"fee_payment": self.fee_payment, "docstatus": 1, "name": ["!=", self.name]}, "name"
		)
		if duplicate:
			frappe.throw(
				_("{0} has already been refunded by {1}.").format(
					frappe.bold(self.fee_payment), frappe.bold(duplicate)
				),
				title=_("Already Refunded"),
			)

	def validate_hierarchy(self):
		"""Keep every linked record inside the one trust's books."""
		validate_same_parent(self, "fee_payment", "trust")
		validate_same_parent(self, "admission_enquiry", "trust")
		validate_same_parent(self, "income_account", "trust")
		validate_same_parent(self, "refund_account", "trust")
		validate_same_parent(self, "institution", "trust")

	# --- submit / cancel effects -----------------------------------------------------

	def flag_enquiry(self):
		"""Mark the lead refunded and take it off the pipeline.

		`application_fee_paid` is deliberately left standing: the fee *was* paid, and erasing that
		would lose the fact the refund is evidence of. The lead is moved to Dropped because the
		applicant is not joining — written with `set_value` for the same reason Fee Payment's
		`flag_enquiry` does, so the flag and the status land together.
		"""
		frappe.db.set_value(
			"Admission Enquiry",
			self.admission_enquiry,
			{
				"application_fee_refunded": 1,
				"application_fee_refund": self.name,
				"status": "Dropped",
			},
		)

	def post_gl_entries(self):
		"""Debit the fee income, credit where the money goes out — the mirror of the receipt."""
		make_gl_entries(
			[
				{
					"account": self.income_account,
					"debit": self.amount,
					"credit": 0,
					"posting_date": self.posting_date,
				},
				{
					"account": self.refund_account,
					"debit": 0,
					"credit": self.amount,
					"posting_date": self.posting_date,
				},
			],
			trust=self.trust,
			voucher_type="Fee Refund",
			voucher_no=self.name,
			remark=_("Application fee refund — {0}").format(self.student_name or self.admission_enquiry),
		)

	def unflag_enquiry(self):
		"""Clear the refunded flag, but only if this is still the refund on record.

		Mirrors Fee Payment's `unflag_enquiry`. The lead's status is left as it stands: cancelling a
		refund does not tell us which stage the lead should return to, and guessing would be worse
		than leaving a human to set it.
		"""
		on_record = frappe.db.get_value("Admission Enquiry", self.admission_enquiry, "application_fee_refund")
		if on_record == self.name:
			frappe.db.set_value(
				"Admission Enquiry",
				self.admission_enquiry,
				{"application_fee_refunded": 0, "application_fee_refund": None},
			)
