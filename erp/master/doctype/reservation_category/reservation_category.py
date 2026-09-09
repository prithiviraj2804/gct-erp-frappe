# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""The category a seat is reserved under, as a row the seat matrix and the register can both name.

`docs/features/arts-science-admission.md` names it, and for two reasons that pull in the same
direction. A community-quota seat matrix is keyed on the category, so without this master an
institution's sanctioned pools cannot be expressed at all. And the statutory returns a trust files
are counted by category, so it has to be on `Student` — which is the statutory admission register,
named by the register number with `allow_rename: 0`, and therefore the one column here that is
expensive to add later rather than now.

**Nothing ships.** Sub-quota names and their sanctioned shares differ by state, by university and
by year, and a plausible-looking wrong row on a statutory register is worse than a blank one — it
reads as an answer. A trust keys in the categories its own notifications name.
"""

import frappe
from frappe import _
from frappe.model.document import Document


class ReservationCategory(Document):
	def on_trash(self):
		if self.is_standard:
			frappe.throw(
				_("{0} ships with the app. Set its status to Inactive instead of deleting it.").format(
					frappe.bold(self.name)
				),
				title=_("Standard Reservation Category"),
			)

		self.assert_not_in_use()

	def assert_not_in_use(self):
		"""Refuse to delete a category a seat pool, an application or a student still names.

		A deleted category would leave a sanctioned pool pointing at nothing — so the seats it
		sanctions would silently stop being reachable, and an admitted student's register row would
		lose the category their seat was allotted under.
		"""
		for doctype in ("Programme Intake Seat", "Admission Enquiry", "Admission Application", "Student"):
			users = frappe.get_all(
				doctype, filters={"reservation_category": self.name}, pluck="name", limit=5
			)
			if users:
				frappe.throw(
					_("{0} is in use by {1} — {2}.").format(
						frappe.bold(self.name), frappe.bold(doctype), frappe.bold(", ".join(map(str, users)))
					),
					title=_("Reservation Category In Use"),
				)
