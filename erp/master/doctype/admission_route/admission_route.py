# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""How a seat was decided — as data the pipeline can interrogate, not a literal it compares against.

`assert_allotted_to_us` used to read `if application.admission_route != "Government Quota": return`,
with the string held in `application_state.GOVERNMENT_QUOTA` and imported into two modules. That
worked for exactly the three routes the `Select` offered, and only because one of them happened to
be the one an external body allots.

It does not survive contact with a real trust. An NRI seat is allotted by the institution but under
a separate sanctioned quota. A supernumerary or lateral-entry seat is a different pool again. A
state's minority quota is allotted centrally. Adding any of them to the Select would have left the
gate silently wrong, because the gate does not ask "which route is this" — it asks *does this route
wait on somebody else's decision*, and only the route can answer that.

So the question moves onto the row. `requires_allotment` is the whole reason this master exists:
`docs/features/school-admission.md` names it, and with it a trust adds `NRI` in Desk and the
allotment gate starts firing with no deploy.

The three shipped rows are named exactly as the superseded `Select`'s options were, so
`Admission Application.admission_route` becomes a Link with no data migration — the same move slice
3 made when `Institution.institution_type` became a Link to a tree.
"""

import frappe
from frappe import _
from frappe.model.document import Document


class AdmissionRoute(Document):
	def on_trash(self):
		self.assert_not_standard()
		self.assert_not_in_use()

	def assert_not_standard(self):
		"""A shipped route may be relabelled or disabled, never deleted.

		`admission_route` is `reqd: 1` on Admission Application, so deleting the route a live
		application sits on would leave that application unsaveable — and the seed would put the row
		back on the next migrate having lost whatever `requires_allotment` the operator had set.
		"""
		if self.is_standard:
			frappe.throw(
				_("{0} ships with the app. Set its status to Inactive instead of deleting it.").format(
					frappe.bold(self.name)
				),
				title=_("Standard Admission Route"),
			)

	def assert_not_in_use(self):
		"""Refuse to delete a route an application or a student still names."""
		for doctype in ("Admission Application", "Student"):
			users = frappe.get_all(doctype, filters={"admission_route": self.name}, pluck="name", limit=5)
			if users:
				frappe.throw(
					_("{0} is in use by {1} — {2}.").format(
						frappe.bold(self.name), frappe.bold(doctype), frappe.bold(", ".join(users))
					),
					title=_("Admission Route In Use"),
				)


def requires_allotment(admission_route: str | None) -> bool:
	"""Whether a seat on this route waits on an external counselling body.

	The one question the pipeline asks of a route, and the reason `Admission Route` is a master
	rather than a longer `Select`. A blank or unknown route resolves to **False**: an institution's
	own seat is the safer default to assume, because the alternative would block every admission on
	a route somebody had not finished configuring.
	"""
	if not admission_route:
		return False

	return bool(frappe.db.get_value("Admission Route", admission_route, "requires_allotment"))
