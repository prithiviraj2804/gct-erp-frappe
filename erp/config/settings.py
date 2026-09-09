# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""The registered configuration keys. Code owns this list; a trust owns the values.

**An unregistered key is a bug, not a missing value** — so the registry is a seed, `Config
Setting.setting_key` is read-only, and `get_config` throws on a key that is not here rather than
returning None. A resolver that answered None for a misspelt key would make every typo a silent
behaviour change, which is the failure `Field Policy.validate_fields_exist` exists to prevent one
layer up and which would be worse here, because a setting has no form to look wrong on.

## Why this list is short

Slice 4 was originally scheduled before the admission work, with exactly one key in it — the
register series. Bringing it after means the keys are the ones four real gates and one naming rule
actually ask for, rather than the ones a design document guessed at. That is the same argument the
project already used to bring the Field Policy slice ahead of this one, and it worked.

## `institution_type_field`

Four of these keys name a column on Institution Type. Where a key does, that column is the *only*
source at type scope — never a `Config Value` row beside it. The column keeps what it is good at: a
labelled, typed control on a form a Trust Admin already opens. `Config Value` adds the four levels
a column cannot reach: institution, programme, intake, and trust-wide. See
`erp/config/resolver.py`.
"""

CONFIG_SETTINGS = (
	{
		"setting_key": "student_register_series",
		"label": "Student Register Series",
		"value_type": "Data",
		# Byte-identical to what `Student.autoname` hardcoded, so no existing site renumbers. The
		# defect it leaves in place — one run shared across every institution of the trust — is now
		# fixable by one Config Value row per institution rather than by a deploy.
		"default_value": "{trust}-STU-.#####",
		"is_required": 1,
		"description": (
			"The statutory admission register series. Substitutions: {trust}, {institution}, "
			"{academic_year}. Set it per institution to give each its own run — the shipped default "
			"keys the register on the trust, so GIS, GCE and GCT share one, which is what the "
			"docstring in student.py claimed it did not."
		),
	},
	{
		"setting_key": "requires_department",
		"label": "Requires Department",
		"value_type": "Select",
		"options": "Yes\nNo",
		"institution_type_field": "requires_department",
		"default_value": "Yes",
		"description": (
			"Whether a Programme or an enquiry here must name a Department. A school admits into a "
			"class that sits under none. Unstated resolves to Yes, which is what the superseded "
			'`institution_type != "School"` branches did for everything that was not a school.'
		),
	},
	{
		"setting_key": "requires_application_fee",
		"label": "Requires Application Fee",
		"value_type": "Select",
		"options": "Yes\nNo",
		"institution_type_field": "requires_application_fee",
		"default_value": "Yes",
		"description": (
			"Whether the application fee gates the pipeline. A government arts college and a "
			"state-aided school charge nothing for the form. Not a per-applicant waiver — an RTE or "
			"sibling concession at a fee-charging school is a different record."
		),
	},
	{
		"setting_key": "requires_admission_interaction",
		"label": "Requires Admission Interaction",
		"value_type": "Select",
		"options": "Yes\nNo",
		"institution_type_field": "requires_admission_interaction",
		# No default: unstated means the gate's own `applies_when_unstated`, which for this gate is
		# off. Stating "No" here would be the same answer by a different route and would hide the
		# fact that the gate owns its own default.
		"description": (
			"Whether a recorded interaction with the family gates the pipeline. A school interviews "
			"the parents; an institution admitting on an external allotment has no such step."
		),
	},
	{
		"setting_key": "default_admission_route",
		"label": "Default Admission Route",
		"value_type": "Link",
		"options": "Admission Route",
		"institution_type_field": "default_admission_route",
		# `Direct` and not blank, because `Admission Application.admission_route` is `reqd: 1` and
		# this is what fills it. Left unstated, a **newly created** Institution Type — which states
		# no default, hanging off `All`, which states none either — resolved to None and the
		# application could not be saved at all. The operator got a bare Frappe mandatory error
		# naming a field they had never touched, on a type they had just added. That broke the
		# promise slice 3 was built for: "adding a Nursing college is an INSERT, not a deploy".
		#
		# `Direct` is the safe end of the asymmetry, and the same reasoning the seed gives for Arts
		# & Science: a route that wrongly waits on an allotment *blocks* an admission, while one
		# that wrongly does not only means the office picks the right route on the form.
		"default_value": "Direct",
		"description": (
			"The route an application opens on when the office does not pick one. Replaces the "
			"static default of Government Quota, which routed every school application into a "
			"counselling branch for a body that does not exist. Defaults to Direct so that a newly "
			"added institution type can admit before anyone configures it."
		),
	},
)

ALL_KEYS = tuple(setting["setting_key"] for setting in CONFIG_SETTINGS)
