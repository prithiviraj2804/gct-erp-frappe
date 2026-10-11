from frappe.model.document import Document

from erp.master.institution_readiness import validate_institution_scope


class Department(Document):
	def validate(self):
		validate_institution_scope(self)
