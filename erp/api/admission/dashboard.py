# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""The admissions manager's lead dashboard: pipeline funnel, overdue load, conversion.

One whitelisted read that aggregates Admission Enquiry rows. It reads them through
`frappe.get_list`, so the same row-level scoping the SPA and Desk get applies here too — a manager
sees their institution's numbers, a counsellor sees their own — without this endpoint re-deriving
who-sees-what. Overdue is computed live from `next_follow_up` rather than trusting the stamped
`follow_up_state`, so a lead that fell overdue since it was last touched still counts.
"""

import frappe
from frappe import _
from frappe.utils import getdate, today

from erp.admission.follow_up_state import CLOSED_STATUSES


@frappe.whitelist(methods=["GET"])
def lead_dashboard() -> dict:
	if not frappe.has_permission("Admission Enquiry", "read"):
		frappe.throw(_("You are not permitted to view the lead dashboard."), frappe.PermissionError)

	# limit_page_length=0 → every row the caller may see. Aggregated in Python so the scoping in
	# get_list is the single source of "which leads count".
	leads = frappe.get_list(
		"Admission Enquiry",
		fields=["status", "counsellor", "next_follow_up"],
		limit_page_length=0,
	)

	today_date = getdate(today())
	funnel: dict[str, int] = {}
	overdue: dict[str, int] = {}

	for lead in leads:
		funnel[lead.status] = funnel.get(lead.status, 0) + 1

		is_open = lead.status not in CLOSED_STATUSES
		if is_open and lead.next_follow_up and getdate(lead.next_follow_up) < today_date:
			owner = lead.counsellor or "Unassigned"
			overdue[owner] = overdue.get(owner, 0) + 1

	total = len(leads)
	admitted = funnel.get("Admitted", 0)

	return {
		"total_leads": total,
		"admitted": admitted,
		"conversion_rate": round(admitted / total * 100, 1) if total else 0.0,
		"overdue_total": sum(overdue.values()),
		"funnel": [{"status": status, "count": count} for status, count in funnel.items()],
		"overdue_by_counsellor": [
			{"counsellor": owner, "count": count} for owner, count in sorted(overdue.items())
		],
	}
