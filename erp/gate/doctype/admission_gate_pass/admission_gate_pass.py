# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

import re

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import get_datetime

from erp.master.hierarchy import validate_same_parent

# The reference route decides which single referrer field is meaningful; every other one
# on this map belongs to a route the user did not choose. "Direct Admission" and "Other"
# deliberately share one field — both are notes rather than referrers.
REFERENCE_ROUTE_FIELDS = {
	"Staff Reference": "staff_reference",
	"Consultancy Reference": "consultancy",
	"Student Reference": "student_reference",
	"Direct Admission": "source_details",
	"Other": "source_details",
}

# Which of those the route cannot do without. Direct Admission is absent on purpose: a
# walk-in explains itself, while "Other" is meaningless until somebody says what it was.
REFERENCE_REQUIRED_FIELDS = {
	"Staff Reference": "staff_reference",
	"Consultancy Reference": "consultancy",
	"Student Reference": "student_reference",
	"Other": "source_details",
}

REFERENCE_STAFF_FIELDS = ("reference_staff_1", "reference_staff_2", "reference_staff_3")


class AdmissionGatePass(Document):
	def validate(self):
		self.set_academic_year()
		# Before the hierarchy check, not after: a referrer belonging to a route the desk has
		# moved off is about to be discarded, and validating it first would let a stale value
		# nobody can see block the save — moving the college to another institution while a
		# now-hidden consultancy still names the old one is exactly that case.
		self.clear_unused_reference()
		self.validate_conditionally_mandatory()
		self.validate_hierarchy()
		self.validate_aadhaar()
		self.validate_unique_aadhaar()
		self.validate_phone_number()
		self.validate_reference_staff()
		self.validate_movement()

	def set_academic_year(self):
		"""Stamp the enquiry with the institution's open admission year.

		Left blank rather than thrown on when no year is flagged open. A gate desk logs
		whoever walks up to it; refusing the entry because an administrator forgot to tick
		a checkbox would push security staff to invent a value or skip the log entirely.
		"""
		# `institution` is `fetch_from` college and filled in `_validate_links`, which
		# `flags.ignore_links` skips — fall back to the college rather than lose the year.
		institution = self.institution
		if not institution and self.college:
			institution = frappe.db.get_value("College", self.college, "institution")

		if not institution:
			return

		# Re-derived, not kept, once the year on the row belongs to somebody else: moving a
		# pass to a college under another institution leaves the old tenant's year behind, and
		# `validate_hierarchy` would then refuse a save nobody at the desk can rescue — the
		# field is read-only, so there is no way to clear the value it is objecting to.
		if self.academic_year:
			year_institution = frappe.db.get_value("Academic Year", self.academic_year, "institution")
			if year_institution == institution:
				return

		self.academic_year = frappe.db.get_value(
			"Academic Year", {"institution": institution, "is_admission_open": 1}, "name"
		)

	def validate_hierarchy(self):
		"""Keep the college, the year and every named referrer inside one institution.

		The referrer links are checked for the same reason as the college: a Staff or
		Consultancy Link accepts any record in the system, so a pass raised at one
		institution's gate can name a counsellor or an agency belonging to a different
		tenant. Nothing downstream would notice — the referral would simply be credited
		across the boundary, and the other institution's referral counts would move because
		of a visitor it never saw.

		Only the two Link referrers are checkable. `student_reference` and the three
		`reference_staff_*` slots are typed names, not records, so there is no institution on
		the other end to compare — the tenant guarantee simply does not reach them.

		`institution` is `fetch_from` college and normally rewritten on save; it is asserted
		here anyway because `flags.ignore_links` skips that rewrite.
		"""
		validate_same_parent(self, "college", "institution")
		validate_same_parent(self, "academic_year", "institution")
		validate_same_parent(self, "staff_reference", "institution")
		validate_same_parent(self, "consultancy", "institution")

	def validate_aadhaar(self):
		if not self.aadhaar_number:
			return

		digits = re.sub(r"\D", "", self.aadhaar_number)
		if len(digits) != 12:
			frappe.throw(
				_("Aadhaar Number must be 12 digits. {0} has {1}.").format(
					frappe.bold(self.aadhaar_number), len(digits)
				)
			)

		# Store the stripped form so "1234 5678 9012" and "123456789012" are one visitor
		# when the desk searches for a repeat enquiry.
		self.aadhaar_number = digits

	def validate_unique_aadhaar(self):
		"""One admission per student (Aadhaar) per institution per admission year.

		A second pass for the same visitor could name a different `reference`, so the referral
		credit would be disputed and every count built on that column double-charged. Scoped to
		institution + academic_year: a student may re-apply in a later year or at another
		institution, but not twice in one cycle.

		Runs after `validate_aadhaar`, which rewrites the number to its 12-digit form — the
		comparison must be against the normalised value, or "1234 5678 9012" would slip past the
		bare "123456789012" already on file. A blank `academic_year` (no year flagged open) is
		left unchecked on purpose: `set_academic_year` logs whoever walks up rather than refusing
		them, and there is no cycle to be unique within.
		"""
		if not (self.aadhaar_number and self.institution and self.academic_year):
			return

		filters = {
			"aadhaar_number": self.aadhaar_number,
			"institution": self.institution,
			"academic_year": self.academic_year,
		}
		# Aadhaar is not part of the `AGP-.YYYY.-.#####` autoname, so a duplicate lands on a
		# different `name` — the `name != self.name` filter is the right guard (unlike Programme
		# Intake, whose colliding rows share a name and must gate on is_new()).
		if not self.is_new():
			filters["name"] = ["!=", self.name]

		duplicate = frappe.db.exists("Admission Gate Pass", filters)
		if duplicate:
			frappe.throw(
				_("A gate pass for Aadhaar {0} already exists at this institution for {1} ({2}).").format(
					frappe.bold(self.aadhaar_number),
					frappe.bold(self.academic_year),
					frappe.bold(duplicate),
				),
				title=_("Duplicate Admission"),
			)

	def validate_phone_number(self):
		if not self.phone_number:
			return

		digits = re.sub(r"\D", "", self.phone_number)
		if len(digits) == 12 and digits.startswith("91"):
			digits = digits[2:]

		if len(digits) != 10:
			frappe.throw(
				_("Phone Number {0} must be 10 digits, with or without the 91 country code.").format(
					frappe.bold(self.phone_number)
				)
			)

		self.phone_number = digits

	def clear_unused_reference(self):
		"""Drop the referrer belonging to any route other than the chosen one.

		Editing a pass from "Consultancy Reference" to "Direct Admission" hides the
		consultancy field but leaves its value in the row. The agency would stay attached to
		an enquiry it did not send, and every referral count built on that column would
		credit it — the visitor counting once for the consultancy and once for the walk-in.
		"""
		kept = REFERENCE_ROUTE_FIELDS.get(self.reference)
		for fieldname in REFERENCE_ROUTE_FIELDS.values():
			if fieldname != kept:
				self.set(fieldname, None)

	def validate_conditionally_mandatory(self):
		"""Require the field the chosen route — or a ticked vehicle box — promises is there.

		`mandatory_depends_on` reads like a rule but is only ever evaluated by the Desk form:
		Frappe never checks it on save, and the React SPA does not load Desk form scripts at
		all. So the API accepts a pass claiming "Consultancy Reference" that names no agency,
		or a vehicle with no plate — a route recorded against a referrer nobody can follow,
		which is worse than the walk-in it actually was.
		"""
		conditional = (
			(REFERENCE_REQUIRED_FIELDS.get(self.reference), True),
			("vehicle_number", self.vehicle),
		)

		for fieldname, required in conditional:
			if not fieldname or not required or self.get(fieldname):
				continue

			frappe.throw(
				_("{0} is required.").format(frappe.bold(_(self.meta.get_label(fieldname)))),
				frappe.MandatoryError,
				title=_("Missing Field"),
			)

	def validate_reference_staff(self):
		"""Three slots, three different people — the slots exist to spread accountability.

		These are typed names rather than links, so the comparison has to normalise: "Anitha
		R", "anitha r" and " Anitha R " are one person to everyone except a string equality
		test, and a duplicate that slips through is a slot silently wasted.
		"""
		seen = {}
		for fieldname in REFERENCE_STAFF_FIELDS:
			staff = (self.get(fieldname) or "").strip()
			if not staff:
				continue

			# Store the trimmed form, so a stray space never splits one person into two
			# rows of a referral count.
			self.set(fieldname, staff)

			key = " ".join(staff.casefold().split())
			if key in seen:
				frappe.throw(
					_("{0} is already named in {1}.").format(
						frappe.bold(staff), frappe.bold(_(self.meta.get_label(seen[key])))
					)
				)

			seen[key] = fieldname

	def validate_movement(self):
		if self.in_time and self.out_time and get_datetime(self.out_time) <= get_datetime(self.in_time):
			frappe.throw(
				_("Out Time {0} must be after In Time {1}.").format(
					frappe.bold(self.out_time), frappe.bold(self.in_time)
				)
			)

		# Derived from the stamps rather than typed: "Inside" is the answer to "is there an
		# out time", and a status anyone can edit stops being an answer to anything.
		self.status = "Exited" if self.out_time else "Inside"
