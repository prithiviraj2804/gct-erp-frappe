# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""What a programme requires an applicant to already hold, in one place for both readers.

The rule has two readers now. An Admission Enquiry checks it against the programme the student
walked in asking about; an Admission Application checks it again against the programme they are
actually being admitted to — and those routinely differ, because a counselling allotment lands
students in a branch they did not choose. Re-checking on the application is the whole point: a
switch to a lateral-entry programme, or to one with a different prerequisite, must not slip through
because the enquiry passed months earlier.

The requirement is data, not a hardcoded map: `Programme.required_prior_qualification` states it, so
a school class and a degree express their prerequisite in the same field. A blank requirement means
none — the case for an entry-level school class (LKG, Class 1), which no institution programme hits.

## Three kinds of condition, and where each lives

| condition | stated on | why there |
|---|---|---|
| a prior qualification | `Programme.required_prior_qualification` | a property of the programme, not of one year's intake |
| an age window | `Programme Intake.min_age` / `max_age` / `age_as_on` | a school states it per cycle, against a cut-off date that moves |
| an aggregate percentage | `Programme Intake.min_percentage` | already there, already labelled, already range-checked |
| a subject or entrance condition | `Programme Intake.eligibility_rules` | needs to name a subject, and there can be several |

**The aggregate percentage is deliberately not a rule row.** It exists as a field, on the form, with
its own range check — so putting it in the table too would give one question two mechanisms and let
an intake state 50 in one place and 60 in the other. What it lacked was enforcement, not a home: it
was collected and range-checked and read by nothing, so an intake stating 50% admitted a 35%
candidate silently, in every institution type, while the form looked like it was enforced.

