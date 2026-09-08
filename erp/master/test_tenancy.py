# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""The Institution tenancy boundary: who can see whose rows.

The boundary is **Institution**, not Trust. A site holds one Trust, so a User Permission on Trust
selects every row in the database — it is a tautology, not a restriction. These tests exercise the
mechanism that replaced it: a `"*"` `permission_query_conditions` hook that scopes every doctype
carrying an `institution` column.

`Staff` is the doctype under test precisely because it has **no** named permission hook of its own.
If it is scoped, the wildcard is doing the work, which is what makes the boundary automatic for
doctypes added later.
"""

import frappe
from frappe.tests import IntegrationTestCase

from erp.api.permission import assert_institution_in_scope


class IntegrationTestInstitutionTenancy(IntegrationTestCase):
	TRUST = "ZT1"
	INST_A = "ZTA"
	INST_B = "ZTB"

	SCOPED = "zt-scoped-a@example.com"
	UNSCOPED = "zt-unscoped@example.com"
	TRUST_ADMIN = "zt-trust-admin@example.com"

	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		cls.ensure("Trust", cls.TRUST, {"trust_code": cls.TRUST, "trust_name": "Tenancy Trust"})
		for code in (cls.INST_A, cls.INST_B):
			cls.ensure(
				"Institution",
				code,
				{
					"trust": cls.TRUST,
					"institution_code": code,
					"institution_name": f"{code} Institution",
					"institution_type": "Engineering",
				},
			)

		# Data rows, deliberately with no `user`, so they are subjects of the scoping rather than
		# participants in the provisioning it drives.
		cls.staff_a = cls.make_staff("ZTSA", cls.INST_A)
		cls.staff_b = cls.make_staff("ZTSB", cls.INST_B)

		# Gate Security carries a read DocPerm on Staff. The tenancy roles are about *which rows*,
		# never *which doctypes*, so a scoped login still needs an ordinary functional role.
		cls.make_user(cls.SCOPED, ["Gate Security"])
		cls.grant(cls.SCOPED, cls.INST_A)
		cls.make_user(cls.UNSCOPED, ["Gate Security"])
		cls.make_user(cls.TRUST_ADMIN, ["Gate Security", "Trust Admin"])

	# --- Fixtures -------------------------------------------------------------------

	@staticmethod
	def ensure(doctype, name, values):
		if frappe.db.exists(doctype, name):
			return name
		return frappe.get_doc({"doctype": doctype, **values}).insert(ignore_permissions=True).name

	@classmethod
	def make_staff(cls, code, institution, user=None):
		values = {
			"doctype": "Staff",
			"trust": cls.TRUST,
			"institution": institution,
			"staff_code": code,
			"staff_name": code,
			"status": "Active",
		}
		if user:
			values["user"] = user
		return frappe.get_doc(values).insert(ignore_permissions=True).name

	@classmethod
	def make_user(cls, email, roles):
		if frappe.db.exists("User", email):
			return email
		user = frappe.new_doc("User")
		user.email = email
		user.first_name = email.split("@")[0]
		for role in roles:
			user.append("roles", {"role": role})
		user.flags.no_welcome_mail = True
		user.insert(ignore_permissions=True)
		return email

	@classmethod
	def grant(cls, email, institution):
		frappe.get_doc(
			{
				"doctype": "User Permission",
				"user": email,
				"allow": "Institution",
				"for_value": institution,
				"apply_to_all_doctypes": 1,
			}
		).insert(ignore_permissions=True)

	def visible_staff(self, user):
		frappe.set_user(user)
		try:
			return set(frappe.get_list("Staff", pluck="name"))
		finally:
			frappe.set_user("Administrator")

	# --- The boundary ---------------------------------------------------------------

	def test_a_scoped_login_sees_only_its_own_institutions_rows(self):
		"""The whole point. Staff has no named hook, so this proves the wildcard scopes it."""
		visible = self.visible_staff(self.SCOPED)
		self.assertIn(self.staff_a, visible)
		self.assertNotIn(self.staff_b, visible)

	def test_a_login_with_no_institution_permission_sees_nothing(self):
		"""Fails closed.

		The superseded rule read "no restriction rows means unrestricted", which is Frappe's own
		default and is right for a superuser — but it also silently promoted every
		half-provisioned account to trust-wide. Absent a trust-wide role, absent a grant now means
		absent access.
		"""
		self.assertEqual(self.visible_staff(self.UNSCOPED), set())

	def test_a_trust_admin_sees_every_institution(self):
		"""A Trust Admin holds no User Permission at all — that is what makes them one."""
		visible = self.visible_staff(self.TRUST_ADMIN)
		self.assertIn(self.staff_a, visible)
		self.assertIn(self.staff_b, visible)

	# --- The imperative guard, for endpoints that write across doctypes --------------

	def test_assert_institution_in_scope_denies_an_empty_allow_list(self):
		"""Regression: the superseded guard read `if allowed and institution not in allowed`, so a
		caller holding no permission rows passed every check. Its three call sites are
		cross-doctype *writes*."""
		frappe.set_user(self.UNSCOPED)
		try:
			with self.assertRaises(frappe.PermissionError):
				assert_institution_in_scope(self.INST_A)
		finally:
			frappe.set_user("Administrator")

	def test_assert_institution_in_scope_refuses_another_institution(self):
		frappe.set_user(self.SCOPED)
		try:
			assert_institution_in_scope(self.INST_A)
			with self.assertRaises(frappe.PermissionError):
				assert_institution_in_scope(self.INST_B)
		finally:
			frappe.set_user("Administrator")

	def test_a_trust_admin_may_act_for_any_institution(self):
		frappe.set_user(self.TRUST_ADMIN)
		try:
			assert_institution_in_scope(self.INST_A)
			assert_institution_in_scope(self.INST_B)
		finally:
			frappe.set_user("Administrator")

	# --- Provisioning: Staff is the User -> tenant bridge ----------------------------

	def _permissions_for(self, email):
		return set(
			frappe.get_all(
				"User Permission", filters={"user": email, "allow": "Institution"}, pluck="for_value"
			)
		)

	def test_staff_grants_moves_and_revokes_the_institution_permission(self):
		email = self.make_user("zt-bridge@example.com", ["Gate Security"])
		staff = frappe.get_doc("Staff", self.make_staff("ZTSBRIDGE", self.INST_A, user=email))
		self.assertEqual(self._permissions_for(email), {self.INST_A})

		# A transfer replaces the grant rather than adding to it — otherwise the transferred
		# staff member keeps reading their old institution for ever.
		staff.institution = self.INST_B
		staff.save(ignore_permissions=True)
		self.assertEqual(self._permissions_for(email), {self.INST_B})

		# Offboarding closes the access without deleting the record they owned.
		staff.status = "Inactive"
		staff.save(ignore_permissions=True)
		self.assertEqual(self._permissions_for(email), set())

	def test_unlinking_the_login_revokes_the_permission_it_was_given(self):
		"""Blanking `user` must still revoke, which means reading the stored value, not the
		in-memory one — the edit most likely to be an offboarding."""
		email = self.make_user("zt-unlink@example.com", ["Gate Security"])
		staff = frappe.get_doc("Staff", self.make_staff("ZTSUNLINK", self.INST_A, user=email))
		self.assertEqual(self._permissions_for(email), {self.INST_A})

		staff.user = None
		staff.save(ignore_permissions=True)
		self.assertEqual(self._permissions_for(email), set())

	# --- The empty-value hole (slice 2) ----------------------------------------------

	def test_strict_user_permissions_is_enabled(self):
		"""A guard, not a behaviour test.

		Everything below depends on this flag. Without it Frappe ANDs
		`IfNull(institution,'') = '' OR institution IN (...)` into every scoped query
		(`frappe/database/query.py:1501-1506`) and the left half hands every blank row to
		everybody. If someone turns this off in System Settings, this test is what says so.
		"""
		self.assertTrue(frappe.db.get_single_value("System Settings", "apply_strict_user_permissions"))

	def test_a_blank_institution_row_is_invisible_to_a_scoped_login(self):
		"""The hole slice 2 closes.

		Written with raw SQL precisely because the ORM can no longer produce this row — the column
		is `reqd: 1` now. What is being tested is the rows that predate that rule, and any that a
		future direct write might leave behind.
		"""
		orphan = self.make_staff("ZTSORPHAN", self.INST_A)
		frappe.db.sql("UPDATE `tabStaff` SET institution = '' WHERE name = %s", orphan)

		self.assertNotIn(orphan, self.visible_staff(self.SCOPED))
		# ... and it is not merely hidden from everyone: a trust-wide login still sees it, which is
		# what makes it fixable rather than lost.
		self.assertIn(orphan, self.visible_staff(self.TRUST_ADMIN))

	def test_a_blank_institution_document_is_denied_to_a_scoped_login(self):
		"""The single-document mirror. A list filter that hides a row is worth little if
		`/api/resource/Staff/<name>` still returns it."""
		orphan = self.make_staff("ZTSORPHANDOC", self.INST_A)
		frappe.db.sql("UPDATE `tabStaff` SET institution = '' WHERE name = %s", orphan)

		frappe.set_user(self.SCOPED)
		try:
			self.assertFalse(frappe.has_permission("Staff", doc=orphan, ptype="read"))
		finally:
			frappe.set_user("Administrator")

	def test_every_institution_scoped_doctype_requires_its_tenant(self):
		"""No new holes. A nullable tenancy column is not "not filled in yet" — it is a row every
		institution can read, so the schema has to refuse one."""
		from erp.patches.v1_0.enable_strict_user_permissions import INSTITUTION_SCOPED

		nullable = [
			doctype
			for doctype in INSTITUTION_SCOPED
			if not frappe.get_meta(doctype).get_field("institution").reqd
		]
		self.assertEqual(nullable, [])

	# --- The roles stand on their own (slice 3) --------------------------------------

	def test_an_institution_admin_needs_no_other_role(self):
		"""Until the DocPerms landed, `Institution Admin` granted rows but no doctypes, so it had
		to be paired with a functional role to be worth anything. It should run an institution by
		itself."""
		email = self.make_user("zt-inst-admin@example.com", ["Institution Admin"])
		self.grant(email, self.INST_A)

		visible = self.visible_staff(email)
		self.assertIn(self.staff_a, visible)
		self.assertNotIn(self.staff_b, visible)

	def test_a_trust_admin_needs_no_other_role(self):
		email = self.make_user("zt-trust-only@example.com", ["Trust Admin"])

		visible = self.visible_staff(email)
		self.assertIn(self.staff_a, visible)
		self.assertIn(self.staff_b, visible)

	def test_an_institution_admin_may_not_create_an_institution(self):
		"""Standing up a new institution is a trust-level act. They may edit their own — contact
		details, logo — which is why `write` is granted and `create` is not."""
		email = self.make_user("zt-inst-admin-2@example.com", ["Institution Admin"])
		self.grant(email, self.INST_A)

		frappe.set_user(email)
		try:
			self.assertFalse(frappe.has_permission("Institution", "create"))
			self.assertTrue(frappe.has_permission("Institution", "write", doc=self.INST_A))
		finally:
			frappe.set_user("Administrator")

	def test_an_institution_admin_may_not_redefine_shared_vocabulary(self):
		"""`Institution Type` and the other trust-global masters are shared by every institution,
		so one institution's admin must not be able to change them for everybody."""
		email = self.make_user("zt-inst-admin-3@example.com", ["Institution Admin"])
		self.grant(email, self.INST_A)

		frappe.set_user(email)
		try:
			self.assertTrue(frappe.has_permission("Institution Type", "read"))
			self.assertFalse(frappe.has_permission("Institution Type", "write"))
			self.assertFalse(frappe.has_permission("Programme Level", "write"))
		finally:
			frappe.set_user("Administrator")
