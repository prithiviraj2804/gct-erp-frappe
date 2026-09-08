# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class Trust(Document):
	def validate(self):
		self.assert_only_one()

	def assert_only_one(self):
		"""One Trust per site — the tenant is the site, not a row in a table.

		Enforced here rather than by making the doctype a Frappe Single, which would look like the
		obvious tool and would in fact break the app. A Single has no `tab<DocType>` table at all —
		its values live as key/value rows in `tabSingles` — so converting would drop `tabTrust`
		and take with it: every one of the eighteen `Link` fields that point at it, the
		`format:{trust}-…` naming on Account, Academic Year, Campus and Consultancy, the
		`{trust}-STU-.#####` register series on Student, `validate_same_parent`, the
		Trust User Permissions the whole scoping model rides on, and the `after_insert` hook
		that provisions a tenant's chart of accounts. Every existing row's `trust` would be
		left pointing at something that no longer exists.

		A cardinality rule gets a cardinality check. Everything above keeps working, and lifting the
		cap later is deleting this method rather than a migration.

		Skipped in test mode: several suites raise two trusts on purpose, because proving that
		a record from one tenant cannot reach another is exactly what `validate_same_parent` and the
		permission scoping are for. The rule has its own test, which turns test mode off to run.
		"""
		if not self.is_new() or frappe.in_test:
			return

		existing = frappe.get_all("Trust", limit=1, pluck="name")
		if existing:
			frappe.throw(
				_(
					"{0} already exists, and this site holds one Trust. Edit it rather than adding another."
				).format(frappe.bold(existing[0])),
				title=_("Trust Already Set Up"),
			)
