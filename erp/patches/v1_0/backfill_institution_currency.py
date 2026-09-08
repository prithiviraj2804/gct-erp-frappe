# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Stamp existing institutions with a default currency (INR).

The field is new; without a value the receipt has no currency symbol to print. INR is the single
assumed currency (single-country education group). Idempotent — only fills blanks. Runs
post_model_sync (the column must exist first).
"""

import frappe


def execute():
	blanks = frappe.get_all(
		"Institution", filters={"default_currency": ["in", [None, ""]]}, pluck="name"
	)
	for name in blanks:
		frappe.db.set_value("Institution", name, "default_currency", "INR", update_modified=False)
