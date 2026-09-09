# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

from frappe.model.document import Document


class ProgrammeIntakeSeat(Document):
	"""One sanctioned pool of an intake's seats.

	No validation of its own: a row means nothing without the other rows of the same matrix, so
	every rule that could be written here — the pools may not oversubscribe the intake, no two rows
	may claim the same pool — needs the parent and lives in `Programme Intake.validate`.
	"""

	pass
