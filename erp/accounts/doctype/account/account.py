# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

from erp.master.hierarchy import validate_same_parent


class Account(Document):
	def validate(self):
		self.validate_parent_in_same_trust()

	def validate_parent_in_same_trust(self):
		"""A parent group must belong to the same trust's chart.

		The chart is per-tenant: each trust owns its own Assets/Income/... tree. A Link only
		proves the parent exists, so this reconciles the branch — an account cannot hang under
		another trust's group.
		"""
		validate_same_parent(self, "parent_account", "trust")

	def on_trash(self):
		"""Never delete an account that has ledger history.

		A posted GL Entry references this account by name; deleting the account would orphan the
		ledger and destroy the audit trail. Disable it instead.
		"""
		if frappe.db.exists("GL Entry", {"account": self.name}):
			frappe.throw(
				_("Account {0} has ledger entries and cannot be deleted. Disable it instead.").format(
					frappe.bold(self.name)
				),
				title=_("Account In Use"),
			)
