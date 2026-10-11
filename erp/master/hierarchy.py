# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Ancestry rules for the Trust → Campus → Institution foundation.

A Link field only proves its target exists, never that the target sits in the same branch,
so those columns are independent claims that must be reconciled.

`validate_same_parent` is the guard: it re-reads the linked record and asserts the
ancestors it claims are the ones the document claims.
"""

import frappe
from frappe import _


class HierarchyMismatchError(frappe.ValidationError):
	"""A document names a parent that lives in a different branch of the hierarchy."""


def inherit_parent_value(doc, link_field: str, target_field: str) -> None:
	"""Populate a denormalized ancestor when callers omit its read-only field."""
	link_value = doc.get(link_field)
	if not link_value or doc.get(target_field):
		return

	link_doctype = doc.meta.get_field(link_field).options
	doc.set(target_field, frappe.db.get_value(link_doctype, link_value, target_field))


def validate_same_parent(doc, link_field: str, *shared_fields: str) -> None:
	"""Assert the record linked in `link_field` shares this document's `shared_fields`.

	``validate_same_parent(self, "campus", "trust")`` on an Institution Campus Assignment reads
	the linked Campus's own `trust` and throws unless it matches the Assignment's.

	Stays silent when either side is blank: an empty link is nothing to compare, and an
	empty value on this document is an omission for `reqd`/`fetch_from` to deal with rather
	than a contradiction. Also silent on a dangling link — ``_validate_links`` runs ahead of
	``validate`` and reports that case better than we could.
	"""
	link_value = doc.get(link_field)
	if not link_value:
		return

	link_doctype = doc.meta.get_field(link_field).options
	parent = frappe.db.get_value(link_doctype, link_value, shared_fields, as_dict=True)
	if not parent:
		return

	for shared_field in shared_fields:
		own_value = doc.get(shared_field)
		if not own_value or parent.get(shared_field) == own_value:
			continue

		link_label = _(doc.meta.get_label(link_field))
		shared_label = _(doc.meta.get_label(shared_field))

		if parent.get(shared_field):
			message = _("{0} {1} belongs to {2} {3}, but this {4} is under {2} {5}.").format(
				link_label,
				frappe.bold(link_value),
				shared_label,
				frappe.bold(parent.get(shared_field)),
				_(doc.doctype),
				frappe.bold(own_value),
			)
		else:
			message = _("{0} {1} has no {2}, but this {3} is under {2} {4}.").format(
				link_label,
				frappe.bold(link_value),
				shared_label,
				_(doc.doctype),
				frappe.bold(own_value),
			)

		frappe.throw(message, HierarchyMismatchError, title=_("Hierarchy Mismatch"))
