# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""One registered configuration key. The registry is code; the values are a trust's.

`setting_key` is read-only and `on_trash` refuses: a key that code asks for cannot be deleted out
from under it, because `get_config` throws on an unregistered key by design — that is what makes a
typo an error rather than a silent behaviour change.
"""

import frappe
from frappe import _
from frappe.model.document import Document

from erp.config.resolver import clear_cache


class ConfigSetting(Document):
	def validate(self):
		self.validate_default_against_type()
		self.validate_required_has_an_answer()

	def on_update(self):
		# Wholesale: a setting's type or default changes how every node's raw value reads back, so
		# there is no one node to invalidate.
		clear_cache()

	def on_trash(self):
		if frappe.db.exists("Config Value", {"setting": self.name}):
			frappe.throw(
				_("{0} has values configured against it. Delete those first.").format(frappe.bold(self.name)),
				title=_("Setting In Use"),
			)

		frappe.throw(
			_(
				"{0} is a registered key that code asks for by name. Deleting it would make every "
				"call for it throw. Change what it decides, or remove it from {1} first."
			).format(frappe.bold(self.name), frappe.bold("erp/config/settings.py")),
			title=_("Registered Key"),
		)

	def validate_default_against_type(self):
		"""A default that the setting's own type would refuse is a trap for the first caller."""
		if not self.default_value:
			return
		assert_valid_value(self, self.default_value, _("Default"))

	def validate_required_has_an_answer(self):
		"""`is_required` with no default is legitimate — but only if a trust will actually set it.

		Recorded rather than refused, because the honest case exists: a key whose value is
		genuinely per-trust and has no sensible shipped answer. The warning is for the other case,
		where the default was simply forgotten and the first caller gets a throw.
		"""
		if self.is_required and not self.default_value:
			frappe.msgprint(
				_(
					"{0} is required and has no default, so {1} will throw until a value is set on "
					"the trust or below."
				).format(frappe.bold(self.label or self.name), frappe.bold("get_config")),
				title=_("No Shipped Default"),
				indicator="orange",
			)


def assert_valid_value(setting, value: str, label: str) -> None:
	"""Whether `value` is something this setting's type could read back.

	Shared with `Config Value.validate`, so a trust's override is held to exactly the standard the
	shipped default is. Two places asking the same question differently is how a value comes to be
	accepted at one level and refused at another.
	"""
	if setting.value_type in ("Int", "Check"):
		if not str(value).strip().lstrip("-").isdigit():
			frappe.throw(
				_("{0} must be a whole number for {1}.").format(
					frappe.bold(label), frappe.bold(setting.name)
				),
				title=_("Wrong Value Type"),
			)
		if setting.value_type == "Check" and str(value).strip() not in ("0", "1"):
			frappe.throw(
				_("{0} must be 0 or 1 for {1}.").format(frappe.bold(label), frappe.bold(setting.name)),
				title=_("Wrong Value Type"),
			)

	elif setting.value_type == "Float":
		try:
			float(value)
		except (TypeError, ValueError):
			frappe.throw(
				_("{0} must be a number for {1}.").format(frappe.bold(label), frappe.bold(setting.name)),
				title=_("Wrong Value Type"),
			)

	elif setting.value_type == "Select":
		permitted = [option.strip() for option in (setting.options or "").split("\n") if option.strip()]
		if permitted and value not in permitted:
			frappe.throw(
				_("{0} must be one of {1} for {2}.").format(
					frappe.bold(label), frappe.bold(", ".join(permitted)), frappe.bold(setting.name)
				),
				title=_("Not A Permitted Value"),
			)

	elif setting.value_type == "Link":
		target = (setting.options or "").strip()
		if target and not frappe.db.exists(target, value):
			frappe.throw(
				_("{0} names no {1} called {2}.").format(
					frappe.bold(label), frappe.bold(target), frappe.bold(value)
				),
				title=_("Unknown Record"),
			)
