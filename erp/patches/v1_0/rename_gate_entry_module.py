# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Drop the `Gate_Entry` module records left behind when it was renamed to `Gate`.

`bench migrate` reads `erp/modules.txt` and creates a Module Def for every line it finds,
but it never removes one for a line that has gone. So renaming the module creates `Gate`
and leaves `Gate_Entry` sitting there — along with its `Gate Entry` workspace, whose file
no longer exists either. Both would keep appearing in the module rail.

Safe to delete outright: the module was renamed while it still held zero doctypes, so
nothing points at either record. Runs in `[post_model_sync]` so the new `Gate` Module Def
and workspace already exist by the time the old ones go.
"""

import frappe

OLD_WORKSPACE = "Gate Entry"
OLD_MODULE = "Gate_Entry"


def execute():
	# Workspace first: it carries a Link to Module Def, and deleting the module while a
	# workspace still references it raises a LinkExistsError.
	if frappe.db.exists("Workspace", OLD_WORKSPACE):
		frappe.delete_doc("Workspace", OLD_WORKSPACE, force=True, ignore_permissions=True)

	# `block_modules` rows on User point at the module by name and are not cleaned up by
	# delete_doc, so they would linger as rows naming a module that no longer exists.
	frappe.db.delete("Block Module", {"module": OLD_MODULE})

	if frappe.db.exists("Module Def", OLD_MODULE):
		frappe.delete_doc("Module Def", OLD_MODULE, force=True, ignore_permissions=True)
