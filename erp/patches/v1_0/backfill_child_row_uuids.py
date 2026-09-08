# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Give every existing child row the UUID `id` the convention always claimed it had.

`set_uuid_id` was wired as a global `before_insert` doc event, and Frappe runs `before_insert` for
the parent only (`frappe/model/document.py:478`); children are written at `:498-500` by
`d.db_insert()`, a `BaseDocument` method that reaches none of the `doc_events` machinery. So no
child row ever received an id. The `unique: 1` on those columns said nothing about it either,
because MariaDB permits unlimited NULLs in a unique index — the convention failed silently from the
day it was written.

`erp.utils.set_uuid_id` now fills children from the parent. This fills the rows that predate that.

Written row by row rather than as one `UPDATE ... SET id = UUID()` because MariaDB's `UUID()` is
non-deterministic per row in a way that is safe here but not portable, and because the column is
unique: a batched statement that collides fails the whole migration, while this reports the row.

Idempotent: only ever fills a blank.
"""

import uuid

import frappe


def execute():
	for doctype in frappe.get_all(
		"DocType", filters={"module": ("in", frappe.get_module_list("erp"))}, pluck="name"
	):
		if not frappe.db.table_exists(doctype) or not frappe.db.has_column(doctype, "id"):
			continue

		blanks = frappe.db.sql(f"SELECT name FROM `tab{doctype}` WHERE ifnull(`id`, '') = ''", pluck=True)
		for name in blanks:
			frappe.db.set_value(doctype, name, "id", str(uuid.uuid4()), update_modified=False)
