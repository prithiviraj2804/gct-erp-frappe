# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

import uuid

import frappe
from frappe import _
from frappe.model.document import Document

from erp.master.hierarchy import validate_same_parent
from erp.utils import normalize_aadhaar, normalize_phone

# The prior qualification a straight-through entrant must show: a school leaver joining an
# undergraduate programme needs a 12th record; a graduate joining a postgraduate one needs an
# undergraduate record. Keyed on the Programme Level name, which is the level's own code
# (`UG`/`PG`) because Programme Level autonames by `level_code`. A lateral entrant is handled
# separately — they skip this and show a diploma instead.
REQUIRED_QUALIFICATION_BY_LEVEL = {
	"UG": "12th",
	"PG": "Undergraduate",
}

# The gate desk's record, held read-only on an enquiry started from a pass: the Aadhaar the
# duplicate check keys on, and the reference block that decides who is credited with the walk-in.
# `read_only_depends_on` greys these in the Desk form; this re-copies them from the pass on every
# save so the lock holds against the API and the SPA too. The other carried fields (name, phone,
# college, …) are set once by the form script and stay the counsellor's to correct.
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
		self.validate_hierarchy()
		self.validate_unique_aadhaar()
		self.validate_previous_education()
		self.ensure_child_ids()

	def set_derived_ancestors(self):
		"""Re-derive the college's ancestors rather than trust the copies on the row.

		`institution`, `campus` and `programme_level` are `fetch_from` fields, filled by
		`_validate_links` — which `flags.ignore_links` skips. Deriving them here means the
		hierarchy check below is comparing against the college's real parent, not a stale copy
		left behind when someone moved the enquiry to a different college.
		"""
		if self.college:
			college = frappe.db.get_value("College", self.college, ["institution", "campus"], as_dict=True)
			if college:
				self.institution = college.institution
				self.campus = college.campus

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
		"""Stamp the enquiry with the institution's open admission year.

		Left blank rather than thrown when no year is flagged open — the same choice the gate
		pass makes: a counsellor logging a walk-in should not be blocked because an administrator
		has not ticked `is_admission_open` yet. Re-derived when the institution changes so a stale
		year never survives a move to another tenant.
		"""
		if not self.institution:
			return

		if self.academic_year:
			year_institution = frappe.db.get_value("Academic Year", self.academic_year, "institution")
			if year_institution == self.institution:
				return

		self.academic_year = frappe.db.get_value(
			"Academic Year", {"institution": self.institution, "is_admission_open": 1}, "name"
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

	def validate_hierarchy(self):
		"""Keep the whole choice — and every named referrer — inside one institution.

		A Link proves a record exists, never that it sits in this enquiry's branch, so each
		denormalised ancestor is an independent claim to reconcile. The referrer and counsellor
		Staff/Consultancy links are checked for the same reason the college is: a Link accepts any
		record in the system, so an enquiry raised at one institution could otherwise credit a
		counsellor or agency belonging to another tenant.
		"""
		validate_same_parent(self, "college", "institution")
		validate_same_parent(self, "department", "college", "institution")
		validate_same_parent(self, "programme", "department", "college", "institution")
		validate_same_parent(self, "academic_year", "institution")
		validate_same_parent(self, "programme_intake", "programme", "college", "institution")
		validate_same_parent(self, "consultancy", "institution")
		validate_same_parent(self, "staff_reference", "institution")
		validate_same_parent(self, "counsellor", "institution")

	def validate_unique_aadhaar(self):
		"""One enquiry per student (Aadhaar) per institution per admission year.

		Aadhaar is optional here — an enquiry can be logged before the number is on hand — so the
		check only runs once it is present. Scoped to institution + academic_year: a student may
		re-enquire in a later cycle or at another institution, but a second live enquiry in the
		same cycle is a duplicate that would split their history across two records.
		"""
		if not (self.aadhaar_number and self.institution and self.academic_year):
			return

		filters = {
			"aadhaar_number": self.aadhaar_number,
			"institution": self.institution,
			"academic_year": self.academic_year,
		}
		if not self.is_new():
			filters["name"] = ["!=", self.name]

		duplicate = frappe.db.exists("Admission Enquiry", filters)
		if duplicate:
			frappe.throw(
				_("An enquiry for Aadhaar {0} already exists at this institution for {1} ({2}).").format(
					frappe.bold(self.aadhaar_number),
					frappe.bold(self.academic_year),
					frappe.bold(duplicate),
				),
				title=_("Duplicate Enquiry"),
			)

	def validate_previous_education(self):
		"""Require the prior qualification the chosen course actually rests on.

		`mandatory_depends_on` and `link_filters` are Desk-form conveniences the server never
		enforces, so the requirement lives here. A lateral entrant joins a programme already in
		progress (`default_entry_semester` past the first) on the strength of a diploma, and shows
		that instead of the school-leaving record a straight-through entrant would.
		"""
		if not self.programme:
			return

		if not self.previous_education:
			frappe.throw(
				_("Add at least one previous education record before saving this enquiry."),
				title=_("Previous Education Required"),
			)

		levels_present = {row.qualification_level for row in self.previous_education}
		required = set()

		lateral = False
		if self.admission_type:
			entry_semester = frappe.db.get_value(
				"Admission Type", self.admission_type, "default_entry_semester"
			)
			lateral = bool(entry_semester and entry_semester > 1)

		if lateral:
			required.add("Diploma")
		elif self.programme_level in REQUIRED_QUALIFICATION_BY_LEVEL:
			required.add(REQUIRED_QUALIFICATION_BY_LEVEL[self.programme_level])

		missing = required - levels_present
		if missing:
			frappe.throw(
				_("This programme needs a {0} record in Previous Education.").format(
					frappe.bold(", ".join(sorted(missing)))
				),
				title=_("Previous Education Required"),
			)

	def ensure_child_ids(self):
		"""Give every previous-education row the standard UUID `id`.

		The global `before_insert` UUID hook acts on top-level documents; child rows are saved
		through the parent and do not reliably pass through it. Stamping them here, in the parent's
		`validate`, keeps the `id` convention true for the grid without depending on that hook.
		"""
		for row in self.previous_education:
			if not row.get("id"):
				row.id = str(uuid.uuid4())
