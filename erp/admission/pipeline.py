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

**A lead may hold several applications, and any one of them clearing a gate advances the lead.**
The enquiry's status is the lead's *furthest progress*, not the progress of every application it
raised: a candidate whose choice list spans two of the trust's institutions has cleared documents
the moment one of those applications has, and it would be nonsense to hold the lead back because a
second application elsewhere is still waiting on a counselling round it may never win.

That is why each gate below answers with an *objection* rather than throwing. Throwing was correct
while `application_for` was a single lookup; with several applications the first one's complaint is
not the lead's answer, and the office needs to be told what stands in the way of **every** route
rather than the first. When only one application exists the message is byte-identical to what it
was, which is deliberate — the generalisation should be invisible in the common case.
"""

import frappe
from frappe import _
from frappe.utils import getdate

from erp.admission.application_state import (
	OUTCOMES_NOT_OURS,
	required_documents_verified,
)
from erp.admission.fee_gate import assert_fee_paid_for_status
from erp.admission.stages import ADMISSION, DOCUMENTS, INTERACTION, required_gates
from erp.master.doctype.admission_route.admission_route import requires_allotment

# The gates that are answered by an *application* rather than by the lead. The fee is the lead's
# own fact — `Admission Enquiry.application_fee_paid` — so it is not here; everything else needs a
# document to interrogate, which is why reaching any of these requires an application to exist.
APPLICATION_GATES = frozenset({INTERACTION, DOCUMENTS, ADMISSION})

# Student statuses that hold a seat. Mirrors `Student.OCCUPYING_STATUSES`; kept as a query filter
# here so a withdrawal slice frees seats by flipping a status, with no change to this module.
OCCUPYING_STATUSES = ("Active",)


def seats_taken(
	programme_intake: str,
	*,
	exclude_enquiry: str | None = None,
	admission_route: str | None = None,
	reservation_category: str | None = None,
) -> int:
	"""How many seats of an intake are occupied right now, optionally within one pool.

	`exclude_enquiry` leaves out the student already created for the enquiry being admitted, so the
	check answers "is there room for this applicant" rather than "is there room for a further one".
	Without it, confirming the last seat would fail: `confirm_admission` creates the Student before
	writing the enquiry's status, so the re-run of this gate would count the new student against
	their own seat.

	`admission_route` and `reservation_category` narrow the count to one sanctioned pool. A pool
	naming no category counts every student on that route whatever their category, which is what
	makes a blank category in the matrix mean "the whole route".
	"""
	filters = {"programme_intake": programme_intake, "status": ["in", OCCUPYING_STATUSES]}
	if exclude_enquiry:
		filters["admission_enquiry"] = ["!=", exclude_enquiry]
	if admission_route:
		filters["admission_route"] = admission_route
	if reservation_category:
		filters["reservation_category"] = reservation_category

	return frappe.db.count("Student", filters)


def seat_pool_for(programme_intake: str, admission_route: str | None, reservation_category: str | None):
	"""The sanctioned pool this applicant's seat would come out of, or None if none is declared.

	Most specific wins, which is the same rule the whole configuration layer runs on: a row naming
	both the route and the category beats one naming only the route. A matrix can therefore state
	the route's pool once and carve a category out of it without the office doing arithmetic in two
	places.

	Returns None when the intake declares no matrix at all *or* when it declares one that says
	nothing about this route — the two are different situations and `seat_objection` tells them
	apart, because a matrix that omits a route is an incomplete matrix rather than an absent one.
	"""
	rows = frappe.get_all(
		"Programme Intake Seat",
		filters={"parent": programme_intake, "parenttype": "Programme Intake"},
		fields=["admission_route", "reservation_category", "sanctioned_seats"],
		order_by="idx",
	)
	if not rows:
		return None

	exact = next(
		(
			row
			for row in rows
			if row.admission_route == admission_route
			and (row.reservation_category or None) == (reservation_category or None)
		),
		None,
	)
	if exact:
		return exact

	return next(
		(row for row in rows if row.admission_route == admission_route and not row.reservation_category),
		None,
	)


def applications_for(enquiry: str) -> list:
	"""Every Admission Application raised from this lead, furthest along first.

	Ordered by `application_date` so that the objection reported when none of them clears a gate is
	the one the office is most likely to be working on. `frappe.get_all` is right here despite
	bypassing permissions: the caller has already been cleared to write the *enquiry*, and these
	applications are that enquiry's own — several of them at institutions the caller may not be
	scoped for, which is precisely the case the gate has to reason about. Refusing to see them
	would let a lead advance on a gate it had not cleared.
	"""
	if not enquiry:
		return []

	names = frappe.get_all(
		"Admission Application",
		filters={"admission_enquiry": enquiry},
		pluck="name",
		order_by="application_date asc, creation asc",
	)
	return [frappe.get_doc("Admission Application", name) for name in names]


def assert_status_transition(enquiry, new_status, previous_status=None, *, application_fee_paid=0):
	"""The one gate every status-writer calls before moving a lead.

	`enquiry` is the lead's name; `application_fee_paid` is passed in rather than read back because
	a brand-new enquiry has no stored row to read it from.
	"""
	institution = frappe.db.get_value("Admission Enquiry", enquiry, "institution")

	assert_fee_paid_for_status(new_status, application_fee_paid, previous_status, institution=institution)

	required = required_gates(new_status, previous_status, institution) & APPLICATION_GATES
	if not required:
		return

	applications = applications_for(enquiry)
	if not applications:
		frappe.throw(
			_("Raise an Admission Application before moving this enquiry to {0}.").format(
				frappe.bold(new_status)
			),
			title=_("No Application"),
		)

	objections = []
	for application in applications:
		objection = _objection(application, enquiry, new_status, required)
		# One route through is enough. The lead's status is its furthest progress, so a second
		# application still waiting on a counselling round it may never win must not hold it back.
		if objection is None:
			return
		objections.append((application.name, objection))

	_throw(objections, new_status)


def assert_application_clears(application, new_status: str, *, application_fee_paid=0) -> None:
	"""Every gate, against **one named application** rather than the lead's best route.

	`assert_status_transition` above answers a question about the *lead*: may this enquiry move to
	`new_status`. Any one of its applications clearing the gate is enough, because the lead's status
	is its furthest progress.

	Admitting is a different question, and it needs this. With two applications — one admissible,
	one still awaiting a counselling round — the lead-level question answers yes for both, so
	`confirm_admission` on the wrong one would pass a gate it had not cleared and take a seat in an
	intake that never allotted it. The lead may be admitted; *this application* may not.

	`previous_status=None` on purpose, as at the `confirm_admission` call site: it means "coming
	from outside every gated region", so every gate runs rather than only the advance-only subset a
	plain save gets.
	"""
	assert_fee_paid_for_status(new_status, application_fee_paid, None, institution=application.institution)

	objection = _objection(
		application,
		application.admission_enquiry,
		new_status,
		required_gates(new_status, None, application.institution) & APPLICATION_GATES,
	)
	if objection:
		frappe.throw(objection.message, title=objection.title)


def _objection(application, enquiry, new_status, required: frozenset[str]) -> "_Objection | None":
	"""What stands between this one application and `new_status`, or None if nothing does.

	`required` is the set of gates that apply — to this transition, at this institution. A gate not
	in it is not part of this institution's pipeline and is not asked: a government arts college is
	not asked for a fee, and an engineering college admitting on a counselling allotment is not
	asked whether it interviewed the family.

	Order matters to whoever reads the error, and it is deliberate rather than alphabetical. The
	seat-already-taken and allotment objections come first because they are the two the office
	cannot remedy: an applicant counselling sent to another institution is not going to be admitted
	here however many certificates are produced, so telling them to go and verify documents first
	would send them down a road that ends nowhere.
	"""
	if ADMISSION in required:
		objection = already_admitted_objection(application)
		if objection:
			return objection

		objection = allotment_objection(application)
		if objection:
			return objection

	if INTERACTION in required:
		objection = interaction_objection(application, new_status)
		if objection:
			return objection

	if DOCUMENTS in required:
		objection = documents_objection(application, new_status)
		if objection:
			return objection

	if ADMISSION in required:
		objection = admissibility_objection(application, enquiry)
		if objection:
			return objection

	return None


class _Objection:
	"""One reason an application cannot advance: a dialog title and the sentence under it.

	A pair rather than a bare string because the title is what the office reads first and it names
	the *kind* of problem — "Allotment Awaited" is a different job from "Documents Not Verified".
	Composing several objections has to keep that distinction, so it cannot be flattened.
	"""

	__slots__ = ("message", "title")

	def __init__(self, title: str, message: str):
		self.title = title
		self.message = message


def _throw(objections: list[tuple[str, _Objection]], new_status: str) -> None:
	"""Report why no application cleared the gate.

	With one application the message and title are byte-identical to what they were before a lead
	could hold several — the generalisation should be invisible in the common case, and the existing
	messages were written with care.

	With several, each is named with the application it belongs to. Listing them beats reporting the
	first, because the office's next action depends on which route is closest: chasing a certificate
	for one application is worth doing, waiting on a counselling round for another is not.
	"""
	if len(objections) == 1:
		objection = objections[0][1]
		frappe.throw(objection.message, title=objection.title)

	lines = "".join(f"<li>{frappe.bold(name)} — {objection.message}</li>" for name, objection in objections)
	frappe.throw(
		_("None of this lead's applications can reach {0} yet:").format(frappe.bold(new_status))
		+ f"<ul>{lines}</ul>",
		title=_("Cannot Advance"),
	)


def already_admitted_objection(application) -> _Objection | None:
	"""A lead may hold several applications and be admitted on exactly one.

	Several applications are a candidate hedging across the trust's institutions. Several
	*admissions* are a double-counted student, a seat consumed in two intakes, and two rows in the
	statutory register.

	Checked here, before anything is written, rather than left to `Student.validate_unique_aadhaar`.
	That check is the backstop and it is not enough on its own: it returns early when no Aadhaar was
	recorded — which is exactly the lead most likely to be entered twice — and it fires while the
	Student is being inserted, so the office reads "Student ... already exists" about a register row
	rather than "this applicant is already admitted on application X".

	Asked of the *other* applications, so it never objects to the admitted one itself: at lead level
	that application clears the gate and the lead is correctly allowed to be Admitted.
	"""
	if not application.admission_enquiry or application.student:
		return None

	other = frappe.db.get_value(
		"Admission Application",
		{
			"admission_enquiry": application.admission_enquiry,
			"student": ["is", "set"],
			"name": ["!=", application.name or ""],
		},
		["name", "student"],
		as_dict=True,
	)
	if not other:
		return None

	return _Objection(
		_("Already Admitted Elsewhere"),
		_(
			"This applicant has already been admitted as {0} on application {1}. A lead may hold "
			"several applications and be admitted on one of them; withdraw that admission before "
			"recording another."
		).format(frappe.bold(other.student), frappe.bold(other.name)),
	)


def interaction_objection(application, new_status) -> _Objection | None:
	"""The family must have been met, and the outcome recorded, before a place is offered.

	The gate a school has and an engineering college does not. A K-12 admission turns on a
	conversation with the parents and, above the entry class, a readiness assessment; an institution
	admitting on an external counselling allotment has no such step and never will.

	It is here rather than in a school-only module because that is the whole point of the stage
	table: a gate is a row, its applicability is a capability on the Institution Type tree, and
	adding one costs an entry in `GATES`, a `Select` on the type, and this function. No branch on
	`institution_type` anywhere — `_objection` never asks what kind of institution this is, only
	which gates it was handed.

	"Not Recommended" is refused as firmly as an unrecorded interaction, and separately, because the
	two are different facts and the office's next step differs: one needs the meeting to happen, the
	other needs a decision reversed by someone who can reverse it.
	"""
	if application.interaction_outcome == "Recommended":
		return None

	if application.interaction_outcome == "Not Recommended":
		return _Objection(
			_("Not Recommended"),
			_(
				"The admission interaction on {0} recorded this applicant as Not Recommended, so they "
				"cannot advance to {1}."
			).format(
				frappe.bold(frappe.format(application.interaction_on, {"fieldtype": "Date"})),
				frappe.bold(new_status),
			),
		)

	return _Objection(
		_("Interaction Awaited"),
		_("Record the admission interaction and its outcome before {0}.").format(frappe.bold(new_status)),
	)


def documents_objection(application, new_status) -> _Objection | None:
	"""Every required certificate must have had its original checked.

	Originals are seen in the applicant's presence and handed straight back — UGC and AICTE forbid
	an institution keeping them — so "verified" is an event, not custody, and this is the only place
	the pipeline asks whether it happened.
	"""
	if required_documents_verified(application.documents):
		return None

	outstanding = [
		row.document_type for row in application.documents if row.is_required and not row.original_verified
	]
	return _Objection(
		_("Documents Not Verified"),
		_("These documents are still unverified: {0}. They must be checked before {1}.").format(
			frappe.bold(", ".join(outstanding)), frappe.bold(new_status)
		),
	)


def allotment_objection(application) -> _Objection | None:
	"""On a route that waits on an external body, counselling must actually have sent us this
	applicant.

	Only such a route is asked: a management-quota or direct seat is the institution's own to give,
	and no external body allots it.

	The question is put to the **route** rather than compared against `"Government Quota"`. The
	literal was right for exactly the three routes the old Select offered, and it was right by
	accident — the gate does not care which route this is, only whether the route waits on somebody
	else. Add `NRI` or a state minority quota to a Select and this gate goes silently quiet on it;
	add it as a row with `requires_allotment` and the gate fires with no deploy.
	"""
	if not requires_allotment(application.admission_route):
		return None

	if application.counselling_outcome in OUTCOMES_NOT_OURS:
		return _Objection(
			_("Not Allotted To This Institution"),
			_("Counselling recorded this applicant as {0}, so they cannot be admitted here.").format(
				frappe.bold(application.counselling_outcome)
			),
		)

	if application.counselling_outcome != "Allotted To Us":
		return _Objection(
			_("Allotment Awaited"),
			_("Record the counselling allotment before admitting this applicant."),
		)

	return None


def admissibility_objection(application, enquiry) -> _Objection | None:
	"""The last checks before a lead becomes a student: the offer stands, and the seat is free."""
	# An offer is optional — a counselling allotment is its own offer, and a management-quota seat is
	# often settled across a desk. But an offer that *was* issued has to have been accepted, and not
	# after it lapsed, or the record would say a student accepted terms they never did.
	if application.offer_issued_on:
		if application.offer_response != "Accepted":
			return _Objection(
				_("Offer Not Accepted"),
				_("The offer issued on {0} has not been accepted.").format(
					frappe.bold(frappe.format(application.offer_issued_on, {"fieldtype": "Date"}))
				),
			)
		if (
			application.offer_expires_on
			and application.offer_response_on
			and getdate(application.offer_response_on) > getdate(application.offer_expires_on)
		):
			return _Objection(
				_("Offer Expired"),
				_("The offer expired on {0} and was answered only on {1}.").format(
					frappe.bold(frappe.format(application.offer_expires_on, {"fieldtype": "Date"})),
					frappe.bold(frappe.format(application.offer_response_on, {"fieldtype": "Date"})),
				),
			)

	return seat_objection(
		application.programme_intake,
		exclude_enquiry=enquiry,
		admission_route=application.admission_route,
		reservation_category=application.reservation_category,
	)


def seat_objection(
	programme_intake: str,
	*,
	exclude_enquiry: str | None = None,
	admission_route: str | None = None,
	reservation_category: str | None = None,
) -> _Objection | None:
	"""Refuse an admission that would take an intake past its sanctioned seats.

	Two checks, and both have to hold. The **pool** check is the one this slice adds: if the intake
	declares a seat matrix, the applicant's own `(route, category)` pool must have room, because a
	general candidate taking a reserved seat is wrong even while the intake as a whole is half
	empty — and it is wrong in a way nobody notices until the returns are filed. The **total** check
	stays because a matrix may legitimately sanction fewer seats than the intake has, leaving an
	unreserved remainder that still may not overflow it.

	An intake that declares no matrix keeps exactly the behaviour it had: one number, one queue.
	"""
	if not programme_intake:
		return None

	objection = _pool_objection(programme_intake, exclude_enquiry, admission_route, reservation_category)
	if objection:
		return objection

	total = frappe.db.get_value("Programme Intake", programme_intake, "total_seats")
	if not total:
		return None

	taken = seats_taken(programme_intake, exclude_enquiry=exclude_enquiry)
	if taken >= total:
		return _Objection(
			_("No Seats Left"),
			_("{0} is full — all {1} seats are taken.").format(
				frappe.bold(programme_intake), frappe.bold(total)
			),
		)

	return None


def _pool_objection(
	programme_intake: str,
	exclude_enquiry: str | None,
	admission_route: str | None,
	reservation_category: str | None,
) -> _Objection | None:
	"""Whether the applicant's own sanctioned pool has room, when the intake declares a matrix.

	A matrix that names no pool for this route is refused rather than waved through. That is the
	point of a seat matrix: the institution has written down where every seat comes from, so a
	route it did not write down has no sanctioned seats — and the message names the missing pool,
	which is exactly what the office needs to add.
	"""
	pool = seat_pool_for(programme_intake, admission_route, reservation_category)
	if pool is None:
		if not frappe.db.exists(
			"Programme Intake Seat", {"parent": programme_intake, "parenttype": "Programme Intake"}
		):
			return None

		return _Objection(
			_("No Sanctioned Pool"),
			_(
				"{0}'s seat matrix sanctions no seats on {1}. Add a seat row for that route — or for "
				"that route and {2} — before admitting on it."
			).format(
				frappe.bold(programme_intake),
				frappe.bold(admission_route or _("no route")),
				frappe.bold(reservation_category or _("no category")),
			),
		)

	taken = seats_taken(
		programme_intake,
		exclude_enquiry=exclude_enquiry,
		admission_route=pool.admission_route,
		reservation_category=pool.reservation_category,
	)
	if taken >= (pool.sanctioned_seats or 0):
		return _Objection(
			_("Pool Full"),
			_("All {0} seats sanctioned for {1} on {2} are taken.").format(
				frappe.bold(pool.sanctioned_seats or 0),
				frappe.bold(
					f"{pool.admission_route} / {pool.reservation_category}"
					if pool.reservation_category
					else pool.admission_route
				),
				frappe.bold(programme_intake),
			),
		)

	return None


def assert_seat_available(programme_intake: str, *, exclude_enquiry: str | None = None) -> None:
	"""`seat_objection`, thrown. Kept because a seat check is worth asking for on its own."""
	objection = seat_objection(programme_intake, exclude_enquiry=exclude_enquiry)
	if objection:
		frappe.throw(objection.message, title=objection.title)
