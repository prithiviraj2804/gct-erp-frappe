# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Create the roles the Gate module's doctypes name in their permission blocks.

Runs in `[pre_model_sync]`, and the ordering is not incidental: a DocType JSON carrying a
permission row for a role that does not exist yet fails to sync, so the role has to be in
the database before `bench migrate` reaches the doctypes that reference it.

Idempotent — re-running is a no-op, which matters because patches re-run on every site the
app is installed onto.
"""

import frappe

ROLES = (
	{
		"role_name": "Gate Security",
		"desk_access": 1,
	},
)


def execute():
	for role in ROLES:
		if frappe.db.exists("Role", role["role_name"]):
			continue

		frappe.get_doc({"doctype": "Role", **role}).insert(ignore_permissions=True)
