# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Give every trust the minimal chart of accounts fee collection needs.

The chart is per-tenant — each trust keeps its own books. Rather than have the fee endpoint
create accounts on demand (which mixes provisioning with collection and races), the chart is built
once when a trust is created (the `after_insert` hook) and back-filled for existing
trusts by a migrate patch. A Fee Payment then only ever *resolves* accounts, and fails loudly
if the chart is missing.

`resolve_account` lives here rather than on a voucher because more than one voucher needs it: a Fee
Payment debits cash and credits fee income, a Fee Refund does the mirror. Both find the account by
*meaning* (`account_type`), never by name, so a renamed account never breaks posting.
"""

import frappe
from frappe import _

# Group nodes: (label, root_type). A legible ERPNext-shaped skeleton; only Assets and Income are
# strictly needed by Phase 1, the rest make the chart make sense at a glance.
ROOT_ACCOUNTS = (
	("Assets", "Asset"),
	("Liabilities", "Liability"),
	("Equity", "Equity"),
	("Income", "Income"),
	("Expenses", "Expense"),
)

# Postable leaves: (label, parent_label, root_type, account_type). account_type is how the posting
# code finds an account by meaning — the income to credit, the cash/bank to debit.
LEAF_ACCOUNTS = (
	("Application Fees", "Income", "Income", "Income Account"),
	("Cash", "Assets", "Asset", "Cash"),
	("Bank", "Assets", "Asset", "Bank"),
)


def _account_name(trust, label):
	# Mirrors Account's autoname "format:{trust}-{account_name}".
	return f"{trust}-{label}"


def ensure_chart_of_accounts(trust):
	"""Idempotently create the per-trust skeleton chart. Safe to re-run."""
	for label, root_type in ROOT_ACCOUNTS:
		if not frappe.db.exists("Account", _account_name(trust, label)):
			frappe.get_doc(
				{
					"doctype": "Account",
					"account_name": label,
					"trust": trust,
					"is_group": 1,
					"root_type": root_type,
				}
			).insert(ignore_permissions=True)

	for label, parent_label, root_type, account_type in LEAF_ACCOUNTS:
		if not frappe.db.exists("Account", _account_name(trust, label)):
			frappe.get_doc(
				{
					"doctype": "Account",
					"account_name": label,
					"trust": trust,
					"is_group": 0,
					"parent_account": _account_name(trust, parent_label),
					"root_type": root_type,
					"account_type": account_type,
				}
			).insert(ignore_permissions=True)


def setup_trust_accounts(doc, method=None):
	"""Trust `after_insert` doc-event: a new tenant gets its chart automatically."""
	ensure_chart_of_accounts(doc.name)


def resolve_account(trust: str, account_type: str) -> str:
	"""The trust's one postable account of this type — the seam every voucher posts through.

	Throws unless exactly one matches: none means the chart was never provisioned, and more than one
	means posting would have to guess. Both are setup errors worth failing loudly on rather than
	silently picking a side of the books.
	"""
	names = frappe.get_all(
		"Account",
		filters={"trust": trust, "account_type": account_type, "disabled": 0},
		pluck="name",
	)
	if len(names) != 1:
		frappe.throw(
			_("Expected exactly one {0} account for {1}, found {2}. Is the chart of accounts set up?").format(
				frappe.bold(account_type or "?"), frappe.bold(trust), len(names)
			),
			title=_("Chart of Accounts"),
		)
	return names[0]
