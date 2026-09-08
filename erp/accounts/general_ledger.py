# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""The one place GL Entries are created — and the one place double-entry balance is enforced.

Every voucher that touches the ledger posts through `make_gl_entries`; nothing inserts a GL Entry
directly. Because the check and the inserts run inside the caller's transaction (a Fee Payment's
`on_submit`), an unbalanced set raises before anything persists, and the whole submit rolls back —
a half-posted voucher can never exist.
"""

import frappe
from frappe import _
from frappe.utils import flt

# A hair over half a paisa — absorbs float rounding without letting a real imbalance through.
BALANCE_TOLERANCE = 0.005


def make_gl_entries(gl_maps, *, trust, voucher_type, voucher_no, remark=None):
	"""Post a balanced set of GL Entries for one voucher.

	`gl_maps` is a list of dicts, each `{account, posting_date, debit?, credit?, remarks?}`. Throws
	if total debits and total credits differ. Inserts with `ignore_permissions` — GL Entry grants
	no role create rights; posting is a system act, not a user one.
	"""
	if not gl_maps:
		return

	total_debit = sum(flt(entry.get("debit"), 2) for entry in gl_maps)
	total_credit = sum(flt(entry.get("credit"), 2) for entry in gl_maps)
	if abs(total_debit - total_credit) > BALANCE_TOLERANCE:
		frappe.throw(
			_("Debits ({0}) and credits ({1}) are not balanced.").format(total_debit, total_credit),
			title=_("Unbalanced Entry"),
		)

	for entry in gl_maps:
		frappe.get_doc(
			{
				"doctype": "GL Entry",
				"posting_date": entry["posting_date"],
				"account": entry["account"],
				"debit": flt(entry.get("debit"), 2),
				"credit": flt(entry.get("credit"), 2),
				"trust": trust,
				"voucher_type": voucher_type,
				"voucher_no": voucher_no,
				"remarks": entry.get("remarks") or remark,
			}
		).insert(ignore_permissions=True)


def post_reversal(voucher_type, voucher_no, *, trust, remark=None):
	"""Undo a voucher's ledger effect by posting mirror-image rows (append-only, never delete).

	Swaps debit and credit on every existing entry of the voucher, so the account nets to zero while
	the original rows stay on the record. Used by a Fee Payment's `on_cancel`.
	"""
	entries = frappe.get_all(
		"GL Entry",
		filters={"voucher_type": voucher_type, "voucher_no": voucher_no},
		fields=["account", "debit", "credit", "posting_date"],
	)
	reversal = [
		{
			"account": entry.account,
			"debit": entry.credit,
			"credit": entry.debit,
			"posting_date": entry.posting_date,
		}
		for entry in entries
	]
	make_gl_entries(
		reversal,
		trust=trust,
		voucher_type=voucher_type,
		voucher_no=voucher_no,
		remark=remark or _("Reversal of {0}").format(voucher_no),
	)
