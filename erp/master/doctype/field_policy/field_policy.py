# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Which fields a doctype collects, stated per scope instead of per deployment.

A school enquiry collects the previous school and its marks. An engineering enquiry collects the
entrance exam, the rank and the cut-off. A medical one collects NEET. They are one doctype and one
table, because a counsellor's list, the registrar's report and every filter in the app have to work
across all of them — and because the alternative, a doctype per institution type, multiplies every
future change by the number of types.

So the *superset* of fields lives in the schema, and a Field Policy says which of them this
institution actually collects, which are required, and what it calls them.

**This is the only validation boundary.** Frappe has no per-row form customization: `depends_on`
and `mandatory_depends_on` are evaluated in the browser (`frappe/public/js/frappe/form/save.js`)
while the server checks only `reqd` (`frappe/model/base_document.py`), so anything expressed there
is advice, not a rule. `apply_field_policy` runs inside `validate()`, which means it holds for Desk,
`/api/resource`, Data Import, a console script and any client that has not been written yet.
"""

import frappe
from frappe import _
from frappe.model.document import Document

from erp.field_policy import GOVERNED_DOCTYPES, clear_cache, fieldtype_objection

# The verbs a rule may use. All four are enforced in `validate()` — "Read Only" reverts exactly
# as "Hidden" does, differing only in whether the field is drawn, because a verb enforced solely by
# greying a control in the browser would be advice rather than a rule.
REQUIREMENTS = ("Required", "Optional", "Hidden", "Read Only")

# The reporting spine: fields a trust-level rollup reads, which therefore mean the same thing in
# every institution and may not be governed by a policy.
#
# The trust's question is "how many admissions across all institutions, and how many each" — and
# that only has an answer while every institution records the *same* things in the *same* columns.
# Configuration is what makes an engineering enquiry differ from a school one; the spine is what
# keeps them countable together. Hiding `institution` would drop a row from every rollup;
# relabelling `status` would make one institution's funnel incomparable with the next.
#
# Most of these are `reqd: 1` and so already refused by `validate_not_statically_required`. They
# are listed anyway, because "it happens to be mandatory" is an accident and "the trust counts on
# it" is a reason — and the next spine field may not be mandatory.
REPORTING_SPINE = {
	"Admission Enquiry": frozenset(
		{"institution", "trust", "status", "enquiry_date", "academic_year", "programme"}
	),
	"Admission Application": frozenset(
		{"institution", "trust", "application_state", "application_date", "programme", "programme_intake"}
	),
	# `reservation_category` is on the Student spine and not on the other two on purpose. Student is
	# the statutory admission register, and the returns a trust files are counted by category — so
	# hiding it there would drop rows from a count the trust is legally obliged to produce. On the
	# enquiry and the application it stays configurable, because an institution that runs no
	# reserved pools has no business collecting it.
	"Student": frozenset(
		{
			"institution",
			"trust",
			"status",
			"date_of_admission",
			"programme",
			"academic_year",
			"reservation_category",
		}
	),
}


class FieldPolicy(Document):
	def autoname(self):
		"""Readable, and unique on exactly what must be unique: one policy per doctype per scope.

		A second policy for the same scope would be an unresolvable contradiction — the merge is
		ordered across scopes, not within one — so the collision is the guard.
		"""
		self.name = f"{self.document_type}-{self.scope()}"

	def validate(self):
		self.validate_document_type_is_governed()
		self.validate_one_scope()
		self.validate_fields_exist()
		self.validate_governable_fieldtypes()
		self.validate_not_reporting_spine()
		self.validate_not_statically_required()
		self.validate_no_duplicate_rules()

	def on_update(self):
		clear_cache()

	def after_delete(self):
		clear_cache()

	def on_trash(self):
		if self.is_standard:
			frappe.throw(
				_("{0} ships with the app. Disable it instead of deleting it.").format(
					frappe.bold(self.name)
				),
				title=_("Standard Field Policy"),
			)

	def scope(self) -> str:
		"""The record this policy applies to. The institution wins when both are set — but
		`validate_one_scope` refuses that, so in practice exactly one is present."""
		return self.scope_institution or self.scope_institution_type

	def validate_one_scope(self):
		"""Exactly one scope, because two would make "which is more specific" a question with no
		answer on a single row. Specificity is expressed *between* policies, not inside one.

		Only two scopes exist today because only two have a consumer: configure the kind, override
		the one institution that differs. Programme and intake scopes are a schema change away, and
		will be made when a journey asks for them rather than in anticipation.
		"""
		if bool(self.scope_institution_type) == bool(self.scope_institution):
			frappe.throw(
				_("Set either an Institution Type or an Institution as the scope, not both and not neither."),
				title=_("One Scope"),
			)

	def validate_document_type_is_governed(self):
		"""A policy may only name a doctype whose controller actually applies one.

		`document_type` is an unrestricted Link to DocType, so the obvious policy for any doctype
		on the site saves without complaint. If that doctype never calls `apply_field_policy`,
		every rule on it is inert: the scope resolves, the merge runs, `get_policy` will even
		return the resolved spec to a form script — and nothing is ever enforced. A Trust Admin has
		no way to distinguish that from a working policy, which makes it the most expensive kind of
		bug this layer can have.

		The list lives in `erp/field_policy.py` beside the enforcer, and a convention test asserts
		it matches the source in both directions.
		"""
		if not self.document_type or self.document_type in GOVERNED_DOCTYPES:
			return

		frappe.throw(
			_(
				"Nothing applies a Field Policy to {0}, so every rule here would be silently "
				"ignored. Governed today: {1}. Governing another doctype means calling "
				"{2} from its {3} and adding it to {4}."
			).format(
				frappe.bold(self.document_type),
				frappe.bold(", ".join(sorted(GOVERNED_DOCTYPES))),
				frappe.bold("apply_field_policy"),
				frappe.bold("validate()"),
				frappe.bold("GOVERNED_DOCTYPES"),
			),
			title=_("Not A Governed DocType"),
		)

	def validate_governable_fieldtypes(self):
		"""Refuse a rule form the enforcer could not actually carry out.

		Three cases, all of which used to save green: a bound on a non-numeric field (which reads
		every value as zero, so it either passes always or blocks every save), Hidden or Read Only
		on a child table (a row operation dressed as a column write), and any rule at all on a
		field that only structures the form. The reasoning for each is in
		`erp.field_policy.fieldtype_objection`, which is the mirror of what enforcement does.
		"""
		if not self.document_type:
			return

		meta = frappe.get_meta(self.document_type)
		for rule in self.rules:
			field = meta.get_field(rule.fieldname)
			if not field:
				continue

			objection = fieldtype_objection(field, rule)
			if objection:
				frappe.throw(
					_("Row {0}: {1}").format(rule.idx, objection), title=_("Rule Cannot Be Enforced")
				)

	def validate_fields_exist(self):
		"""A rule naming a field that does not exist does nothing, silently, for ever.

		The commonest way to write one is a typo, and the second commonest is a field that was
		renamed. Both look identical to a working policy from the outside, which is why this is a
		hard error rather than a warning.
		"""
		if not self.document_type:
			return

		meta = frappe.get_meta(self.document_type)
		for rule in self.rules:
			if not meta.has_field(rule.fieldname):
				frappe.throw(
					_("Row {0}: {1} has no field {2}.").format(
						rule.idx, frappe.bold(self.document_type), frappe.bold(rule.fieldname)
					),
					title=_("Unknown Field"),
				)

	def validate_not_statically_required(self):
		"""A policy-governed field may not also be `reqd: 1` in the doctype JSON.

		The two say different things and the JSON always wins: `_validate_mandatory` runs after
		`validate`, so a policy saying "Optional" or "Hidden" for a school would be overruled by a
		static `reqd` and the school could never save the form. The failure is confusing precisely
		because the policy looks correct.

		Fields that genuinely every institution type needs — `institution`, `programme`,
		`student_name` — stay `reqd: 1` in the JSON and are simply not governed here.
		"""
		if not self.document_type:
			return

		meta = frappe.get_meta(self.document_type)
		clashes = [
			rule.fieldname
			for rule in self.rules
			if rule.requirement and (field := meta.get_field(rule.fieldname)) and field.reqd
		]
		if clashes:
			frappe.throw(
				_(
					"{0} is mandatory in the {1} schema, so a policy cannot govern it. "
					"Either drop the rule, or make the field optional in the doctype and let "
					"policy decide."
				).format(frappe.bold(", ".join(clashes)), frappe.bold(self.document_type)),
				title=_("Field Is Always Required"),
			)

	def validate_not_reporting_spine(self):
		"""Refuse to govern a field the trust counts on.

		An institution may run its own process; what it may not do is stop being countable
		alongside the others. This is the line between the two.
		"""
		spine = REPORTING_SPINE.get(self.document_type, frozenset())
		governed = sorted({rule.fieldname for rule in self.rules} & spine)
		if governed:
			frappe.throw(
				_(
					"{0} is part of the trust-wide reporting spine and means the same thing in every "
					"institution, so a policy cannot change it. Configure the process around it."
				).format(frappe.bold(", ".join(governed))),
				title=_("Reporting Spine"),
			)

	def validate_no_duplicate_rules(self):
		"""One rule per field per policy. Two rows for one field is an unresolvable contradiction —
		the merge is ordered across *scopes*, not within one."""
		seen = set()
		for rule in self.rules:
			if rule.fieldname in seen:
				frappe.throw(
					_("Row {0}: {1} already has a rule in this policy.").format(
						rule.idx, frappe.bold(rule.fieldname)
					),
					title=_("Duplicate Rule"),
				)
			seen.add(rule.fieldname)
