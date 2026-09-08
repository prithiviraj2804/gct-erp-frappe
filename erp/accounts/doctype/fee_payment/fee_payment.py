# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt

from erp.accounts.general_ledger import make_gl_entries, post_reversal
from erp.accounts.provisioning import resolve_account
from erp.admission.fee_gate import advance_target_on_payment
from erp.master.hierarchy import validate_same_parent

STATUS_BY_DOCSTATUS = {0: "Draft", 1: "Paid", 2: "Cancelled"}


class FeePayment(Document):
	"""A submittable application-fee receipt.

	Submittable on purpose: posted money must be immutable and reversible, not editable — the
	framework locks a submitted doc's fields, and `on_submit`/`on_cancel` are the seams for posting
	and reversing the ledger. The business logic lives here, not in the API endpoint, so a receipt
	submitted from the Desk posts identically to one created through `record_application_fee`.
	"""

	def validate(self):
		self.set_ancestors_and_amount()
		self.resolve_accounts()
		self.validate_hierarchy()
		self.status = STATUS_BY_DOCSTATUS.get(self.docstatus, "Draft")

	def on_submit(self):
		self.flag_enquiry()
		if flt(self.amount) > 0:
			self.post_gl_entries()
		self.db_set("status", "Paid")

	def on_cancel(self):
		if flt(self.amount) > 0:
			post_reversal("Fee Payment", self.name, trust=self.trust, remark=self.remarks)
		self.unflag_enquiry()
		self.db_set("status", "Cancelled")

	# --- validate helpers ------------------------------------------------------------

	def set_ancestors_and_amount(self):
		"""Re-derive the tenant, names and amount from the enquiry — never trust posted copies.

		`fetch_from` is a Desk convenience skipped under `ignore_links`, so deriving here makes the
		amount authoritative: it is always the intake's `application_fee`, never a client value.
		"""
		if not self.admission_enquiry:
			return

		enquiry = frappe.db.get_value(
			"Admission Enquiry",
			self.admission_enquiry,
			["student_name", "programme_intake", "trust", "institution"],
			as_dict=True,
		)
		if not enquiry:
			return

		self.student_name = enquiry.student_name
		self.programme_intake = enquiry.programme_intake
		self.trust = enquiry.trust
		self.institution = enquiry.institution

		if not self.programme_intake:
			frappe.throw(
				_(
					"This enquiry has no Programme Intake, so its application fee is unknown. Set the intake on the enquiry first."
				),
				title=_("No Fee Defined"),
			)
		self.amount = flt(frappe.db.get_value("Programme Intake", self.programme_intake, "application_fee"))

	def resolve_accounts(self):
		"""Find the trust's income and deposit accounts by meaning, not by name.

		The lookup itself is in `erp/accounts/provisioning.py` because a Fee Refund resolves the same
		two accounts to post the mirror entry.
		"""
		self.income_account = resolve_account(self.trust, "Income Account")
		mode_type = frappe.db.get_value("Mode of Payment", self.mode_of_payment, "type")
		self.deposit_account = resolve_account(self.trust, mode_type)

	def validate_hierarchy(self):
		"""Keep every linked record inside the one trust's books."""
		validate_same_parent(self, "programme_intake", "trust")
		validate_same_parent(self, "income_account", "trust")
		validate_same_parent(self, "deposit_account", "trust")
		validate_same_parent(self, "institution", "trust")

	# --- submit / cancel effects -----------------------------------------------------

	def flag_enquiry(self):
		"""Mark the lead paid and advance it into the pipeline (never regressing it).

		Written with `set_value` (bypassing the enquiry's `validate`) deliberately: this payment is
		exactly the fee gate's condition, and the paid flag and the advanced status are set together
		so the lead is never momentarily "Application Submitted" while still unpaid.
		"""
		updates = {"application_fee_paid": 1, "application_fee_payment": self.name}
		target = advance_target_on_payment(
			frappe.db.get_value("Admission Enquiry", self.admission_enquiry, "status")
		)
		if target:
			updates["status"] = target
		frappe.db.set_value("Admission Enquiry", self.admission_enquiry, updates)

	def post_gl_entries(self):
		"""Debit where the money landed, credit the fee income — one balanced voucher."""
		make_gl_entries(
			[
				{
					"account": self.deposit_account,
					"debit": self.amount,
					"credit": 0,
					"posting_date": self.posting_date,
				},
				{
					"account": self.income_account,
					"debit": 0,
					"credit": self.amount,
					"posting_date": self.posting_date,
				},
			],
			trust=self.trust,
			voucher_type="Fee Payment",
			voucher_no=self.name,
			remark=_("Application fee — {0}").format(self.student_name or self.admission_enquiry),
		)

	def unflag_enquiry(self):
		"""Clear the paid flag on cancellation — but only if this is still the receipt on record,
		so a corrected re-collection made after this one is not clobbered."""
		on_record = frappe.db.get_value(
			"Admission Enquiry", self.admission_enquiry, "application_fee_payment"
		)
		if on_record == self.name:
			frappe.db.set_value(
				"Admission Enquiry",
				self.admission_enquiry,
				{"application_fee_paid": 0, "application_fee_payment": None},
			)
