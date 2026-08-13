# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Trimmed doctype schema for the SPA's generic list and record screens.

Not `frappe.desk.form.load.getdoctype`, which is whitelisted and would technically work: it
returns a `get_meta_bundle` — every DocField property, the permissions child table, user
settings, dashboard config — shaped for Desk's form renderer and running to tens of kilobytes
per doctype, almost none of which this app renders. It also does not apply
`get_permitted_fieldnames`, so a permlevel-restricted field would be published to a user who
cannot read it. This is the same call `navigation.py` makes against `get_desktop_page`.

This returns **no document data**. Rows still travel `/api/resource/<doctype>` with the
framework's own permission checks, which is what METHOD.md step 5 asks for — the rule there is
against wrapping `get_list`, and there is no list here. What the SPA cannot get from CRUD is
schema: labels, fieldtypes, section structure, which columns a list should show.

Scoped to this app's own modules deliberately. The SPA only renders doctypes reachable from an
erp Workspace, and leaving it unscoped would turn this into general Desk schema introspection
over every doctype on the site.
"""

import json
import re

import frappe
from frappe import _

from erp.api.modules import get_allowed_modules

# DocField properties the SPA renders. Everything else is Desk form machinery (`in_filter`,
# `bold`, `print_hide`, `translatable`, `permlevel`, `columns`, …) or database detail, and
# publishing it invites the renderer to grow a dependency on it.
_FIELD_PROPS = (
	"fieldname",
	"fieldtype",
	"label",
	"options",
	"default",
	"description",
	"reqd",
	"read_only",
	"hidden",
	"unique",
	"precision",
	"length",
	"fetch_from",
	"non_negative",
	"in_list_view",
	"in_standard_filter",
)

# Fields that structure a form rather than hold a value.
#
# Tab Break is NOT a Section Break. Collapsing the two loses a whole dimension of the authored
# form: a doctype that groups forty fields into four tabs would render as ten stacked cards,
# which is the difference between a record you can read and a wall. `_layout` therefore returns
# tabs containing sections, and a doctype with no Tab Break gets one implicit unlabelled tab —
# the same shape, and the same reasoning, as the implicit unlabelled section below it.
_TAB_TYPE = "Tab Break"
_SECTION_TYPE = "Section Break"
_LAYOUT_TYPES = {_TAB_TYPE, _SECTION_TYPE, "Column Break"}

# Fieldtypes whose value is rows in another doctype. Their schema has to travel with the
# parent's or the renderer has no labels for the grid it is about to draw.
_CHILD_TYPES = {"Table", "Table MultiSelect"}

# Every doctype in this app carries an `id` UUID column with `in_standard_filter: 1`, which is
# right for Desk and wrong here — it would put a filter box for an opaque machine identifier on
# all fourteen screens. It stays in `fields` (a record view should show it); it is only barred
# from the filter bar. See the `id` convention in CLAUDE.md.
_NEVER_FILTER = {"id"}

_EVAL = "eval:"

# `eval:doc.reference=='Staff Reference'` — quotes either way, whitespace tolerated.
_EQ = re.compile(r"^doc\.(\w+)\s*(==|!=)\s*(['\"])(.*?)\3$")
# `eval:['Direct Admission','Other'].includes(doc.reference)`
_IN = re.compile(r"^\[(.*?)\]\.includes\(\s*doc\.(\w+)\s*\)$")
# `eval:doc.vehicle`
_TRUTHY = re.compile(r"^doc\.(\w+)$")
_QUOTED = re.compile(r"['\"](.*?)['\"]")


def parse_condition(raw: str | None) -> dict | None:
	"""An `eval:` string as data, or None when there is no condition.

	Parsed here rather than in the browser because `depends_on` is authored in the Desk form
	builder and the set of expressions it can hold is open-ended. A parser in Python sits beside
	a test (`test_doctype.py`) asserting every expression in this app is one we support, so a
	newly-authored expression fails a test rather than silently degrading a screen months later.
	The SPA receives a discriminated union and never sees the word `eval`.

	Supports exactly the three shapes this app authors:

	    eval:doc.vehicle                        -> {"op": "truthy", "field": "vehicle"}
	    eval:doc.reference=='Staff Reference'   -> {"op": "eq", "field": …, "value": …}
	    eval:['A','B'].includes(doc.reference)  -> {"op": "in", "field": …, "values": [...]}

	Anything else returns `{"op": "unsupported", "raw": raw}`. Never raises: an expression we
	cannot read must degrade one field, not take down the screen it lives on.
	"""
	if not raw:
		return None

	expr = raw.strip()
	if not expr.startswith(_EVAL):
		# A bare fieldname is legal Frappe ("show when this field is truthy").
		if _TRUTHY.match(f"doc.{expr}"):
			return {"op": "truthy", "field": expr}
		return {"op": "unsupported", "raw": raw}

	expr = expr[len(_EVAL) :].strip()

	if match := _TRUTHY.match(expr):
		return {"op": "truthy", "field": match.group(1)}

	if match := _EQ.match(expr):
		return {
			"op": "eq" if match.group(2) == "==" else "neq",
			"field": match.group(1),
			"value": match.group(4),
		}

	if match := _IN.match(expr):
		return {
			"op": "in",
			"field": match.group(2),
			"values": _QUOTED.findall(match.group(1)),
		}

	return {"op": "unsupported", "raw": raw}


def parse_link_filters(raw: str | None) -> list[dict] | None:
	"""`link_filters` JSON as data, or None when there is none.

	Reimplemented rather than called, because there is no server-side implementation to call:
	`link_filters` appears nowhere in Frappe's Python model layer except a JSON-shape validator
	at `frappe/core/doctype/doctype/doctype.py`. Its only runtime consumer is the Desk link
	control (`frappe/public/js/frappe/form/controls/link.js`), which parses it and passes the
	result to `search_link`.

	So this is a **picker convenience, not a save-time guard** — nothing checks it on write,
	not in Frappe and not here. Tenant scoping is `validate_same_parent` in the controllers.
	See docs/DATA-MODEL.md.

	    [["Campus","institution","=","eval:doc.institution"]]
	        -> {"fieldname": "institution", "operator": "=", "from_field": "institution"}
	    [["College","status","=","Active"]]
	        -> {"fieldname": "status", "operator": "=", "value": "Active"}
	"""
	if not raw:
		return None

	try:
		rows = json.loads(raw)
	except (ValueError, TypeError):
		return None

	if not isinstance(rows, list):
		return None

	filters = []
	for row in rows:
		# The Desk shape is [doctype, fieldname, operator, value]; the leading doctype is the
		# link target and is redundant here, since the field already names it.
		if not isinstance(row, list) or len(row) != 4:
			continue

		_target, fieldname, operator, value = row
		if isinstance(value, str) and value.startswith(_EVAL):
			condition = parse_condition(value)
			if not condition or condition["op"] != "truthy":
				# Only `eval:doc.<field>` appears in this app. Anything richer is dropped
				# rather than guessed at — a wrong filter silently hides valid options.
				continue
			filters.append(
				{"fieldname": fieldname, "operator": operator, "from_field": condition["field"]}
			)
		else:
			filters.append({"fieldname": fieldname, "operator": operator, "value": value})

	return filters or None


def _field(df) -> dict:
	"""One DocField, trimmed, with its `eval:` strings already parsed into data."""
	out = {prop: df.get(prop) for prop in _FIELD_PROPS}
	out["depends_on"] = parse_condition(df.get("depends_on"))
	out["mandatory_depends_on"] = parse_condition(df.get("mandatory_depends_on"))
	out["link_filters"] = parse_link_filters(df.get("link_filters"))
	return out


def _layout(fields: list[dict]) -> list[dict]:
	"""Tab -> section -> columns -> fieldnames, for the record view.

	Three nested groupings, all authored in the Desk form builder and all of them meaning
	something to a reader:

	    Tab Break    -> a tab, shown as a tab strip when there is more than one
	    Section Break-> a card, with its own heading and `collapsible` flag
	    Column Break -> a column INSIDE that card

	Fields before any break belong to an implicit unlabelled tab and an implicit unlabelled
	section — the same shape, and the same reasoning, as the implicit group in
	`navigation.py.get_module_menu`.

	The column split is returned as authored rather than flattened, because a two-column
	section and a three-column section are different instructions and the renderer cannot
	recover the difference once it is lost.

	`hidden` fields (`naming_series`) stay in `fields` so a renderer can still read their
	default, but never appear here. Empty columns, sections and tabs are dropped, or the form
	shows a heading — or worse, a tab — over nothing.
	"""
	tabs: list[dict] = []
	tab: dict | None = None
	section: dict | None = None

	def start_tab(label=None):
		nonlocal tab, section
		tab = {"label": label, "sections": []}
		tabs.append(tab)
		section = None

	def start_section(label=None, collapsible=0):
		nonlocal section
		if tab is None:
			start_tab()
		section = {"label": label, "collapsible": bool(collapsible), "columns": [[]]}
		tab["sections"].append(section)

	for df in fields:
		fieldtype = df["fieldtype"]

		if fieldtype == _TAB_TYPE:
			start_tab(df.get("label"))
			continue

		if fieldtype == _SECTION_TYPE:
			start_section(df.get("label"), df.get("collapsible"))
			continue

		if fieldtype == "Column Break":
			if section is None:
				start_section()
			section["columns"].append([])
			continue

		if df.get("hidden"):
			continue

		if section is None:
			start_section()
		section["columns"][-1].append(df["fieldname"])

	for candidate in tabs:
		for child in candidate["sections"]:
			child["columns"] = [column for column in child["columns"] if column]
		candidate["sections"] = [child for child in candidate["sections"] if child["columns"]]

	return [candidate for candidate in tabs if candidate["sections"]]


def _child_schema(doctype: str) -> dict:
	"""Enough of a child doctype to draw its grid.

	No permission check of its own, deliberately: a child doctype has no independent
	permissions in Frappe — `frappe.has_permission` on one resolves against its parent — and
	the caller has already been cleared to read that parent. Checking here would either be a
	no-op or, worse, refuse a table the user can already see through `/api/resource`.

	Only the columns a grid shows. `in_list_view` on a child doctype is exactly the "show this
	in the grid" flag Desk uses, so it is read rather than restated; the fallback covers a
	child authored without it, which would otherwise render as a table with no columns.
	"""
	meta = frappe.get_meta(doctype)
	fields = [
		_field(df) for df in meta.fields if df.fieldtype not in _LAYOUT_TYPES and not df.hidden
	]

	columns = [df["fieldname"] for df in fields if df["in_list_view"]]
	if not columns:
		columns = [df["fieldname"] for df in fields[:4]]

	return {"doctype": doctype, "label": _(doctype), "fields": fields, "columns": columns}


def _list_columns(meta, permitted: set) -> list[str]:
	"""Default table columns, in order, identity first.

	The first column is the row's identity and is what links to the record: `title_field` when
	there is one, else `name` — the same choice Desk's own list view makes. Every other
	`in_list_view` field follows in field order, with the identity removed so a doctype whose
	title field is also flagged does not print it twice.

	`in_list_view` is authored on all fourteen doctypes today, so the fallback below has never
	fired. It exists so a doctype added without it degrades to a usable column rather than a
	table with no columns at all.
	"""
	identity = meta.get_title_field()
	if identity != "name" and identity not in permitted:
		identity = "name"

	columns = [identity]
	columns += [
		df.fieldname
		for df in meta.fields
		if df.in_list_view
		and df.fieldname != identity
		and df.fieldname in permitted
		and df.fieldtype not in _LAYOUT_TYPES
	]

	if len(columns) == 1:
		fallback = next(
			(
				df.fieldname
				for df in meta.fields
				if df.reqd and df.fieldtype == "Data" and df.fieldname in permitted
			),
			None,
		)
		if fallback and fallback != identity:
			columns.append(fallback)

	return columns


@frappe.whitelist(methods=["GET"])
def get_doctype_schema(doctype: str) -> dict:
	"""Everything the generic renderer needs to draw one doctype, and nothing else.

	Fails closed three ways: Guest is refused, a doctype outside this app's modules is refused,
	and `has_permission(read)` is refused. The middle one matters — without it any logged-in
	user could read the schema of every doctype on the site, including Frappe's own.

	`permissions` is advisory: it decides which buttons render, and guards nothing. The
	framework re-checks on every write, which is the only check that counts.
	"""
	if frappe.session.user == "Guest":
		frappe.throw(_("Not permitted"), frappe.PermissionError)

	if not frappe.db.exists("DocType", doctype):
		frappe.throw(_("DocType {0} not found").format(doctype), frappe.DoesNotExistError)

	meta = frappe.get_meta(doctype)

	allowed = {module["name"] for module in get_allowed_modules()}
	if meta.module not in allowed:
		frappe.throw(_("{0} is not available").format(_(doctype)), frappe.PermissionError)

	if not frappe.has_permission(doctype, "read"):
		frappe.throw(_("Not permitted"), frappe.PermissionError)

	# permlevel > 0 is unused across every doctype in this app today, so this is currently a
	# no-op. It is here because the day someone adds `permlevel: 1` to a salary field, the
	# alternative is publishing its label to everyone who can open the screen.
	#
	# It does NOT decide child tables, and cannot. `get_permitted_fieldnames` is built from
	# `get_fieldnames_with_value`, and `Table` / `Table MultiSelect` are in Frappe's own
	# `NO_VALUE_FIELDS` — a child table holds rows in another table, not a column on this one,
	# so the framework never lists one as a permitted *field*. Filtering on it therefore
	# dropped every Table field from `fields`, which left `child_schemas` permanently `{}` and
	# the SPA's child grid unreachable: the renderer looked up `child_schemas[options]`, found
	# nothing, and fell through. Child tables are admitted by fieldtype instead, which is the
	# same rule Desk applies — a child doctype has no permissions of its own, it resolves
	# against its parent, and the caller has already been cleared to read that parent.
	# `_child_schema` says the same thing from the other end.
	permitted = set(meta.get_permitted_fieldnames(permission_type="read"))

	fields = [
		_field(df)
		for df in meta.fields
		if df.fieldtype in _LAYOUT_TYPES
		or df.fieldtype in _CHILD_TYPES
		or df.fieldname in permitted
	]

	# Fetched with the parent rather than on demand: a child grid is part of the record, so a
	# second round-trip on open would show an empty table for a beat on every record that has
	# one. Keyed by child doctype, not by fieldname, because two Table fields can point at the
	# same child and the schema is identical either way.
	child_schemas = {}
	for df in fields:
		child = df["options"]
		if df["fieldtype"] in _CHILD_TYPES and child and child not in child_schemas:
			child_schemas[child] = _child_schema(child)

	return {
		"doctype": doctype,
		"module": meta.module,
		"label": _(doctype),
		"title_field": meta.get_title_field(),
		# `field:`/`format:` naming means the identity IS a business column, and it is computed
		# on insert and never recomputed — so the SPA has to lock those fields after create.
		# It reads the rule from here rather than re-deriving it. See docs/DATA-MODEL.md.
		"autoname": meta.autoname,
		"is_submittable": bool(meta.is_submittable),
		"fields": fields,
		# Tabs, each holding sections, each holding columns. See `_layout`.
		"layout": _layout(fields),
		"child_schemas": child_schemas,
		"list_columns": _list_columns(meta, permitted),
		"filter_fields": [
			df.fieldname
			for df in meta.fields
			if df.in_standard_filter
			and df.fieldname not in _NEVER_FILTER
			and df.fieldname in permitted
			and df.fieldtype not in _LAYOUT_TYPES
		],
		# get_search_fields() appends `name` and splits the authored string, but does not check
		# that each entry still exists — a renamed field would otherwise produce a 500 on every
		# search, so filter against the permitted set.
		"search_fields": [f for f in meta.get_search_fields() if f == "name" or f in permitted],
		"sort_field": meta.sort_field or "modified",
		"sort_order": (meta.sort_order or "desc").lower(),
		"permissions": {
			"can_create": bool(frappe.has_permission(doctype, "create")),
			"can_write": bool(frappe.has_permission(doctype, "write")),
			"can_delete": bool(frappe.has_permission(doctype, "delete")),
		},
	}
