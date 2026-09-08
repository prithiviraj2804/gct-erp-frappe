# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Whitelisted Admission Application actions the SPA and Desk call.

Only `start_application` lives here. Raising an application reads a lead, a programme intake and its
document checklist and writes one document seeded from all three — which plain `/api/resource` CRUD
cannot do in a step — and it must be idempotent so a double-click never leaves a lead with two
applications. Everything after that (recording the allotment, ticking documents off, issuing an
offer, changing the branch) is ordinary CRUD on the application, with the rules enforced in its
controller, and needs no wrapper here.
"""

import frappe
from frappe import _

from erp.api.permission import assert_institution_in_scope

# Copied off the lead as the application's starting point. They are a *starting* point only: the
# programme is the one the student asked about, and counselling routinely moves it. That is why the
# application owns these fields rather than fetching them from the enquiry forever.
SEEDED_FROM_ENQUIRY = ("programme", "programme_intake", "admission_type")


@frappe.whitelist(methods=["POST"])
def start_application(enquiry: str) -> dict:
	"""Raise the Admission Application for a lead, seeded from the lead and its intake (idempotent).

	Returns the existing application if one is already raised, so a repeat call never splits a lead
	across two of them. The fee must already be collected: this college hands out its application
	form only after the fee is taken, and the pipeline says the same thing — an unpaid lead cannot
	reach "Application Submitted".
	"""
	if not frappe.has_permission("Admission Application", "create"):
		frappe.throw(_("You are not permitted to raise an Admission Application."), frappe.PermissionError)

	lead = frappe.db.get_value(
		"Admission Enquiry",
		enquiry,
		["institution", "application_fee_paid", "date_of_birth", *SEEDED_FROM_ENQUIRY],
		as_dict=True,
	)
	if not lead:
		frappe.throw(_("Admission Enquiry {0} was not found.").format(frappe.bold(enquiry)))
	assert_institution_in_scope(lead.institution)

	existing = frappe.db.get_value("Admission Application", {"admission_enquiry": enquiry}, "name")
	if existing:
		return _application_result(existing, created=False)

	if not lead.application_fee_paid:
		frappe.throw(
			_("Collect the application fee for {0} before raising an application.").format(
				frappe.bold(enquiry)
			),
			title=_("Application Fee Required"),
		)

	application = frappe.new_doc("Admission Application")
	application.admission_enquiry = enquiry
	for field in SEEDED_FROM_ENQUIRY:
		application.set(field, lead.get(field))

	if lead.programme:
		# The branch they walked in asking for is their first choice until the form says otherwise.
		application.append("preferences", {"preference_order": 1, "programme": lead.programme})

	for row in required_documents_for(lead.programme_intake):
		application.append("documents", row)

	application.insert()
	return _application_result(application.name, created=True)


def required_documents_for(programme_intake: str) -> list[dict]:
	"""The checklist an intake publishes, as rows ready to append to an application.

	The list is per-intake rather than global because it is where the school/college difference
	actually lives: a school class asks for a birth certificate and a transfer certificate, an
	engineering intake for mark sheets, a community certificate and the counselling allotment order.
	One doctype, different data — no rule keyed on the college's type.
	"""
	if not programme_intake:
		return []

	return [
		{"document_type": row.document_type, "is_required": row.is_required, "remarks": row.remarks}
		for row in frappe.get_all(
			"Programme Intake Document",
			filters={"parent": programme_intake, "parenttype": "Programme Intake"},
			fields=["document_type", "is_required", "remarks"],
			order_by="idx",
		)
	]


def _application_result(name: str, *, created: bool) -> dict:
	application = frappe.db.get_value(
		"Admission Application",
		name,
		["application_state", "programme", "programme_intake", "counselling_outcome", "student"],
		as_dict=True,
	)
	return {
		"name": name,
		"created": created,
		"application_state": application.application_state,
		"programme": application.programme,
		"programme_intake": application.programme_intake,
		"counselling_outcome": application.counselling_outcome,
		"student": application.student,
	}
