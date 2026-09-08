# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

import uuid

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import today

from erp.admission.application_state import derive_application_state
from erp.admission.eligibility import assert_prior_qualification, enquiry_education
from erp.master.doctype.programme_intake.programme_intake import assert_age_within_window
from erp.master.hierarchy import validate_same_parent

# Read off the lead once and held read-only here: the applicant's identity and the cycle they are
# applying in. The *choice* fields are deliberately absent — the programme this application admits
# to is its own, because a counselling allotment routinely differs from what was enquired about.
ENQUIRY_FIELDS = ("student_name", "counsellor", "institution", "campus", "academic_year")

# Fields that decide which seat is being taken. Locked once a student exists: moving an admitted
# student to another branch is a transfer, a different journey with its own approvals.
SEAT_FIELDS = ("programme", "programme_intake", "admission_type")


class AdmissionApplication(Document):
	def validate(self):
		self.sync_from_enquiry()
		self.set_derived_ancestors()
		self.guard_seat_change_after_admission()
		self.validate_one_per_enquiry()
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
		college. Deriving from `self.programme` is what makes the hierarchy check below compare
		against the real parents of the branch actually being taken.
		"""
		if self.programme:
			programme = frappe.db.get_value(
				"Programme",
				self.programme,
				["institution", "college", "campus", "department", "programme_level"],
				as_dict=True,
			)
			if programme:
				self.institution = programme.institution
				self.college = programme.college
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

	def validate_one_per_enquiry(self):
		"""One application per lead.

		A change of branch or of quota is an edit to this application, not a second record — which
		keeps "the application for this enquiry" a single unambiguous lookup for the pipeline gates,
		and stops a lead's history splitting across two documents the way a duplicate enquiry would.
		"""
		if not self.admission_enquiry:
			return

		existing = frappe.db.get_value(
			"Admission Application", {"admission_enquiry": self.admission_enquiry}, "name"
		)
		if existing and existing != self.name:
			frappe.throw(
				_("{0} already has an application ({1}). Edit that one rather than raising a second.").format(
					frappe.bold(self.admission_enquiry), frappe.bold(existing)
				),
				title=_("Application Exists"),
			)

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
		"""Keep the application, its intake and the lead it came from inside one institution."""
		validate_same_parent(self, "college", "institution")
		validate_same_parent(self, "department", "college", "institution")
		validate_same_parent(self, "programme", "department", "college", "institution")
		validate_same_parent(self, "academic_year", "institution")
		validate_same_parent(self, "programme_intake", "programme", "college", "institution")
		validate_same_parent(self, "admission_enquiry", "institution")

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
