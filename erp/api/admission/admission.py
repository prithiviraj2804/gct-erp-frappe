# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Confirming an admission — the one act that turns an applicant into a student.

An endpoint rather than CRUD because it is a transaction across four doctypes: it re-checks the
gates, allots a register number, writes the Student, links the application back to it and moves the
lead to Admitted. It must also be idempotent — a double-click must not admit the same person twice
and consume two seats.
"""

import frappe
from frappe import _
from frappe.utils import today

from erp.admission.pipeline import assert_status_transition
from erp.api.permission import assert_institution_in_scope

# Carried from the lead onto the student. Identity and contact only — every academic field comes
# from the *application*, because the programme admitted to is routinely not the one enquired about.
PERSONAL_FIELDS = (
	"student_name",
	"date_of_birth",
	"gender",
	"aadhaar_number",
	"phone_number",
	"email",
	"parent_name",
	"parent_phone",
	"address",
	"city",
	"state",
	"pincode",
)

# Taken from the application: the branch, intake and cycle the seat actually belongs to.
ACADEMIC_FIELDS = (
	"trust",
	"institution",
	"campus",
	"department",
	"programme",
	"programme_level",
	"academic_year",
	"programme_intake",
	"admission_type",
	"admission_route",
	"allotment_reference",
)


@frappe.whitelist(methods=["POST"])
def confirm_admission(application: str, date_of_admission: str | None = None) -> dict:
	"""Admit the applicant behind an Admission Application (idempotent).

	Returns the existing student if this application has already produced one, so a repeat call
	neither renumbers the register nor takes a second seat.
	"""
	if not frappe.has_permission("Student", "create"):
		frappe.throw(_("You are not permitted to admit a student."), frappe.PermissionError)

	doc = frappe.get_doc("Admission Application", application)
	doc.check_permission("write")
	assert_institution_in_scope(doc.institution)

	if doc.student:
		return _admission_result(doc.name, doc.student, created=False)

	enquiry = frappe.db.get_value(
		"Admission Enquiry", doc.admission_enquiry, ["status", "application_fee_paid"], as_dict=True
	)
	if not enquiry:
		frappe.throw(_("Admission Enquiry {0} was not found.").format(frappe.bold(doc.admission_enquiry)))

	# `previous_status=None` on purpose: it means "coming from outside every gated region", so every
	# gate runs — fee, documents and admissibility alike. Passing the lead's real current status would
	# skip the document check for a lead already sitting at "Documents Verified", and this is the one
	# moment that deserves the full set rather than the advance-only semantics a plain save gets.
	assert_status_transition(
		doc.admission_enquiry,
		"Admitted",
		None,
		application_fee_paid=enquiry.application_fee_paid,
	)

	student = _create_student(doc, date_of_admission or today())

	doc.student = student.name
	doc.save()

	# `set_value` rather than a full save, for the reason Fee Payment's `flag_enquiry` gives: the gates
	# were just run explicitly above, and re-saving the lead would re-run its whole validation on a
	# document the caller may not have open.
	frappe.db.set_value("Admission Enquiry", doc.admission_enquiry, "status", "Admitted")

	return _admission_result(doc.name, student.name, created=True)


def _create_student(application, date_of_admission: str):
	"""Write the register entry: the applicant's identity, and the seat they actually took."""
	student = frappe.new_doc("Student")
	student.date_of_admission = date_of_admission
	student.status = "Active"
	student.admission_application = application.name
	student.admission_enquiry = application.admission_enquiry

	for field in ACADEMIC_FIELDS:
		student.set(field, application.get(field))

	lead = frappe.db.get_value(
		"Admission Enquiry", application.admission_enquiry, PERSONAL_FIELDS, as_dict=True
	)
	if lead:
		for field in PERSONAL_FIELDS:
			student.set(field, lead.get(field))

	student.insert()
	return student


def _admission_result(application: str, student: str, *, created: bool) -> dict:
	row = frappe.db.get_value(
		"Student", student, ["programme", "programme_intake", "date_of_admission"], as_dict=True
	)
	return {
		"application": application,
		"student": student,
		"created": created,
		"programme": row.programme,
		"programme_intake": row.programme_intake,
		"date_of_admission": row.date_of_admission,
		"enquiry_status": frappe.db.get_value(
			"Admission Enquiry",
			frappe.db.get_value("Admission Application", application, "admission_enquiry"),
			"status",
		),
	}
