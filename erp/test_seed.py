# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""What the seed promises about rows it has already shipped.

Two promises pull against each other, and both were broken in the same session in different ways:

* **A correction to shipped configuration must reach an existing site.** "Only absence is
  corrected" meant a shipped row was frozen at whatever it looked like the first time a site
  migrated. A School application policy shipped with `interaction_outcome` Required — which made
  `start_application` unable to raise a school application at all — and editing the seed fixed
  nothing until the rows were deleted by hand through a script that bypassed `assert_not_standard`.
  `requires_admission_interaction` added to `School` in code reached a fresh site and no existing
  one, silently, and was caught only by a test asserting the gate applied.

* **An operator's edit must never be clobbered.** That is the promise the first one endangers.

The resolution is different for the two row classes, and the reason is what "blank" means:

| | recognised by | re-asserted when |
|---|---|---|
| `Field Policy` rules | `shipped_digest` | the row still matches what shipped |
| vocabulary capabilities | the column being blank | blank, i.e. nobody has answered |

A digest is right for a policy because its rules are a statement an operator either made or did
not. It is wrong for a capability, because those columns are *meant* to be edited and blank already
means "unstated" — so filling a blank overrides no decision anybody made.
"""

import frappe
from frappe.tests import IntegrationTestCase

from erp.seed import (
	FIELD_POLICIES,
	_rules_digest,
	diverged_field_policies,
	ensure_shared_vocabulary,
	restore_shipped_field_policies,
)


class IntegrationTestShippedPolicyLifecycle(IntegrationTestCase):
	POLICY = "Admission Enquiry-School"

	def test_every_shipped_policy_carries_its_identity_and_digest(self):
		"""Without both, the seed cannot tell an untouched row from a tuned one."""
		for policy in FIELD_POLICIES:
			key = f"{policy['document_type']}::{policy['scope_institution_type']}"
			row = frappe.db.get_value(
				"Field Policy", {"standard_key": key}, ["name", "shipped_digest"], as_dict=True
			)
			self.assertIsNotNone(row, f"no shipped policy for {key}")
			self.assertEqual(
				row.shipped_digest,
				_rules_digest(policy["rules"]),
				f"{row.name} has drifted from the rules the code ships",
			)

	def test_a_shipped_correction_reaches_an_untouched_policy(self):
		"""Simulated by damaging the row the way a bad shipped rule would have left it."""
		doc = frappe.get_doc("Field Policy", self.POLICY)
		shipped_rules = [
			{
				"fieldname": row.fieldname,
				"requirement": row.requirement,
				"label_override": row.label_override,
			}
			for row in doc.rules
		]

		doc.rules = []
		doc.append("rules", {"fieldname": "entrance_exam", "requirement": "Optional"})
		doc.shipped_digest = _rules_digest(doc.rules)
		doc.save(ignore_permissions=True)

		ensure_shared_vocabulary()

		restored = frappe.get_doc("Field Policy", self.POLICY)
		self.assertEqual(
			[
				{
					"fieldname": row.fieldname,
					"requirement": row.requirement,
					"label_override": row.label_override,
				}
				for row in restored.rules
			],
			shipped_rules,
			"the shipped rules did not come back",
		)

	def test_an_operator_tuned_policy_is_left_alone(self):
		"""And stays that way on every future migrate, because its digest is deliberately stale."""
		doc = frappe.get_doc("Field Policy", self.POLICY)
		doc.append("rules", {"fieldname": "email", "requirement": "Required"})
		doc.save(ignore_permissions=True)

		ensure_shared_vocabulary()
		ensure_shared_vocabulary()

		after = frappe.get_doc("Field Policy", self.POLICY)
		self.assertIn(
			"email",
			{row.fieldname for row in after.rules},
			"the operator's rule was clobbered by the seed",
		)

	def test_divergence_is_reportable(self):
		"""An operator's tuning must be *visible*, even though no gate may fail on it.

		This is the diagnosis for every "shipped behaviour" assertion that goes red on a real
		deployment. Without it the symptom is a `Missing Information` traceback naming three fields
		and nothing about the policy row that made them required.
		"""
		# From shipped state, not from whatever this site holds. The first version asserted an
		# empty list up front and failed on a site where a Trust Admin had — correctly — tuned a
		# shipped policy, which is the exact coupling this whole test is about.
		restore_shipped_field_policies()
		self.assertEqual(diverged_field_policies(), [])

		doc = frappe.get_doc("Field Policy", self.POLICY)
		doc.append("rules", {"fieldname": "email", "requirement": "Required"})
		doc.save(ignore_permissions=True)

		self.assertEqual(diverged_field_policies(), [self.POLICY])

	def test_restoring_discards_the_operators_edit_on_purpose(self):
		"""The deliberate counterpart to `_ensure_field_policies`, which protects it.

		Never called from the migrate hook — only by someone who has decided to reset, and by the
		gates that assert shipped behaviour.
		"""
		doc = frappe.get_doc("Field Policy", self.POLICY)
		doc.rules = []
		doc.append("rules", {"fieldname": "email", "requirement": "Required"})
		doc.save(ignore_permissions=True)

		self.assertIn(self.POLICY, restore_shipped_field_policies())
		self.assertEqual(diverged_field_policies(), [])

		restored = {row.fieldname for row in frappe.get_doc("Field Policy", self.POLICY).rules}
		self.assertIn("entrance_exam", restored)
		self.assertNotIn("email", restored)


class IntegrationTestCapabilityBackfill(IntegrationTestCase):
	def test_a_blank_capability_is_filled_from_the_shipped_value(self):
		frappe.db.set_value(
			"Institution Type", "School", "requires_admission_interaction", None, update_modified=False
		)

		ensure_shared_vocabulary()

		self.assertEqual(
			frappe.db.get_value("Institution Type", "School", "requires_admission_interaction"),
			"Yes",
			"a blank capability was not filled from the shipped value",
		)

	def test_an_answered_capability_is_never_overwritten(self):
		"""Including with an explicit "No", which is a decision and not an absence."""
		frappe.db.set_value(
			"Institution Type", "School", "requires_admission_interaction", "No", update_modified=False
		)

		ensure_shared_vocabulary()

		self.assertEqual(
			frappe.db.get_value("Institution Type", "School", "requires_admission_interaction"),
			"No",
			"the seed overwrote an answer the operator had given",
		)

	def test_a_relabelled_type_keeps_its_structure(self):
		"""`_backfill_unstated` must never rewrite where a row sits — only what it does.

		An operator may relabel a type and re-parent it; `docs/CONFIGURATION.md` §2 sanctions both.
		Re-asserting `parent_institution_type` from the shipped table would silently undo a
		re-parent, and a re-parent reshuffles the whole ancestry every capability resolves through.
		"""
		frappe.db.set_value(
			"Institution Type", "Nursing", "parent_institution_type", "All", update_modified=False
		)
		try:
			ensure_shared_vocabulary()
			self.assertEqual(
				frappe.db.get_value("Institution Type", "Nursing", "parent_institution_type"),
				"All",
				"the seed undid an operator's re-parent",
			)
		finally:
			frappe.db.set_value(
				"Institution Type",
				"Nursing",
				"parent_institution_type",
				"Professional",
				update_modified=False,
			)
