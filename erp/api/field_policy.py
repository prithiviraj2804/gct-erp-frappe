# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""The resolved Field Policy, for a form that has to draw itself.

App-wide rather than module-scoped: any doctype may be governed by a policy, and the Desk form
script for each asks the same question. See erp/field_policy.py for the resolution itself.

This endpoint is **presentation only**. Nothing it returns is trusted: the same policy is applied
again in `validate()`, server-side, for every writer including the ones that never call this.
Hiding a field here is a courtesy to the counsellor, not a security boundary.
"""

from dataclasses import asdict

import frappe
from frappe import _

from erp.api.permission import assert_institution_in_scope
from erp.field_policy import resolve_policy


@frappe.whitelist()
def get_policy(document_type: str, institution: str | None = None) -> dict:
	"""The effective rule for every governed field, keyed by fieldname.

	Permission is checked against the *governed* doctype rather than against Field Policy, because
	the question being asked is "how does my form behave", and anyone who may read the form may ask
	it. Requiring read on Field Policy would mean every counsellor needed access to the
	configuration layer to fill in a lead.
	"""
	if not frappe.has_permission(document_type, "read"):
		frappe.throw(
			_("You are not permitted to read {0}.").format(frappe.bold(document_type)),
			frappe.PermissionError,
		)

	# The doctype permission above answers "may you read this kind of record". It says nothing
	# about *whose* configuration you asked for, and `institution` arrives from the caller — so
	# without this a counsellor at one institution could read another's resolved policy: which
	# fields it requires and hides, what it calls them, what bounds it sets. `resolve_policy`
	# cannot refuse it either, because it reads through `frappe.db.get_value` and `frappe.get_all`,
	# both of which bypass the permission layer by design.
	#
	# This matters beyond the disclosure: `docs/CONFIGURATION.md` specifies `explain(key, **anchors)`
	# with the same shape and the same caller-supplied anchors, and this endpoint is the precedent
	# it will be written from.
	if institution:
		assert_institution_in_scope(institution)

	spec = resolve_policy(document_type, institution=institution)
	return {fieldname: asdict(rule) for fieldname, rule in spec.items()}