`Programme Intake.eligibility_criteria` remains free text and remains read by nobody. That is now
what its description says, which it did not before.
"""

import frappe
from frappe import _

# A lateral entrant joins a programme already in progress on the strength of a diploma, whatever the
# programme's own entry requirement — so lateral entry overrides it with this.
LATERAL_ENTRY_QUALIFICATION = "Diploma"


def required_prior_qualification(programme: str, admission_type: str | None = None) -> str | None:
	"""The qualification an applicant must already hold to join this programme, or None.

	Lateral entry wins over the programme's own requirement: an Admission Type whose
	`default_entry_semester` is past the first places the student mid-programme, which a diploma is
	what earns.
	"""
	if not programme:
		return None

	if admission_type:
		entry_semester = frappe.db.get_value("Admission Type", admission_type, "default_entry_semester")
		if entry_semester and entry_semester > 1:
			return LATERAL_ENTRY_QUALIFICATION

	return frappe.db.get_value("Programme", programme, "required_prior_qualification")


def assert_prior_qualification(programme: str, admission_type: str | None, education_rows) -> None:
	"""Throw unless the applicant's previous-education rows carry the required qualification.

	`education_rows` is any iterable of rows with a `qualification_level` — the enquiry's child table
	read either in memory or back from the database.
	"""
	required = required_prior_qualification(programme, admission_type)
	if not required:
		return

	levels_present = {row.get("qualification_level") for row in education_rows}
	if required not in levels_present:
		frappe.throw(
			_("This programme needs a {0} record in Previous Education.").format(frappe.bold(required)),
			title=_("Previous Education Required"),
		)


def enquiry_education(enquiry: str) -> list[dict]:
	"""The previous-education rows recorded on a lead, for a reader that only holds its name."""
	if not enquiry:
		return []

	return frappe.get_all(
		"Admission Enquiry Education",
		filters={"parent": enquiry, "parenttype": "Admission Enquiry"},
		fields=["qualification_level", "percentage", "year_of_passing"],
	)


# --- Conditions the intake publishes ------------------------------------------------------


def assert_aggregate_percentage(programme_intake: str, education_rows) -> None:
	"""Throw unless the applicant's best recorded percentage clears the intake's minimum.

	Checked against the **highest** percentage on record rather than a particular qualification.
	The alternative — pick the row matching `required_prior_qualification` — sounds tighter and is
	wrong in the case that matters: a lateral entrant's diploma is the qualification that earns the
	seat, and a candidate who also recorded a weaker 10th would be judged on whichever row the
	lookup happened to name.

	Vacuously true when the intake states no minimum, or when no percentage has been recorded. The
	second is deliberate: an enquiry is a lead and often arrives before results do, so refusing an
	application for a percentage nobody has yet would block the journey rather than gate it. The
	intake's checklist is what insists on the mark sheet.
	"""
	minimum = frappe.db.get_value("Programme Intake", programme_intake, "min_percentage")
	if not minimum:
		return

	recorded = [row.get("percentage") for row in education_rows if row.get("percentage")]
	if not recorded:
		return

	best = max(recorded)
	if best < minimum:
		frappe.throw(
			_(
				"This intake needs at least {0}% in the qualifying examination; the best on record is {1}%."
			).format(frappe.bold(minimum), frappe.bold(best)),
			title=_("Below The Minimum Percentage"),
		)


def intake_eligibility_rules(programme_intake: str) -> list[dict]:
	"""The subject and entrance conditions an intake publishes."""
	if not programme_intake:
		return []

	return frappe.get_all(
		"Programme Intake Eligibility",
		filters={"parent": programme_intake, "parenttype": "Programme Intake"},
		fields=["rule_type", "subject", "threshold", "idx"],
		order_by="idx",
	)


def enquiry_subject_marks(enquiry: str) -> list[dict]:
	"""The per-subject marks recorded on a lead."""
	if not enquiry:
		return []

	return frappe.get_all(
		"Admission Enquiry Subject Mark",
		filters={"parent": enquiry, "parenttype": "Admission Enquiry"},
		fields=["qualification_level", "subject", "marks_obtained", "max_marks", "percentage"],
	)


def assert_intake_rules(application) -> None:
	"""Every subject and entrance condition this intake publishes, checked at once.

	Collected and reported together rather than one throw at a time, for the same reason
	`apply_field_policy` collects its missing fields: an office told one condition at a time
	discovers the next one on the next save.

	A rule whose data the applicant has simply not supplied yet is **not** waved through — that is
	the difference between this and the aggregate percentage above. An aggregate mark is one number
	that may not exist yet; a rule naming Physics is a statement that this intake does not admit
	anyone who did not take Physics, and an absent Physics row is exactly the case it exists to
	catch. The office records the marks, or the applicant is not eligible.
	"""
	rules = intake_eligibility_rules(application.programme_intake)
	if not rules:
		return

	marks = {row["subject"]: row for row in enquiry_subject_marks(application.admission_enquiry)}
	failures = []

	for rule in rules:
		failure = _rule_failure(rule, marks, application)
		if failure:
			failures.append(failure)

	if failures:
		frappe.throw(
			_("This intake's entry conditions are not met: {0}.").format(
				", ".join(frappe.bold(failure) for failure in failures)
			),
			title=_("Not Eligible"),
		)


def _rule_failure(rule: dict, marks: dict, application) -> str | None:
	"""Why this one rule is unmet, phrased for the office, or None if it is met."""
	rule_type = rule["rule_type"]

	if rule_type == "Subject Required":
		return None if rule["subject"] in marks else _("{0} was not taken").format(rule["subject"])

	if rule_type == "Subject Percentage At Least":
		row = marks.get(rule["subject"])
		if not row:
			return _("{0} was not taken").format(rule["subject"])
		if (row.get("percentage") or 0) < (rule["threshold"] or 0):
			return _("{0} is {1}%, below {2}%").format(
				rule["subject"], row.get("percentage") or 0, rule["threshold"]
			)
		return None

	# An entrance rank or score arrives from the counselling body *after* the application is
	# raised, so an absent one is "not yet known" rather than "not eligible" — refusing here would
	# make an intake that publishes an entrance rule unable to raise an application at all, which
	# is what two tests found. **Whether the value must exist before a stage is a different
	# question**, and it belongs to the pipeline: `entrance_data_objection` asks it at the
	# admission gate. The same boundary `erp/admission/stages.py` states for Field Policy.
	if rule_type == "Entrance Rank At Most":
		rank = application.entrance_rank
		if rank and rank > (rule["threshold"] or 0):
			return _("entrance rank {0} is worse than {1}").format(rank, int(rule["threshold"] or 0))
		return None

	if rule_type == "Entrance Score At Least":
		score = application.entrance_score
		if score and score < (rule["threshold"] or 0):
			return _("entrance score {0} is below {1}").format(score, rule["threshold"])
		return None

	return None


def missing_entrance_data(programme_intake: str, application) -> list[str]:
	"""Which entrance values this intake's rules need and the application has not recorded.

	Asked by the pipeline at the admission gate rather than by `assert_intake_rules`, because "is
	this value acceptable" and "does this value exist yet" are different questions asked at
	different moments. An intake publishing an entrance cut-off must not admit an applicant whose
	rank was never entered — but it must be able to raise their application, because the rank comes
	back from the counselling body weeks later.
	"""
	needed = []
	for rule in intake_eligibility_rules(programme_intake):
		if rule["rule_type"] == "Entrance Rank At Most" and not application.entrance_rank:
			needed.append(_("entrance rank"))
		if rule["rule_type"] == "Entrance Score At Least" and not application.entrance_score:
			needed.append(_("entrance score"))
	return needed
