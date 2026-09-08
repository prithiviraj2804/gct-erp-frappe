# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt

from erp.master.hierarchy import validate_same_parent


class GLEntry(Document):
	"""A single immutable ledger row. Never user-created — posted only by a voucher's controller
	through erp.accounts.general_ledger.make_gl_entries (which enforces per-voucher balance).

	Corrections are made by posting a new reversing entry, never by editing or deleting an existing
	one — that is what keeps the ledger an audit trail.
	"""

	def validate(self):
		if not self.is_new():
			frappe.throw(_("GL Entries are immutable and cannot be edited. Post a reversing entry instead."))
		self.validate_debit_or_credit()
		validate_same_parent(self, "account", "institution")

	def validate_debit_or_credit(self):
		"""Exactly one side, non-negative: a ledger row is a debit or a credit, never both or neither."""
		debit = flt(self.debit, 2)
		credit = flt(self.credit, 2)
		if debit < 0 or credit < 0:
			frappe.throw(_("Debit and credit must not be negative."))
		if bool(debit) == bool(credit):
			frappe.throw(_("A GL Entry must carry exactly one of debit or credit."))

	def on_trash(self):
		frappe.throw(_("GL Entries cannot be deleted. Post a reversing entry instead."))
