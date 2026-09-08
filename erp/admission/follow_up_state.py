# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""The single definition of a lead's follow-up state, shared by two writers.

An Admission Enquiry carries a denormalised `follow_up_state` — the at-a-glance badge an admin
scans a list by. It is derived, never typed, from three facts: whether the lead is closed, whether
it has ever been contacted, and when its next follow-up falls relative to today. Both the
Admission Follow-up controller (which rolls the log up onto the lead) and the Admission Enquiry
controller (which refreshes the badge when the stage changes) compute it, so the rule lives here
once rather than in two places that could drift.

Caveat worth naming: the state is stamped at write time. "Due Today" does not become "Overdue" by
itself at midnight — it flips when the lead is next touched. A daily scheduled re-derivation closes
that gap; the manager dashboard sidesteps it by computing overdue live from `next_follow_up`.
"""

from frappe.utils import getdate

# Terminal stages — the lead is decided, so follow-up scheduling no longer applies.
CLOSED_STATUSES = frozenset({"Admitted", "Rejected", "Dropped"})


def derive_follow_up_state(status: str, next_follow_up, follow_up_count: int) -> str:
	if status in CLOSED_STATUSES:
		return "Closed"
	if not follow_up_count:
		return "Never Contacted"
	if not next_follow_up:
		return "No Next Step"

	due = getdate(next_follow_up)
	today = getdate()
	if due < today:
		return "Overdue"
	if due == today:
		return "Due Today"
	return "Scheduled"
