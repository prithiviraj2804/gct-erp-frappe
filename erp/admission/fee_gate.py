# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""The application-fee gate on the admission pipeline — one rule, several writers.

A lead may not reach "Application Submitted" or beyond until its application fee is collected. The
enquiry's `status` is a free Select written from more than one place (a direct save, and the
Admission Follow-up's `new_status` path, which uses `frappe.db.set_value` and bypasses the enquiry's
`validate`). So the rule lives here once, the way `follow_up_state.py` centralises the follow-up badge.

It is no longer called directly by those writers: `erp/admission/pipeline.py` composes this rule
with the document and seat gates into a single `assert_status_transition`, and that is what a
status-writer calls. This module keeps the fee rule itself; add a new rule to `pipeline.py`.

**Which stages the fee gates is no longer stated here.** It is one column of the stage table in
`erp/admission/stages.py`, so "what does this stage require" has one answer instead of three
written from three directions. `PIPELINE` and `GATE_ENTRY_STATUS` are re-exported for the callers
that already import them from this module; the table is the source.
"""

import frappe
from frappe import _

from erp.admission.stages import FEE, GATE_ENTRY_STATUS, PIPELINE, required_gates

__all__ = ("GATE_ENTRY_STATUS", "PIPELINE", "advance_target_on_payment", "assert_fee_paid_for_status")


def assert_fee_paid_for_status(new_status, application_fee_paid, previous_status=None, *, institution=None):
	"""Throw if a lead is being moved *into* the gated region without its fee paid.

	Only an entry across the boundary is gated — a lead already inside it (e.g. a payment was later
	cancelled, leaving it Paid-less at "Application Submitted") can still be saved and edited; the
	gate is about advancing, not about re-validating history. `previous_status=None` means a brand-new
	record, which is treated as coming from outside the gate.

	`institution` decides whether the gate is part of this institution's pipeline at all — a
	government arts college charges nothing for the form. Omitted, the gate applies, which is the
	fail-closed answer and exactly what every existing caller got.
	"""
	if FEE not in required_gates(new_status, previous_status, institution):
		return

	if not application_fee_paid:
		frappe.throw(
			_("The application fee must be collected before this enquiry can move to {0}.").format(
				frappe.bold(new_status)
			),
			title=_("Application Fee Required"),
		)


def advance_target_on_payment(current_status):
	"""The status a lead should jump to when its fee is paid, or None if it should not move.

	Advances a lead that is behind "Application Submitted" up to it; leaves a lead already at or past
	it untouched, and never resurrects a Rejected/Dropped lead (those are off the pipeline).
	"""
	if current_status in PIPELINE and PIPELINE.index(current_status) < PIPELINE.index(GATE_ENTRY_STATUS):
		return GATE_ENTRY_STATUS
	return None
