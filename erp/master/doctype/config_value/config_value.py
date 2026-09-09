# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""One trust's answer to one registered key, at one level of the hierarchy.

Every rule here exists because the alternative is a row that looks configured and is not:

* A **blank** value is refused. A blank is not an answer, it is the absence of one — the tri-state
  rule in `docs/DATA-MODEL.md` — and the way to say nothing is to have no row. A blank row would be
  invisible in the resolver and puzzling in a list.
* Exactly **one scope** per row, because two would make "which level is this" a question with no
  answer. Specificity is expressed *between* rows, not inside one — the same rule, and the same
  wording, as `Field Policy.validate_one_scope`.
* A **duplicate** at one scope is refused. `(setting, scope)` is what the chain resolves against,
  so two rows for it is a contradiction with no answer: the chain is ordered *between* levels, not
  within one. The same shape as two Field Policy rules for one field.
* A value the setting's **type** would refuse is caught here rather than at the first read, and by
  the same function that validates the shipped default.
* A scope whose level the setting **already answers from a column** is refused, so one level of the
  chain never has two sources.
"""

import frappe
from frappe import _
from frappe.model.document import Document

from erp.config.resolver import SCOPE_FIELDS, clear_cache
from erp.master.doctype.config_setting.config_setting import assert_valid_value


class ConfigValue(Document):
	def validate(self):
		self.validate_one_scope()
		self.validate_value_is_stated()
		self.validate_against_setting()
		self.validate_not_a_column_scope()
		self.validate_unique_at_scope()

	def on_update(self):
		clear_cache(*self.scope())

	def on_trash(self):
		clear_cache(*self.scope())

	def setting_doc(self):
		return frappe.get_cached_doc("Config Setting", self.setting)

	def scope(self) -> tuple[str | None, str | None]:
		"""The `(scope_type, scope_name)` pair this row answers for.

		Five typed `Link` columns rather than one `Dynamic Link`, and the reason is the same one
		`Field Policy` gives for its two: the generic SPA renderer has never been taught to draw a
		Dynamic Link, and `erp/api/test_doctype.py` enforces that — it refuses any fieldtype the
		renderer cannot draw, which is what caught the first version of this doctype. Typed columns
		also each become a real Report Builder filter, so "every override at institution level" is a
		list view rather than a query.

		The pair is derived here rather than stored, so there is one place that knows the mapping and
		the cache key stays `{scope_type}|{scope_name}` exactly as `docs/CONFIGURATION.md` §3
		specifies.
		"""
		for scope_type, fieldname in SCOPE_FIELDS.items():
			if self.get(fieldname):
				return scope_type, self.get(fieldname)
		return None, None

	def validate_one_scope(self):
		"""Exactly one scope. Two would make "which level is this" unanswerable on a single row."""
		set_scopes = [fieldname for fieldname in SCOPE_FIELDS.values() if self.get(fieldname)]
		if len(set_scopes) != 1:
			frappe.throw(
				_(
					"Set exactly one scope — a trust, an institution type, an institution, a "
					"programme or an intake. Specificity is expressed between rows, not inside one."
				),
				title=_("One Scope"),
			)

	def validate_value_is_stated(self):
		if self.value is None or str(self.value).strip() == "":
			frappe.throw(
				_(
					"A Config Value must state a value. To say nothing at this level, delete the row — "
					"a blank is the absence of an answer, not an answer."
				),
				title=_("No Value"),
			)

	def validate_against_setting(self):
		assert_valid_value(self.setting_doc(), self.value, _("Value"))

	def validate_not_a_column_scope(self):
		"""Refuse a row at a level the setting answers from an Institution Type column.

		Where `institution_type_field` is set, the column is the source at that level and the
		resolver never looks at a row here. Accepting one would be the worst kind of configuration
		bug: a Trust Admin sets it, sees it saved, and nothing changes.
		"""
		setting = self.setting_doc()
		scope_type, scope_name = self.scope()
		if scope_type == "Institution Type" and setting.institution_type_field:
			frappe.throw(
				_(
					"{0} is answered at Institution Type level by the {1} field on the type itself, so "
					"a value here would be ignored. Set it on {2}, or override it on an institution, "
					"programme or intake."
				).format(
					frappe.bold(setting.label or setting.name),
					frappe.bold(setting.institution_type_field),
					frappe.bold(scope_name),
				),
				title=_("Answered On The Type"),
			)

	def validate_unique_at_scope(self):
		scope_type, scope_name = self.scope()
		existing = frappe.db.get_value(
			"Config Value",
			{
				"setting": self.setting,
				SCOPE_FIELDS[scope_type]: scope_name,
				"name": ["!=", self.name or ""],
			},
			"name",
		)
		if existing:
			frappe.throw(
				_("{0} already has a value for {1} ({2}). Edit that row rather than adding a second.").format(
					frappe.bold(scope_name), frappe.bold(self.setting), frappe.bold(existing)
				),
				title=_("Value Exists"),
			)
