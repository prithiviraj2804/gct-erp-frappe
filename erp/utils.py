# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

import re
import uuid

import frappe
from frappe import _
from frappe.utils import cstr


def slugify(text: str) -> str:
	"""URL-safe slug for SPA routes: "Admission Entry" -> "admission-entry".

	Deliberately not `frappe.scrub`, which produces underscores ("admission_entry") — those
	are Python identifiers, not URL segments, and would leak the framework's naming into
	our routes.
	"""
	return re.sub(r"[^a-z0-9]+", "-", cstr(text).lower()).strip("-")


def set_uuid_id(doc, method=None):
	"""Auto-populate the standard `id` column with a UUID4.

	Project convention: every doctype carries a separate `id` field (distinct
	from the primary key `name`) that holds an auto-generated UUID. Wired as a
	global ``before_insert`` doc event in ``hooks.py``, so it runs for every
	doctype but only acts on those that actually define the `id` field.
	"""
	if doc.get("id"):
		# Respect an explicitly provided id (e.g. data import / migration).
		return

	if doc.meta.has_field("id"):
		doc.id = str(uuid.uuid4())


def normalize_phone(value: str) -> str:
	"""Return a bare 10-digit phone, dropping punctuation and a leading 91 country code.

	Stores the stripped form so "+91 98765 43210", "9876543210" and "98765-43210" are one
	number when a repeat enquiry is searched for. Throws on anything that is not ten digits.
	"""
	digits = re.sub(r"\D", "", cstr(value))
	if len(digits) == 12 and digits.startswith("91"):
		digits = digits[2:]

	if len(digits) != 10:
		frappe.throw(
			_("Phone Number {0} must be 10 digits, with or without the 91 country code.").format(
				frappe.bold(value)
			)
		)

	return digits


def normalize_aadhaar(value: str) -> str:
	"""Return a bare 12-digit Aadhaar, dropping the spaces people type between blocks.

	Stores the stripped form so "1234 5678 9012" and "123456789012" are one identity when a
	duplicate is looked for. Throws on anything that is not twelve digits.
	"""
	digits = re.sub(r"\D", "", cstr(value))
	if len(digits) != 12:
		frappe.throw(
			_("Aadhaar Number must be 12 digits. {0} has {1}.").format(frappe.bold(value), len(digits))
		)

	return digits
