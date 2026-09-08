# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

import frappe
from frappe.tests import IntegrationTestCase

from erp.api.doctype import get_doctype_schema, parse_condition, parse_link_filters
from erp.api.modules import APP_NAME

# Fieldtypes the SPA's generic renderer knows how to draw. Kept here rather than in
# doctype.py because it is an assertion about the app, not a runtime rule: the endpoint
# publishes whatever a doctype declares, and this list is what says we have looked at it.
SUPPORTED_FIELDTYPES = {
	"Attach Image",
	"Check",
	"Color",
	"Column Break",
	"Currency",
	"Data",
	"Date",
	"Datetime",
	"Float",
	"Int",
	"JSON",
	"Link",
	"Section Break",
	"Select",
	"Small Text",
	"Tab Break",
	"Table",
	"Table MultiSelect",
	"Text",
}


def _laid_out(schema: dict) -> set:
	"""Every fieldname the layout places, across every tab, section and column."""
	return {
		fieldname
		for tab in schema["layout"]
		for section in tab["sections"]
		for column in section["columns"]
		for fieldname in column
	}


def _app_doctypes() -> list[str]:
	modules = frappe.get_all("Module Def", filters={"app_name": APP_NAME}, pluck="name")
	return frappe.get_all("DocType", filters={"module": ["in", modules]}, pluck="name")


class TestDoctypeSchema(IntegrationTestCase):
	"""The endpoint's contract, and the app's side of it.

	The coverage tests below are the point of this file. Without them, authoring
	`eval:doc.a && doc.b > 3` in the Desk form builder degrades an SPA screen silently — the
	field simply stops hiding — and is found by a confused user weeks later. Here it is a red
	test at the commit that introduces it.
	"""

	def test_every_authored_condition_is_supported(self):
		unsupported = []

		for doctype in _app_doctypes():
			for df in frappe.get_meta(doctype).fields:
				for prop in ("depends_on", "mandatory_depends_on"):
					parsed = parse_condition(df.get(prop))
					if parsed and parsed["op"] == "unsupported":
						unsupported.append(f"{doctype}.{df.fieldname}.{prop} = {parsed['raw']!r}")

		self.assertEqual(
			unsupported,
			[],
			"Unsupported condition expressions. Add a shape to parse_condition, or rewrite the "
			"expression — leaving it unparsed means the SPA silently ignores it.",
		)

	def test_every_authored_fieldtype_is_supported(self):
		found = {df.fieldtype for doctype in _app_doctypes() for df in frappe.get_meta(doctype).fields}

		self.assertEqual(
			found - SUPPORTED_FIELDTYPES,
			set(),
			"Fieldtypes the generic renderer has never been taught to draw. Add a control and a "
			"cell for it, then add it to SUPPORTED_FIELDTYPES.",
		)

	def test_every_authored_link_filter_parses(self):
		for doctype in _app_doctypes():
			for df in frappe.get_meta(doctype).fields:
				raw = df.get("link_filters")
				if not raw:
					continue
				with self.subTest(field=f"{doctype}.{df.fieldname}"):
					self.assertIsNotNone(
						parse_link_filters(raw),
						f"link_filters on {doctype}.{df.fieldname} parsed to nothing: {raw!r}",
					)


class TestConditionParser(IntegrationTestCase):
	def test_truthy(self):
		self.assertEqual(parse_condition("eval:doc.vehicle"), {"op": "truthy", "field": "vehicle"})

	def test_equality(self):
		self.assertEqual(
			parse_condition("eval:doc.reference=='Staff Reference'"),
			{"op": "eq", "field": "reference", "value": "Staff Reference"},
		)

	def test_equality_tolerates_whitespace_and_double_quotes(self):
		self.assertEqual(
			parse_condition('eval:doc.reference == "Other"'),
			{"op": "eq", "field": "reference", "value": "Other"},
		)

	def test_includes(self):
		self.assertEqual(
			parse_condition("eval:['Direct Admission','Other'].includes(doc.reference)"),
			{"op": "in", "field": "reference", "values": ["Direct Admission", "Other"]},
		)

	def test_absent_condition_is_none(self):
		self.assertIsNone(parse_condition(None))
		self.assertIsNone(parse_condition(""))

	def test_unreadable_expression_degrades_rather_than_raising(self):
		parsed = parse_condition("eval:doc.a && doc.b > 3")
		self.assertEqual(parsed["op"], "unsupported")
		self.assertEqual(parsed["raw"], "eval:doc.a && doc.b > 3")


