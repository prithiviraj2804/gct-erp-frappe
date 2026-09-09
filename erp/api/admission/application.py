# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Whitelisted Admission Application actions the SPA and Desk call.

Only `start_application` lives here. Raising an application reads a lead, a programme intake and its
document checklist and writes one document seeded from all three — which plain `/api/resource` CRUD
cannot do in a step — and it must be idempotent so a double-click never leaves a lead with two
applications **for the same intake**. Everything after that (recording the allotment, ticking
documents off, issuing an offer, changing the branch) is ordinary CRUD on the application, with the
rules enforced in its controller, and needs no wrapper here.

**Idempotency is keyed on the intake, not the lead.** It used to be keyed on the lead, which made
the endpoint structurally incapable of raising a second application — a candidate applying at a
second institution of the trust got the first application handed back, silently, as though the
request had succeeded. Keying on the intake keeps the double-click safe and makes the deliberate
second application possible, which is the whole point: see
`AdmissionApplication.validate_one_per_intake`.
"""

import frappe
from frappe import _

from erp.api.permission import assert_institution_in_scope

# Copied off the lead as the application's starting point. They are a *starting* point only: the
# programme is the one the student asked about, and counselling routinely moves it. That is why the
# application owns these fields rather than fetching them from the enquiry forever.
SEEDED_FROM_ENQUIRY = ("programme", "programme_intake", "admission_type")


@frappe.whitelist(methods=["POST"])
def start_application(enquiry: str, programme_intake: str | None = None) -> dict:
	"""Raise an Admission Application for a lead, seeded from the lead and an intake (idempotent).

	`programme_intake` defaults to the one the lead enquired about, which is the ordinary case and
	the only one that existed before a lead could hold several applications. Passing another intake
	raises a second application — a candidate hedging across the trust's institutions, a parent
	applying to two of its schools, a Class XI applicant wanting both the Bio and the Commerce
	group. Repeating the call for an intake already applied for returns that application rather
	than a second one, so a double-click is still safe.

	The fee must already be collected: this institution hands out its application form only after
	the fee is taken, and the pipeline says the same thing — an unpaid lead cannot reach
	"Application Submitted".
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

	intake = programme_intake or lead.programme_intake
	programme = _programme_of(intake) or lead.programme

	# Scoped on the *target* institution, not the lead's. A second application may be at another
	# institution of the trust, and raising it there is an act at that institution — so the caller
	# has to be permitted for it. Without this the lead's own scope would be the only check, and a
	# counsellor at one institution could enter applicants into another's intake.
	if programme:
		assert_institution_in_scope(_institution_of(programme))

	existing = frappe.db.get_value(
		"Admission Application",
		{"admission_enquiry": enquiry, "programme_intake": intake},
		"name",
	)
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
	application.admission_type = lead.admission_type
	application.programme = programme
	application.programme_intake = intake

	if programme:
		# The branch this application admits to is its own first choice until the form says
		# otherwise. Seeded from the *target* programme rather than the lead's, so a second
		# application does not open with the first one's choice at the top of its list.
		application.append("preferences", {"preference_order": 1, "programme": programme})

	for row in required_documents_for(intake):
		application.append("documents", row)

	application.insert()
	return _application_result(application.name, created=True)


def _programme_of(programme_intake: str | None) -> str | None:
	"""The programme an intake belongs to. The application's own controller re-checks the pairing."""
	if not programme_intake:
		return None
	return frappe.db.get_value("Programme Intake", programme_intake, "programme")


def _institution_of(programme: str) -> str:
	return frappe.db.get_value("Programme", programme, "institution")


def required_documents_for(programme_intake: str) -> list[dict]:
	"""The checklist an intake publishes, as rows ready to append to an application.

	The list is per-intake rather than global because it is where the school/institution difference
	actually lives: a school class asks for a birth certificate and a transfer certificate, an
	engineering intake for mark sheets, a community certificate and the counselling allotment order.
	One doctype, different data — no rule keyed on the institution's type.
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
