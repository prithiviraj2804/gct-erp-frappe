# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import now_datetime

PASS_DOCTYPE = "Admission Gate Pass"


@frappe.whitelist(methods=["POST"])
def mark_exit(pass_name: str) -> dict:
	"""Stamp the moment a visitor left, and close the pass.

	Deliberately an endpoint rather than a plain `db.updateDoc` from the client, which the
	`frappe-api` skill would otherwise prefer. Two reasons, both specific to a gate log:

	The exit time has to be the *server's*. A pass records when someone physically left the
	campus; letting a workstation supply that timestamp means a wrong clock — or a bored
	operator — silently rewrites the audit trail, and nothing downstream can tell.

	And leaving must not be repeatable. An update call would happily overwrite an existing
	`out_time` with a later one, quietly erasing the real departure. Here a second attempt
	is refused and says so.

	`check_permission` rather than a role check: the doctype's own permission rules already
	say who may write a pass, and duplicating that here would let the two drift apart.
	"""
	doc = frappe.get_doc(PASS_DOCTYPE, pass_name)
	doc.check_permission("write")

	if doc.out_time:
		frappe.throw(
			_("{0} was already marked out at {1}.").format(frappe.bold(doc.name), frappe.bold(doc.out_time)),
			title=_("Already Exited"),
		)

	doc.out_time = now_datetime()
	# `status` is derived from `out_time` in the controller, so saving is what sets it —
	# assigning it here as well would give the derivation a second, competing author.
	doc.save()

	return {"name": doc.name, "out_time": doc.out_time, "status": doc.status}
