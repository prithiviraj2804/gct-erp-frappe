# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Institution branding for the sign-in screen.

The SPA renders `/login` to an anonymous visitor, so every fact it shows has to be readable
by Guest. That makes this module a deliberate, narrow hole in an otherwise closed app: it
publishes a hand-picked subset of one Institution record — the same facts that already sit on
that institution's letterhead, prospectus and public website — and nothing else.

What is NOT published, and must not be added: `registration_number`, `remarks`, the geo
coordinates, and the financial/academic year configuration. Nor any *names* of colleges,
campuses or departments — only how many there are.
"""

import json

import frappe
from frappe.utils import cstr

CACHE_KEY = "erp:login_branding"
# Short enough that a new College shows up in the scope strip within a coffee break, long
# enough that hammering /login never reaches the database. Institution edits bypass it
# entirely — see `clear_cache`, wired to doc_events in hooks.py.
CACHE_TTL = 300

MAX_ACCREDITATIONS = 6
MAX_ACCREDITATION_LEN = 40

# The allow-list. Adding a fieldname here makes it world-readable to anyone who can reach
# /login, which is the entire internet in a production deployment.
_PUBLIC_FIELDS = (
	"institution_name",
	"short_name",
	"institution_type",
	"logo",
	"favicon",
	"accreditation",
	"city",
	"state",
	"website",
	"email",
	"phone",
)

# Counted, never listed. Key is the client-facing name; value is the doctype.
_SCOPE_DOCTYPES = {
	"campuses": "Campus",
	"colleges": "College",
	"departments": "Department",
	"programmes": "Programme",
}


@frappe.whitelist(allow_guest=True, methods=["GET"])
def get_login_branding() -> dict:
	"""Identity for the sign-in screen: which institution this bench belongs to.

	Always answers 200 with the same shape. `institution` is None on a fresh bench that has no
	Institution record yet — the client falls back to the product's own mark rather than
	treating it as an error, because a sign-in form must render whatever branding does.
	"""
	cached = frappe.cache.get_value(CACHE_KEY)
	if cached is not None:
		return cached

	payload = _build()
	frappe.cache.set_value(CACHE_KEY, payload, expires_in_sec=CACHE_TTL)
	return payload


def clear_cache(doc=None, method=None) -> None:
	"""Drop the cached payload so an Institution edit is visible on the next page load.

	Wired to Institution writes in hooks.py. The TTL covers everything else: adding a College
	moves a count, and being five minutes stale about that is fine.
	"""
	frappe.cache.delete_value(CACHE_KEY)


def _build() -> dict:
	name = _resolve_institution()
	if not name:
		return {"institution": None, "scope": None}

	doc = frappe.db.get_value("Institution", name, _PUBLIC_FIELDS, as_dict=True)
	if not doc:
		return {"institution": None, "scope": None}

	return {
		"institution": {
			"name": doc.institution_name,
			"short_name": doc.short_name or None,
			"type": doc.institution_type or None,
			"logo": _guest_readable(doc.logo),
			"favicon": _guest_readable(doc.favicon),
			"accreditations": _accreditations(doc.accreditation),
			"location": ", ".join(p for p in (doc.city, doc.state) if p) or None,
			"website": doc.website or None,
			"support_email": doc.email or None,
			"support_phone": doc.phone or None,
		},
		"scope": _scope(name),
	}


def _resolve_institution() -> str | None:
	"""Which Institution brands the sign-in screen.

	One bench can hold several Institution rows: the doctype links to itself through
	`affiliated_university`, so a college group and the university it answers to are both
	stored here. The screen needs exactly one, picked the same way on every request:

	1. `erp_login_institution` in site_config.json, when it names a real record — the escape
	   hatch for a bench that genuinely holds more than one root.
	2. The oldest Active institution affiliated to nobody, i.e. the top of the tree.
	3. The oldest Active institution, for the degenerate case where every row is affiliated.

	`get_all` (not `get_list`) is load-bearing: it ignores permissions, and a Guest has no
	read access to Institution.
	"""
	override = frappe.conf.get("erp_login_institution")
	if override and frappe.db.exists("Institution", override):
		return override

	for filters in (
		{"status": "Active", "affiliated_university": ["is", "not set"]},
		{"status": "Active"},
	):
		found = frappe.get_all("Institution", filters=filters, pluck="name", order_by="creation asc", limit=1)
		if found:
			return found[0]

	return None


def _guest_readable(url: str | None) -> str | None:
	"""An attachment URL, but only when an anonymous browser can actually fetch it.

	Attach Image stores whatever the upload produced. A *private* upload lands under
	/private/files/ and is served through Frappe's permission check, so a Guest gets a 403 and
	the <img> renders as a broken image on the sign-in screen. Returning None instead is what
	lets the client fall back to the monogram — a designed state, not a failure.
	"""
	url = cstr(url).strip()
	if not url:
		return None

	return url if url.startswith(("http://", "https://", "/files/", "/assets/")) else None


def _accreditations(raw) -> list[str]:
	"""Flatten the free-form accreditation JSON into display chips.

	The field is a JSON column with no schema, so three shapes are all plausible things for an
	administrator to have entered, and all three have to work:

	    ["NAAC A++", "NBA"]
	    [{"body": "NAAC", "grade": "A++"}]
	    {"NAAC": "A++", "NBA": "Accredited"}

	Anything else yields an empty list. A sign-in screen must not 500 because a JSON field
	holds a typo, and the chips are hidden when the list is empty anyway.
	"""
	if isinstance(raw, str):
		try:
			raw = json.loads(raw) if raw.strip() else None
		except ValueError:
			return []

	if isinstance(raw, dict):
		items = [f"{key} {value}" if value else key for key, value in raw.items()]
	elif isinstance(raw, list):
		items = [_accreditation_label(entry) for entry in raw]
	else:
		return []

	clean = [" ".join(cstr(item).split())[:MAX_ACCREDITATION_LEN] for item in items if cstr(item).strip()]
	return clean[:MAX_ACCREDITATIONS]


def _accreditation_label(entry) -> str:
	if not isinstance(entry, dict):
		return cstr(entry)

	body = next((cstr(entry[key]) for key in ("body", "name", "agency") if entry.get(key)), "")
	grade = next((cstr(entry[key]) for key in ("grade", "value", "status") if entry.get(key)), "")
	return f"{body} {grade}".strip()


def _scope(institution: str) -> dict:
	"""How large this institution is, as four counts.

	Counts only — no names and no codes. That a group runs eleven colleges is on its own
	prospectus; which eleven is not something a signed-out visitor needs to learn.
	"""
	return {
		key: frappe.db.count(doctype, {"institution": institution, "status": "Active"})
		for key, doctype in _SCOPE_DOCTYPES.items()
	}
