# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""The app-wide conventions, tested rather than asserted in a docstring.

The UUID `id` column is the project's central convention and it was broken for every child table
from the day it was written — `before_insert` fires for the parent only, so no child row ever got
one, and a `unique: 1` index full of NULLs raised nothing. These tests exist because that failure
was invisible: nothing errored, nothing logged, and the JSON said the field was unique.
"""

import frappe
from frappe.tests import IntegrationTestCase


class IntegrationTestUuidConvention(IntegrationTestCase):
	TRUST = "ZU1"
	INST = "ZUA"

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.ensure("Trust", cls.TRUST, {"trust_code": cls.TRUST, "trust_name": "UUID Trust"})
		cls.ensure(
			"Institution",
			cls.INST,
			{
				"trust": cls.TRUST,
				"institution_code": cls.INST,
				"institution_name": "UUID Institution",
				"institution_type": "Engineering",
			},
		)
		cls.ensure(
			"Programme Level", "ZUL", {"level_code": "ZUL", "level_name": "UUID Level", "level_order": 9}
		)
		cls.ensure(
			"Academic Structure",
			"ZUS",
			{
				"structure_code": "ZUS",
				"structure_name": "UUID Structure",
				"terms_per_year": 2,
				"term_label": "Term",
			},
		)
		cls.ensure(
			"Department",
			f"{cls.INST}-ZUD",
			{
				"trust": cls.TRUST,
				"institution": cls.INST,
				"department_code": "ZUD",
				"department_name": "UUID Department",
			},
		)
		cls.programme = cls.ensure(
			f"{cls.INST}-ZUP",
			None,
			{
				"doctype": "Programme",
				"trust": cls.TRUST,
				"institution": cls.INST,
				"department": f"{cls.INST}-ZUD",
				"programme_code": "ZUP",
				"programme_name": "UUID Programme",
				"programme_level": "ZUL",
				"academic_structure": "ZUS",
				"duration_years": 1,
				"total_terms": 2,
			},
		)
		cls.year = cls.ensure(
			f"{cls.TRUST}-ZU26",
			None,
			{
				"doctype": "Academic Year",
				"trust": cls.TRUST,
				"year_code": "ZU26",
				"year_name": "UUID 2026-27",
				"title": "UUID 2026-27",
				"start_date": "2026-06-01",
				"end_date": "2027-04-30",
			},
		)

	@staticmethod
	def ensure(name_or_doctype, name, values):
		"""Insert if absent. Called two ways because some fixtures know their name and some do not."""
		if name is None:
			doctype, target = values["doctype"], name_or_doctype
		else:
			doctype, target = name_or_doctype, name
			values = {"doctype": doctype, **values}
		if frappe.db.exists(doctype, target):
			return target
		return frappe.get_doc(values).insert(ignore_permissions=True).name

	def make_intake(self, code, documents):
		"""An intake is unique per (academic year, programme), so each test brings its own
		programme rather than competing for one."""
		programme = self.ensure(
			f"{self.INST}-{code}",
			None,
			{
				"doctype": "Programme",
				"trust": self.TRUST,
				"institution": self.INST,
				"department": f"{self.INST}-ZUD",
				"programme_code": code,
				"programme_name": f"UUID Programme {code}",
				"programme_level": "ZUL",
				"academic_structure": "ZUS",
				"duration_years": 1,
				"total_terms": 2,
			},
		)
		return frappe.get_doc(
			{
				"doctype": "Programme Intake",
				"academic_year": self.year,
				"programme": programme,
				"total_seats": 10,
				"application_fee": 100,
				"required_documents": documents,
			}
		).insert(ignore_permissions=True)

	def test_a_child_row_gets_a_uuid_on_insert(self):
		"""The defect. Before the fix the parent got a UUID and every child got NULL."""
		intake = self.make_intake("ZUI1", [{"document_type": "TC", "is_required": 1}])

		self.assertTrue(intake.id)
		for row in intake.required_documents:
			self.assertTrue(row.id, "child row was inserted without a UUID id")

	def test_a_child_row_appended_to_an_existing_parent_gets_a_uuid(self):
		"""`before_insert` never fires for this path, which is why the hook is also on
		`before_save`. It is the commonest way a child row is created."""
		intake = self.make_intake("ZUI2", [{"document_type": "TC", "is_required": 1}])
		intake.append("required_documents", {"document_type": "PHOTO", "is_required": 1})
		intake.save(ignore_permissions=True)

		self.assertEqual(len(intake.required_documents), 2)
		for row in intake.required_documents:
			self.assertTrue(row.id, "child row appended on update was left without a UUID id")

	def test_child_uuids_are_distinct(self):
		"""`unique: 1` on the column cannot be relied on to catch a collision: MariaDB permits
		unlimited NULLs in a unique index, which is exactly why the original defect was silent."""
		intake = self.make_intake(
			"ZUI3",
			[
				{"document_type": "TC", "is_required": 1},
				{"document_type": "PHOTO", "is_required": 1},
				{"document_type": "AADHAAR", "is_required": 1},
			],
		)
		ids = [row.id for row in intake.required_documents]
		self.assertEqual(len(set(ids)), len(ids))

	def test_an_explicit_id_is_respected(self):
		"""A data import carries the identifier the external system already knows the row by."""
		intake = self.make_intake(
			"ZUI4", [{"document_type": "TC", "is_required": 1, "id": "kept-by-the-import"}]
		)
		self.assertEqual(intake.required_documents[0].id, "kept-by-the-import")


class IntegrationTestWorkspaceReachability(IntegrationTestCase):
	"""Every doctype must be reachable from a workspace.

	A doctype absent from every workspace exists only to someone who knows to type its URL. The
	feature-slice checklist has always said "workspace links added, so the feature is reachable" —
	this is that checklist item, enforced. It was written after `Institution Type` shipped without
	a link, and found `Admission Follow-up` had been missing one since the slice that created it.

	Child tables are exempt: they are edited inside their parent and have no list view worth
	linking to.
	"""

	def test_every_doctype_is_reachable_from_a_workspace(self):
		modules = frappe.get_module_list("erp")
		doctypes = frappe.get_all("DocType", filters={"module": ("in", modules), "istable": 0}, pluck="name")
		linked = set(
			frappe.get_all(
				"Workspace Link",
				filters={"link_type": "DocType", "parent": ("in", frappe.get_all("Workspace", pluck="name"))},
				pluck="link_to",
			)
		)

		unreachable = sorted(set(doctypes) - linked)
		self.assertEqual(
			unreachable,
			[],
			f"these doctypes are in no workspace and cannot be navigated to: {unreachable}",
		)
