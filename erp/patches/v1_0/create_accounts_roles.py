# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Create the roles the Accounts module's doctypes name in their permission blocks.

`Accounts Manager` is the per-institution finance admin (collects, cancels, reads the ledger);
`Cashier` is the counter collector (collects, cannot cancel). Runs in `[pre_model_sync]` because a
DocType JSON carrying a permission row for a role that does not exist yet fails to sync, so the
roles must be in the database before `bench migrate` reaches the Accounts doctypes.

Idempotent — re-running is a no-op.
"""

import frappe

ROLES = (
	{"role_name": "Accounts Manager", "desk_access": 1},
	{"role_name": "Cashier", "desk_access": 1},
)


def execute():
	for role in ROLES:
		if frappe.db.exists("Role", role["role_name"]):
			continue
		frappe.get_doc({"doctype": "Role", **role}).insert(ignore_permissions=True)
