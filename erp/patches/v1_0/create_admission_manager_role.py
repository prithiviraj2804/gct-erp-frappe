# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Create the Admission Manager role — the per-trust admissions admin.

A separate patch from `create_admission_roles`, not a line added to it: that patch has already
run on live sites and its Patch Log entry stops it re-running, so an amended tuple would never
create this role on an existing site. A new patch runs everywhere — fresh installs and sites that
already have the Counsellor role alike.

Runs in `[pre_model_sync]` because `Admission Enquiry`'s permission block now names this role, and
a DocType JSON carrying a permission row for a role that does not exist yet fails to sync — so the
role must be in the database before `bench migrate` reaches the doctype.

Idempotent — re-running is a no-op.
"""

import frappe


def execute():
	if frappe.db.exists("Role", "Admission Manager"):
		return

	frappe.get_doc(
		{
			"doctype": "Role",
			"role_name": "Admission Manager",
			"desk_access": 1,
		}
	).insert(ignore_permissions=True)
