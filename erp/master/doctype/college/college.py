# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

from frappe.model.document import Document

from erp.master.hierarchy import validate_same_parent


class College(Document):
	def validate(self):
		self.validate_hierarchy()

	def validate_hierarchy(self):
		"""A College may sit on a Campus of a different Institution unless we say otherwise.

		Programme fetches its `campus` straight from the college, so an unchecked campus
		here surfaces as a Programme whose campus belongs to someone else's institution —
		which no amount of validation on Programme itself can catch.
		"""
		validate_same_parent(self, "campus", "institution")
