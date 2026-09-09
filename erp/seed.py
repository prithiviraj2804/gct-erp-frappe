# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Vocabulary the app owns, replayed on every migrate.

These rows are **code**, not tenant data: the same set every education group needs, shipped so that
`bench install-app erp` produces a working site rather than an inert one. Nobody should have to key
"Undergraduate" in by hand before the first Programme can be saved.

**Why an `after_migrate` hook and not a patch.** A patch runs once and is then logged forever. On
this bench, `seed_school_admission_config` *and* the `reseed_school_vocabulary` written to repair it
are both in the Patch Log, and `Programme Level` and `Academic Structure` are both empty — the rows
were seeded and later removed, and no logged patch will ever put them back. Chasing that with a
third patch would buy one more repair and the same failure the next time. A hook re-asserts the
vocabulary on every migrate, so the rows cannot silently go missing, and adding to the list later
costs one entry rather than one patch.

Exactly the argument `erp.utils.ensure_module_defs` makes for running `before_migrate` rather than
as a patch, applied to data instead of Module Defs.

Idempotent and non-destructive: a row that already exists is left completely alone, including any
edits an operator has made to its label. Only absence is corrected — and "already exists" is asked
of `standard_key` rather than of the name, because for Institution Type the name *is* the label.
See `_ensure`.
"""

import frappe

# The kinds of institution a trust runs, as a tree. Ordered parents-first because each row names its
# parent by name, and NestedSet needs the parent to exist.
#
# `requires_department` is stated only where it is *decided*: a school admits into a class that sits
# under no department, every degree-awarding institution has one. The leaves under Professional say
# nothing and inherit — which is the whole point of the tree, and the reason adding Nursing costs one
# row and no rules.
#
# The names match the values the superseded `Select` already held, so the field becomes a Link with
# no data migration: 'School', 'Arts & Science' and 'Engineering' are already exactly these rows.
INSTITUTION_TYPES = (
	{"type_name": "All", "is_group": 1},
	{"type_name": "School", "parent_institution_type": "All", "requires_department": "No"},
	{"type_name": "Arts & Science", "parent_institution_type": "All", "requires_department": "Yes"},
	{
		"type_name": "Professional",
		"is_group": 1,
		"parent_institution_type": "All",
		"requires_department": "Yes",
	},
	{"type_name": "Engineering", "parent_institution_type": "Professional"},
	{"type_name": "Medical", "parent_institution_type": "Professional"},
	{"type_name": "Polytechnic", "parent_institution_type": "Professional"},
	{"type_name": "Law", "parent_institution_type": "Professional"},
	{"type_name": "MBA", "parent_institution_type": "Professional"},
	{"type_name": "Nursing", "parent_institution_type": "Professional"},
	{"type_name": "Pharmacy", "parent_institution_type": "Professional"},
)

# `level_code` is the business key — Programme Level autonames by it. The two ladders share a
# `level_order` namespace and that is deliberate: a school and a college never sort against each
# other, and forcing one combined ordering would make "Primary" and "Undergraduate" comparable,
# which they are not.
PROGRAMME_LEVELS = (
	{"level_code": "UG", "level_name": "Undergraduate", "level_order": 1},
	{"level_code": "PG", "level_name": "Postgraduate", "level_order": 2},
	{"level_code": "PRI", "level_name": "Primary", "level_order": 1},
	{"level_code": "MID", "level_name": "Middle", "level_order": 2},
	{"level_code": "SEC", "level_name": "Secondary", "level_order": 3},
	{"level_code": "HSC", "level_name": "Higher Secondary", "level_order": 4},
)

# `term_label` is what makes one shared Programme read "Term I" in a school and "Semester 1" in a
# college, with no doctype knowing which it is.
ACADEMIC_STRUCTURES = (
	{
		"structure_code": "SEM",
		"structure_name": "Semester System",
		"terms_per_year": 2,
		"term_label": "Semester",
	},
	{
		"structure_code": "TERM",
		"structure_name": "Term System",
		"terms_per_year": 3,
		"term_label": "Term",
	},
)


# Shipped Field Policies. These state only what is *structurally* true of a kind of institution —
# a school admits without an entrance exam, so those fields are not part of its form. Whether a
# field is *required* is a trust's decision, not ours, and is deliberately left unstated: an
# enquiry is a lead, and a lead often arrives before results do.
FIELD_POLICIES = (
	{
		"document_type": "Admission Enquiry",
		"scope_institution_type": "School",
		"description": (
			"A school admits on its own assessment and the previous school's record, not on an "
			"entrance exam, so the entrance fields are not part of a school enquiry."
		),
		"rules": (
			{"fieldname": "entrance_exam", "requirement": "Hidden"},
			{"fieldname": "entrance_registration_no", "requirement": "Hidden"},
			{"fieldname": "cutoff_marks", "requirement": "Hidden"},
			{"fieldname": "entrance_rank", "requirement": "Hidden"},
			{"fieldname": "previous_education", "label_override": "Previous School Record"},
		),
	},
	{
		"document_type": "Admission Enquiry",
		"scope_institution_type": "Professional",
		"description": (
			"Engineering, medical, law and the rest admit through an entrance exam and a rank, so "
			"those fields are part of the enquiry. Inherited by every type under Professional. "
			"A cut-off cannot be negative; what it may be *at most* differs by exam and is left to "
			"the trust to state per type or per institution."
		),
		"rules": (
			{"fieldname": "cutoff_marks", "min_value": "0"},
			{"fieldname": "entrance_rank", "min_value": "0"},
		),
	},
)


def ensure_shared_vocabulary():
	"""`after_migrate` hook. Re-assert every code-owned vocabulary row."""
	_ensure("Institution Type", "type_name", INSTITUTION_TYPES, standard=True)
	_ensure("Programme Level", "level_code", PROGRAMME_LEVELS)
	_ensure("Academic Structure", "structure_code", ACADEMIC_STRUCTURES)
	_ensure_field_policies()


def _ensure(doctype: str, key: str, rows: tuple[dict, ...], standard: bool = False):
	"""Insert any row that is absent, in the order given, leaving existing rows untouched.

	`standard` marks the row as shipped, which is what stops it being deleted — a deleted standard
	row would reappear on the next migrate having taken its configuration with it.

	**A standard row is recognised by `standard_key`, not by its name.** The docstring above used to
	promise that "a row that already exists is left completely alone, including any edits an
	operator has made to its label", and for Institution Type that was false precisely because the
	label *is* the key: `autoname` is `field:type_name` and `allow_rename` is 1, so relabelling
	School to "CBSE School" is a rename. The row, every Institution pointing at it and the Field
	Policy scoped to it all follow the rename correctly — and then this function looked for
	"School", did not find it, and inserted a second one. The phantom carried no policy, so a K-12
	enquiry created under it collected the full professional superset with nothing hidden, and
	`assert_not_standard` then refused to let anyone delete it. No error at any step.
	"""
	for row in rows:
		if standard:
			if _standard_row(doctype, row[key]):
				continue
		elif frappe.db.exists(doctype, row[key]):
			continue

		values = dict(row)
		if standard:
			values["is_standard"] = 1
			values["standard_key"] = row[key]

			# A row shipped before `standard_key` existed, or one an operator keyed in by hand under
			# exactly the shipped name. Adopt it rather than colliding with it — self-healing is the
			# reason this is a hook and not a patch, and a patch that ran once would leave every site
			# that migrated in between broken.
			if frappe.db.exists(doctype, row[key]):
				frappe.db.set_value(
					doctype,
					row[key],
					{"is_standard": 1, "standard_key": row[key]},
					update_modified=False,
				)
				continue

		frappe.get_doc({"doctype": doctype, **values}).insert(ignore_permissions=True)


def _standard_row(doctype: str, standard_key: str) -> str | None:
	"""The current name of the row that shipped under `standard_key`, however it is labelled now."""
	return frappe.db.get_value(doctype, {"standard_key": standard_key}, "name")


def _ensure_field_policies():
	"""Insert any shipped Field Policy that is absent, leaving an operator's edits alone.

	Keyed on the autoname — `{document_type}-{scope}` — so a policy an operator
	has since tuned is recognised as present and never overwritten. Marked `is_standard`, which
	stops it being deleted: a deleted standard policy would reappear on the next migrate, and in
	the meantime the form it governs would quietly revert to collecting everything.
	"""
	for policy in FIELD_POLICIES:
		# Resolve the scope through `standard_key`, so a relabelled Institution Type keeps the
		# policy it already has instead of being handed a second one. Keying on the autoname —
		# `{document_type}-{scope}` — could not do that: the name embeds the scope as it was at
		# insert time, and `autoname` does not re-run on rename.
		scope = _standard_row("Institution Type", policy["scope_institution_type"])
		if not scope:
			continue
		if frappe.db.exists(
			"Field Policy",
			{"document_type": policy["document_type"], "scope_institution_type": scope},
		):
			continue

		doc = frappe.get_doc(
			{
				"doctype": "Field Policy",
				"document_type": policy["document_type"],
				"scope_institution_type": scope,
				"description": policy["description"],
				"enabled": 1,
				"is_standard": 1,
				"rules": [dict(rule) for rule in policy["rules"]],
			}
		)
		doc.insert(ignore_permissions=True)
