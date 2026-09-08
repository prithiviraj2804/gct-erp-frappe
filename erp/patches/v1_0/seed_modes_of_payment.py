# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Seed the payment modes the front desk collects application fees through.

Global masters (not per-institution): each maps to a deposit account *type* (Cash or Bank), which a
Fee Payment resolves against the paying institution's chart. Idempotent. Runs post_model_sync.
"""

import frappe

MODES = (
	("Cash", "Cash"),
	("UPI", "Bank"),
	("Card", "Bank"),
	("Cheque", "Bank"),
	("Bank Transfer", "Bank"),
)


def execute():
	for mode_name, mode_type in MODES:
		if frappe.db.exists("Mode of Payment", mode_name):
			continue
		frappe.get_doc(
			{"doctype": "Mode of Payment", "mode_name": mode_name, "type": mode_type}
		).insert(ignore_permissions=True)
