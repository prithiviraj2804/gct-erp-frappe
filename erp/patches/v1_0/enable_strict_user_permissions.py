# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Turn off the empty-value disjunct that lets a blank tenancy column read as "visible to everyone".

Without `apply_strict_user_permissions`, Frappe ANDs this into every scoped query
(`frappe/database/query.py:1501-1506`):

    IfNull(`tabX`.`institution`, '') = ''  OR  `tabX`.`institution` IN (...)

The left half is the hole. With the setting on, only the `IN` survives; the same switch also closes
the single-document path at `frappe/permissions.py:430`. It is one site-wide flag with no
per-doctype dial, which is why it lands last, after `reqd: 1` on the columns and after
`backfill_tenancy_columns` has filled the rows that predate that rule.

**Why this refuses rather than warns.** Turning the flag on while blank rows remain does not expose
them — it hides them, permanently, from the very institution that owns them, and the owner has no
way to tell the difference between "deleted" and "invisible". Turning it *off* and leaving it off
keeps a cross-tenant read open. Neither is a thing to do quietly during a deploy, so a site that
still has blank tenancy values stops here with the counts in the message. Every blank reaching this
point is a row whose *source of truth* is also blank — the backfill is an inner join and never
invents a tenant — so it is a genuinely broken record that wants a person, not a default.

Idempotent: returns immediately once the flag is set.
"""

import frappe

# Doctypes whose rows belong to exactly one institution. `Account`, `GL Entry`, `Academic Year`,
# `Campus` and `Consultancy` are trust-level and carry no `institution` column, by design.
INSTITUTION_SCOPED = (
	"Admission Application",
	"Admission Enquiry",
	"Admission Follow-up",
	"Admission Gate Pass",
	"Department",
	"Fee Payment",
	"Fee Refund",
	"Programme",
	"Programme Intake",
	"Staff",
	"Student",
)


def execute():
	if frappe.db.get_single_value("System Settings", "apply_strict_user_permissions"):
		return

	holes = blank_tenancy_counts()
	if holes:
		frappe.throw(
			"Cannot enable strict user permissions while these rows have no institution:\n"
			+ "\n".join(f"  {doctype}: {count}" for doctype, count in holes.items())
			+ "\n\nEach is readable by every user in every institution, and each has a source "
			"record whose own institution is blank, so nothing can derive it safely. Set the "
			"institution on these rows (or delete them if they are junk) and run "
			"`bench migrate` again."
		)

	frappe.db.set_single_value("System Settings", "apply_strict_user_permissions", 1)
	frappe.clear_cache()


def blank_tenancy_counts() -> dict[str, int]:
	"""Institution-scoped doctypes that still hold rows with no institution, and how many."""
	counts = {}
	for doctype in INSTITUTION_SCOPED:
		if not (frappe.db.table_exists(doctype) and frappe.db.has_column(doctype, "institution")):
			continue

		count = frappe.db.sql(f"SELECT COUNT(*) FROM `tab{doctype}` WHERE ifnull(`institution`, '') = ''")[0][
			0
		]
		if count:
			counts[doctype] = count
	return counts
