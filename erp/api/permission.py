import frappe


def has_app_permission():
	"""Whether to show Erp on the /apps screen for the current user.

	Referenced by `add_to_apps_screen` in hooks.py and called during session boot,
	so an exception here fails the whole Desk login, not just the apps screen.
	"""
	return bool(frappe.session.user and frappe.session.user != "Guest")
