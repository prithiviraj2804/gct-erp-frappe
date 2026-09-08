import frappe

# Roles that see every lead, not just their own. The per-trust scoping for an Admission
# Manager is not done here — it rides on a User Permission (Trust = X) that the framework
# ANDs into the query independently, so this hook only has to decide "own rows" vs "all rows".
# System Manager is the bench-wide super-admin and bypasses User Permissions entirely.
LEAD_ADMIN_ROLES = frozenset({"System Manager", "Admission Manager"})


def has_app_permission():
	"""Whether to show Erp on the /apps screen for the current user.

	Referenced by `add_to_apps_screen` in hooks.py and called during session boot,
	so an exception here fails the whole Desk login, not just the apps screen.
	"""
	return bool(frappe.session.user and frappe.session.user != "Guest")


def staff_for_user(user: str | None = None) -> str | None:
	"""The Active Staff record whose `user` is this login, or None.

	The bridge the whole lead-scoping rests on: a lead is owned by a `counsellor` (a Staff record),
	while the caller is a `User`, and `Staff.user` is the only thing joining the two. Memoised on
	`frappe.flags` because a single request can trigger several permission checks and each would
	otherwise repeat the lookup. `status = Active` is part of the match, so disabling a Staff record
	(offboarding) closes their access without touching the leads they owned.
	"""
	user = user or frappe.session.user
	cache = frappe.flags.setdefault("erp_user_staff", {})
	if user not in cache:
		cache[user] = frappe.db.get_value("Staff", {"user": user, "status": "Active"}, "name")
	return cache[user]


def _owner_scope_condition(user: str | None, table: str) -> str:
	"""Shared row filter for the counsellor-owned doctypes (Enquiry, Follow-up).

	An admin/manager gets `""` (every row, narrowed to their trust by their User Permission);
	a counsellor is pinned to `counsellor = <their staff>`; a login with the role but no Staff link
	fails closed to `1=0` — sees nothing, never everything.
	"""
	user = user or frappe.session.user
	if LEAD_ADMIN_ROLES & set(frappe.get_roles(user)):
		return ""

	staff = staff_for_user(user)
	if not staff:
		return "1=0"

	return f"`{table}`.counsellor = {frappe.db.escape(staff)}"


def _owner_has_permission(doc, ptype, user) -> bool:
	"""Shared per-document guard mirroring `_owner_scope_condition` for single-record access.

	A controller hook can only *deny*, never grant beyond the role/User-Permission checks the
	framework already ran, so returning True defers to those. `create` is deferred deliberately: an
	Enquiry has no owner until the manager assigns it, and a Follow-up's ownership is enforced in its
	own controller — gating creation here would wrongly block a counsellor. Ownership is read from
	the *stored* `counsellor`, not the in-memory value: `check_permission("write")` fires before the
	permlevel machinery reverts a field the caller may not edit, so comparing the posted value would
	refuse a counsellor their own save.
	"""
	if LEAD_ADMIN_ROLES & set(frappe.get_roles(user)):
		return True

	if ptype == "create":
		return True

	staff = staff_for_user(user)
	if not staff:
		return False

	owner = doc.counsellor if doc.is_new() else doc.get_db_value("counsellor")
	return owner == staff


# --- Admission Enquiry (the lead) -----------------------------------------------------


def admission_enquiry_query(user: str | None = None, **kwargs) -> str:
	"""`permission_query_conditions` for Admission Enquiry — governs lists, and so the SPA and Desk
	alike (both read over /api/resource)."""
	return _owner_scope_condition(user, "tabAdmission Enquiry")


def admission_enquiry_has_permission(doc, ptype=None, user=None, **kwargs) -> bool:
	"""`has_permission` for Admission Enquiry — the single-record mirror of the list filter."""
	return _owner_has_permission(doc, ptype, user)


# --- Admission Follow-up (the interaction log) ----------------------------------------


def admission_followup_query(user: str | None = None, **kwargs) -> str:
	"""`permission_query_conditions` for Admission Follow-up — scoped by the lead owner it carries,
	so a counsellor's timeline shows only their own leads' follow-ups."""
	return _owner_scope_condition(user, "tabAdmission Follow-up")


def admission_followup_has_permission(doc, ptype=None, user=None, **kwargs) -> bool:
	"""`has_permission` for Admission Follow-up — the single-record mirror of the list filter."""
	return _owner_has_permission(doc, ptype, user)


# --- Admission Application (the formal application) -----------------------------------


def admission_application_query(user: str | None = None, **kwargs) -> str:
	"""`permission_query_conditions` for Admission Application — scoped by the lead owner it carries.

	Without this an application would be the hole in the lead scoping: a counsellor barred from
	another counsellor's enquiry could read the same applicant's marks, documents and allotment
	through the application raised from it.
	"""
	return _owner_scope_condition(user, "tabAdmission Application")


def admission_application_has_permission(doc, ptype=None, user=None, **kwargs) -> bool:
	"""`has_permission` for Admission Application — the single-record mirror of the list filter."""
	return _owner_has_permission(doc, ptype, user)


def assert_trust_in_scope(trust: str) -> None:
	"""Apply the declarative tenant rule to a cross-doctype action.

	Doctype list scoping rides on User Permissions the framework ANDs into queries, but a whitelisted
	endpoint that writes across doctypes does its own reads and so escapes that. This is the same rule
	stated imperatively, for those call sites.

	System Manager acts for any tenant. Otherwise, if the caller carries Trust User Permissions,
	the target must be among them; a caller with no such permission is unrestricted — the same model
	the list scoping uses, where an absent restriction means "not restricted", not "restricted to
	nothing".
	"""
	if "System Manager" in frappe.get_roles():
		return

	allowed = frappe.get_all(
		"User Permission",
		filters={"user": frappe.session.user, "allow": "Trust"},
		pluck="for_value",
	)
	if allowed and trust not in allowed:
		frappe.throw(
			frappe._("You are not permitted to act for {0}.").format(frappe.bold(trust)),
			frappe.PermissionError,
		)
