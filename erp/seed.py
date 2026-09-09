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

import hashlib
import json

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
	{
		"type_name": "School",
		"parent_institution_type": "All",
		"requires_department": "No",
		# A school meets the family before offering a place. Stated here rather than left to
		# inherit, because the app-wide default is No: an institution admitting on an external
		# counselling allotment has no such step.
		"requires_admission_interaction": "Yes",
		# The one line that fixes the defect the roadmap carried for three slices: a school
		# application no longer opens on a route that waits for a counselling body.
		"default_admission_route": "Direct",
	},
	{
		"type_name": "Arts & Science",
		"parent_institution_type": "All",
		"requires_department": "Yes",
		# A community or government quota seat is allotted by a state body; the college's own seats
		# are Direct. Stated as Direct because that is the larger share and the safer default —
		# a route that wrongly waits on an allotment blocks an admission, one that wrongly does not
		# only means the office picks the right route on the form.
		"default_admission_route": "Direct",
	},
	{
		"type_name": "Professional",
		"is_group": 1,
		"parent_institution_type": "All",
		"requires_department": "Yes",
		# Inherited by all nine leaves. An institution running only management-quota intakes
		# overrides it on its own type or leaves the office to pick.
		"default_admission_route": "Government Quota",
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

# How a seat was decided. Named exactly as the superseded `Admission Application.admission_route`
# Select's options were, so the field becomes a Link with no data migration — the same move slice 3
# made for `Institution.institution_type`.
#
# `requires_allotment` is the only behaviour here, and it is the whole reason this is a master: the
# allotment gate asks the route whether it waits on somebody else's decision, instead of comparing
# against the literal "Government Quota". A trust adds `NRI` in Desk and the gate starts firing.
ADMISSION_ROUTES = (
	{
		"route_name": "Government Quota",
		"requires_allotment": 1,
		"description": (
			"Seats filled by a state counselling body — TNEA, MCC, a university's own allotment. "
			"The institution records the outcome; it does not decide it."
		),
	},
	{
		"route_name": "Management Quota",
		"requires_allotment": 0,
		"description": "The institution's own sanctioned quota, settled by the institution.",
	},
	{
		"route_name": "Direct",
		"requires_allotment": 0,
		"description": (
			"Admitted on the institution's own decision with no quota mechanism at all — a school "
			"class, an arts & science seat outside the community quota."
		),
	},
)

# The boards this trust's institutions actually receive students from, not a pretend national
# register. A trust adds its own; these three exist so that `GROUP BY education_board` has
# something to group by on a fresh site.
EDUCATION_BOARDS = (
	{"board_name": "CBSE", "description": "Central Board of Secondary Education"},
	{"board_name": "ICSE", "description": "Council for the Indian School Certificate Examinations"},
	{"board_name": "State Board", "description": "The state's own secondary board"},
)

# Subjects an eligibility rule can name. A small set, because a rule cannot be written before its
# subjects exist and no operator should key in "Mathematics" before their first intake. A trust adds
# the rest — a board's own subject list is long, regional and changes, and shipping a pretend one
# would be the `Education Board` free-text problem with extra steps.
EXAMINATION_SUBJECTS = (
	{"subject_name": "Mathematics"},
	{"subject_name": "Physics"},
	{"subject_name": "Chemistry"},
	{"subject_name": "Biology"},
	{"subject_name": "Botany"},
	{"subject_name": "Zoology"},
	{"subject_name": "Computer Science"},
	{"subject_name": "English"},
	{"subject_name": "Commerce"},
	{"subject_name": "Accountancy"},
	{"subject_name": "Economics"},
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
	# --- Admission Application ---------------------------------------------------------
	#
	# The document the app exists to configure, and until now the one nothing configured. It carries
	# `counselling_outcome`, `allotment_reference`, `allotment_date` and the four entrance fields —
	# every one of them meaningless in a school, all of them on a school's form.
	#
	# Note what is *not* here. `admission_route` is `reqd: 1`, so `validate_not_statically_required`
	# refuses to govern it and a policy cannot supply its default; that default belongs on the
	# Institution Type tree and arrives with the `Admission Route` master. `application_state` is in
	# `REPORTING_SPINE` and may not be touched at all. Both refusals are correct, and both are why
	# `docs/CONFIGURATION.md` §6 is marked target-state rather than implemented.
	{
		"document_type": "Admission Application",
		"scope_institution_type": "School",
		"description": (
			"A school admits on its own assessment and the previous school's record. There is no "
			"entrance exam and no external counselling body, so the entrance and allotment fields "
			"are not part of a school application — and a form that asks for them invites an "
			"operator to fill one in, which is how a school application came to sit in Awaiting "
			"Counselling for a body that does not exist. The interaction fields are deliberately "
			"NOT Required here: Field Policy's Required binds at insert, and the interview happens "
			"after the application is raised. That is the interaction *gate*'s job — see below."
		),
		"rules": (
			{"fieldname": "entrance_exam", "requirement": "Hidden"},
			{"fieldname": "entrance_registration_no", "requirement": "Hidden"},
			{"fieldname": "entrance_score", "requirement": "Hidden"},
			{"fieldname": "entrance_rank", "requirement": "Hidden"},
			{"fieldname": "cutoff_marks", "requirement": "Hidden"},
			{"fieldname": "counselling_outcome", "requirement": "Hidden"},
			{"fieldname": "allotment_reference", "requirement": "Hidden"},
			{"fieldname": "allotment_date", "requirement": "Hidden"},
		),
	},
	{
		"document_type": "Admission Application",
		"scope_institution_type": "Professional",
		"description": (
			"Engineering, medical, law and the rest admit on an entrance rank, so those fields are "
			"part of the application and a cut-off or rank cannot be negative. Inherited by every "
			"type under Professional. The interaction fields are hidden: a seat allotted by an "
			"external counselling body is not decided by an interview."
		),
		"rules": (
			{"fieldname": "cutoff_marks", "min_value": "0"},
			{"fieldname": "entrance_rank", "min_value": "0"},
			{"fieldname": "entrance_score", "min_value": "0"},
			{"fieldname": "interaction_on", "requirement": "Hidden"},
			{"fieldname": "interaction_mode", "requirement": "Hidden"},
			{"fieldname": "interacted_by", "requirement": "Hidden"},
			{"fieldname": "interaction_outcome", "requirement": "Hidden"},
			{"fieldname": "interaction_remarks", "requirement": "Hidden"},
		),
	},
	# Arts & Science hangs off `All`, so it inherited *neither* policy above and its form was the
	# raw professional superset — entrance exam, rank and cut-off all visible and unbounded, with
	# nothing to notice it because no test instantiated an institution of this type. It admits on
	# qualifying-exam marks and, for a government or community quota seat, on a state allotment, so
	# the entrance fields go and the allotment fields stay.
	{
		"document_type": "Admission Application",
		"scope_institution_type": "Arts & Science",
		"description": (
			"An arts & science college admits on the marks of the qualifying examination, not on an "
			"entrance exam — but a government or community quota seat is allotted by a state body, "
			"so the allotment fields remain part of the application."
		),
		"rules": (
			{"fieldname": "entrance_exam", "requirement": "Hidden"},
			{"fieldname": "entrance_registration_no", "requirement": "Hidden"},
			{"fieldname": "entrance_score", "requirement": "Hidden"},
			{"fieldname": "entrance_rank", "requirement": "Hidden"},
			{"fieldname": "cutoff_marks", "requirement": "Hidden"},
			{"fieldname": "interaction_on", "requirement": "Hidden"},
			{"fieldname": "interaction_mode", "requirement": "Hidden"},
			{"fieldname": "interacted_by", "requirement": "Hidden"},
			{"fieldname": "interaction_outcome", "requirement": "Hidden"},
			{"fieldname": "interaction_remarks", "requirement": "Hidden"},
		),
	},
	{
		"document_type": "Admission Enquiry",
		"scope_institution_type": "Arts & Science",
		"description": (
			"The enquiry counterpart: no entrance exam here either, so the type that inherited "
			"neither shipped policy no longer collects fields it has no use for."
		),
		"rules": (
			{"fieldname": "entrance_exam", "requirement": "Hidden"},
			{"fieldname": "entrance_registration_no", "requirement": "Hidden"},
			{"fieldname": "cutoff_marks", "requirement": "Hidden"},
			{"fieldname": "entrance_rank", "requirement": "Hidden"},
		),
	},
)


def ensure_shared_vocabulary():
	"""`after_migrate` hook. Re-assert every code-owned vocabulary row."""
	_ensure_config_settings()
	# Routes first: `Institution Type.default_admission_route` is a Link to one, and `_validate_links`
	# would refuse the type row if its target did not exist yet.
	_ensure("Admission Route", "route_name", ADMISSION_ROUTES, standard=True)
	_ensure("Education Board", "board_name", EDUCATION_BOARDS, standard=True)
	_ensure("Examination Subject", "subject_name", EXAMINATION_SUBJECTS, standard=True)
	_ensure("Institution Type", "type_name", INSTITUTION_TYPES, standard=True)
	_ensure("Programme Level", "level_code", PROGRAMME_LEVELS)
	_ensure("Academic Structure", "structure_code", ACADEMIC_STRUCTURES)
	_ensure_field_policies()


def _ensure_config_settings():
	"""Register every configuration key, and keep its declaration in step with the code.

	Unlike a vocabulary row, a `Config Setting` is **entirely** code-owned: `setting_key` is
	read-only, `on_trash` refuses, and `get_config` throws on an unregistered key. So there is no
	operator edit to protect here and no digest to compare — the declaration in
	`erp/config/settings.py` simply wins, every migrate.

	That is also why it runs first. `Config Value` has a `reqd` Link to a setting, and the
	capability keys have to exist before anything resolves through them.
	"""
	from erp.config.settings import CONFIG_SETTINGS

	for setting in CONFIG_SETTINGS:
		key = setting["setting_key"]
		declared = {
			"label": setting["label"],
			"value_type": setting["value_type"],
			"options": setting.get("options"),
			"default_value": setting.get("default_value"),
			"is_required": setting.get("is_required", 0),
			"institution_type_field": setting.get("institution_type_field"),
			"description": setting.get("description"),
		}

		if not frappe.db.exists("Config Setting", key):
			frappe.get_doc({"doctype": "Config Setting", "setting_key": key, **declared}).insert(
				ignore_permissions=True
			)
			continue

		current = frappe.db.get_value("Config Setting", key, list(declared), as_dict=True)
		if any((current.get(field) or None) != (value or None) for field, value in declared.items()):
			frappe.db.set_value("Config Setting", key, declared, update_modified=False)


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
			present = _standard_row(doctype, row[key])
			if present:
				_backfill_unstated(doctype, present, row)
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
				_backfill_unstated(doctype, row[key], row)
				continue

		frappe.get_doc({"doctype": doctype, **values}).insert(ignore_permissions=True)


# Keys that say *where* a standard row sits rather than what it does. An operator may relabel a
# type and re-parent it — `docs/CONFIGURATION.md` §2 sanctions both — so these are never rewritten,
# and neither is the key itself.
_STRUCTURAL_KEYS = frozenset(
	{
		"type_name",
		"parent_institution_type",
		"is_group",
		"level_code",
		"level_name",
		"level_order",
		"structure_code",
		"structure_name",
		"route_name",
		"board_name",
		"subject_name",
	}
)


def _backfill_unstated(doctype: str, name: str, row: dict) -> None:
	"""Supply a shipped capability the row currently leaves **blank**, and nothing else.

	The problem this solves is the one `_ensure_field_policies` solves with a digest, in the form it
	takes for a vocabulary row: adding a capability to a shipped type in code reached a fresh site
	and no existing one, silently. `requires_admission_interaction` was added to `School` and every
	already-migrated site kept a school with no interaction gate — found by a test asserting the
	gate applied, which it did not.

	A digest is the wrong instrument here, because these rows are *meant* to be edited: an operator
	may relabel a type, re-parent it, and set its capabilities. So the rule is narrower and needs no
	fingerprint. **Blank means unstated** — the tri-state rule in `docs/DATA-MODEL.md` — so writing
	a shipped value into a blank column overrides no decision anybody made; it supplies the default
	the row would have had if it were being inserted today. A column the operator has actually
	answered, including with an explicit "No", is never touched.

	The consequence worth naming: an operator who wants a shipped capability *unset* cannot express
	that by clearing it, because clearing it means "inherit" and the next migrate will fill it in
	again. They set the value they want instead, which is what the `Select` is for.
	"""
	unstated = {
		field: value
		for field, value in row.items()
		if field not in _STRUCTURAL_KEYS and not frappe.db.get_value(doctype, name, field)
	}
	if unstated:
		frappe.db.set_value(doctype, name, unstated, update_modified=False)


def _standard_row(doctype: str, standard_key: str) -> str | None:
	"""The current name of the row that shipped under `standard_key`, however it is labelled now."""
	return frappe.db.get_value(doctype, {"standard_key": standard_key}, "name")


# The rule properties a shipped policy states. The digest is taken over these, so an operator who
# has changed any of them is recognised as having tuned the policy.
_RULE_PROPERTIES = (
	"fieldname",
	"requirement",
	"label_override",
	"description_override",
	"display_order",
	"min_value",
	"max_value",
)


def _ensure_field_policies():
	"""Assert every shipped Field Policy, and re-assert one whose *code* has changed.

	Three cases, and the third is the one this used to get wrong.

	**Absent** — insert it, stamped with `standard_key` (what it shipped as) and `shipped_digest`
	(a fingerprint of its rules as shipped).

	**Present and unchanged in code** — leave it entirely alone.

	**Present, and the shipped rules have since changed in code** — replace them *only if the
	operator has not touched them*, which the digest is what makes answerable. Before this, "only
	absence is corrected" meant a shipped policy was frozen at whatever it looked like the first
	time the site migrated: correcting a mistake in a shipped rule could never reach an existing
	site, and no error said so. It was found the hard way inside one session — a School application
	policy shipped with `interaction_outcome` Required, which made `start_application` unable to
	raise a school application at all, and editing the seed fixed nothing until the rows were
	deleted by hand through a script that had to bypass `assert_not_standard` to do it.

	The digest is also what keeps the original promise. An operator who has tuned a shipped policy
	has changed its rules, so its current digest no longer matches what shipped, and the row is left
	alone — the same guarantee as before, now stated as a comparison rather than as a refusal to
	look.

	Keyed on `standard_key` rather than on the autoname, for the reason `_ensure` gives: the name
	embeds the scope as it was at insert time and `autoname` does not re-run on rename, so
	relabelling an Institution Type would otherwise produce a second policy at the same scope.
	"""
	for policy in FIELD_POLICIES:
		# Resolve the scope through `standard_key`, so a relabelled Institution Type keeps the
		# policy it already has instead of being handed a second one.
		scope = _standard_row("Institution Type", policy["scope_institution_type"])
		if not scope:
			continue

		key = f"{policy['document_type']}::{policy['scope_institution_type']}"
		digest = _rules_digest(policy["rules"])
		existing = frappe.db.get_value(
			"Field Policy", {"standard_key": key}, ["name", "shipped_digest"], as_dict=True
		)

		if not existing:
			existing = _adopt_field_policy(policy, scope, key, digest)

		if not existing:
			_insert_field_policy(policy, scope, key, digest)
			continue

		if existing.shipped_digest == digest:
			continue

		doc = frappe.get_doc("Field Policy", existing.name)
		if _rules_digest(doc.rules) != existing.shipped_digest:
			# Tuned by an operator. Their version wins, and the digest is deliberately left stale so
			# that this stays true on every future migrate.
			continue

		doc.description = policy["description"]
		doc.rules = []
		for rule in policy["rules"]:
			doc.append("rules", dict(rule))
		doc.shipped_digest = digest
		doc.save(ignore_permissions=True)


def _adopt_field_policy(policy: dict, scope: str, key: str, digest: str):
	"""Claim a shipped policy that predates `standard_key`, or return None if there is none.

	Self-healing rather than a patch, for the reason this whole module is a hook: a patch runs once
	and every site that migrated before it was written stays broken.

	`shipped_digest` is set to the digest of the rules the **code** ships, in both branches, and
	that single choice gets the conservative answer right without having to guess at history. If
	the row's rules match what ships, current equals stored and it stays in sync with future code
	changes. If they do not — an operator tuned it, or it shipped under older code — current will
	never equal stored, so it reads as tuned and is left alone from here on. A shipped correction
	reaching an untouched row is worth having; one overwriting an operator's edit is not.
	"""
	name = frappe.db.get_value(
		"Field Policy",
		{
			"document_type": policy["document_type"],
			"scope_institution_type": scope,
			"standard_key": ["in", ("", None)],
		},
		"name",
	)
	if not name:
		return None

	frappe.db.set_value(
		"Field Policy",
		name,
		{"is_standard": 1, "standard_key": key, "shipped_digest": digest},
		update_modified=False,
	)
	return frappe._dict(name=name, shipped_digest=digest)


def _insert_field_policy(policy: dict, scope: str, key: str, digest: str):
	frappe.get_doc(
		{
			"doctype": "Field Policy",
			"document_type": policy["document_type"],
			"scope_institution_type": scope,
			"description": policy["description"],
			"enabled": 1,
			"is_standard": 1,
			"standard_key": key,
			"shipped_digest": digest,
			"rules": [dict(rule) for rule in policy["rules"]],
		}
	).insert(ignore_permissions=True)


def _rules_digest(rules) -> str:
	"""A fingerprint of a policy's rules, stable across shipped dicts and stored child rows.

	Order-insensitive — the merge is per property and a policy refuses two rules for one field, so
	the order rules are written in carries no meaning and reordering them is not an edit.

	Blank, None and a `display_order` of zero all normalise to the same thing, which is the
	tri-state rule (`docs/DATA-MODEL.md`) applied to comparison: those are the *same* statement,
	namely no statement. Note that a `min_value` of `"0"` does not normalise away — it is stored as
	Data precisely so that a bound of zero is distinguishable from no bound, and `"0" == 0` is
	False in Python, which is what keeps it distinguishable here too.
	"""
	normalised = sorted(tuple(_rule_value(rule, prop) for prop in _RULE_PROPERTIES) for rule in rules)
	return hashlib.sha256(json.dumps(normalised).encode()).hexdigest()[:32]


def _rule_value(rule, prop: str) -> str:
	value = rule.get(prop)
	return "" if value in (None, "", 0) else str(value)
