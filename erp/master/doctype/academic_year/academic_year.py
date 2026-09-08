# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import getdate


class AcademicYear(Document):
	def validate(self):
		self.validate_dates()
		self.validate_admission_window()

	def validate_dates(self):
		if self.start_date and self.end_date and getdate(self.end_date) <= getdate(self.start_date):
			frappe.throw(_("End Date must be after Start Date."))

	def validate_admission_window(self):
		if not (self.admission_start_date or self.admission_end_date):
			return

		if (
			self.admission_start_date
			and self.admission_end_date
			and getdate(self.admission_end_date) <= getdate(self.admission_start_date)
		):
			frappe.throw(_("Admission End Date must be after Admission Start Date."))

		# Admissions for a year commonly open before that year begins (you admit for
		# 2027-28 during 2026-27), so there is no lower bound. They must, however,
		# close on or before the academic year itself ends.
		if (
			self.admission_end_date
			and self.end_date
			and getdate(self.admission_end_date) > getdate(self.end_date)
		):
			frappe.throw(_("Admission End Date cannot be after the academic year's End Date."))

	def on_update(self):
		# "Current" (running) and "Admission Open" are independent pointers, but each is
		# a per-trust singleton: setting one here clears it on every other year.
		self.enforce_singleton_flag("is_current")
		self.enforce_singleton_flag("is_admission_open")

	def enforce_singleton_flag(self, fieldname):
		if not self.get(fieldname):
			return

		others = frappe.get_all(
			"Academic Year",
			filters={
				"trust": self.trust,
				fieldname: 1,
				"name": ["!=", self.name],
			},
			pluck="name",
		)
		for name in others:
			frappe.db.set_value("Academic Year", name, fieldname, 0)
