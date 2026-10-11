# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

import frappe

TRUST_WIDE_ROLES = frozenset({"System Manager", "Trust Admin"})


def has_app_permission():
	return bool(frappe.session.user and frappe.session.user != "Guest")


def allowed_institutions(user: str | None = None) -> list[str]:
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
	return bool(TRUST_WIDE_ROLES & set(frappe.get_roles(user or frappe.session.user)))


def _is_institution_scoped(doctype: str) -> bool:
	try:
		return bool(frappe.get_meta(doctype).has_field("institution"))
	except Exception:
		return False


def institution_scope_query(user: str | None = None, doctype: str | None = None) -> str:
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
	if not _is_institution_scoped(doc.doctype):
		return True

	user = user or frappe.session.user
	if acts_for_any_institution(user):
		return True

	allowed = allowed_institutions(user)
	if not allowed:
		return False

	institution = doc.get("institution") if doc.is_new() else doc.get_db_value("institution")
	return bool(institution and institution in allowed)


def assert_signed_in() -> None:
	if frappe.session.user == "Guest":
		frappe.throw(
			frappe._("Your session has ended. Sign in again."),
			frappe.AuthenticationError,
		)


def assert_institution_in_scope(institution: str) -> None:
	if acts_for_any_institution():
		return

	if institution not in allowed_institutions():
		frappe.throw(
			frappe._("You are not permitted to act for {0}.").format(frappe.bold(institution)),
			frappe.PermissionError,
		)
