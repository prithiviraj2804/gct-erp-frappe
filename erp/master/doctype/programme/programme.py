import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt

from erp.master.hierarchy import validate_same_parent
from erp.master.institution_readiness import validate_institution_scope


class Programme(Document):
	def validate(self):
		validate_institution_scope(self)
		validate_same_parent(self, "department", "institution", "trust")
		if self.duration is not None and flt(self.duration) <= 0:
			frappe.throw(_("Duration must be greater than zero."))