class TestLinkFilterParser(IntegrationTestCase):
	def test_literal_value(self):
		self.assertEqual(
			parse_link_filters('[["Institution","status","=","Active"]]'),
			[{"fieldname": "status", "operator": "=", "value": "Active"}],
		)

	def test_sibling_field_reference(self):
		self.assertEqual(
			parse_link_filters('[["Campus","trust","=","eval:doc.trust"]]'),
			[{"fieldname": "trust", "operator": "=", "from_field": "trust"}],
		)

	def test_multiple_rows(self):
		parsed = parse_link_filters(
			'[["Staff","trust","=","eval:doc.trust"],["Staff","status","=","Active"]]'
		)
		self.assertEqual(len(parsed), 2)

	def test_malformed_json_is_none_not_an_exception(self):
		self.assertIsNone(parse_link_filters("not json"))


class TestSchemaEndpoint(IntegrationTestCase):
	DOCTYPE = "Trust"

	def test_returns_no_document_data(self):
		"""The endpoint publishes schema. Rows travel /api/resource with their own checks."""
		schema = get_doctype_schema(self.DOCTYPE)
		self.assertNotIn("data", schema)
		self.assertNotIn("docs", schema)

	def test_publishes_the_layout_the_json_authored(self):
		schema = get_doctype_schema(self.DOCTYPE)

		self.assertEqual(schema["doctype"], self.DOCTYPE)
		self.assertEqual(schema["title_field"], "trust_name")
		self.assertTrue(schema["layout"], "Trust has Section Breaks; layout must not be empty")

		sections = [section for tab in schema["layout"] for section in tab["sections"]]
		self.assertIn("Basic Information", [section["label"] for section in sections])

	def test_a_doctype_without_tab_breaks_gets_one_implicit_tab(self):
		"""No doctype in this app authors tabs yet, so every layout is a single unlabelled tab.

		The renderer keys "show a tab strip" off this, so a regression that emitted one tab per
		SECTION would put a tab strip over every record in the app.
		"""
		schema = get_doctype_schema(self.DOCTYPE)

		self.assertEqual(len(schema["layout"]), 1)
		self.assertIsNone(schema["layout"][0]["label"])
		self.assertGreater(len(schema["layout"][0]["sections"]), 1)

	def test_authored_column_breaks_survive_as_separate_columns(self):
		"""A Column Break is an instruction. Flattening it loses the author's grouping."""
		schema = get_doctype_schema(self.DOCTYPE)

		sections = [section for tab in schema["layout"] for section in tab["sections"]]
		self.assertTrue(
			any(len(section["columns"]) > 1 for section in sections),
			"Trust authors Column Breaks; no section reports more than one column",
		)

	def test_child_schemas_is_present_and_empty_until_a_table_field_exists(self):
		"""Always a dict, so the renderer never branches on its absence."""
		self.assertEqual(get_doctype_schema(self.DOCTYPE)["child_schemas"], {})

	def test_a_table_field_publishes_its_child_schema(self):
		"""A Table field must reach `fields`, and its child doctype must reach `child_schemas`.

		This is a regression test for a bug that could not be caught any other way, because no
		doctype in this app authors a Table field yet — the emptiness the test above asserts was
		indistinguishable from the endpoint dropping child tables entirely, which is what it did.

		The cause is worth naming so it is not reintroduced: `fields` was filtered against
		`meta.get_permitted_fieldnames()`, which is built from `get_fieldnames_with_value()`, and
		`Table` / `Table MultiSelect` are both in Frappe's `NO_VALUE_FIELDS`. A child table holds
		rows in another table rather than a column on this one, so the framework never reports one
		as a permitted *field* and the filter silently removed every one of them.

		The fixture is a custom doctype and a Custom Field, so it lives in the database only and
		writes nothing back into `erp/` even with developer_mode on.

		It is torn down twice — once before it is built and once after. Creating a DocType runs
		DDL, and DDL implicitly commits in MariaDB, so the transaction `IntegrationTestCase` rolls
		back at the end of the test cannot take the child table with it. Without the leading
		cleanup, an interrupted run leaves the doctype behind and every later run dies on a
		duplicate primary key rather than on the thing it is testing.
		"""
		child = "Zz Schema Test Row"
		fieldname = "zz_schema_test_rows"
		custom_field = f"{self.DOCTYPE}-{fieldname}"

		def drop():
			if frappe.db.exists("Custom Field", custom_field):
				frappe.delete_doc("Custom Field", custom_field, force=True)
			if frappe.db.exists("DocType", child):
				frappe.delete_doc("DocType", child, force=True)
			frappe.db.commit()
			frappe.clear_cache()

		drop()
		self.addCleanup(drop)

		frappe.get_doc(
			{
				"doctype": "DocType",
				"name": child,
				"module": "Master",
				"custom": 1,
				"istable": 1,
				"fields": [
					{"fieldname": "item", "label": "Item", "fieldtype": "Data", "in_list_view": 1},
					{"fieldname": "qty", "label": "Qty", "fieldtype": "Int", "in_list_view": 1},
				],
				"permissions": [],
			}
		).insert()
		frappe.get_doc(
			{
				"doctype": "Custom Field",
				"dt": self.DOCTYPE,
				"fieldname": fieldname,
				"label": "Zz Schema Test Rows",
				"fieldtype": "Table",
				"options": child,
				"insert_after": "id",
			}
		).insert()
		frappe.clear_cache(doctype=self.DOCTYPE)

		schema = get_doctype_schema(self.DOCTYPE)

		self.assertIn(
			fieldname,
			[field["fieldname"] for field in schema["fields"]],
			"a Table field was filtered out of `fields`",
		)
		self.assertIn(child, schema["child_schemas"], "the child doctype's schema did not travel")
		# The grid draws these, from the child's own `in_list_view` — the same flag Desk reads.
		self.assertEqual(schema["child_schemas"][child]["columns"], ["item", "qty"])

	def test_list_columns_lead_with_the_identity_and_do_not_repeat_it(self):
		schema = get_doctype_schema(self.DOCTYPE)
		columns = schema["list_columns"]

		self.assertEqual(columns[0], "trust_name")
		self.assertEqual(len(columns), len(set(columns)), "a column is listed twice")

	def test_layout_omits_hidden_fields_but_fields_keeps_them(self):
		"""naming_series is hidden and must not render, but its default is still needed."""
		schema = get_doctype_schema("Admission Gate Pass")

		self.assertNotIn("naming_series", _laid_out(schema))
		self.assertIn("naming_series", {f["fieldname"] for f in schema["fields"]})

	def test_conditions_arrive_parsed_not_as_eval_strings(self):
		schema = get_doctype_schema("Admission Gate Pass")
		vehicle_number = next(f for f in schema["fields"] if f["fieldname"] == "vehicle_number")

		self.assertEqual(vehicle_number["depends_on"], {"op": "truthy", "field": "vehicle"})
		self.assertEqual(vehicle_number["mandatory_depends_on"], {"op": "truthy", "field": "vehicle"})

	def test_filter_fields_exclude_the_uuid_column(self):
		"""`id` carries in_standard_filter by app convention; a UUID filter box is junk."""
		for doctype in ("Trust", "Institution", "Admission Gate Pass"):
			with self.subTest(doctype=doctype):
				self.assertNotIn("id", get_doctype_schema(doctype)["filter_fields"])

	def test_refuses_a_doctype_outside_this_app(self):
		"""Otherwise this is general Desk schema introspection for any logged-in user."""
		with self.assertRaises(frappe.PermissionError):
			get_doctype_schema("User")

	def test_refuses_a_doctype_that_does_not_exist(self):
		with self.assertRaises(frappe.DoesNotExistError):
			get_doctype_schema("No Such Doctype")

	def test_refuses_guest(self):
		frappe.set_user("Guest")
		try:
			with self.assertRaises(frappe.PermissionError):
				get_doctype_schema(self.DOCTYPE)
		finally:
			frappe.set_user("Administrator")
