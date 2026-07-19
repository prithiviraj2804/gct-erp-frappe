# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

import frappe
from frappe import _

from erp.api.modules import get_allowed_modules
from erp.utils import slugify


def _restricted_doctypes() -> set:
	"""Doctypes not excluded by the site's active domains.

	Reuses Frappe's own cache. The name is the framework's and is a misnomer: membership
	means "allowed", not "restricted" — a doctype with no `restrict_to_domain` matches via
	the empty string that `get_active_domains()` appends.
	"""
	from frappe.cache_manager import build_domain_restricted_doctype_cache

	return set(
		frappe.cache.get_value("domain_restricted_doctypes") or build_domain_restricted_doctype_cache()
	)


def _is_doctype_allowed(doctype: str) -> bool:
	"""Whether the current user may see a menu link pointing at `doctype`.

	Reimplements the DocType branch of `frappe.desk.desk_views.DeskViews.is_item_allowed`
	rather than calling it: that method reads `self.can_read`, which `DeskViews.__init__`
	never sets — its own docstring says it "relies on the consumer setting can_read", and
	both framework callers inject it by hand. Calling it directly raises AttributeError.

	`frappe.has_permission` is the authority here; the domain check only removes doctypes
	the site has switched off.
	"""
	if frappe.session.user == "Administrator":
		return True

	try:
		# frappe.has_permission (the top-level wrapper) takes no `print_logs` — that kwarg
		# only exists on frappe.permissions.has_permission.
		return doctype in _restricted_doctypes() and frappe.has_permission(doctype, "read")
	except frappe.DoesNotExistError:
		# A link pointing at a deleted doctype must not break the whole menu.
		frappe.clear_last_message()
		return False


def _is_workspace_permitted(workspace_name: str) -> bool:
	"""Mirror of `Workspace.is_permitted()` (frappe/desk/desktop.py:59-74).

	An EMPTY roles table means "everyone" — not "no one". Getting this backwards would
	hide every workspace we ship, since we do not set roles on them.
	"""
	roles = frappe.get_all(
		"Has Role", filters={"parent": workspace_name, "parenttype": "Workspace"}, pluck="role"
	)
	if not roles:
		return True

	return bool(set(roles) & set(frappe.get_roles()))


def _menu_item(link, module_slug: str) -> dict | None:
	"""Map a Workspace Link row to an SPA menu item, or None if it isn't permitted."""
	if link.get("hidden"):
		return None

	link_type = link.get("link_type")
	link_to = link.get("link_to")

	if link_type == "DocType":
		if not link_to or not _is_doctype_allowed(link_to):
			return None
		slug = slugify(link_to)
		# The module comes from the WORKSPACE, not from the doctype's own module. A
		# workspace may link to a doctype owned elsewhere; routing by the doctype's module
		# would make clicking a link inside one module jump the rail to another.
		route = f"/{module_slug}/{slug}"
	else:
		# Page/Report links have no SPA equivalent yet. Surfaced without a route so the UI
		# can show them as unavailable rather than silently dropping them.
		slug = None
		route = None

	return {
		"label": link.get("label"),
		"icon": link.get("icon"),
		"link_type": link_type,
		"link_to": link_to,
		"slug": slug,
		"route": route,
		"description": link.get("description"),
	}


@frappe.whitelist(methods=["GET"])
def get_module_rail() -> list[dict]:
	"""Modules for the icon rail, in display order.

	Layers workspace metadata onto `get_allowed_modules()` rather than re-deriving the
	block_modules denylist, so module visibility has exactly one implementation.
	"""
	if frappe.session.user == "Guest":
		frappe.throw(_("Not permitted"), frappe.PermissionError)

	rail = []
	for module in get_allowed_modules():
		workspace = frappe.get_all(
			"Workspace",
			filters={"module": module["name"], "public": 1, "is_hidden": 0},
			fields=["name", "label", "icon", "sequence_id"],
			order_by="sequence_id asc",
			limit=1,
			ignore_permissions=True,
		)
		# A module with no workspace has nothing to navigate to, so it never reaches the
		# rail (this is why `Erp` is absent). It still appears on the launcher, which lists
		# modules rather than menus.
		if not workspace or not _is_workspace_permitted(workspace[0]["name"]):
			continue

		rail.append(
			{
				"module": module["name"],
				"slug": slugify(module["name"]),
				"label": workspace[0]["label"] or module["module_name"].replace("_", " "),
				"icon": workspace[0]["icon"],
				"sequence_id": workspace[0]["sequence_id"] or 0,
			}
		)

	# Order by the workspace's sequence_id, NOT the module name. get_allowed_modules is
	# alphabetical, which would put an empty "Gate_Entry" ahead of "Master" and make the
	# shell open on an empty menu. sequence_id is the field that exists to control this.
	rail.sort(key=lambda m: (m["sequence_id"], m["label"]))

	return rail


@frappe.whitelist(methods=["GET"])
def get_module_menu(module: str) -> dict:
	"""The permission-filtered menu for one module.

	Not frappe's `get_workspaces()`/`get_desktop_page()`: those return Desk-shaped payloads
	(content blocks, charts, number cards, onboarding) that we would only discard, and
	`get_desktop_page` wants a JSON string of a whole page dict. Neither yields SPA routes.

	Returns `doctype_by_slug` so the frontend can resolve a deep-linked URL segment back to
	a doctype without a second round-trip — and, usefully, that map only ever contains
	permitted doctypes, so an unpermitted deep link fails closed as a 404.
	"""
	if frappe.session.user == "Guest":
		frappe.throw(_("Not permitted"), frappe.PermissionError)

	allowed = {m["name"] for m in get_allowed_modules()}
	if module not in allowed:
		frappe.throw(_("Module {0} is not available").format(module), frappe.PermissionError)

	workspaces = frappe.get_all(
		"Workspace",
		filters={"module": module, "public": 1, "is_hidden": 0},
		fields=["name", "label", "icon"],
		order_by="sequence_id asc",
		limit=1,
		# Deliberate, and the same choice frappe makes at desktop.py:432 — Workspace's own
		# DocPerms gate the Workspace *editor* (Workspace Manager), not who may read a menu.
		# Real gating is _is_workspace_permitted + per-link _is_doctype_allowed below.
		ignore_permissions=True,
	)

	module_slug = slugify(module)
	base = {
		"module": module,
		"module_slug": module_slug,
		"label": module.replace("_", " "),
		"icon": None,
		"groups": [],
		"doctype_by_slug": {},
	}

	if not workspaces or not _is_workspace_permitted(workspaces[0]["name"]):
		return base

	workspace = frappe.get_cached_doc("Workspace", workspaces[0]["name"])
	base["label"] = workspaces[0]["label"] or base["label"]
	base["icon"] = workspaces[0]["icon"]

	groups: list[dict] = []
	current: dict | None = None

	for link in workspace.links:
		# "Card Break" rows are group headers, not links.
		if link.type == "Card Break":
			current = {"label": link.label, "icon": link.icon, "items": []}
			groups.append(current)
			continue

		item = _menu_item(link.as_dict(), module_slug)
		if not item:
			continue

		if current is None:
			# Links before any Card Break belong to an implicit unlabelled group.
			current = {"label": None, "icon": None, "items": []}
			groups.append(current)

		current["items"].append(item)
		if item["slug"] and item["link_type"] == "DocType":
			base["doctype_by_slug"][item["slug"]] = item["link_to"]

	# Drop groups whose every link was filtered out, or the menu shows headers over nothing.
	base["groups"] = [g for g in groups if g["items"]]

	return base
