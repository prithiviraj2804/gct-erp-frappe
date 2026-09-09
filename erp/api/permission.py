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


# --- Tenancy: the Institution boundary ----------------------------------------------------
#
# The tenancy boundary is Institution, NOT Trust. `Trust.assert_only_one` caps the site at one
# Trust row, so a User Permission on Trust selects every row in the database — it is not a
# restriction, it is a tautology. Scoping therefore keys on `institution`.
#
# Registered as `"*"` hooks rather than one entry per doctype. Frappe supports the wildcard for
# both (`database/query.py:1617` and `permissions.py:490`) and passes the doctype in, so a single
# pair of functions scopes every doctype that carries an `institution` column — including any
# added later, which is the point. A per-doctype list would be a list somebody forgets to append to,
# and the failure mode of forgetting is a silent cross-tenant read.

# Roles that act for every institution. A Trust Admin holds no User Permissions at all, which is
# precisely what makes them a superuser: `frappe.permissions` treats a user with no restriction
# rows as unrestricted. System Manager is the bench operator and bypasses User Permissions anyway.
TRUST_WIDE_ROLES = frozenset({"System Manager", "Trust Admin"})


def allowed_institutions(user: str | None = None) -> list[str]:
	"""The institutions this login may act for, from its User Permissions.

	Memoised on `frappe.flags` because a single request triggers this once per queried doctype and
	once per document check, and each would otherwise repeat the same lookup.
	"""
	user = user or frappe.session.user
	cache = frappe.flags.setdefault("erp_allowed_institutions", {})
	if user not in cache:
		cache[user] = frappe.get_all(
			"User Permission",
			filters={"user": user, "allow": "Institution"},
			pluck="for_value",
		)
	return cache[user]


def acts_for_any_institution(user: str | None = None) -> bool:
	"""Whether this login is unrestricted across institutions."""
	return bool(TRUST_WIDE_ROLES & set(frappe.get_roles(user or frappe.session.user)))


def _is_institution_scoped(doctype: str) -> bool:
	"""Whether `doctype` carries the tenancy column. Meta is cached, so this is a dict lookup."""
	try:
		return bool(frappe.get_meta(doctype).has_field("institution"))
	except Exception:
		# During install/migrate a doctype may be mid-import. Never let a permission hook be the
		# thing that breaks a migration; the query paths this guards are not live yet either.
		return False


def institution_scope_query(user: str | None = None, doctype: str | None = None) -> str:
	"""`permission_query_conditions` for every doctype carrying `institution`.

	Fails **closed**: a login that is not trust-wide and holds no Institution User Permission gets
	`1=0` and sees nothing. The alternative — treating "no restriction rows" as "unrestricted" —
	is what the superseded `assert_trust_in_scope` did, and it turns a half-provisioned account
	into a trust-wide one.

	For a child-table query Frappe calls this with the *parent* doctype and joins the child to it
	(`database/query.py:1548-1560`), so emitting `` `tab{doctype}`.institution `` is correct and
	must not be changed to assume the queried table.
	"""
	if not doctype or not _is_institution_scoped(doctype):
		return ""

	user = user or frappe.session.user
	if acts_for_any_institution(user):
		return ""

	allowed = allowed_institutions(user)
	if not allowed:
		return "1=0"

	values = ", ".join(frappe.db.escape(institution) for institution in allowed)
	return f"`tab{doctype}`.institution in ({values})"


