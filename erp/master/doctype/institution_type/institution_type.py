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


class InstitutionType(NestedSet):
	# Stated rather than derived. `update_nsm` builds "parent_" + scrub(doctype) while
	# `NestedSet.on_trash` builds scrub(doctype) + "_parent", and those are not the same field.
	nsm_parent_field = "parent_institution_type"

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


def resolve_capability_for_institution(institution: str | None, capability: str) -> str | None:
	"""`resolve_capability`, entered from an institution rather than from its type.

	Almost every caller has an institution in hand and not a type — a Programme, an enquiry, an
	application, a pipeline gate — so the Institution → type lookup was being written out at each
	call site. One of them is enough, and having one place means the day a capability is answerable
	somewhere other than the type tree (an institution of its own, a programme, an intake — the
	chain `docs/CONFIGURATION.md` §1 specifies) exactly one function changes.
	"""
	if not institution:
		return None

	return resolve_capability(frappe.db.get_value("Institution", institution, "institution_type"), capability)


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
