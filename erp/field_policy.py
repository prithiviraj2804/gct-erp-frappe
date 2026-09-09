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
from frappe.model import display_fieldtypes, numeric_fieldtypes, table_fields
from frappe.utils import flt
from frappe.utils.nestedset import get_ancestors_of

HIDDEN = "Hidden"
REQUIRED = "Required"
READ_ONLY = "Read Only"

# The two requirements enforced by putting a value *back*: what the institution does not collect,
# and what it may see but not write. Both need somewhere to put the restored value, which is why
# `Field Policy.validate_governable_fieldtypes` refuses them on a child table.
#
# They are one enforcement and two presentations. Hidden is not rendered; Read Only is rendered
# and greyed. Neither may be written, and a rule that only greyed a field in the browser would be
# advice rather than a rule — the whole reason this module exists.
REVERTING = frozenset({HIDDEN, READ_ONLY})

# Every doctype whose controller calls `apply_field_policy`.
#
# A policy may be written only for one of these, because a policy on anything else saves green and
# enforces nothing. That is the same silent no-op `Field Policy.validate_fields_exist` exists to
# prevent one level down — a rule naming a field that does not exist — and it is worse at this
# level, because the whole policy looks correct and a Trust Admin has no way to tell.
#
# Declared rather than discovered: there is no cheap runtime question that means "does this
# controller call the enforcer". `erp/test_conventions.py` asserts the declaration matches the
# source in both directions, so the list cannot drift from what is actually enforced, and
# `erp.api.doctype` publishes it so a client knows which forms it must not draw unaided.
GOVERNED_DOCTYPES = frozenset(
	{
		"Admission Enquiry",
	}
)


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
	if stated(rule.min_value):
		changes["min_value"] = flt(rule.min_value)
	if stated(rule.max_value):
		changes["max_value"] = flt(rule.max_value)
	return replace(base, **changes) if changes else base


def stated(value) -> bool:
	"""Whether a bound was actually written down, as opposed to left blank."""
	return value is not None and str(value).strip() != ""


# --- Enforcement -----------------------------------------------------------------------


def apply_field_policy(doc) -> None:
	"""Enforce the resolved policy. Call from `validate()`; it is the only boundary.

	Three things happen, in this order:

	* **Hidden** and **Read Only** fields are *reverted* — to the stored value on an existing
	  document, to the doctype's own default on a new one. Reverting rather than clearing matters:
	  a field this institution no longer collects may still hold what it collected last year, and a
	  policy change must not quietly delete history. What it must do is stop a writer that cannot
	  show the field from writing to it. The two requirements are one enforcement and two
	  presentations — see `REVERTING`.
	* **Required** fields are collected and reported together, once, so a counsellor is told
	  everything that is missing rather than discovering it one save at a time. On an existing
	  document a Required rule binds only a field the writer is actually touching — see
	  `_required_binds`.
	* **Bounds** are checked on whatever value survived.

	A revert is announced rather than silent. It used to be silent, on the reasoning that the only
	writer it could affect was a stray form post; but the SPA publishes the schema without the
	policy, and Data Import runs every row through `validate`, so the same code path is reached by
	a counsellor who typed a real value and by a five-thousand-row migration. Neither should learn
	about it a year later.
	"""
	spec = resolve_policy(doc.doctype, institution=doc.get("institution"))
	if not spec:
		return

	missing = []
	discarded = []

	for fieldname, rule in spec.items():
		field = doc.meta.get_field(fieldname)
		if not field:
			continue

		label = rule.label or doc.meta.get_label(fieldname)

		if rule.requirement in REVERTING:
			if _revert(doc, field):
				discarded.append(label)
			continue

		value = doc.get(fieldname)
		if rule.requirement == REQUIRED and _is_blank(value):
			if _required_binds(doc, fieldname):
				missing.append(label)
			continue

		_check_bounds(doc, fieldname, rule, value)

	if discarded:
		frappe.msgprint(
			_("This institution does not collect {0}, so what was entered there was not saved.").format(
				", ".join(frappe.bold(label) for label in discarded)
			),
			title=_("Not Collected Here"),
			indicator="orange",
		)

	if missing:
		frappe.throw(
			_("This institution requires: {0}.").format(", ".join(frappe.bold(label) for label in missing)),
			title=_("Missing Information"),
		)


def _is_blank(value) -> bool:
	"""A child table counts as blank when it has no rows, which `not value` already covers."""
	return value in (None, "", []) or value == []


