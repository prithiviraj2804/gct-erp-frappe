# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

from frappe.model.document import Document


class ProgrammeIntakeEligibility(Document):
	"""One entry condition an intake publishes.

	No validation here: whether a rule is well-formed depends on its `rule_type`, and the message
	has to name the row, so the check lives in `Programme Intake.validate_eligibility_rules` where
	the parent and the row index are both in hand.
	"""

	pass
