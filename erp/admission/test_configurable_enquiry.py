# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""One Admission Enquiry doctype, collecting different things for different kinds of institution.

The journey: *a school enquiry records the previous school and its marks; an engineering enquiry
records the entrance exam, rank and cut-off.* Both are rows in `tabAdmission Enquiry`, so the
counsellor's list, the registrar's report and every filter keep working across both — and adding a
nursing college changes no code.
"""

import frappe
from frappe.tests import IntegrationTestCase

from erp.api.field_policy import get_policy
from erp.field_policy import resolve_policy


class IntegrationTestConfigurableEnquiry(IntegrationTestCase):
	TRUST = "ZC1"
	SCHOOL = "ZCSCH"
	ENGG = "ZCENG"

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.ensure("Trust", cls.TRUST, {"trust_code": cls.TRUST, "trust_name": "Config Trust"})
		cls.ensure(
			"Admission Type",
			"ZCREG",
			{"type_code": "ZCREG", "type_name": "Regular", "default_entry_semester": 1},
		)
		for code, itype in ((cls.SCHOOL, "School"), (cls.ENGG, "Engineering")):
			cls.ensure(
				"Institution",
				code,
				{
					"trust": cls.TRUST,
					"institution_code": code,
					"institution_name": f"{code} Institution",
					"institution_type": itype,
				},
			)
		cls.dept = cls.ensure(
			"Department",
			f"{cls.ENGG}-ZCCSE",
			{
				"trust": cls.TRUST,
				"institution": cls.ENGG,
				"department_code": "ZCCSE",
				"department_name": "Computer Science",
			},
		)
		cls.school_programme = cls.make_programme(cls.SCHOOL, None, "ZCVI")
		cls.engg_programme = cls.make_programme(cls.ENGG, cls.dept, "ZCBE")

	# --- Fixtures --------------------------------------------------------------------

	@staticmethod
	def ensure(doctype, name, values):
		if frappe.db.exists(doctype, name):
			return name
		return frappe.get_doc({"doctype": doctype, **values}).insert(ignore_permissions=True).name

	@classmethod
	def make_programme(cls, institution, department, code):
		values = {
			"doctype": "Programme",
			"trust": cls.TRUST,
			"institution": institution,
			"programme_code": code,
			"programme_name": f"Programme {code}",
			"programme_level": "UG",
			"academic_structure": "SEM",
			"duration_years": 1,
			"total_terms": 2,
		}
		if department:
			values["department"] = department
		return (
			cls.ensure(f"{institution}-{code}", None, values)
			if False
			else (
				frappe.get_doc(values).insert(ignore_permissions=True).name
				if not frappe.db.exists("Programme", f"{institution}-{code}")
				else f"{institution}-{code}"
			)
		)

	def make_enquiry(self, institution, programme, **extra):
		doc = frappe.get_doc(
			{
				"doctype": "Admission Enquiry",
				"student_name": "Policy Probe",
				"phone_number": "9876500001",
				"institution": institution,
				"programme": programme,
				"admission_type": "ZCREG",
				**extra,
			}
		)
		if institution == self.ENGG:
			doc.department = self.dept
		doc.insert(ignore_permissions=True)
		return doc

	@staticmethod
	def policy(scope_field, scope_value, rules, document_type="Admission Enquiry"):
		"""Create (or replace) a policy at one scope.

		`scope_field` is the column — "scope_institution_type" or "scope_institution" — because the
		scope is two typed Links rather than a Dynamic Link, so that the generic renderer can draw
		it and the Report Builder can filter on it.
		"""
		name = f"{document_type}-{scope_value}"
		if frappe.db.exists("Field Policy", name):
			frappe.delete_doc("Field Policy", name, force=True, ignore_permissions=True)
		return frappe.get_doc(
			{
				"doctype": "Field Policy",
				"document_type": document_type,
				scope_field: scope_value,
				"enabled": 1,
				"rules": list(rules),
			}
		).insert(ignore_permissions=True)

	# --- The shipped behaviour --------------------------------------------------------

	def test_a_school_does_not_collect_the_entrance_fields(self):
		spec = resolve_policy("Admission Enquiry", institution=self.SCHOOL)
		for fieldname in ("entrance_exam", "entrance_rank", "cutoff_marks"):
			self.assertEqual(spec[fieldname].requirement, "Hidden", fieldname)

	def test_an_engineering_institution_does_collect_them(self):
		spec = resolve_policy("Admission Enquiry", institution=self.ENGG)
		self.assertNotEqual(spec.get("cutoff_marks").requirement, "Hidden")

	def test_the_school_relabels_previous_education(self):
		spec = resolve_policy("Admission Enquiry", institution=self.SCHOOL)
		self.assertEqual(spec["previous_education"].label, "Previous School Record")

	# --- Enforcement is on the server, not the form ------------------------------------

	def test_a_hidden_field_is_refused_on_a_new_enquiry(self):
		"""Typed into the API, or left behind by a form that had not yet redrawn."""
		enquiry = self.make_enquiry(self.SCHOOL, self.school_programme, cutoff_marks=180)
		self.assertIn(enquiry.cutoff_marks, (None, 0, 0.0))

	def test_a_hidden_field_is_preserved_on_an_existing_record(self):
		"""A policy change must not delete history.

		The engineering enquiry legitimately recorded a cut-off. If that institution is later
		reclassified, or the policy tightened, the number it collected last year is still what
		happened — so Hidden reverts an attempted change rather than destroying the stored value.
		"""
		enquiry = self.make_enquiry(self.ENGG, self.engg_programme, cutoff_marks=192.5)
		self.assertEqual(enquiry.cutoff_marks, 192.5)

		self.policy("scope_institution", self.ENGG, [{"fieldname": "cutoff_marks", "requirement": "Hidden"}])
		enquiry.cutoff_marks = 0
		enquiry.save(ignore_permissions=True)

		self.assertEqual(enquiry.cutoff_marks, 192.5)

	def test_a_required_field_blocks_the_save(self):
		"""What the trust configures on a Tuesday: this institution must have a cut-off."""
		self.policy(
			"scope_institution", self.ENGG, [{"fieldname": "cutoff_marks", "requirement": "Required"}]
		)

		with self.assertRaises(frappe.ValidationError):
			self.make_enquiry(self.ENGG, self.engg_programme)

	# --- The merge ---------------------------------------------------------------------

	def test_the_nearest_scope_wins(self):
		"""An institution may contradict its type — the school that does run an entrance test."""
		self.policy(
			"scope_institution", self.SCHOOL, [{"fieldname": "cutoff_marks", "requirement": "Optional"}]
		)
		spec = resolve_policy("Admission Enquiry", institution=self.SCHOOL)

		self.assertEqual(spec["cutoff_marks"].requirement, "Optional")
		# ... and the sibling fields the institution said nothing about still inherit Hidden.
		self.assertEqual(spec["entrance_rank"].requirement, "Hidden")

	def test_a_rule_stating_only_a_label_keeps_the_inherited_requirement(self):
		"""The merge is per property. Renaming a field must not silently un-hide it — this is why
		the cascade folds properties rather than replacing whole rules."""
		self.policy(
			"scope_institution", self.SCHOOL, [{"fieldname": "cutoff_marks", "label_override": "Score"}]
		)
		spec = resolve_policy("Admission Enquiry", institution=self.SCHOOL)

		self.assertEqual(spec["cutoff_marks"].label, "Score")
		self.assertEqual(spec["cutoff_marks"].requirement, "Hidden")

	def test_a_bound_of_zero_is_a_bound(self):
		"""Regression. Bounds are stored as Data precisely because a Float column is NOT NULL
		DEFAULT 0 and could not tell "minimum zero" from "no minimum" — which silently dropped the
		shipped bound when this was first written."""
		self.policy(
			"scope_institution",
			self.ENGG,
			[{"fieldname": "cutoff_marks", "min_value": "0", "max_value": "200"}],
		)
		with self.assertRaises(frappe.ValidationError):
			self.make_enquiry(self.ENGG, self.engg_programme, cutoff_marks=-1)
		with self.assertRaises(frappe.ValidationError):
			self.make_enquiry(self.ENGG, self.engg_programme, cutoff_marks=201)

	# --- Guards -------------------------------------------------------------------------

	def test_a_rule_must_name_a_real_field(self):
		"""A typo would otherwise do nothing, silently, for ever."""
		with self.assertRaises(frappe.ValidationError):
			self.policy(
				"scope_institution", self.ENGG, [{"fieldname": "cutof_marks", "requirement": "Required"}]
			)

	def test_a_policy_cannot_govern_a_statically_required_field(self):
		"""`institution` is `reqd: 1` in the schema and `_validate_mandatory` runs after `validate`,
		so a policy saying Optional could never take effect. Better to refuse the policy than to
		let someone write a rule that looks right and does nothing."""
		with self.assertRaises(frappe.ValidationError):
			self.policy(
				"scope_institution", self.ENGG, [{"fieldname": "institution", "requirement": "Optional"}]
			)

	def test_a_policy_cannot_carry_two_rules_for_one_field(self):
		with self.assertRaises(frappe.ValidationError):
			self.policy(
				"Institution",
				self.ENGG,
				[
					{"fieldname": "cutoff_marks", "requirement": "Required"},
					{"fieldname": "cutoff_marks", "requirement": "Hidden"},
				],
			)

	# --- What the Desk form asks for -----------------------------------------------------

	def test_the_endpoint_returns_the_resolved_policy(self):
		payload = get_policy("Admission Enquiry", institution=self.SCHOOL)
		self.assertEqual(payload["cutoff_marks"]["requirement"], "Hidden")
		self.assertEqual(payload["previous_education"]["label"], "Previous School Record")
