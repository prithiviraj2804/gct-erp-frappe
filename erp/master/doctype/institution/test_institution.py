# Copyright (c) 2026, Prithivi and Contributors
# See license.txt

"""One Institution per site, and why it is a check rather than a Single doctype.

The rule is skipped in test mode, because the cross-tenant suites raise two institutions on purpose
to prove the scoping works. So this suite turns test mode off around the assertions — the same way
Frappe's own tests exercise behaviour that is otherwise suppressed for them.
"""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.tests.utils import toggle_test_mode


class IntegrationTestInstitution(IntegrationTestCase):
	@staticmethod
	def make(code):
		return frappe.get_doc(
			{"doctype": "Institution", "institution_code": code, "institution_name": f"{code} Institute"}
		)

	def test_a_second_institution_is_refused(self):
		first = self.make("ZI1")
		toggle_test_mode(False)
		try:
			if not frappe.get_all("Institution", limit=1):
				first.insert()

			with self.assertRaises(frappe.ValidationError) as caught:
				self.make("ZI2").insert()
			self.assertIn("one Institution", str(caught.exception))
		finally:
			toggle_test_mode(True)

	def test_the_existing_institution_can_still_be_edited(self):
		"""The cap is on creation, not on maintenance — an existing tenant stays editable."""
		toggle_test_mode(False)
		try:
			existing = frappe.get_all("Institution", limit=1, pluck="name")
			self.assertTrue(existing, "the site is expected to hold one institution")

			doc = frappe.get_doc("Institution", existing[0])
			doc.remarks = "edited under the one-institution rule"
			doc.save()
		finally:
			toggle_test_mode(True)

	def test_the_rule_is_lifted_for_the_isolation_suites(self):
		"""Two tenants must remain constructible in tests, or nothing could prove they stay apart."""
		self.make("ZI3").insert()
		self.make("ZI4").insert()
		self.assertTrue(frappe.db.exists("Institution", "ZI3"))
		self.assertTrue(frappe.db.exists("Institution", "ZI4"))

	def test_institution_is_not_a_single_doctype(self):
		"""Guards the decision itself: eighteen Link fields and five naming series need the table.

		If someone later flips `issingle`, `tabInstitution` disappears and every one of those breaks
		silently. This fails first, and points at why.
		"""
		meta = frappe.get_meta("Institution")
		self.assertFalse(meta.issingle, "Institution must stay a table-backed doctype")

		linked = frappe.get_all(
			"DocField", filters={"fieldtype": "Link", "options": "Institution"}, fields=["parent"]
		)
		self.assertGreater(len(linked), 10, "Link fields depend on tabInstitution existing")
