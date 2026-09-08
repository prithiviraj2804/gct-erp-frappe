# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Rename the two top levels of the hierarchy to the vocabulary the group actually uses.

The model was always Trust → Institution; only the names were wrong. What the code called an
`Institution` was the tenant root — it carries the branding, the currency, the financial year, the
chart of accounts and the User Permissions the whole scoping model rides on — and what it called a
`College` was the operating unit with a type (Engineering, Medical, School, Arts & Science,
Polytechnic, Law, MBA). A trust runs schools as well as colleges, so "College" was never going to
name that unit honestly.

    Institution -> Trust
    College     -> Institution

Runs in `[pre_model_sync]`, and that is the whole reason this file exists rather than a bare
`git mv`. The doctype JSON on disk has already been renamed, so if model sync ran first it would
import a *brand new* `Trust` and a *brand new* `Institution` from those files and leave the original
`tabInstitution` and `tabCollege` behind as orphans — two empty doctypes and every existing row
stranded. Renaming the DocType records before sync means sync finds the tables already named what
its files expect and simply updates them.

Two framework behaviours make this safe, both keyed on `frappe.flags.in_patch`, which
`patch_handler` sets while a patch runs:

  * `DocType.check_developer_mode` returns early, so this works on a site with `developer_mode` off.
  * `DocType.after_rename` skips `rename_files_and_folders`, so it will not try to move files that
    are already at their new paths — it only issues the `RENAME TABLE`.

Order is not a preference. `Institution` must become `Trust` first to free the name before `College`
can claim it; the reverse order collides on an existing DocType and throws.

The *fields* are renamed separately, in `rename_trust_and_institution_fields`, which has to run
`[post_model_sync]` — see that patch for why.
"""

import frappe


def execute():
	# Both conditions are needed. `Trust` present means this already ran. `Institution` absent
	# means a brand-new site, where pre_model_sync runs before any doctype exists at all and
	# there is nothing to rename — sync will create `Trust` and `Institution` directly from the
	# JSON. Renaming unconditionally would throw DoesNotExistError on every fresh install.
	if frappe.db.exists("DocType", "Institution") and not frappe.db.exists("DocType", "Trust"):
		frappe.rename_doc("DocType", "Institution", "Trust", force=True)

	# After the rename above the name `Institution` is free. A surviving `College` is what says the
	# second half has not happened yet.
	if frappe.db.exists("DocType", "College"):
		frappe.rename_doc("DocType", "College", "Institution", force=True)
