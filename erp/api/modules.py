# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

import frappe
from frappe import _

APP_NAME = "erp"


@frappe.whitelist(methods=["GET"])
def get_allowed_modules() -> list[dict]:
	"""This app's modules that the current user is allowed to see.

	Frappe models module access as a denylist: every Module Def is visible unless the user
	has it in their `block_modules` child table (see User.get_blocked_modules). So "allowed"
	is all of this app's modules minus that set — there is no allowlist to read.

	Scoped to `app_name == "erp"` on purpose: the site also registers Frappe's own modules
	(Core, Desk, Website, ...), which are Desk internals and not features of this product.

	No `allow_guest` — this is behind a login. An anonymous caller gets 403, which is
	correct; the SPA only calls this from a guarded route.
	"""
	if frappe.session.user == "Guest":
		frappe.throw(_("Not permitted"), frappe.PermissionError)

	# get_cached_doc, not get_doc: this is called on every dashboard load, and the User doc
	# is already in Frappe's cache from session setup.
	blocked = set(frappe.get_cached_doc("User", frappe.session.user).get_blocked_modules())

	modules = frappe.get_all(
		"Module Def",
		filters={"app_name": APP_NAME},
		fields=["name", "module_name"],
		order_by="module_name asc",
	)

	# NOTE: Module Def also has `restrict_to_domain`, which Frappe checks against the site's
	# active domains. No erp module sets it today, so it is not handled here — revisit if
	# one ever does, or restricted modules will leak into this list.
	return [m for m in modules if m.name not in blocked]
