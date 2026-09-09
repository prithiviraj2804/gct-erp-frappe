# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Move `Config Value` off an autoincrementing counter and onto its business key.

The doctype shipped with `naming_rule: Autoincrement`, alone among this app's non-child doctypes —
every other one names itself after something a person can read. The cost was not theoretical: the
SPA's list screen synthesises a column for `name` and labels it **"ID"**
(`frontend/src/pages/doctype/pages/DoctypeListScreen.tsx`), so the Config Value list showed `168`
under a heading that, in this app, means the UUID column. It read as a UUID that had failed to
generate, and the actual `id` UUID beside it was correct all along.

`ConfigValue.autoname` now builds `{setting}-{scope}`, which is exactly the pair
`validate_unique_at_scope` already forbids duplicating — the same shape as `Field Policy`.

**Frappe cannot make this column change on its own.** `MariaDBTable.alter_primary_key`
(`frappe/database/mariadb/schema.py`) handles UUID↔varchar and nothing else, so leaving the ALTER
to `bench migrate` would leave `name bigint(20)` behind a doctype that now produces strings, and
the first save after deploy would die on a type error rather than here.

Runs `post_model_sync` deliberately: `frappe.rename_doc` reads `allow_rename` from the synced meta,
which is only 1 once the new JSON has landed. It is also what carries Versions, comments and shares
across to the new name — a raw `UPDATE ... SET name` would strip a `track_changes: 1` doctype of
its history.

Idempotent: the column type is the flag, and a second run finds varchar and returns.
"""

import frappe

from erp.config.resolver import SCOPE_FIELDS

DOCTYPE = "Config Value"

# Named by `frappe.db.create_sequence`, which slugs the doctype and appends `_id_seq`
# (`frappe/database/sequence.py`). Nothing reads it once the naming rule changes, and leaving it
# behind would hand the next autoincrement doctype of this name a stale counter.
SEQUENCE = "config_value_id_seq"


def execute():
	if not frappe.db.table_exists(DOCTYPE):
		return

	# `startswith`, not equality: MariaDB reports the display width too, so this is the string
	# `bigint(20)`. Frappe's own `alter_primary_key` compares exactly, which is safe only because
	# the type it looks for (`uuid`) carries no width.
	if not frappe.db.get_column_type(DOCTYPE, "name").startswith("bigint"):
		return

	frappe.db.sql_ddl(f"ALTER TABLE `tab{DOCTYPE}` MODIFY `name` varchar({frappe.db.VARCHAR_LEN}) NOT NULL")
	frappe.db.sql_ddl(f"DROP SEQUENCE IF EXISTS `{SEQUENCE}`")

	for row in frappe.get_all(DOCTYPE, fields=["name", "setting", *SCOPE_FIELDS.values()]):
		scope = next((row[fieldname] for fieldname in SCOPE_FIELDS.values() if row[fieldname]), None)
		if not scope:
			# `validate_one_scope` has always forbidden this, so it means a row written around the
			# controller. Renaming it to `…-None` would bury that; leaving the counter as its name
			# keeps it findable and keeps the migration from being the thing that lost it.
			continue

		new_name = f"{row.setting}-{scope}"
		if str(row.name) == new_name:
			continue

		frappe.rename_doc(DOCTYPE, row.name, new_name, force=True, show_alert=False)
