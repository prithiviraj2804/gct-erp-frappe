# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Refunding the application fee — the voucher the first accounts slice deferred.

`cancel_application_fee` reverses a *booking*: it says the receipt should never have existed. This
says the opposite — the money was properly collected and is properly going back, because counselling
allotted the applicant to another institution and they will never join. Two different facts, two
different vouchers, both on the record.

An endpoint rather than CRUD for the reasons `record_application_fee` is: it creates and submits in
one step, and must be idempotent so a double-click never pays a student twice.
"""

import frappe
from frappe import _
from frappe.utils import flt

from erp.api.permission import assert_trust_in_scope


@frappe.whitelist(methods=["POST"])
def refund_application_fee(
	fee_payment: str,
	reason: str,
	mode_of_payment: str,
	amount: float | None = None,
	posting_date: str | None = None,
) -> dict:
	"""Refund a collected application fee (idempotent).

	`amount` defaults to the whole receipt; pass less to keep a processing deduction. Returns the
	existing refund if this receipt has already been refunded.
	"""
	if not frappe.has_permission("Fee Refund", "create"):
		frappe.throw(_("You are not permitted to refund a fee."), frappe.PermissionError)

	payment = frappe.db.get_value("Fee Payment", fee_payment, ["trust", "admission_enquiry"], as_dict=True)
	if not payment:
		frappe.throw(_("Fee Payment {0} was not found.").format(frappe.bold(fee_payment)))
	assert_trust_in_scope(payment.trust)

	existing = frappe.db.get_value("Fee Refund", {"fee_payment": fee_payment, "docstatus": 1}, "name")
	if existing:
		return _refund_result(existing, created=False)

	if not reason:
		frappe.throw(_("State why the fee is being refunded."), title=_("Reason Required"))

	doc = frappe.new_doc("Fee Refund")
	doc.fee_payment = fee_payment
	doc.mode_of_payment = mode_of_payment
	doc.reason = reason
	if amount is not None:
		doc.amount = flt(amount)
	if posting_date:
		doc.posting_date = posting_date
	doc.insert()
	doc.submit()

	return _refund_result(doc.name, created=True)


def _refund_result(name: str, *, created: bool) -> dict:
	refund = frappe.db.get_value(
		"Fee Refund", name, ["amount", "status", "admission_enquiry", "fee_payment"], as_dict=True
	)
	return {
		"name": name,
		"created": created,
		"amount": refund.amount,
		"status": refund.status,
		"fee_payment": refund.fee_payment,
		"enquiry_status": frappe.db.get_value("Admission Enquiry", refund.admission_enquiry, "status"),
	}
