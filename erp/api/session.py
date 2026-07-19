# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

import frappe


@frappe.whitelist(allow_guest=True, methods=["GET"])
def get_session() -> dict:
	"""Who the caller is, from the session cookie.

	`allow_guest` is deliberate and is the whole point of this endpoint. Frappe's own
	`frappe.auth.get_logged_user` is whitelisted *without* it, so an anonymous caller gets a
	403 — meaning "logged out" arrives as an error, which React Query retries and the browser
	logs to the console. Here logged-out is ordinary data (`user == "Guest"`), so the client
	can branch on it instead of catching.

	It also returns `full_name`, which the login response gives once and never again: after a
	page reload there is no other way to render the user's name without a second request.

	Exposes nothing a Guest could not already learn — for a Guest it reports "Guest".
	"""
	user = frappe.session.user

	if user == "Guest":
		return {"user": "Guest", "full_name": None, "roles": []}

	return {
		"user": user,
		"full_name": frappe.get_cached_value("User", user, "full_name"),
		"roles": frappe.get_roles(user),
	}
