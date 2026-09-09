# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

from frappe.model.document import Document


class AdmissionEnquirySubjectMark(Document):
	"""One subject's marks in one of the applicant's previous examinations.

	`percentage` is derived by the parent on save rather than here: a child row's `validate` does
	not run on its own in Frappe — the parent's does — so putting the arithmetic here would look
	right and never execute.
	"""

	pass
