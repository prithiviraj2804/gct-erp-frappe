# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Resolve and enforce the Field Policy chain.

One doctype serves a school, an engineering college and a medical college; a Field Policy says
which of its fields each actually collects. This module answers "what does *this* institution
collect on *this* doctype" and then enforces the answer.

**The merge accumulates; it does not short-circuit.** Scopes are folded least-specific first —
Trust, then the institution type's ancestors furthest-first, then the type, then the institution,
the programme and the intake — and each rule overwrites only the properties it actually states.
So a trust can make one field optional for one intake with a single child row carrying a single
property, and the label, order and bounds it does not mention are inherited rather than reset.

That ordering is the exact reverse of a settings lookup, which stops at the first answer. A policy
is not one answer; it is a composition.
"""

from dataclasses import dataclass, replace

import frappe
from frappe import _
from frappe.utils import flt
from frappe.utils.nestedset import get_ancestors_of

HIDDEN = "Hidden"
REQUIRED = "Required"
READ_ONLY = "Read Only"


@dataclass(frozen=True)
class ResolvedField:
	"""What one field does, after every applicable scope has had its say."""

	fieldname: str
	requirement: str = "Optional"
	label: str | None = None
	description: str | None = None
	display_order: int = 0
	min_value: float | None = None
	max_value: float | None = None


# --- The scope chain -------------------------------------------------------------------


def scope_chain(institution: str | None) -> list[tuple[str, str]]:
	"""Every scope that applies, **least specific first**, as (scope_field, value) pairs.

	Ancestors come furthest-first — `get_ancestors_of(..., order_by="lft asc")` — so `All` is folded
	before `Professional`, which is folded before `Engineering`, and the institution's own policy
	lands last. The nearest statement therefore wins without the merge knowing anything about depth.

	Two scopes, because two have a consumer: configure the kind, override the one institution that
	differs. A programme or intake scope is a field and a line here, added when a journey asks.
	"""
	if not institution:
		return []

	institution_type = frappe.db.get_value("Institution", institution, "institution_type")

	chain: list[tuple[str, str]] = []
	if institution_type:
		for ancestor in get_ancestors_of("Institution Type", institution_type, order_by="lft asc"):
			chain.append(("scope_institution_type", ancestor))
		chain.append(("scope_institution_type", institution_type))

	chain.append(("scope_institution", institution))
	return chain


def resolve_policy(document_type: str, *, institution: str | None) -> dict[str, ResolvedField]:
	"""The effective rule for every governed field on `document_type`.

	Memoised per request on `frappe.local`: one save resolves this once and then asks it about a
	dozen fields, and a Data Import of three hundred rows would otherwise re-read the same policies
	three hundred times.
	"""
	chain = scope_chain(institution)
	if not chain:
		return {}

	cache = getattr(frappe.local, "erp_field_policy", None)
	if cache is None:
		cache = frappe.local.erp_field_policy = {}
	key = (document_type, tuple(chain))
	if key in cache:
		return cache[key]

	resolved: dict[str, ResolvedField] = {}
	for scope_field, scope_value in chain:
		for policy in _policies_for(document_type, scope_field, scope_value):
			for rule in policy:
				resolved[rule.fieldname] = _merge(resolved.get(rule.fieldname), rule)

	cache[key] = resolved
	return resolved


def clear_cache() -> None:
	"""Drop the resolved-policy memo for this request.

	Called from `Field Policy.on_update` and `on_trash`. Without it, anything that edits a policy
	and then saves a governed document in the same request — a patch, a Data Import, a background
	job, a test — keeps enforcing the policy as it was when the request started. The memo exists
	because one save asks about a dozen fields; it must not outlive the answer being true.
	"""
	frappe.local.erp_field_policy = {}


def _policies_for(document_type: str, scope_field: str, scope_value: str) -> list[list]:
	"""The enabled policies at one scope, as lists of their rule rows."""
	names = frappe.get_all(
		"Field Policy",
		filters={"document_type": document_type, scope_field: scope_value, "enabled": 1},
		pluck="name",
	)
	return [frappe.get_cached_doc("Field Policy", name).rules for name in names]


def _merge(current: ResolvedField | None, rule) -> ResolvedField:
	"""Overwrite only what this rule states.

	"States" means non-blank, and for `display_order` it means non-zero — see the tri-state rule in
	docs/DATA-MODEL.md. A rule that sets only a label must not silently reset the requirement a
	broader scope established.
	"""
	base = current or ResolvedField(fieldname=rule.fieldname)
	changes = {}
	if rule.requirement:
		changes["requirement"] = rule.requirement
	if rule.label_override:
		changes["label"] = rule.label_override
	if rule.description_override:
		changes["description"] = rule.description_override
	if rule.display_order:
		changes["display_order"] = rule.display_order
	# Bounds are stored as Data so that "0" is a bound and "" is no bound. Testing truthiness here
	# would silently drop a minimum of zero, which is the commonest bound there is.
	if _stated(rule.min_value):
		changes["min_value"] = flt(rule.min_value)
	if _stated(rule.max_value):
		changes["max_value"] = flt(rule.max_value)
	return replace(base, **changes) if changes else base


def _stated(value) -> bool:
	"""Whether a bound was actually written down, as opposed to left blank."""
	return value is not None and str(value).strip() != ""


# --- Enforcement -----------------------------------------------------------------------


def apply_field_policy(doc) -> None:
	"""Enforce the resolved policy. Call from `validate()`; it is the only boundary.

	Three things happen, in this order:

	* **Hidden** fields are emptied on a new document and *reverted* on an existing one. Reverting
	  rather than clearing matters: a field this institution no longer collects may still hold what
	  it collected last year, and a policy change must not quietly delete history. What it must do
	  is stop a form that cannot show the field from writing to it.
	* **Required** fields are collected and reported together, once, so a counsellor is told
	  everything that is missing rather than discovering it one save at a time.
	* **Bounds** are checked on whatever value survived.
	"""
	spec = resolve_policy(doc.doctype, institution=doc.get("institution"))
	if not spec:
		return

	missing = []
	for fieldname, rule in spec.items():
		if not doc.meta.has_field(fieldname):
			continue

		if rule.requirement == HIDDEN:
			_revert(doc, fieldname)
			continue

		value = doc.get(fieldname)
		if rule.requirement == REQUIRED and _is_blank(value):
			missing.append(rule.label or doc.meta.get_label(fieldname))
			continue

		_check_bounds(doc, fieldname, rule, value)

	if missing:
		frappe.throw(
			_("This institution requires: {0}.").format(", ".join(frappe.bold(label) for label in missing)),
			title=_("Missing Information"),
		)


def _is_blank(value) -> bool:
	"""A child table counts as blank when it has no rows, which `not value` already covers."""
	return value in (None, "", []) or value == []


def _revert(doc, fieldname: str) -> None:
	"""Put a hidden field back to what is stored, or empty it on a new document."""
	if doc.is_new():
		doc.set(fieldname, None)
		return

	stored = doc.get_db_value(fieldname)
	if doc.get(fieldname) != stored:
		doc.set(fieldname, stored)


def _check_bounds(doc, fieldname: str, rule: ResolvedField, value) -> None:
	if value in (None, ""):
		return

	label = rule.label or doc.meta.get_label(fieldname)
	if rule.min_value is not None and flt(value) < rule.min_value:
		frappe.throw(
			_("{0} cannot be below {1}.").format(frappe.bold(label), frappe.bold(rule.min_value)),
			title=_("Out Of Range"),
		)
	if rule.max_value is not None and flt(value) > rule.max_value:
		frappe.throw(
			_("{0} cannot be above {1}.").format(frappe.bold(label), frappe.bold(rule.max_value)),
			title=_("Out Of Range"),
		)
