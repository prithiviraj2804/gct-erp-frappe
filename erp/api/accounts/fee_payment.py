# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Whitelisted application-fee actions the SPA and Desk call.

Recording a fee is a multi-doctype transaction — create a Fee Payment, submit it (which posts the
ledger and advances the lead) — and must be idempotent so a double-click never charges twice. That
is why it is an endpoint rather than plain CRUD. The accounting itself lives on the Fee Payment
controller, so a Desk-submitted receipt behaves identically; these functions are orchestration and
idempotency only.
"""

import frappe
from frappe import _
from frappe.utils import flt

from erp.api.permission import assert_institution_in_scope


@frappe.whitelist(methods=["POST"])
def record_application_fee(
	enquiry: str, mode_of_payment: str, reference_no: str = None, posting_date: str = None
) -> dict:
	"""Collect the application fee for an enquiry (idempotent).

	Returns the existing receipt if one is already submitted for this enquiry, so a repeat call
	never double-charges; a *cancelled* receipt does not block a corrected re-collection.
	"""
	if not frappe.has_permission("Fee Payment", "create"):
		frappe.throw(_("You are not permitted to record a fee payment."), frappe.PermissionError)

	institution = frappe.db.get_value("Admission Enquiry", enquiry, "institution")
	if not institution:
		frappe.throw(_("Admission Enquiry {0} was not found.").format(frappe.bold(enquiry)))
	assert_institution_in_scope(institution)

	existing = frappe.db.get_value("Fee Payment", {"admission_enquiry": enquiry, "docstatus": 1}, "name")
	if existing:
		return _payment_result(existing, created=False)

	doc = frappe.new_doc("Fee Payment")
	doc.admission_enquiry = enquiry
	doc.mode_of_payment = mode_of_payment
	doc.reference_no = reference_no
	if posting_date:
		doc.posting_date = posting_date
	doc.insert()
	doc.submit()
	return _payment_result(doc.name, created=True)


@frappe.whitelist(methods=["POST"])
def cancel_application_fee(fee_payment: str, reason: str) -> dict:
	"""Cancel a submitted receipt: reverse its ledger effect and unflag the lead.

	Reverses the *booking* (append-only mirror GL entries); an actual cash refund to the student is
	a separate voucher (a later slice). Only a role with cancel permission (Accounts Manager) may.
	"""
	doc = frappe.get_doc("Fee Payment", fee_payment)
	doc.check_permission("cancel")
	if doc.docstatus != 1:
		frappe.throw(_("Only a submitted (Paid) Fee Payment can be cancelled."), title=_("Not Cancellable"))

	reversed_gl = flt(doc.amount) > 0
	doc.cancel()
	if reason:
		# The doc is now cancelled (locked); write the reason straight to the column.
		frappe.db.set_value("Fee Payment", doc.name, "remarks", reason, update_modified=False)
	return {"name": doc.name, "status": "Cancelled", "reversed": reversed_gl}


def _payment_result(name: str, *, created: bool) -> dict:
	payment = frappe.db.get_value(
		"Fee Payment", name, ["amount", "status", "admission_enquiry"], as_dict=True
	)
	return {
		"name": name,
		"created": created,
		"amount": payment.amount,
		"status": payment.status,
		"enquiry_status": frappe.db.get_value("Admission Enquiry", payment.admission_enquiry, "status"),
	}
