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
from frappe.model import no_value_fields, table_fields

from erp.api.permission import assert_institution_in_scope
from erp.field_policy import GOVERNED_DOCTYPES, resolve_policy
from erp.master.doctype.field_policy.field_policy import REPORTING_SPINE


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


@frappe.whitelist(methods=["GET"])
def governable_fields(document_type: str) -> list[dict]:
	"""The fields a policy on `document_type` may actually govern, for the rule row's picker.

	`Field Policy Rule.fieldname` used to be a free `Data` field. That made three things happen and
	all three read to an operator as "I cannot add a rule":

	* clicking **Add Row** and saving before typing anything threw
	  `Admission Enquiry has no field None`;
	* typing the label — "Entrance Rank" — threw `has no field Entrance Rank`; and
	* a misspelling threw the same way, with no hint what the right spelling was.

	Every one of those errors was *correct*. None of them was useful, because nothing anywhere told
	the operator what the valid answers were — the fieldnames live in a JSON file they have no
	reason to have read.

	So the picker offers only fields that will pass every guard in `Field Policy.validate`: not on
	the reporting spine, not statically `reqd`, and not a fieldtype the enforcer cannot carry out a
	rule on. It is the same discipline as `fieldtype_objection`, moved one step earlier — **a rule
	form that saves is a rule form the enforcer carries out**, and now also *a rule form you can
	choose is one that saves*.

	Labelled `"Label (fieldname)"`, which is Frappe's own idiom for this in
	`document_naming_rule.js`: the operator recognises the label, and the stored value stays the
	fieldname the enforcer needs.
	"""
	if not frappe.has_permission("Field Policy", "read"):
		frappe.throw(
			_("You are not permitted to read Field Policy."),
			frappe.PermissionError,
		)

	if document_type not in GOVERNED_DOCTYPES:
		frappe.throw(
			_("Nothing applies a Field Policy to {0}.").format(frappe.bold(document_type)),
			title=_("Not A Governed DocType"),
		)

	spine = REPORTING_SPINE.get(document_type, frozenset())
	meta = frappe.get_meta(document_type)

	fields = []
	for df in meta.fields:
		if df.fieldtype in no_value_fields and df.fieldtype not in table_fields:
			continue
		if df.fieldname in spine or df.reqd or df.fieldname == "id":
			continue

		fields.append(
			{
				"value": df.fieldname,
				"label": f"{_(df.label or df.fieldname)} ({df.fieldname})",
				"fieldtype": df.fieldtype,
			}
		)

	return sorted(fields, key=lambda field: field["label"])
