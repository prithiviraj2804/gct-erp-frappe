# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

import re
import uuid

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
