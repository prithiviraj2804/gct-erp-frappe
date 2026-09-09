# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""A subject of a qualifying examination, as a row an eligibility rule can name.

Not a taught subject — that is a different concept in a different slice, which is why this is
`Examination Subject` rather than the `Subject` an academics module will one day want. Naming it
generically now would guarantee the collision.

It exists because an eligibility rule has to *name* a subject. "Physics and Chemistry compulsory",
NEET's PCB requirement and a weighted engineering cut-off all name subjects, and free text would
make "Physics" and "physics" two subjects — so one intake's rule would silently miss half its
applicants, which is worse than the rule not existing. Exactly the argument `Education Board` makes.

A small standard set ships, because an eligibility rule cannot be written before the subjects exist
and no operator should have to key in "Mathematics" before their first intake. A trust adds the
rest.
"""

import frappe
from frappe import _
from frappe.model.document import Document


class ExaminationSubject(Document):
	def on_trash(self):
		if self.is_standard:
			frappe.throw(
				_("{0} ships with the app. Set its status to Inactive instead of deleting it.").format(
					frappe.bold(self.name)
				),
				title=_("Standard Examination Subject"),
			)

		self.assert_not_in_use()

	def assert_not_in_use(self):
		"""Refuse to delete a subject a rule or a marks row still names.

		A deleted subject would leave an eligibility rule pointing at nothing — and a rule that
		names no subject cannot be evaluated, so it would either throw for every applicant or be
		skipped for all of them. Both are worse than refusing the delete.
		"""
		for doctype, label in (
			("Programme Intake Eligibility", _("an eligibility rule")),
			("Admission Enquiry Subject Mark", _("a recorded mark")),
		):
			if frappe.db.exists(doctype, {"subject": self.name}):
				frappe.throw(
					_("{0} is named by {1}.").format(frappe.bold(self.name), label),
					title=_("Examination Subject In Use"),
				)
