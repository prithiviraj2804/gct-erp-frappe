# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Admissions across every institution, and each one separately — from one query, for both readers.

The trust asks "how many admissions this year, and how many at each institution". The institution
asks "how many at mine". These are the same report, and deliberately so: the row filter that scopes
a list view scopes this too, so a Trust Admin sees every institution and a scoped login sees only
its own, with no second report to keep in step and no chance of the two disagreeing.

**Every count goes through `frappe.get_list`.** That is the whole design.

  * `frappe.get_all` sets `ignore_permissions=True` (`frappe/__init__.py:1400`) — it would count
    other institutions' rows.
  * `frappe.db.count` builds its own query and never reaches the permission layer at all.
  * A **Query Report** is worse: `frappe/core/doctype/report/report.py:181` runs
    `frappe.db.sql(self.query, filters)` raw, so `permission_query_conditions`, the `"*"` tenancy
    hook and User Permissions are all bypassed. Reporting is the sanctioned escape hatch for
    analytics a list view cannot express; written as raw SQL it is also the escape hatch out of
    tenancy. Where raw SQL is genuinely unavoidable, `erp.api.permission.institution_sql_clause`
    is the one supported way to scope it.

`get_list` also carries the *owner* scoping, so a counsellor running this would see their own
pipeline rather than their institution's. That is correct, and it is why the aggregates are asked
for through the same door as the rows.

**Why the conversion denominator is applications, not enquiries.** A lead now belongs to the
institution it was filed at and may raise applications at any institution of the trust — a TNEA
choice list spanning two colleges, a parent applying to two of the trust's schools. So `enquiries`
and `applications` are counted at different institutions for the same person, and
admitted/enquiries stopped being a ratio of two comparable things: an institution that receives
applications from leads filed elsewhere could show a conversion above 100%, and one whose leads all
applied elsewhere could show zero while admitting a full cohort.

Admitted-over-applications is well defined at every institution and comparable across types: of
the applications this institution received, how many became students. The `enquiries` column stays
as the lead count it always was — it is a real number, it is just no longer this ratio's
denominator. Naming the column for what it measures rather than "Conversion %" is part of the fix;
an ambiguous label is how two rollups come to disagree.
"""

import frappe
from frappe import _


def execute(filters=None):
	filters = frappe._dict(filters or {})

	# Permission-scoped: this is what makes the report mean "all institutions" to a Trust Admin and
	# "mine" to an Institution Admin, without either branch being written.
	institutions = frappe.get_list("Institution", fields=["name", "institution_type"], order_by="name")

	enquiries = _count_by_institution("Admission Enquiry", "enquiry_date", filters)
	paid = _count_by_institution(
		"Admission Enquiry", "enquiry_date", filters, extra={"application_fee_paid": 1}
	)
	applications = _count_by_institution("Admission Application", "application_date", filters)
	# No `status` filter. An admission is an *event* — it happened on `date_of_admission` and
	# nothing later un-happens it — whereas `status` is a present-tense lifecycle state. Counting
	# only `Active` students made a historical number shrink as its cohort moved on: re-running
	# AY 2023-24 next year would return fewer admissions and a lower conversion than it does
	# today, with no audit trail and no error. It is also worse the further apart two institution
	# types are, because the rate at which Active decays is type-specific — a K-12 Class 1 cohort
	# after twelve years against a two-year MBA cohort — which is exactly the comparison this
	# report exists to make.
	admitted = _count_by_institution("Student", "date_of_admission", filters)

	data = []
	totals = dict.fromkeys(("enquiries", "paid", "applications", "admitted"), 0)

	for institution in institutions:
		row = {
			"institution": institution.name,
			"institution_type": institution.institution_type,
			"enquiries": enquiries.get(institution.name, 0),
			"paid": paid.get(institution.name, 0),
			"applications": applications.get(institution.name, 0),
			"admitted": admitted.get(institution.name, 0),
		}
		row["conversion"] = _percent(row["admitted"], row["applications"])
		for key in totals:
			totals[key] += row[key]
		data.append(row)

	if data:
		data.append(
			{
				"institution": _("Total"),
				"institution_type": None,
				**totals,
				"conversion": _percent(totals["admitted"], totals["applications"]),
			}
		)

	return _columns(), data


def _count_by_institution(doctype: str, date_field: str, filters, extra: dict | None = None) -> dict:
	"""How many rows of `doctype` each institution has, within the report's filters.

	One grouped query rather than one per institution, and through `get_list` so the caller's row
	filters apply. The aggregate is passed as `{"COUNT": "name"}` because `get_list` refuses SQL
	functions written as strings.
	"""
	conditions = dict(extra or {})
	if filters.get("academic_year"):
		conditions["academic_year"] = filters.academic_year
	if filters.get("from_date"):
		conditions[date_field] = [">=", filters.from_date]
	if filters.get("to_date"):
		# A second condition on one field needs the list form, so merge rather than overwrite.
		conditions[date_field] = (
			["between", [filters.from_date, filters.to_date]]
			if filters.get("from_date")
			else ["<=", filters.to_date]
		)

	rows = frappe.get_list(
		doctype,
		filters=conditions,
		fields=["institution", {"COUNT": "name"}],
		group_by="institution",
		order_by="institution",
	)
	return {row.get("institution"): _first_count(row) for row in rows if row.get("institution")}


def _first_count(row: dict) -> int:
	"""The count column, whatever the query builder decided to call it."""
	for key, value in row.items():
		if key != "institution":
			return int(value or 0)
	return 0


def _percent(part: int, whole: int) -> float:
	return round(part * 100.0 / whole, 1) if whole else 0.0


def _columns():
	return [
		{
			"fieldname": "institution",
			"label": _("Institution"),
			"fieldtype": "Data",
			"width": 220,
		},
		{
			"fieldname": "institution_type",
			"label": _("Type"),
			"fieldtype": "Link",
			"options": "Institution Type",
			"width": 140,
		},
		{"fieldname": "enquiries", "label": _("Enquiries"), "fieldtype": "Int", "width": 110},
		{"fieldname": "paid", "label": _("Fee Paid"), "fieldtype": "Int", "width": 110},
		{"fieldname": "applications", "label": _("Applications"), "fieldtype": "Int", "width": 120},
		{"fieldname": "admitted", "label": _("Admitted"), "fieldtype": "Int", "width": 110},
		{
			"fieldname": "conversion",
			"label": _("Admitted % Of Applications"),
			"fieldtype": "Percent",
			"width": 190,
		},
	]
