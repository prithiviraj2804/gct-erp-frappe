# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""The board a school applicant comes from, as a row rather than free text.

`docs/features/school-admission.md` names it for one reason: the trust counts its intake by board,
and free text made "CBSE", "C.B.S.E." and "Cbse" three boards. That is not a tidiness argument —
`GROUP BY education_board` is the query, and it silently returns three rows where there is one
board, which is worse than returning none because it looks like an answer.

Deliberately four fields. There is no affiliation number, no address, no contact: nothing in the
school journey reads any of them, and this app has eleven masters built ahead of a consumer already.
The rows shipped are the boards this trust's institutions actually receive students from, not a
pretend national register — a trust adds its own in Desk.
"""

import frappe
from frappe import _
from frappe.model.document import Document


class EducationBoard(Document):
	def on_trash(self):
		if self.is_standard:
			frappe.throw(
				_("{0} ships with the app. Set its status to Inactive instead of deleting it.").format(
					frappe.bold(self.name)
				),
				title=_("Standard Education Board"),
			)
