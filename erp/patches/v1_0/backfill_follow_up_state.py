# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Populate `follow_up_state` on Admission Enquiries that predate the field.

The column is derived, and going forward the Admission Follow-up and Admission Enquiry controllers
keep it current. But rows created before this slice carry NULL, so an admin filtering the lead list
by state would miss them until each was next touched. This stamps every existing lead once — leads
with no follow-ups land on "Never Contacted", which is exactly right.

Runs post_model_sync (the column must exist first). Idempotent: the state is derived deterministically
from the lead's own fields, so re-running only ever writes the same value.
"""

import frappe

from erp.admission.follow_up_state import derive_follow_up_state


def execute():
	for enquiry in frappe.get_all(
		"Admission Enquiry", fields=["name", "status", "next_follow_up", "follow_up_count"]
	):
		state = derive_follow_up_state(enquiry.status, enquiry.next_follow_up, enquiry.follow_up_count or 0)
		frappe.db.set_value(
			"Admission Enquiry", enquiry.name, "follow_up_state", state, update_modified=False
		)
