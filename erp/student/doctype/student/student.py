# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.model.naming import make_autoname

from erp.master.hierarchy import validate_same_parent
from erp.utils import normalize_aadhaar, normalize_phone

# Statuses that still occupy a seat in the intake. A student who has left frees the seat they held;
# an alumnus completed the programme and no longer sits in that year's count either.
OCCUPYING_STATUSES = frozenset({"Active"})


class Student(Document):
	def autoname(self):
		"""Allot the admission register number: a per-institution monotonic series.

		In India the admission register is a statutory record — CBSE, ICSE, the state SSC boards and
		UGC inspections all ask to see a numbered, chronological list of who was admitted and when —
		so the number has to be dense and monotonic within an institution, not a random key. The
		series is keyed on the institution because each one keeps its own register; two colleges of
		the same group never share a run of numbers.

		`name` *is* the register number rather than a separate column holding a second identifier:
		one authoritative number, and the readable business key the app's naming convention asks
		for. The UUID `id` remains the stable handle for external systems.
		"""
		if not self.institution:
			frappe.throw(_("A student cannot be numbered without an Institution."))

		self.name = make_autoname(f"{self.institution}-STU-.#####", doc=self)

	def validate(self):
		self.set_derived_ancestors()
		self.normalize_contact()
		self.validate_hierarchy()
		self.validate_unique_aadhaar()

	def set_derived_ancestors(self):
		"""Re-derive the ancestors of the programme actually admitted to.

		Every one of these is read-only on the form and written by `confirm_admission`, but a Link
		still only proves the target exists. Deriving them here means the hierarchy check below
		compares against the programme's real parents rather than a stale copy — the same reasoning
		as on Admission Enquiry, and it matters more here because the admitted programme is often
		*not* the one first enquired about.
		"""
		if self.programme:
			programme = frappe.db.get_value(
				"Programme",
				self.programme,
				["institution", "college", "campus", "programme_level"],
				as_dict=True,
			)
			if programme:
				self.institution = programme.institution
				self.college = programme.college
				self.campus = programme.campus
				self.programme_level = programme.programme_level

	def normalize_contact(self):
		"""Store the searchable forms of the student's own phone and Aadhaar.

		Mirrors Admission Enquiry exactly, including leaving `parent_phone` as typed — a guardian's
		number is often a landline and forcing it to ten digits would reject a real one.
		"""
		if self.phone_number:
			self.phone_number = normalize_phone(self.phone_number)

		if self.aadhaar_number:
			self.aadhaar_number = normalize_aadhaar(self.aadhaar_number)

	def validate_hierarchy(self):
		"""Keep the admitted programme, its intake and the year inside one institution."""
		validate_same_parent(self, "college", "institution")
		validate_same_parent(self, "department", "college", "institution")
		validate_same_parent(self, "programme", "department", "college", "institution")
		validate_same_parent(self, "academic_year", "institution")
		validate_same_parent(self, "programme_intake", "programme", "college", "institution")

	def validate_unique_aadhaar(self):
		"""One student record per Aadhaar per institution per admission year.

		The register must not carry the same person twice in one cycle. Scoped exactly as the
		enquiry's duplicate check is: a student may legitimately be admitted again in a later year
		(a fresh PG admission) or at another institution of the group.
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

		duplicate = frappe.db.exists("Student", filters)
		if duplicate:
			frappe.throw(
				_("A student with Aadhaar {0} is already admitted at this institution for {1} ({2}).").format(
					frappe.bold(self.aadhaar_number),
					frappe.bold(self.academic_year),
					frappe.bold(duplicate),
				),
				title=_("Duplicate Student"),
			)
