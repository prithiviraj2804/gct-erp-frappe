# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

from erp.master.hierarchy import validate_same_parent


class Staff(Document):
	def validate(self):
		self.validate_hierarchy()

	def on_update(self):
		self.sync_institution_permission()

	def on_trash(self):
		self.revoke_institution_permission()

	def validate_hierarchy(self):
		"""`trust` is picked by hand here, not fetched, so it can flatly contradict
		`institution`. The Admission Gate Pass trusts a Staff record's `trust` to keep
		referrers inside one tenant, so this check is what makes that trust worth anything.
		"""
		validate_same_parent(self, "institution", "trust")

	# --- The User -> tenant bridge -------------------------------------------------------

	def sync_institution_permission(self):
		"""Keep this staff member's Institution User Permission in step with their record.

		`Staff.user` is the only thing joining a login to an institution, so it is also the only
		honest place to grant the User Permission that scopes them. Doing it here rather than by
		hand means provisioning cannot be forgotten — and because tenancy fails closed
		(`erp/api/permission.py:institution_scope_query`), a forgotten grant is not a silent
		over-permission but a user who can see nothing, which gets reported within the hour.

		Four transitions, each a real event in an institution's life:
		  * a staff member is given a login                    -> grant
		  * they transfer to another institution               -> the grant moves, it does not accrue
		  * their login is swapped for a different one         -> the old login loses its access
		  * they are offboarded, or the login is unlinked      -> revoke

		The previous login comes from `get_doc_before_save()`, not from `get_db_value()`. This runs
		in `on_update`, which is *after* the row is written, so `get_db_value("user")` already
		returns the new value and would report no change on the one edit that matters most — the
		offboarding that blanks `user`.

		A person serving two institutions is not representable: `Staff` is one row per person per
		institution and this grants exactly one. Recorded in docs/ROADMAP.md rather than papered
		over, because the fix is a real modelling change, not a flag.
		"""
		holder = self.user if (self.is_active() and self.user and self.institution) else None
		before = self.get_doc_before_save()
		previous = before.user if before else None

		# Whoever used to hold this record's access and no longer does loses all of it. This is
		# the unlink and the login-swap case, and it must not be narrowed by `keep` — the
		# institution is unchanged in both, so a keep would preserve exactly what we are revoking.
		if previous and previous != holder:
			self._revoke(previous)

		if not holder:
			if self.user:
				self._revoke(self.user)
			return

		# A transfer replaces rather than accumulates.
		self._revoke(holder, keep=self.institution)

		if not frappe.db.exists(
			"User Permission",
			{"user": holder, "allow": "Institution", "for_value": self.institution},
		):
			frappe.get_doc(
				{
					"doctype": "User Permission",
					"user": holder,
					"allow": "Institution",
					"for_value": self.institution,
					"apply_to_all_doctypes": 1,
				}
			).insert(ignore_permissions=True)

	def revoke_institution_permission(self):
		"""Withdraw access on delete, for the current login and the stored one alike."""
		before = self.get_doc_before_save()
		for user in {self.user, before.user if before else None} - {None, ""}:
			self._revoke(user)

	@staticmethod
	def _revoke(user: str, keep: str | None = None):
		"""Drop this login's Institution permissions, optionally sparing one institution."""
		for permission in frappe.get_all(
			"User Permission",
			filters={"user": user, "allow": "Institution"},
			fields=["name", "for_value"],
		):
			if keep and permission.for_value == keep:
				continue
			frappe.delete_doc("User Permission", permission.name, ignore_permissions=True, force=True)

	def is_active(self) -> bool:
		return self.status == "Active"
