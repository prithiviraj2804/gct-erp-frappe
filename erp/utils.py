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
	"""Auto-populate the standard `id` column with a UUID4, on the document and its child rows.

	Project convention: every doctype carries a separate `id` field (distinct from the primary key
	`name`) holding an auto-generated UUID, as a stable handle for external systems.

	**Child rows have to be filled here, by the parent.** Frappe runs `before_insert` for the
	parent only — `frappe/model/document.py:478` — and then writes children at `:498-500` with
	`d.db_insert()`, a `BaseDocument` method. `doc_events` are composed in `Document.hook`, which
	is reached only from `run_method`, so no hook of any kind fires for a child row. Left to the
	global hook alone, every child `id` stayed NULL; and because MariaDB permits unlimited NULLs
	in a unique index, the `unique: 1` on those columns raised nothing and the convention failed
	in silence.

	Wired to `before_insert` *and* `before_save` in hooks.py. `before_insert` alone would miss the
	row appended to an existing parent, which is most of them; `before_save` alone would miss the
	insert that passes `ignore_validate`, since `run_before_save_methods` returns early on that
	flag while `before_insert` is called unconditionally. Running both is safe because the
	function only ever fills a blank.
	"""
	_set_uuid(doc)

	for row in doc.get_all_children():
		_set_uuid(row)


def _set_uuid(doc):
	"""Give `doc` a UUID `id` if it declares the field and has not already been given one.

	An explicitly provided id is respected, so a data import or a migration can carry the
	identifier the external system already knows this record by.
	"""
	if doc.get("id"):
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


def ensure_module_defs():
	"""Give every module named in `erp/modules.txt` a Module Def, before doctypes sync.

	`before_migrate` hook. Frappe creates Module Defs only in `install_app`, never on migrate, so a
	module added to `modules.txt` after installation has none — and a doctype in it then fails
	`get_controller`, which `remove_orphan_doctypes` reads as "the code is gone" and deletes the
	DocType it just imported. The failure is silent: migrate reports success and the doctype simply
	is not there.

	Running here rather than in a patch means the next module costs nothing: `before_migrate` fires
	ahead of `sync_all` and of orphan removal on every migrate, so adding a line to `modules.txt` is
	all that a new module ever needs.
	"""
	for module in frappe.get_module_list("erp"):
		if frappe.db.exists("Module Def", module):
			continue

		frappe.get_doc({"doctype": "Module Def", "module_name": module, "app_name": "erp"}).insert(
			ignore_permissions=True
		)
