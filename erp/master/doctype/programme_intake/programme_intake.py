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
		self.validate_seat_matrix()
		self.validate_percentage()
		self.validate_eligibility_rules()
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

	def validate_seat_matrix(self):
		"""The sanctioned pools must be coherent, and must not claim more than the intake has.

		The matrix is optional — an intake that declares none keeps exactly the behaviour it had,
		one number of seats and one queue for them. Once it declares any, two things have to hold or
		the numbers stop meaning anything:

		**No two rows may claim the same pool.** `(route, category)` is what the gate resolves
		against, so two rows for one pool is a contradiction with no answer, the same shape as two
		Field Policy rules for one field.

		**The pools may not oversubscribe the intake.** Summing to *less* than `total_seats` is
		legitimate and common — the remainder is unreserved, and a matrix that states only the
		reserved pools is how most sanction letters read. Summing to more is not: it would let the
		institution admit past its sanctioned strength one pool at a time, with every individual
		pool check passing.

		A blank category means "the whole route", so it is summed alongside the categories under it
		rather than instead of them — a route stating 60 seats with 15 for one category is claiming
		75 unless the office meant the 15 to come *out* of the 60. That ambiguity is why the sum
		refuses rather than guesses, and the message says which reading to write down.
		"""
		if not self.seats:
			return

		seen = set()
		for row in self.seats:
			pool = (row.admission_route, row.reservation_category or "")
			if pool in seen:
				frappe.throw(
					_("Row {0}: {1} already has a seat row for {2}.").format(
						row.idx,
						frappe.bold(row.admission_route),
						frappe.bold(row.reservation_category or _("every category")),
					),
					title=_("Duplicate Seat Pool"),
				)
			seen.add(pool)

		sanctioned = sum(row.sanctioned_seats or 0 for row in self.seats)
		if self.total_seats and sanctioned > self.total_seats:
			frappe.throw(
				_(
					"The seat matrix sanctions {0} seats but this intake has {1}. A pool for a whole "
					"route and a pool for a category within it are counted separately, so state the "
					"route's remaining seats rather than its total if the categories come out of it."
				).format(frappe.bold(sanctioned), frappe.bold(self.total_seats)),
				title=_("Seat Matrix Oversubscribed"),
			)

	def validate_percentage(self):
		if self.min_percentage and not 0 <= self.min_percentage <= 100:
			frappe.throw(_("Minimum Percentage must be between 0 and 100."))

	def validate_eligibility_rules(self):
		"""Refuse a rule the pipeline could not evaluate.

		The same discipline as `erp.field_policy.fieldtype_objection`: **a rule form that saves is a
		rule form the enforcer carries out.** A subject rule with no subject, or a threshold rule
		with no threshold, would be silently skipped by `_rule_failure` — so the intake would look
		as though it published a condition it does not enforce, which is worse than publishing none.

		A duplicate is refused for the same reason two Field Policy rules for one field are: it is a
		contradiction with no answer, and the more permissive one would decide by accident.
		"""
		if not self.eligibility_rules:
			return

		needs_subject = ("Subject Required", "Subject Percentage At Least")
		needs_threshold = (
			"Subject Percentage At Least",
			"Entrance Rank At Most",
			"Entrance Score At Least",
		)

		seen = set()
		for row in self.eligibility_rules:
			if row.rule_type in needs_subject and not row.subject:
				frappe.throw(
					_("Row {0}: {1} has to name a subject.").format(row.idx, frappe.bold(row.rule_type)),
					title=_("Rule Needs A Subject"),
				)

			if row.rule_type in needs_threshold and not row.threshold:
				frappe.throw(
					_("Row {0}: {1} has to state a threshold.").format(row.idx, frappe.bold(row.rule_type)),
					title=_("Rule Needs A Threshold"),
				)

			if row.rule_type == "Subject Percentage At Least" and not 0 <= row.threshold <= 100:
				frappe.throw(
					_("Row {0}: a subject percentage must be between 0 and 100.").format(row.idx),
					title=_("Out Of Range"),
				)

			key = (row.rule_type, row.subject or "")
			if key in seen:
				frappe.throw(
					_("Row {0}: this intake already states {1} for {2}.").format(
						row.idx, frappe.bold(row.rule_type), frappe.bold(row.subject or _("no subject"))
					),
					title=_("Duplicate Eligibility Rule"),
				)
			seen.add(key)

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
