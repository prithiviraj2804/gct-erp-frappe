# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Whitelisted admission-enquiry actions the SPA and the Desk form call.

Only `start_from_gate_pass` lives here: turning a gate pass into an enquiry copies a fixed set
of fields across two doctypes in one step, which plain `/api/resource` CRUD cannot do. Everything
else about an enquiry is ordinary CRUD and needs no wrapper.
"""

import frappe
from frappe import _

# Copied from the pass onto the new enquiry. The choice fields (department, programme, admission
# type) and previous education are deliberately absent — the gate desk never collects them, so the
# counsellor supplies them on the pre-filled stub.
CARRIED_FIELDS = (
	"student_name",
	"phone_number",
	"aadhaar_number",
	"parent_name",
	"native_place",
	"college",
	"institution",
	"academic_year",
	"reference",
	"consultancy",
	"staff_reference",
)


@frappe.whitelist(methods=["POST"])
def start_from_gate_pass(gate_pass: str) -> dict:
	"""Create (or return) the Admission Enquiry seeded from an Admission Gate Pass.

	Idempotent: a pass already worked into an enquiry returns that enquiry rather than raising a
	second one — the same walk-in must not split across two records. The new enquiry is a stub at
	status `New`, pre-filled with the visitor's details and chosen college; its mandatory choice
	fields (programme, admission type) are left for the counsellor and so are allowed to be blank
	at creation.
	"""
	if not frappe.has_permission("Admission Enquiry", "create"):
		frappe.throw(_("You are not permitted to create an Admission Enquiry."), frappe.PermissionError)

	existing = frappe.db.exists("Admission Enquiry", {"gate_pass": gate_pass})
	if existing:
		return {"name": existing, "created": False}

	pass_doc = frappe.get_doc("Admission Gate Pass", gate_pass)
	pass_doc.check_permission("read")

	enquiry = frappe.new_doc("Admission Enquiry")
	enquiry.gate_pass = pass_doc.name
	enquiry.status = "New"
	for field in CARRIED_FIELDS:
		enquiry.set(field, pass_doc.get(field))

	enquiry.insert(ignore_mandatory=True)

	return {"name": enquiry.name, "created": True}
