# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""The single definition of an application's state, shared by everything that displays one.

An Admission Application carries a denormalised `application_state` — the at-a-glance badge an
admission office scans a list by. It is derived, never typed, from the application's own facts:
whether a student was produced, what counselling returned, whether an offer was issued and answered,
and whether the required documents have been verified.

Deliberately *not* a second pipeline. `Admission Enquiry.status` remains the one status a human
moves a lead along; this is a read-only summary of one application, the way `follow_up_state.py`
summarises a lead's follow-up log. Keeping the rule here rather than in the controller means the
state cannot drift between the doctype, a report and a future portal.

`counselling_outcome` is a *recorded external fact* — what TNEA sent back — and stays a separate
field. The two are different things: an outcome is evidence, a state is a conclusion drawn from it.
"""

from erp.master.doctype.admission_route.admission_route import requires_allotment

# Terminal outcomes that end an application: the seat went somewhere else, so nothing else follows.
OUTCOMES_NOT_OURS = frozenset({"Allotted Elsewhere", "Not Allotted"})

ADMITTED = "Admitted"
NOT_ALLOTTED = "Not Allotted"
AWAITING_COUNSELLING = "Awaiting Counselling"
DECLINED = "Declined"
ACCEPTED = "Accepted"
OFFERED = "Offered"
DOCUMENTS_VERIFIED = "Documents Verified"
DOCUMENTS_PENDING = "Documents Pending"


def required_documents_verified(documents) -> bool:
	"""Whether every document this intake insists on has had its original checked.

	Vacuously true when the intake names no required document — a school class that asks only for a
	birth certificate copy, or an intake whose checklist has not been set up. That is the honest
	answer: nothing is outstanding, so nothing should block. Rows marked optional never block.
	"""
	return all(row.original_verified for row in documents if row.is_required)


def derive_application_state(application) -> str:
	"""The furthest point this application has reached, or what it is blocked on.

	Order matters and encodes the real precedence. A produced student ends it. A seat that went
	elsewhere ends it too, and outranks any document progress — verifying certificates for a student
	TNEA sent to another institution changes nothing. Waiting on counselling outranks the offer and
	document steps because none of them can conclude until the allotment is known.
	"""
	if application.student:
		return ADMITTED

	# Asked of the *route*, not compared against a literal. `admission_route == "Government Quota"`
	# was right for exactly the three routes the old Select offered, and silently wrong for the
	# fourth: an NRI or minority-quota seat also waits on somebody else's decision, and adding it to
	# a Select would have left this branch skipping it. Only the route knows.
	if requires_allotment(application.admission_route):
		if application.counselling_outcome in OUTCOMES_NOT_OURS:
			return NOT_ALLOTTED
		if not application.counselling_outcome or application.counselling_outcome == "Awaited":
			return AWAITING_COUNSELLING

	if application.offer_response == "Declined":
		return DECLINED
	if application.offer_response == "Accepted":
		return ACCEPTED
	if application.offer_issued_on:
		return OFFERED

	if required_documents_verified(application.documents):
		return DOCUMENTS_VERIFIED

	return DOCUMENTS_PENDING
