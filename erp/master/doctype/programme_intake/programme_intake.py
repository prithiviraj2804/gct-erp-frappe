# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class ProgrammeIntake(Document):
	def validate(self):
		self.validate_seats()
		self.validate_percentage()
		self.validate_unique_offering()

	def validate_seats(self):
		if self.total_seats is not None and self.total_seats <= 0:
			frappe.throw(_("Total Seats must be greater than zero."))

	def validate_percentage(self):
		if self.min_percentage and not 0 <= self.min_percentage <= 100:
			frappe.throw(_("Minimum Percentage must be between 0 and 100."))

	def validate_unique_offering(self):
		"""One intake per programme per academic year.

		The name is `format:{academic_year}-{programme}`, so a duplicate resolves to the
		same name as the existing row — meaning a plain `name != self.name` filter would
		exclude the very record it clashes with. Gate on is_new() instead.
		"""
		existing = frappe.db.exists(
			"Programme Intake",
			{
				"academic_year": self.academic_year,
				"programme": self.programme,
			},
		)
		if existing and (self.is_new() or existing != self.name):
			frappe.throw(
				_("An intake for {0} in {1} already exists ({2}).").format(
					frappe.bold(self.programme), frappe.bold(self.academic_year), existing
				)
			)
