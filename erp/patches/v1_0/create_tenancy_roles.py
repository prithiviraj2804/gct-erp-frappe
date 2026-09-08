# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Create the two roles the Institution tenancy boundary is expressed in.

`Trust Admin` is the business superuser: it holds **no** User Permissions at all, and that is what
makes it one. `frappe.permissions` treats a login with no restriction rows as unrestricted, so
"acts for every institution" needs no code and no special case. It exists as a separate role from
System Manager because System Manager is the bench operator — schema, patches, roles — and handing
that to a trustee to get them past a tenancy filter is how the filter stops meaning anything.

`Institution Admin` runs one institution and carries exactly one User Permission,
`{allow: "Institution", for_value: X}`. It is deliberately *not* granted the schema layer
(Institution Type, Config Setting, Field Policy), because a bad policy row is an outage across
every institution of that type, not a local mistake.

Runs in `[pre_model_sync]` for the reason `create_accounts_roles` gives: a DocType JSON naming a
role that does not exist yet fails to sync, so the roles must precede the doctypes that reference
them.

Idempotent — re-running is a no-op.
"""

import frappe

ROLES = (
	{"role_name": "Trust Admin", "desk_access": 1},
	{"role_name": "Institution Admin", "desk_access": 1},
)


def execute():
	for role in ROLES:
		if frappe.db.exists("Role", role["role_name"]):
			continue
		frappe.get_doc({"doctype": "Role", **role}).insert(ignore_permissions=True)
