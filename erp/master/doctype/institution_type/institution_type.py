# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""What kind of institution this is, and what that kind requires.

A trust runs schools, engineering colleges, medical colleges and arts & science colleges from one
database, and almost every difference between them is a difference of *kind*, not of instance.
Holding the kind as a tree means a rule is stated once where it is true and inherited everywhere it
applies — "a professional college admits on an entrance exam" is one row, not seven.

    All
    |-- School
    |-- Arts & Science
    `-- Professional          <- state it here
        |-- Engineering       <- inherited
        |-- Medical           <- inherited
        |-- Polytechnic, Law, MBA, Nursing, Pharmacy ...

Adding a Nursing college becomes an INSERT rather than a deploy. Before this, `institution_type` was
a `Select` whose options were a line of Python, and two controllers branched on the literal
`"School"`.

**Capabilities are tri-state, and that is why they are `Select` and not `Check`.**
`frappe/database/schema.py:182` makes `Check` columns `NOT NULL DEFAULT 0`, so a `Check` cannot
distinguish "No" from "not stated" — and a cascade needs that distinction, or every child silently
overrides its parent with 0. Blank means inherit; only "Yes"/"No" are answers.
"""

import frappe
from frappe import _
from frappe.utils.nestedset import NestedSet, get_ancestors_of

from erp.config.resolver import clear_cache as clear_config_cache
from erp.config.resolver import get_config


class InstitutionType(NestedSet):
	# Stated rather than derived. `update_nsm` builds "parent_" + scrub(doctype) while
	# `NestedSet.on_trash` builds scrub(doctype) + "_parent", and those are not the same field.
	nsm_parent_field = "parent_institution_type"

	def on_update(self):
		"""Maintain the nested set, then invalidate configuration wholesale.

		`super()` first and non-negotiably. `NestedSet.on_update` is what calls `update_nsm`, which
		maintains `lft`/`rgt` — so overriding this method without it silently stops the tree being
		a tree: `get_ancestors_of` returns nothing, every inherited capability resolves to None, and
		a Nursing college added under Professional quietly stops requiring a Department. Three tests
		caught it here; nothing would have caught it in production until a form stopped asking for a
		field.

		Wholesale rather than surgical, because a saved type can change every descendant's answer.

		Two ways. A **re-parent** reshuffles the ancestry the whole chain walks, so every institution
		under this subtree resolves differently and there is no one node to invalidate. And a
		**capability column** edited here is the source at type scope for every key that names it,
		which the per-node cache holds under this type's own node — but a leaf inheriting from it
		caches the answer under *its* node, so surgical invalidation would miss the inheritors.
		"""
		super().on_update()
		clear_config_cache()

	def on_trash(self):
		self.assert_not_standard()
		self.assert_unused()
		super().on_trash()

	def assert_not_standard(self):
		"""A shipped type may be relabelled or re-parented, never deleted.

		The rows are code — replayed by a seed patch — so deleting one only means it reappears on
		the next migrate, having taken its configuration with it in the meantime.
		"""
		if self.is_standard:
			frappe.throw(
				_("{0} ships with the app and cannot be deleted. Edit it instead.").format(
					frappe.bold(self.name)
				),
				title=_("Standard Institution Type"),
			)

	def assert_unused(self):
		"""Refuse to strand institutions on a type that no longer exists.

		`institution_type` is `reqd`, so a deleted type would leave rows that cannot be saved again
		and whose capabilities resolve to nothing.
		"""
		users = frappe.get_all("Institution", filters={"institution_type": self.name}, pluck="name")
		if users:
			frappe.throw(
				_("{0} is in use by {1}.").format(frappe.bold(self.name), frappe.bold(", ".join(users))),
				title=_("Institution Type In Use"),
			)


# --- Capability resolution -------------------------------------------------------------


def resolve_capability(institution_type: str | None, capability: str) -> str | None:
	"""The nearest stated value for `capability`, walking up from `institution_type`.

	Returns the first non-blank answer found on the type itself, then on each ancestor in turn,
	nearest first. `get_ancestors_of(..., order_by="lft desc")` is already in that order, which is
	why the walk is a loop and not a sort.

	Returns None when nothing in the chain states a value — the caller decides what that means,
	because "unstated" is not the same answer for every capability.
	"""
	if not institution_type:
		return None

	stated = frappe.db.get_value("Institution Type", institution_type, capability)
	if stated:
		return stated

	for ancestor in get_ancestors_of("Institution Type", institution_type, order_by="lft desc"):
		stated = frappe.db.get_value("Institution Type", ancestor, capability)
		if stated:
			return stated

	return None


def resolve_capability_for_institution(
	institution: str | None,
	capability: str,
	*,
	programme: str | None = None,
	programme_intake: str | None = None,
) -> str | None:
	"""A capability's effective value for one institution, through the full configuration chain.

	This used to be `resolve_capability` entered from an institution — the Institution → type
	lookup, then the ancestor walk, and nothing below the type tree or above it. It is now a thin
	call into `erp.config.resolver`, which is the day this function was written for: its own
	docstring said "the day a capability is answerable somewhere other than the type tree ...
	exactly one function changes", and this is that change.

	What every caller gains without any of them changing: four more levels. A capability stated on
	the type is still stated on the type — `Config Setting.institution_type_field` makes that column
	the source at type scope — but it can now be overridden on one institution, one programme or one
	intake, and set trust-wide as a floor. `docs/features/school-admission.md` needs exactly that: a
	trust with one fee-free school among six fee-charging ones, which the type tree cannot express
	because both are Schools.

	`default=None` rather than letting the setting's own default apply, because these callers each
	have their own answer for "nobody said" and it is not the same answer — the interaction gate
	treats silence as off, the department rule and the fee gate treat it as on. Those defaults
	belong at the call site, and are documented there.

	`resolve_capability` remains, and remains the ancestor walk: it answers a question about a
	*type* rather than about an institution, which is what the Institution Type form asks.
	"""
	if not institution:
		return None

	return get_config(
		capability,
		institution=institution,
		programme=programme,
		programme_intake=programme_intake,
		default=None,
	)


def institution_requires_department(institution: str | None) -> bool:
	"""Whether a Programme or an enquiry under this institution must name a Department.

	Replaces the two byte-identical `if institution_type != "School"` branches that used to sit in
	`programme.py` and `admission_enquiry.py`. The rule is now a row on the type.

	Unstated resolves to **True**, which is what the hardcoded rule did for everything that was not
	a school. A type nobody has configured therefore keeps the stricter behaviour rather than
	quietly dropping a requirement.
	"""
	if not institution:
		return True

	return resolve_capability_for_institution(institution, "requires_department") != "No"
