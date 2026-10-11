from frappe.model.document import Document

from erp.master.hierarchy import validate_same_parent
from erp.master.institution_readiness import validate_institution_scope


class InstitutionSettings(Document):
	def validate(self):
		validate_institution_scope(self)
		validate_same_parent(self, "default_academic_year", "institution", "trust")