def institution_has_permission(doc, ptype=None, user=None, **kwargs) -> bool:
	"""`has_permission` for every doctype carrying `institution` — the single-record mirror.

	A controller hook can only deny, never grant, so returning True defers to the checks the
	framework already ran. Reads the *stored* institution on an existing document: a caller who
	may not act for institution B must not be able to move a row there by posting B and having
	the check pass against the value they just typed.
	"""
	if not _is_institution_scoped(doc.doctype):
		return True

	user = user or frappe.session.user
	if acts_for_any_institution(user):
		return True

	allowed = allowed_institutions(user)
	if not allowed:
		return False

	institution = doc.get("institution") if doc.is_new() else doc.get_db_value("institution")
	if not institution:
		# A blank tenancy column is the hole this whole module exists to close: Frappe's own
		# user-permission clause is `IfNull(institution,'')='' OR institution IN (...)`
		# (`database/query.py:1503-1506`), so a blank row is readable by everyone. Deny here
		# rather than inherit that.
		return False

	return institution in allowed


def institution_sql_clause(alias: str, *, column: str = "institution") -> str:
	"""The one supported way to scope hand-written report SQL to the caller's institutions.

	A Query Report runs `frappe.db.sql(self.query, filters)` raw — `frappe/core/doctype/report/
	report.py:181` — so it bypasses `permission_query_conditions`, the `"*"` hook and User
	Permissions entirely. Reporting is the sanctioned escape hatch for analytics the list view
	cannot express, and without this it is also the escape hatch out of tenancy.

	Returns `1=1` for a caller who acts for every institution, `` `alias`.`column` IN (...) `` for a
	scoped one, and `1=0` for a login with no grant — the same fail-closed rule as the list filter,
	stated for SQL.

	Prefer `frappe.get_list`, which applies the hook for you and needs none of this. Reach for raw
	SQL only when an aggregate genuinely cannot be expressed otherwise, and then interpolate this
	into the WHERE clause.
	"""
	if acts_for_any_institution():
		return "1=1"

	allowed = allowed_institutions()
	if not allowed:
		return "1=0"

	values = ", ".join(frappe.db.escape(institution) for institution in allowed)
	return f"`{alias}`.`{column}` in ({values})"


def assert_signed_in() -> None:
	"""Refuse an anonymous caller with "sign in", not "not permitted".

	Five SPA endpoints used to throw `PermissionError("Not permitted")` for Guest — the same
	exception and the same words as a genuinely unpermitted user. Frappe maps `PermissionError` to
	403, the SPA maps 403 to its `permission` kind, and the screen therefore told a user whose
	session had simply expired that they lacked permission to see a doctype they administer. It was
	reported as exactly that: "the field policy doctype is showing as not permitted".

	`AuthenticationError` is a 401, which the SPA already has an `auth` kind for — so the two cases
	become distinguishable at the only place that can tell them apart. A wrong diagnosis is worse
	than a terse one: it sends someone to check DocPerms that were never the problem.
	"""
	if frappe.session.user == "Guest":
		frappe.throw(
			frappe._("Your session has ended. Sign in again."),
			frappe.AuthenticationError,
		)


def assert_institution_in_scope(institution: str) -> None:
	"""The tenant rule stated imperatively, for whitelisted endpoints that write across doctypes.

	Doctype scoping rides on hooks and User Permissions the framework ANDs into queries, but an
	endpoint that does its own reads and writes escapes all of that. These call sites are
	cross-doctype *writes*, which is why this fails closed: an empty allow-list denies.
	"""
	if acts_for_any_institution():
		return

	if institution not in allowed_institutions():
		frappe.throw(
			frappe._("You are not permitted to act for {0}.").format(frappe.bold(institution)),
			frappe.PermissionError,
		)


def assert_trust_in_scope(trust: str) -> None:
	"""Deprecated shim. Scoping moved from Trust to Institution — see erp/docs/DATA-MODEL.md.

	Kept for one release so a caller that still passes a trust is not silently unguarded. It
	cannot do anything useful: under a one-Trust site every caller is in scope for the only
	trust, which is exactly why the boundary moved. Callers must migrate to
	`assert_institution_in_scope`.
	"""
	if acts_for_any_institution():
		return

	if not allowed_institutions():
		frappe.throw(
			frappe._("You are not permitted to act for {0}.").format(frappe.bold(trust)),
			frappe.PermissionError,
		)
