# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import getdate

from erp.master.hierarchy import validate_same_parent


class ProgrammeIntake(Document):
	def validate(self):
		self.validate_hierarchy()
		self.validate_seats()
		self.validate_percentage()
		self.validate_age_window()
		self.validate_unique_offering()

	def validate_hierarchy(self):
		"""An intake is the seat count for one programme in one academic year — both sides
		must belong to the same trust, or the seats land in another tenant's ledger.

		`trust`/`institution` are `fetch_from` programme and normally rewritten on save;
		they are asserted here for the same reason as on Programme, since `flags.ignore_links`
		skips that rewrite.
		"""
		validate_same_parent(self, "programme", "trust", "institution")
		validate_same_parent(self, "academic_year", "trust")

	def validate_seats(self):
		if self.total_seats is not None and self.total_seats <= 0:
			frappe.throw(_("Total Seats must be greater than zero."))

	def validate_percentage(self):
		if self.min_percentage and not 0 <= self.min_percentage <= 100:
			frappe.throw(_("Minimum Percentage must be between 0 and 100."))

	def validate_age_window(self):
		"""Keep the age window coherent, and make it measurable when it is set.

		The window is how a school states an entry condition a degree programme does not have — an
		LKG intake admits 3-to-5-year-olds as on 1 June, a B.E. intake leaves all three blank and no
		age is ever checked. It is deliberately data on the intake rather than a rule keyed on
		`Institution.institution_type`: the same doctype then serves a school and an institution, the way
		`Programme.required_prior_qualification` already does for the prior-qualification rule.

		An age bound with no `age_as_on` is unmeasurable — "under 5" is meaningless without saying
		when — so the cut-off date is required as soon as either bound is set.
		"""
		if self.min_age and self.max_age and self.min_age > self.max_age:
			frappe.throw(
				_("Minimum Age ({0}) cannot be greater than Maximum Age ({1}).").format(
					self.min_age, self.max_age
				)
			)

		if (self.min_age or self.max_age) and not self.age_as_on:
			frappe.throw(
				_("Set the date the age window is reckoned as on, or clear the age bounds."),
				title=_("Age Cut-off Date Required"),
			)

	def validate_unique_offering(self):
		"""One intake per programme per academic year.

		The name is `format:{academic_year}-{programme}`, so a duplicate resolves to the
		same name as the existing row — meaning a plain `name != self.name` filter would
		exclude the very record it clashes with. Gate on is_new() instead.
		"""
		existing = frappe.db.exists(
			"Programme Intake",
			{
				"academic_year": self.academic_year,
				"programme": self.programme,
			},
		)
		if existing and (self.is_new() or existing != self.name):
			frappe.throw(
				_("An intake for {0} in {1} already exists ({2}).").format(
					frappe.bold(self.programme), frappe.bold(self.academic_year), existing
				)
			)


def assert_age_within_window(programme_intake: str, date_of_birth) -> None:
	"""Throw unless an applicant's age falls in the intake's window, measured on its cut-off date.

	Silent when the intake sets no window (every degree programme) or when the applicant's date of
	birth is unknown — an admission office often starts an application before the birth certificate
	is on hand, and an absent DOB is `reqd`'s problem, not this rule's. Age is whole completed years
	on `age_as_on`, which is how a school states the condition and how a parent reads it.

	Counted with calendar arithmetic, not `date_diff(...) // 365`: dividing by 365 ignores leap days
	and so reports a child born on 2 June as five years old on the 1 June before their birthday —
	an off-by-one landing exactly on the boundary the rule exists to police.
	"""
	if not (programme_intake and date_of_birth):
		return

	intake = frappe.db.get_value(
		"Programme Intake", programme_intake, ["min_age", "max_age", "age_as_on"], as_dict=True
	)
	if not intake or not intake.age_as_on or not (intake.min_age or intake.max_age):
		return

	born = getdate(date_of_birth)
	as_on = getdate(intake.age_as_on)
	age = as_on.year - born.year - ((as_on.month, as_on.day) < (born.month, born.day))

	if intake.min_age and age < intake.min_age:
		frappe.throw(
			_("The applicant is {0} as on {1}; this intake admits from age {2}.").format(
				frappe.bold(age),
				frappe.bold(frappe.format(intake.age_as_on, {"fieldtype": "Date"})),
				frappe.bold(intake.min_age),
			),
			title=_("Outside Age Window"),
		)

	if intake.max_age and age > intake.max_age:
		frappe.throw(
			_("The applicant is {0} as on {1}; this intake admits up to age {2}.").format(
				frappe.bold(age),
				frappe.bold(frappe.format(intake.age_as_on, {"fieldtype": "Date"})),
				frappe.bold(intake.max_age),
			),
			title=_("Outside Age Window"),
		)
