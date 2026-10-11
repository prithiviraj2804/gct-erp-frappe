# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import getdate

from erp.master.hierarchy import inherit_parent_value, validate_same_parent


class InstitutionCampusAssignment(Document):
	def validate(self):
		inherit_parent_value(self, "institution", "trust")
		validate_same_parent(self, "institution", "trust")
		validate_same_parent(self, "campus", "trust")
		self._validate_dates()
		self._validate_campus_period()
		self._validate_primary_period()

	def _validate_dates(self):
		if self.effective_to and getdate(self.effective_to) < getdate(self.effective_from):
			frappe.throw(_("Effective To cannot be before Effective From."))

	def _validate_campus_period(self):
		conflict = self._find_overlap(campus=self.campus)
		if conflict:
			frappe.throw(
				_("Campus {0} is already assigned to this Institution during the selected period in {1}.").format(
					frappe.bold(self.campus), frappe.bold(conflict)
				)
			)

	def _validate_primary_period(self):
		if not self.is_primary:
			return

		conflict = self._find_overlap(primary=True)
		if conflict:
			frappe.throw(
				_("Primary campus assignment {0} already applies to this Institution during the selected period.").format(
					frappe.bold(conflict)
				)
			)

	def _find_overlap(self, *, campus: str | None = None, primary: bool = False) -> str | None:
		if self.status != "Active":
			return None

		extra_condition = " and campus = %(campus)s" if campus else " and is_primary = 1" if primary else ""
		matches = frappe.db.sql(
			f"""
			select name
			from `tabInstitution Campus Assignment`
			where name != %(name)s
			  and institution = %(institution)s
			  and status = 'Active'
			  and effective_from <= %(effective_to)s
			  and (effective_to is null or effective_to >= %(effective_from)s)
			  {extra_condition}
			limit 1
			""",  # nosec B608: the only interpolated SQL fragment is selected from constants above
			{
				"name": self.name or "",
				"institution": self.institution,
				"campus": campus,
				"effective_from": self.effective_from,
				"effective_to": self.effective_to or "9999-12-31",
			},
		)
		return matches[0][0] if matches else None
