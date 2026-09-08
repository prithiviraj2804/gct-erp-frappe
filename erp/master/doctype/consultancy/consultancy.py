# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class Consultancy(Document):
	"""An external agency that refers admission enquiries, scoped to one trust.

	No ancestry check here. Every other master in this app calls `validate_same_parent` to
	prove its ancestry columns agree, but a Consultancy carries exactly one ancestor —
	`trust`, the root of the hierarchy. There is nothing above it to contradict, so a
	`validate_same_parent` call would compare the record against itself and pass
	unconditionally. Adding one would read as protection while providing none.
	"""

	def validate(self):
		self.validate_code_is_unique_in_trust()

	def validate_code_is_unique_in_trust(self):
		"""One code per agency per trust — two trusts may reuse the same code.

		`consultancy_code` is deliberately not `unique`, because the same code belongs to
		different agencies at different trusts. Folding the trust into `name` via
		the `format:` autoname looks like it covers the rest, but it only covers inserts:
		`name` is computed once and never recomputed, so editing the code on a saved record
		moves the column without moving the key, and the vacated code inserts again cleanly.
		Two rows in one trust then share a code, and every referral figure grouped by
		(trust, code) credits one agency for the other's enquiries.
		"""
		if not (self.trust and self.consultancy_code):
			return

		filters = {"trust": self.trust, "consultancy_code": self.consultancy_code}
		if not self.is_new():
			filters["name"] = ["!=", self.name]

		duplicate = frappe.db.exists("Consultancy", filters)
		if duplicate:
			frappe.throw(
				_("Consultancy Code {0} is already used by {1} at Trust {2}.").format(
					frappe.bold(self.consultancy_code),
					frappe.bold(duplicate),
					frappe.bold(self.trust),
				),
				title=_("Duplicate Consultancy Code"),
			)
