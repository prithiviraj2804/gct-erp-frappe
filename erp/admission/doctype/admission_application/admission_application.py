# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

import uuid

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import today

from erp.admission.application_state import derive_application_state
from erp.admission.eligibility import assert_prior_qualification, enquiry_education
from erp.admission.pipeline import already_admitted_objection
from erp.master.doctype.programme_intake.programme_intake import assert_age_within_window
from erp.master.hierarchy import validate_same_parent

# Read off the lead once and held read-only here: the applicant's identity and the cycle they are
# applying in. The *choice* fields are deliberately absent — the programme this application admits
# to is its own, because a counselling allotment routinely differs from what was enquired about.
ENQUIRY_FIELDS = ("student_name", "counsellor", "trust", "campus", "academic_year")

# Fields that decide which seat is being taken. Locked once a student exists: moving an admitted
# student to another branch is a transfer, a different journey with its own approvals.
SEAT_FIELDS = ("programme", "programme_intake", "admission_type")


class AdmissionApplication(Document):
	def validate(self):
		self.sync_from_enquiry()
		self.set_derived_ancestors()
		self.guard_seat_change_after_admission()
		self.validate_one_per_intake()
		self.validate_one_admission_per_lead()
		self.validate_intake_matches_programme()
		self.validate_hierarchy()
		self.validate_eligibility()
		self.validate_offer()
		self.set_application_state()
		self.ensure_child_ids()

	def sync_from_enquiry(self):
		"""Re-copy the applicant's identity and cycle from the lead.

		`fetch_from` fills these in the Desk form, but that is a client convenience the server does
		not enforce and `flags.ignore_links` skips entirely. Only identity and cycle are copied —
		never the programme, which this application owns.
		"""
		if not self.admission_enquiry:
			return

		enquiry = frappe.db.get_value(
			"Admission Enquiry", self.admission_enquiry, ENQUIRY_FIELDS, as_dict=True
		)
		if enquiry:
			for field in ENQUIRY_FIELDS:
				self.set(field, enquiry.get(field))

	def set_derived_ancestors(self):
		"""Derive the ancestors of the programme *this application* admits to.

		The lead's ancestors are not reusable here: a student who walked in asking for CSE and was
		allotted ECE has an application under a different department, and possibly a different
		institution. Deriving from `self.programme` is what makes the hierarchy check below compare
		against the real parents of the branch actually being taken.
		"""
		if self.programme:
			programme = frappe.db.get_value(
				"Programme",
				self.programme,
				["trust", "institution", "campus", "department", "programme_level"],
				as_dict=True,
			)
			if programme:
				self.trust = programme.trust
				self.institution = programme.institution
				self.campus = programme.campus
				self.department = programme.department
				self.programme_level = programme.programme_level

	def guard_seat_change_after_admission(self):
		"""Once a student exists, the branch and intake are settled.

		A programme change before admission is ordinary — it is how a counselling allotment is
		recorded. After admission it is an internal transfer: it needs a vacancy in the target
		branch, usually university approval, and it has to move the seat from one intake's count to
		another. None of that is built, so rather than let a silent edit leave the register wrong,
		it is refused.
		"""
		if self.is_new() or not self.student:
			return

		for field in SEAT_FIELDS:
			if self.get(field) != self.get_db_value(field):
				frappe.throw(
					_(
						"{0} cannot be changed once {1} has been admitted. A branch transfer is a separate process."
					).format(frappe.bold(self.meta.get_label(field)), frappe.bold(self.student)),
					title=_("Already Admitted"),
				)

	def validate_one_per_intake(self):
		"""One application per lead **per intake**, not one per lead.

		This used to be one per lead, on the reasoning that "a change of branch or of quota is an
		edit to this application, not a second record". That is true of a change of branch. It is
		not true of a second *institution*: composed with the enquiry's own uniqueness rule — one
		enquiry per Aadhaar per trust per academic year — it capped an applicant at exactly one
		application in the entire trust per cycle, and forbade journeys this group already runs. A
		TNEA candidate's choice list spans GCT and GCE. A parent applies to two of the trust's
		schools. A Class XI applicant wants both the Bio and the Commerce group.

		The invariant that actually matters was never this one. `Student.validate_unique_aadhaar`
		enforces one student record per Aadhaar per trust per admission year, so a person can still
		only be *admitted* once per cycle however many applications they raise — and
		`validate_one_admission_per_lead` below states the same thing at this level, where the
		office meets it. The office's real rule is "admitted once", not "enquired once".

		What remains refused is a second application for the same intake, which is a duplicate for
		one seat rather than a second choice. The model already permitted the rest:
		`validate_hierarchy` ties an application to its lead's **trust**, not its institution, and
		`set_derived_ancestors` takes `institution` from the programme this application admits to —
		so an application at another institution of the trust was always well-formed. Only this
		check stood in the way.

		The workaround the office would otherwise have used is worse than the rule: the enquiry's
		duplicate check returns early when `aadhaar_number` is blank, so a blank or invented Aadhaar
		bought a second application at the price of duplicate detection — and the funnel would then
		count one child as two leads.
		"""
		if not (self.admission_enquiry and self.programme_intake):
			return

		existing = frappe.db.get_value(
			"Admission Application",
			{
				"admission_enquiry": self.admission_enquiry,
				"programme_intake": self.programme_intake,
				"name": ["!=", self.name or ""],
			},
			"name",
		)
		if existing:
			frappe.throw(
				_(
					"{0} already has an application for {1} ({2}). Edit that one rather than raising a "
					"second for the same intake — a different programme or institution is a second "
					"application, the same intake twice is a duplicate."
				).format(
					frappe.bold(self.admission_enquiry),
					frappe.bold(self.programme_intake),
					frappe.bold(existing),
				),
				title=_("Application Exists"),
			)

	def validate_one_admission_per_lead(self):
		"""A lead may apply in several places and be admitted in one.

		The rule itself lives in `erp.admission.pipeline.already_admitted_objection`, which is where
		`confirm_admission` meets it — before anything is written, so nothing half-lands. This is
		the same boundary for the other writer: `student` is an ordinary field, so plain
		`/api/resource` CRUD or a console script can set it without ever passing through the
		pipeline. Calling the pipeline's own function rather than restating the query is the
		`validate_same_parent` discipline — one implementation per rule, per this app's conventions.
		"""
		if not self.student:
			return

		objection = already_admitted_objection(self)
		if objection:
			frappe.throw(objection.message, title=objection.title)

	def validate_intake_matches_programme(self):
		"""The intake must be the one published for this programme.

		The intake is where the seat count, the age window and the document checklist come from, so
		an intake belonging to another programme would apply the wrong rules to this applicant and
		consume a seat in the wrong count.
		"""
		if not (self.programme and self.programme_intake):
			return

		intake_programme = frappe.db.get_value("Programme Intake", self.programme_intake, "programme")
		if intake_programme and intake_programme != self.programme:
			frappe.throw(
				_("Intake {0} is for {1}, not {2}.").format(
					frappe.bold(self.programme_intake),
					frappe.bold(intake_programme),
					frappe.bold(self.programme),
				),
				title=_("Wrong Intake"),
			)

	def validate_hierarchy(self):
		"""Keep the application, its intake and the lead it came from inside one trust."""
		validate_same_parent(self, "institution", "trust")
		validate_same_parent(self, "department", "institution", "trust")
		validate_same_parent(self, "programme", "department", "institution", "trust")
		validate_same_parent(self, "academic_year", "trust")
		validate_same_parent(self, "programme_intake", "programme", "institution", "trust")
		validate_same_parent(self, "admission_enquiry", "trust")

	def validate_eligibility(self):
		"""Re-check entry conditions against the programme actually being admitted to.

		This is the reason the check is not left to the enquiry. The enquiry cleared the programme
		the student asked about; the allotment may have moved them to one with a different
		prerequisite — most sharply a lateral-entry seat, which needs a diploma the original choice
		never asked for. The age window is checked here for the same reason, and because it lives on
		the *intake*, which only this document names.
		"""
		education = enquiry_education(self.admission_enquiry)
		assert_prior_qualification(self.programme, self.admission_type, education)

		date_of_birth = frappe.db.get_value("Admission Enquiry", self.admission_enquiry, "date_of_birth")
		assert_age_within_window(self.programme_intake, date_of_birth)

	def validate_offer(self):
		"""An answer needs an offer to answer, and a date to answer it on."""
		if self.offer_response and not self.offer_issued_on:
			frappe.throw(
				_("Record when the offer was issued before recording the applicant's response."),
				title=_("No Offer Issued"),
			)

		if self.offer_response and not self.offer_response_on:
			self.offer_response_on = today()

		if not self.offer_response:
			self.offer_response_on = None

	def set_application_state(self):
		"""Refresh the derived badge. The rule is in `erp/admission/application_state.py`."""
		self.application_state = derive_application_state(self)

	def ensure_child_ids(self):
		"""Give every preference and document row the standard UUID `id`.

		The global `before_insert` UUID hook acts on top-level documents; child rows are saved
		through the parent and do not reliably pass through it.
		"""
		for row in list(self.preferences) + list(self.documents):
			if not row.get("id"):
				row.id = str(uuid.uuid4())
