# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Give every existing institution its minimal chart of accounts.

New institutions get one from the `after_insert` hook; this backfills tenants that predate the
Accounts module so fee collection has somewhere to post from day one. Runs post_model_sync (the
Account doctype must exist first). Idempotent — `ensure_chart_of_accounts` guards each account.
"""

import frappe

from erp.accounts.provisioning import ensure_chart_of_accounts


def execute():
	# The Account doctype is created in the same migrate as this patch; clear the cache so its
	# controller resolves to erp.accounts, not a stale "Core" fallback left from earlier in the run.
	frappe.clear_cache(doctype="Account")
	for institution in frappe.get_all("Institution", pluck="name"):
		ensure_chart_of_accounts(institution)
