# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Every rule that gates a lead's advance along the admission pipeline, in one place.

`Admission Enquiry.status` is written from more than one place — a direct save, and an Admission
Follow-up's `new_status` path, which uses `frappe.db.set_value` and so bypasses the enquiry's
`validate`. `fee_gate.py` already states the resulting invariant: *any* status-writer must consult
the gate before moving a lead forward. Three separate rules would mean three things each writer has
to remember, so they are composed here into one call.

**Invariant: a status-writer calls `assert_status_transition` and nothing else.** Adding a fourth
rule then means editing this module, not hunting down every writer.

Each rule fires only when a lead *enters* the region it guards, never on a save inside it. A lead
already at "Documents Verified" whose payment was later cancelled can still be edited; the gates are
about advancing, not about re-litigating history. That is `fee_gate.py`'s rule, kept uniform.
"""

import frappe
from frappe import _
from frappe.utils import getdate

from erp.admission.application_state import (
	GOVERNMENT_QUOTA,
	OUTCOMES_NOT_OURS,
	required_documents_verified,
)
from erp.admission.fee_gate import assert_fee_paid_for_status

# Stages that assert the applicant's certificates have been seen.
DOCUMENT_GATED_STATUSES = frozenset({"Documents Verified", "Admitted"})

# The single stage that consumes a seat and produces a student.
ADMISSION_GATED_STATUSES = frozenset({"Admitted"})

# Student statuses that hold a seat. Mirrors `Student.OCCUPYING_STATUSES`; kept as a query filter
# here so a withdrawal slice frees seats by flipping a status, with no change to this module.
OCCUPYING_STATUSES = ("Active",)


def _entering(new_status: str, previous_status: str | None, region: frozenset) -> bool:
	"""Whether this transition crosses *into* `region` from outside it.

	`previous_status=None` means a brand-new record, treated as coming from outside.
	"""
	return new_status in region and (previous_status is None or previous_status not in region)


def seats_taken(programme_intake: str, *, exclude_enquiry: str | None = None) -> int:
	"""How many seats of an intake are occupied right now.

	`exclude_enquiry` leaves out the student already created for the enquiry being admitted, so the
	check answers "is there room for this applicant" rather than "is there room for a further one".
	Without it, confirming the last seat would fail: `confirm_admission` creates the Student before
	writing the enquiry's status, so the re-run of this gate would count the new student against
	their own seat.
	"""
	filters = {"programme_intake": programme_intake, "status": ["in", OCCUPYING_STATUSES]}
	if exclude_enquiry:
		filters["admission_enquiry"] = ["!=", exclude_enquiry]

	return frappe.db.count("Student", filters)


def application_for(enquiry: str):
	"""The one Admission Application raised from this lead, or None.

	An enquiry carries at most one application — a change of branch or of quota is an edit to it,
	not a second record — so this is a single lookup rather than a "most recent" guess.
	"""
	if not enquiry:
		return None

	name = frappe.db.get_value("Admission Application", {"admission_enquiry": enquiry}, "name")
	return frappe.get_doc("Admission Application", name) if name else None


def assert_status_transition(enquiry, new_status, previous_status=None, *, application_fee_paid=0):
	"""The one gate every status-writer calls before moving a lead.

	`enquiry` is the lead's name; `application_fee_paid` is passed in rather than read back because
	a brand-new enquiry has no stored row to read it from.
	"""
	assert_fee_paid_for_status(new_status, application_fee_paid, previous_status)

	needs_documents = _entering(new_status, previous_status, DOCUMENT_GATED_STATUSES)
	needs_admission = _entering(new_status, previous_status, ADMISSION_GATED_STATUSES)
	if not (needs_documents or needs_admission):
		return

	application = application_for(enquiry)
	if not application:
		frappe.throw(
			_("Raise an Admission Application before moving this enquiry to {0}.").format(
				frappe.bold(new_status)
			),
			title=_("No Application"),
		)

	# Order matters to whoever reads the error. The allotment outcome is checked first because it is
	# the one thing the office cannot remedy: an applicant counselling sent to another college is not
	# going to be admitted here however many certificates are produced, so telling them to go and
	# verify documents first would send them down a road that ends nowhere.
	if needs_admission:
		assert_allotted_to_us(application)

	if needs_documents:
		assert_documents_verified(application, new_status)

	if needs_admission:
		assert_admissible(application, enquiry)


def assert_documents_verified(application, new_status) -> None:
	"""Every required certificate must have had its original checked.

	Originals are seen in the applicant's presence and handed straight back — UGC and AICTE forbid
	an institution keeping them — so "verified" is an event, not custody, and this is the only place
	the pipeline asks whether it happened.
	"""
	if required_documents_verified(application.documents):
		return

	outstanding = [
		row.document_type for row in application.documents if row.is_required and not row.original_verified
	]
	frappe.throw(
		_("These documents are still unverified: {0}. They must be checked before {1}.").format(
			frappe.bold(", ".join(outstanding)), frappe.bold(new_status)
		),
		title=_("Documents Not Verified"),
	)


def assert_allotted_to_us(application) -> None:
	"""For a government-quota seat, counselling must actually have sent this applicant to us.

	Only a government-quota application is asked: a management-quota or direct seat is the college's
	own to give, and no external body allots it.
	"""
	if application.admission_route != GOVERNMENT_QUOTA:
		return

	if application.counselling_outcome in OUTCOMES_NOT_OURS:
		frappe.throw(
			_("Counselling recorded this applicant as {0}, so they cannot be admitted here.").format(
				frappe.bold(application.counselling_outcome)
			),
			title=_("Not Allotted To This College"),
		)

	if application.counselling_outcome != "Allotted To Us":
		frappe.throw(
			_("Record the counselling allotment before admitting this applicant."),
			title=_("Allotment Awaited"),
		)


def assert_admissible(application, enquiry) -> None:
	"""The last checks before a lead becomes a student: the offer stands, and the seat is free."""
	# An offer is optional — a counselling allotment is its own offer, and a management-quota seat is
	# often settled across a desk. But an offer that *was* issued has to have been accepted, and not
	# after it lapsed, or the record would say a student accepted terms they never did.
	if application.offer_issued_on:
		if application.offer_response != "Accepted":
			frappe.throw(
				_("The offer issued on {0} has not been accepted.").format(
					frappe.bold(frappe.format(application.offer_issued_on, {"fieldtype": "Date"}))
				),
				title=_("Offer Not Accepted"),
			)
		if (
			application.offer_expires_on
			and application.offer_response_on
			and getdate(application.offer_response_on) > getdate(application.offer_expires_on)
		):
			frappe.throw(
				_("The offer expired on {0} and was answered only on {1}.").format(
					frappe.bold(frappe.format(application.offer_expires_on, {"fieldtype": "Date"})),
					frappe.bold(frappe.format(application.offer_response_on, {"fieldtype": "Date"})),
				),
				title=_("Offer Expired"),
			)

	assert_seat_available(application.programme_intake, exclude_enquiry=enquiry)


def assert_seat_available(programme_intake: str, *, exclude_enquiry: str | None = None) -> None:
	"""Refuse an admission that would take an intake past its sanctioned seats."""
	if not programme_intake:
		return

	total = frappe.db.get_value("Programme Intake", programme_intake, "total_seats")
	if not total:
		return

	taken = seats_taken(programme_intake, exclude_enquiry=exclude_enquiry)
	if taken >= total:
		frappe.throw(
			_("{0} is full — all {1} seats are taken.").format(
				frappe.bold(programme_intake), frappe.bold(total)
			),
			title=_("No Seats Left"),
		)
