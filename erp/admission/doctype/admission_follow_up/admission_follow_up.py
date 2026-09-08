# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

from erp.admission.follow_up_state import derive_follow_up_state
from erp.admission.pipeline import assert_status_transition
from erp.api.permission import LEAD_ADMIN_ROLES, staff_for_user

# Copied from the enquiry so a follow-up carries its own scoping keys and display name. `counsellor`
# is the one the row-level permission rides on; keeping it on the follow-up means "my follow-ups"
# filters without a join back to the enquiry every time.
ENQUIRY_FIELDS = ("student_name", "counsellor", "institution", "college")


class AdmissionFollowup(Document):
	# Class name is AdmissionFollowup (lowercase "up"): Frappe derives the controller class from the
	# doctype as `name.replace(" ", "").replace("-", "")`, so the hyphen in "Admission Follow-up"
	# collapses without recapitalising. A CamelCase "AdmissionFollowUp" would not be found, and
	# migrate would delete the DocType as orphaned (base_document.get_controller).
	def validate(self):
		self.sync_from_enquiry()
		self.guard_ownership()
		self.enforce_pipeline_gates()

	def on_update(self):
		# on_update runs after insert too, so this covers both a new follow-up and an edit.
		self.apply_status_change()
		sync_enquiry_rollups(self.enquiry)

	def after_delete(self):
		# The row is gone; recompute so the lead's badge and counts reflect what remains.
		sync_enquiry_rollups(self.enquiry)

	def sync_from_enquiry(self):
		"""Re-copy the lead's owner, tenant and name onto the follow-up.

		`fetch_from` fills these in the Desk form, but that is a client convenience the server does
		not enforce — and `flags.ignore_links` skips it entirely. Deriving them here means the
		follow-up's `counsellor` (which visibility keys on) is always the enquiry's real owner, not
		whatever a caller posted.
		"""
		if not self.enquiry:
			return

		enquiry = frappe.db.get_value("Admission Enquiry", self.enquiry, ENQUIRY_FIELDS, as_dict=True)
		if enquiry:
			for field in ENQUIRY_FIELDS:
				self.set(field, enquiry.get(field))

	def guard_ownership(self):
		"""A counsellor may only log follow-ups on leads assigned to them; managers on any.

		The read scoping already hides other counsellors' leads, but nothing stops a crafted POST
		from linking a follow-up to an enquiry the caller does not own — so the write side is closed
		here too. `counsellor` has just been re-derived from the enquiry, so it is the lead's true
		owner to compare against.
		"""
		if self.flags.ignore_permissions:
			return

		user = frappe.session.user
		if user == "Administrator" or LEAD_ADMIN_ROLES & set(frappe.get_roles(user)):
			return

		if self.counsellor != staff_for_user(user):
			frappe.throw(
				_("You can only log follow-ups for leads assigned to you."),
				frappe.PermissionError,
			)

	def enforce_pipeline_gates(self):
		"""A follow-up that advances the lead must satisfy the same gates a direct edit does.

		Runs in `validate`, which fires before `apply_status_change`'s `set_value` in `on_update` —
		so an unearned advance fails before the status is written, closing the bypass that a raw
		`set_value` would otherwise open. Every rule is composed in `erp/admission/pipeline.py`, so
		this path and the enquiry's own `validate` can never drift apart.
		"""
		if not self.new_status:
			return

		enquiry = frappe.db.get_value(
			"Admission Enquiry", self.enquiry, ["status", "application_fee_paid"], as_dict=True
		)
		if enquiry:
			assert_status_transition(
				self.enquiry,
				self.new_status,
				enquiry.status,
				application_fee_paid=enquiry.application_fee_paid,
			)

	def apply_status_change(self):
		"""Advance the lead's stage if this follow-up requested one.

		Written straight to the enquiry with `set_value` rather than by loading and saving it: the
		only field touched is `status`, and a full save would re-run the enquiry's whole validation
		on a document the counsellor may not have open. `sync_enquiry_rollups` runs next and reads
		this fresh status, so a follow-up that both closes the lead and rolls up lands as "Closed".
		"""
		if not self.new_status:
			return

		current = frappe.db.get_value("Admission Enquiry", self.enquiry, "status")
		if current and current != self.new_status:
			frappe.db.set_value("Admission Enquiry", self.enquiry, "status", self.new_status)


def sync_enquiry_rollups(enquiry: str) -> None:
	"""Recompute the lead's denormalised follow-up summary from its follow-up log.

	`last_contacted_on`, `last_outcome` and `follow_up_count` are facts drawn from the log; the
	lead's `next_follow_up` becomes the most recent follow-up's next step (the latest interaction
	defines what happens next); and `follow_up_state` is derived from all of it. Written with
	`update_modified=False` so logging a call does not bump the lead's timestamp and collide with a
	counsellor who has the lead open.
	"""
	if not enquiry or not frappe.db.exists("Admission Enquiry", enquiry):
		return

	rows = frappe.get_all(
		"Admission Follow-up",
		filters={"enquiry": enquiry},
		fields=["follow_up_on", "outcome", "next_follow_up_on"],
		order_by="follow_up_on desc",
	)

	latest = rows[0] if rows else None
	count = len(rows)
	next_follow_up = latest.next_follow_up_on if latest else None
	status = frappe.db.get_value("Admission Enquiry", enquiry, "status")

	frappe.db.set_value(
		"Admission Enquiry",
		enquiry,
		{
			"last_contacted_on": latest.follow_up_on if latest else None,
			"last_outcome": latest.outcome if latest else None,
			"follow_up_count": count,
			"next_follow_up": next_follow_up,
			"follow_up_state": derive_follow_up_state(status, next_follow_up, count),
		},
		update_modified=False,
	)
