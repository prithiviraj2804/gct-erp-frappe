# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

import uuid

import frappe
from frappe import _
from frappe.model.document import Document

from erp.admission.eligibility import assert_prior_qualification
from erp.admission.follow_up_state import derive_follow_up_state
from erp.admission.pipeline import assert_status_transition
from erp.master.doctype.institution_type.institution_type import institution_requires_department
from erp.master.hierarchy import validate_same_parent
from erp.utils import normalize_aadhaar, normalize_phone

# The gate desk's record, held read-only on an enquiry started from a pass: the Aadhaar the
# duplicate check keys on, and the reference block that decides who is credited with the walk-in.
# `read_only_depends_on` greys these in the Desk form; this re-copies them from the pass on every
# save so the lock holds against the API and the SPA too. The other carried fields (name, phone,
# institution, …) are set once by the form script and stay the counsellor's to correct.
GATE_PASS_LOCKED_FIELDS = (
	"aadhaar_number",
	"reference",
	"staff_reference",
	"consultancy",
	"student_reference",
	"source_details",
)


class AdmissionEnquiry(Document):
	def validate(self):
		self.set_derived_ancestors()
		self.sync_from_gate_pass()
		self.set_academic_year()
		self.normalize_contact()
		self.validate_department()
		self.validate_hierarchy()
		self.validate_unique_aadhaar()
		self.validate_previous_education()
		self.enforce_pipeline_gates()
		self.set_follow_up_state()
		self.ensure_child_ids()

	def set_derived_ancestors(self):
		"""Re-derive the institution's ancestors rather tha trust the copies on the row.

		`trust`, `campus` and `programme_level` are `fetch_from` fields, filled by
		`_validate_links` — which `flags.ignore_links` skips. Deriving them here means the
		hierarchy check below is comparing against the institution's real parent, not a stale copy
		left behind when someone moved the enquiry to a different institution.
		"""
		if self.institution:
			institution = frappe.db.get_value(
				"Institution", self.institution, ["trust", "campus"], as_dict=True
			)
			if institution:
				self.trust = institution.trust
				self.campus = institution.campus

		if self.programme:
			self.programme_level = frappe.db.get_value("Programme", self.programme, "programme_level")

	def sync_from_gate_pass(self):
		"""Hold the Aadhaar and reference block to what the gate desk recorded.

		The form script fetches these onto the enquiry when a pass is picked, and
		`read_only_depends_on` greys them out — but that is only a Desk hint. Re-copying them from
		the pass on every save makes "not editable" real: the identity the duplicate check keys on
		and the referral credit cannot be rewritten through the API or the SPA either.
		"""
		if not self.gate_pass:
			return

		pass_values = frappe.db.get_value(
			"Admission Gate Pass", self.gate_pass, GATE_PASS_LOCKED_FIELDS, as_dict=True
		)
		if pass_values:
			for field in GATE_PASS_LOCKED_FIELDS:
				self.set(field, pass_values.get(field))

	def set_academic_year(self):
		"""Stamp the enquiry with the trust's open admission year.

		Left blank rather than thrown when no year is flagged open — the same choice the gate
		pass makes: a counsellor logging a walk-in should not be blocked because an administrator
		has not ticked `is_admission_open` yet. Re-derived when the trust changes so a stale
		year never survives a move to another tenant.
		"""
		if not self.trust:
			return

		if self.academic_year:
			year_trust = frappe.db.get_value("Academic Year", self.academic_year, "trust")
			if year_trust == self.trust:
				return

		self.academic_year = frappe.db.get_value(
			"Academic Year", {"trust": self.trust, "is_admission_open": 1}, "name"
		)

	def normalize_contact(self):
		"""Store the searchable forms of the student's phone and Aadhaar.

		Only the student's own phone and Aadhaar are normalised. `parent_phone` is left as typed
		— a guardian's number is often a landline, and forcing it to ten digits would reject a
		real one.
		"""
		if self.phone_number:
			self.phone_number = normalize_phone(self.phone_number)

		if self.aadhaar_number:
			self.aadhaar_number = normalize_aadhaar(self.aadhaar_number)

	def validate_department(self):
		"""Require a Department for every institution that is not a School.

		`department` is optional on the schema because a school may admit into a class that sits
		under no department. A degree-awarding institution always names one, so the rule is enforced
		here, turning on the institution's type, rather than with a static `reqd`. Which types
		require one is a row on `Institution Type`, not a literal here.

		Mirrors a real `reqd` field: skipped under `ignore_mandatory`, so the `New` stub
		`start_from_gate_pass` inserts (institution known, department not yet chosen) is not blocked —
		the counsellor supplies it when they complete the enquiry.
		"""
		if self.department or self.flags.ignore_mandatory:
			return

		if institution_requires_department(self.institution):
			frappe.throw(
				_("Department is required for this institution."),
				title=_("Department Required"),
			)

	def validate_hierarchy(self):
		"""Keep the whole choice — and every named referrer — inside one trust.

		A Link proves a record exists, never that it sits in this enquiry's branch, so each
		denormalised ancestor is an independent claim to reconcile. The referrer and counsellor
		Staff/Consultancy links are checked for the same reason the institution is: a Link accepts any
		record in the system, so an enquiry raised at one trust could otherwise credit a
		counsellor or agency belonging to another tenant.
		"""
		validate_same_parent(self, "institution", "trust")
		validate_same_parent(self, "department", "institution", "trust")
		validate_same_parent(self, "programme", "department", "institution", "trust")
		validate_same_parent(self, "academic_year", "trust")
		validate_same_parent(self, "programme_intake", "programme", "institution", "trust")
		validate_same_parent(self, "consultancy", "trust")
		validate_same_parent(self, "staff_reference", "trust")
		validate_same_parent(self, "counsellor", "trust")

	def validate_unique_aadhaar(self):
		"""One enquiry per student (Aadhaar) per trust per admission year.

		Aadhaar is optional here — an enquiry can be logged before the number is on hand — so the
		check only runs once it is present. Scoped to trust + academic_year: a student may
		re-enquire in a later cycle or at another trust, but a second live enquiry in the
		same cycle is a duplicate that would split their history across two records.
		"""
		if not (self.aadhaar_number and self.trust and self.academic_year):
			return

		filters = {
			"aadhaar_number": self.aadhaar_number,
			"trust": self.trust,
			"academic_year": self.academic_year,
		}
		if not self.is_new():
			filters["name"] = ["!=", self.name]

		duplicate = frappe.db.exists("Admission Enquiry", filters)
		if duplicate:
			frappe.throw(
				_("An enquiry for Aadhaar {0} already exists at this trust for {1} ({2}).").format(
					frappe.bold(self.aadhaar_number),
					frappe.bold(self.academic_year),
					frappe.bold(duplicate),
				),
				title=_("Duplicate Enquiry"),
			)

	def validate_previous_education(self):
		"""Require the prior qualification the chosen course actually rests on.

		`mandatory_depends_on` and `link_filters` are Desk-form conveniences the server never
		enforces, so the requirement lives on the server. The rule itself is in
		`erp/admission/eligibility.py` because the Admission Application checks it a second time,
		against the programme actually being admitted to — which a counselling allotment routinely
		makes a different one.
		"""
		assert_prior_qualification(self.programme, self.admission_type, self.previous_education)

	def ensure_child_ids(self):
		"""Give every previous-education row the standard UUID `id`.

		The global `before_insert` UUID hook acts on top-level documents; child rows are saved
		through the parent and do not reliably pass through it. Stamping them here, in the parent's
		`validate`, keeps the `id` convention true for the grid without depending on that hook.
		"""
		for row in self.previous_education:
			if not row.get("id"):
				row.id = str(uuid.uuid4())

	def enforce_pipeline_gates(self):
		"""Block an advance the lead has not earned — fee unpaid, documents unverified, no seat.

		Reads the *stored* status so only an actual transition is checked; a lead already inside a
		gated region (e.g. after a payment was cancelled) can still be saved and edited. All three
		rules are composed in `erp/admission/pipeline.py`, which the Admission Follow-up's
		`new_status` path calls too — that path writes with `set_value` and bypasses this `validate`
		entirely, so the rule cannot live here.
		"""
		previous = None if self.is_new() else self.get_db_value("status")
		assert_status_transition(
			self.name,
			self.status,
			previous,
			application_fee_paid=self.application_fee_paid,
		)

	def set_follow_up_state(self):
		"""Keep the follow-up badge honest when the lead itself is edited.

		The Admission Follow-up controller refreshes this whenever a call is logged; this covers the
		other writer — a direct edit to the lead, most importantly a stage change to a closed status,
		which should read as "Closed" at once rather than waiting for the next follow-up. `_count`
		and `next_follow_up` are the log's roll-ups, so this only re-derives the label from them.
		"""
		self.follow_up_state = derive_follow_up_state(
			self.status, self.next_follow_up, self.follow_up_count or 0
		)
