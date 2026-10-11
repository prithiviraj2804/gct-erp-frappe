from frappe.model.document import Document

from erp.master.institution_readiness import validate_academic_year_dates, validate_institution_scope


class AcademicYear(Document):
	def validate(self):
		validate_institution_scope(self)
		validate_academic_year_dates(self)
