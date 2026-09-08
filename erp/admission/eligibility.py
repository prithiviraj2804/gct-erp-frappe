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