def _required_binds(doc, fieldname: str) -> bool:
	"""Whether a Required rule applies to *this* save of *this* document.

	Always on insert. On an existing document, only for a field the writer actually changed.

	The reason is that a policy has no time dimension — no `effective_from`, no academic year — and
	`validate` runs on every save, so the rule in force is always today's rule applied to records
	raised under last month's. Enforcing Required unconditionally therefore means that adding
	`Required: aadhaar_number` in September makes every July lead without one *unsaveable*: not
	merely unable to advance, but impossible to edit, so a counsellor cannot correct a phone number
	on it. The lockout is silent until someone tries.

	Binding only changed fields keeps the rule real — a field cannot be blanked out, because
	blanking it is a change — while leaving history editable. A rule that must be applied
	retrospectively is a different request, and it needs a scope that says which cycle it belongs
	to; that is `academic_year` on the policy, and it is a schema change, not this branch.

	`get_latest()` rather than `get_doc_before_save()`: `Document._save` does not populate
	`_doc_before_save` before running `validate` (it loads it at `document.py:1537`, after), so the
	accessor returns `None` here and every field would read as unchanged. `get_latest()` loads it
	lazily, which is the same call `frappe.model.base_document.reset_values_if_no_permlevel_access`
	makes for the same reason.
	"""
	if doc.is_new():
		return True

	previous = doc.get_latest()
	if previous is None:
		return False

	return doc.get(fieldname) != previous.get(fieldname)


def _revert(doc, field) -> bool:
	"""Put a governed field back to what it should hold, and say whether anything was discarded.

	On an existing document that is the stored value; on a new one it is the doctype's own default,
	which is what `frappe.new_doc` produces — the same two branches, and the same reasoning, as
	`reset_values_if_no_permlevel_access`. Reading the default rather than writing `None` matters
	for a field whose schema supplies one: clearing it would make a policy that hides a field also
	silently override its default.
	"""
	fieldname = field.fieldname
	submitted = doc.get(fieldname)

	if doc.is_new():
		restored = frappe.new_doc(doc.doctype).get(fieldname)
	else:
		previous = doc.get_latest()
		if previous is None:
			return False
		restored = previous.get(fieldname)

	if submitted == restored:
		return False

	doc.set(fieldname, restored)
	return True


def _check_bounds(doc, fieldname: str, rule: ResolvedField, value) -> None:
	"""Compare a numeric field against its stated bounds.

	`Field Policy.validate_governable_fieldtypes` refuses a bound on anything but a numeric field,
	so `flt` here is converting a number rather than guessing at one. That guard is load-bearing:
	`flt` returns 0.0 for anything it cannot parse, so `min_value: 1` on a Data field holding
	"JEE Main" would have thrown for every value an institution could possibly enter — blocking
	every save of the governed doctype at that scope, with an error naming a bound the operator
	had no reason to think applied.
	"""
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


# --- Guards shared with the Field Policy controller ------------------------------------


def fieldtype_objection(field, rule) -> str | None:
	"""Why this rule cannot govern this field, or None if it can.

	Lives here rather than in the controller because it is the mirror of what enforcement above
	actually does: a rule form is refusable exactly when `apply_field_policy` could not carry it
	out. Keeping the two in one module is what stops a rule saving green and enforcing nothing.
	"""
	if field.fieldtype in display_fieldtypes:
		return _("{0} structures the form and holds no value, so there is nothing to govern.").format(
			frappe.bold(field.fieldname)
		)

	if rule.requirement in REVERTING and field.fieldtype in table_fields:
		return _(
			"{0} is a {1}. {2} works by putting the previous value back, which is a row operation "
			"on a child table rather than a column write — so it is refused here rather than "
			"failing at save time. Hide the rows the table collects instead, or make the table "
			"Required and govern its own fields."
		).format(frappe.bold(field.fieldname), frappe.bold(field.fieldtype), frappe.bold(rule.requirement))

	if (stated(rule.min_value) or stated(rule.max_value)) and field.fieldtype not in numeric_fieldtypes:
		return _(
			"{0} is a {1}, so a Minimum or Maximum cannot be compared against it. A bound on a "
			"non-numeric field reads every value as zero, which either passes always or blocks "
			"every save."
		).format(frappe.bold(field.fieldname), frappe.bold(field.fieldtype))

	return None
