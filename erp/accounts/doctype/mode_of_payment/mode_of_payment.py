# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

from frappe.model.document import Document


class ModeofPayment(Document):
	# Class name is ModeofPayment (lowercase "of"/"payment" joins): Frappe derives the controller
	# class from the doctype as name.replace(" ", "").replace("-", ""), which does not recapitalise.
	# "ModeOfPayment" would not be found and migrate would delete the doctype as orphaned.
	pass
