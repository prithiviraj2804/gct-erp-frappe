# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

import uuid


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
