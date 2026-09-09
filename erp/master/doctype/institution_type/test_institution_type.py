# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Institution Type: the tree, its inheritance, and the journey it exists for.

The journey: *a trust acquires a nursing college on a Tuesday and configures it that afternoon.*
Before this doctype, `institution_type` was a `Select` whose options were a line of Python and two
controllers branched on the literal `"School"`, so a new kind of institution meant an edit, a review
and a deploy.
"""

import frappe
from frappe.tests import IntegrationTestCase

from erp.master.doctype.institution_type.institution_type import (
	institution_requires_department,
	resolve_capability,
)
from erp.seed import ensure_shared_vocabulary


class IntegrationTestInstitutionType(IntegrationTestCase):
	TRUST = "ZY1"

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.ensure("Trust", cls.TRUST, {"trust_code": cls.TRUST, "trust_name": "Type Trust"})

	@staticmethod
	def ensure(doctype, name, values):
		if frappe.db.exists(doctype, name):
			return name
		return frappe.get_doc({"doctype": doctype, **values}).insert(ignore_permissions=True).name

	def make_institution(self, code, institution_type):
		return self.ensure(
			"Institution",
			code,
			{
				"trust": self.TRUST,
				"institution_code": code,
				"institution_name": f"{code} Institution",
				"institution_type": institution_type,
			},
		)

	# --- The shipped tree ------------------------------------------------------------

	def test_the_shipped_tree_has_one_root(self):
		"""NestedSet permits exactly one root, and everything inherits through it."""
		roots = frappe.get_all(
			"Institution Type", filters={"parent_institution_type": ("in", ("", None))}, pluck="name"
		)
		self.assertEqual(roots, ["All"])

	def test_every_shipped_type_is_marked_standard(self):
		"""`is_standard` is what stops a shipped row being deleted and silently reappearing on the
		next migrate, having taken its configuration with it."""
		for name in ("School", "Engineering", "Medical", "Nursing", "Professional"):
			self.assertTrue(frappe.db.get_value("Institution Type", name, "is_standard"), name)

	# --- Inheritance -----------------------------------------------------------------

	def test_a_leaf_inherits_from_its_group(self):
		"""The point of the tree. `Engineering` states nothing; `Professional` does.

		"States nothing" is the empty string, not NULL — a Select column is written as `''`. That
		is precisely why `resolve_capability` tests truthiness rather than `is None`.
		"""
		self.assertFalse(frappe.db.get_value("Institution Type", "Engineering", "requires_department"))
		self.assertEqual(resolve_capability("Engineering", "requires_department"), "Yes")

	def test_the_nearest_statement_wins(self):
		"""An institution type may contradict its group — that is what makes the tree a default
		rather than a cage."""
		odd = self.ensure(
			"Institution Type",
			"ZY Open Engineering",
			{
				"type_name": "ZY Open Engineering",
				"parent_institution_type": "Professional",
				"requires_department": "No",
			},
		)
		self.assertEqual(resolve_capability(odd, "requires_department"), "No")

	def test_an_unstated_capability_resolves_to_none(self):
		"""`None` means "nobody has decided", which is not the same as "No" — the caller chooses
		what silence means. This is why capabilities are Select and not Check: a Check column is
		NOT NULL DEFAULT 0 (frappe/database/schema.py:182) and cannot hold "unstated"."""
		blank = self.ensure(
			"Institution Type",
			"ZY Undecided",
			{"type_name": "ZY Undecided", "parent_institution_type": "All"},
		)
		self.assertIsNone(resolve_capability(blank, "requires_department"))

	# --- The rule that used to be two hardcoded branches ------------------------------

	def test_a_school_needs_no_department(self):
		self.assertFalse(institution_requires_department(self.make_institution("ZYSCH", "School")))

	def test_an_engineering_institution_needs_a_department(self):
		self.assertTrue(institution_requires_department(self.make_institution("ZYENG", "Engineering")))

	def test_an_unconfigured_type_keeps_the_stricter_rule(self):
		"""Silence must not quietly drop a requirement. The superseded literal required a
		department for everything that was not a school; an unconfigured type does the same."""
		self.ensure(
			"Institution Type",
			"ZY Unknown",
			{"type_name": "ZY Unknown", "parent_institution_type": "All"},
		)
		self.assertTrue(institution_requires_department(self.make_institution("ZYUNK", "ZY Unknown")))

	# --- The journey ------------------------------------------------------------------

	def test_a_new_kind_of_institution_needs_no_code(self):
		"""The whole slice, in one test.

		A dental college is not in any Select, is named nowhere in Python, and was not thought
		about when this was written. Creating the row and pointing an institution at it is the
		entire onboarding, and the department rule applies to it correctly through inheritance.
		"""
		self.ensure(
			"Institution Type",
			"ZY Dental",
			{"type_name": "ZY Dental", "parent_institution_type": "Professional"},
		)
		dental = self.make_institution("ZYDEN", "ZY Dental")

		self.assertEqual(resolve_capability("ZY Dental", "requires_department"), "Yes")
		self.assertTrue(institution_requires_department(dental))

	# --- Guards ------------------------------------------------------------------------

	def test_a_standard_type_cannot_be_deleted(self):
		with self.assertRaises(frappe.ValidationError):
			frappe.delete_doc("Institution Type", "Medical")

	def test_a_type_in_use_cannot_be_deleted(self):
		spare = self.ensure(
			"Institution Type",
			"ZY Spare",
			{"type_name": "ZY Spare", "parent_institution_type": "All"},
		)
		self.make_institution("ZYSPARE", spare)

		with self.assertRaises(frappe.ValidationError):
			frappe.delete_doc("Institution Type", spare)

	# --- Relabelling a shipped type must not fork the taxonomy -------------------------

	def test_relabelling_a_standard_type_does_not_fork_it_on_reseed(self):
		"""The journey: *a trust calls its schools "CBSE School" and migrates the next morning.*

		`autoname` is `field:type_name` and `allow_rename` is 1, so relabelling is a rename — and
		`validate_rename` needs only `write`, which Trust Admin holds. The rename itself is correct:
		the row, every Institution pointing at it and the Field Policy scoped to it all follow.

		Then the `after_migrate` seed looked for "School", did not find it, and inserted a second
		one. The phantom carried no Field Policy — `_ensure_field_policies` keyed on the autoname
		`Admission Enquiry-School`, which the renamed policy still bore — so any institution later
		created under it collected the full professional superset with nothing hidden. And
		`assert_not_standard` then refused to let anyone delete it, including System Manager. No
		error at any point: the operator saw a tidy tree with one extra row.

		The fix is `standard_key`: what the row shipped as, separate from what it is called now.
		"""
		before = frappe.db.count("Institution Type", {"standard_key": "School"})
		self.assertEqual(before, 1, "the shipped School row should carry its standard_key")

		frappe.rename_doc("Institution Type", "School", "ZY CBSE School", force=True)
		try:
			ensure_shared_vocabulary()

			self.assertEqual(
				frappe.db.count("Institution Type", {"standard_key": "School"}),
				1,
				"the seed inserted a second School instead of recognising the relabelled one",
			)
			self.assertFalse(
				frappe.db.exists("Institution Type", "School"),
				"a phantom School reappeared under the shipped name",
			)
			self.assertEqual(
				frappe.db.get_value("Institution Type", "ZY CBSE School", "standard_key"),
				"School",
				"the relabelled row lost the key that identifies it as shipped",
			)
			self.assertTrue(
				frappe.db.exists(
					"Field Policy",
					{"document_type": "Admission Enquiry", "scope_institution_type": "ZY CBSE School"},
				),
				"the shipped policy did not follow the rename",
			)
			self.assertEqual(
				frappe.db.count(
					"Field Policy",
					{"document_type": "Admission Enquiry", "scope_institution_type": "ZY CBSE School"},
				),
				1,
				"the seed added a second policy at the relabelled scope",
			)
		finally:
			frappe.rename_doc("Institution Type", "ZY CBSE School", "School", force=True)
