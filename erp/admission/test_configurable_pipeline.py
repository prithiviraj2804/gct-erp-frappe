# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""One admission pipeline, demanding different things of different kinds of institution.

The journey: *a school meets the family before offering a place; an engineering college admitting
on a TNEA allotment has no such step; a government arts college charges nothing for the form.*
All three walk the same six stages, because `status` is in `REPORTING_SPINE` and a trust running a
school and an engineering college has to be able to count admissions across both. What differs is
what each stage *demands*.

Proved here: the stage table reproduces the three hand-written frozensets it replaced exactly; a
gate switches off per institution type and its default when nothing is stated is per gate; the
Field Policy layer reaches Admission Application at last; and Arts & Science — which inherited
neither shipped policy and so collected the raw professional superset — now inherits its own.
"""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import today

from erp.admission.stages import (
	ADMISSION,
	CLOSED_STATUSES,
	DOCUMENTS,
	FEE,
	GATE_ENTRY_STATUS,
	INTERACTION,
	PIPELINE,
	gate_applies,
	gated_by,
	required_gates,
)
from erp.field_policy import resolve_policy


class IntegrationTestStageTable(IntegrationTestCase):
	"""The declaration must reproduce what it replaced, byte for byte.

	`stages.py` collapsed five literals in three modules into one table. A refactor that quietly
	changed which stages a gate guards would be invisible — every gate would still fire, just on
	the wrong set — so the sets are asserted against the values the old frozensets held.
	"""

	def test_the_fee_gate_guards_what_it_always_guarded(self):
		self.assertEqual(
			gated_by(FEE), frozenset({"Application Submitted", "Documents Verified", "Admitted"})
		)

	def test_the_document_gate_guards_what_it_always_guarded(self):
		self.assertEqual(gated_by(DOCUMENTS), frozenset({"Documents Verified", "Admitted"}))

	def test_the_admission_gate_guards_only_admitted(self):
		self.assertEqual(gated_by(ADMISSION), frozenset({"Admitted"}))

	def test_the_pipeline_order_is_unchanged(self):
		self.assertEqual(
			PIPELINE,
			("New", "Contacted", "Visited", "Application Submitted", "Documents Verified", "Admitted"),
		)

	def test_the_closed_statuses_are_unchanged(self):
		self.assertEqual(CLOSED_STATUSES, frozenset({"Admitted", "Rejected", "Dropped"}))

	def test_the_fee_gate_entry_is_derived_not_restated(self):
		self.assertEqual(GATE_ENTRY_STATUS, "Application Submitted")

	def test_the_stage_vocabulary_matches_the_schema(self):
		"""The table and the `Select` it describes must agree, or a stage is unreachable.

		This is the same class of bug as the SPA's `Application Submit`: a literal duplicated
		across a doctype JSON and Python, drifting silently.
		"""
		options = {
			option.strip()
			for option in frappe.get_meta("Admission Enquiry").get_field("status").options.split("\n")
			if option.strip()
		}
		from erp.admission.stages import BY_NAME

		self.assertEqual(set(BY_NAME), options)


class IntegrationTestConfigurableGates(IntegrationTestCase):
	TRUST = "ZP1"
	SCHOOL = "ZPSCH"
	ENGG = "ZPENG"
	ARTS = "ZPART"

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.ensure("Trust", cls.TRUST, {"trust_code": cls.TRUST, "trust_name": "Pipeline Trust"})
		cls.ensure(
			"Admission Type",
			"ZPREG",
			{"type_code": "ZPREG", "type_name": "Regular", "default_entry_semester": 1},
		)
		cls.ensure("Mode of Payment", "Cash", {"mode_name": "Cash", "type": "Cash"})
		cls.ensure(
			"Admission Document Type", "ZPBIRTH", {"document_code": "ZPBIRTH", "document_name": "Birth"}
		)
		cls.year = cls.ensure(
			"Academic Year",
			f"{cls.TRUST}-2070-71",
			{
				"trust": cls.TRUST,
				"year_code": "2070-71",
				"title": "P 2070-71",
				"start_date": "2070-06-01",
				"end_date": "2071-05-31",
				"is_admission_open": 1,
			},
		)
		for code, itype in ((cls.SCHOOL, "School"), (cls.ENGG, "Engineering"), (cls.ARTS, "Arts & Science")):
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
		cls.school_programme, cls.school_intake = cls.make_offering(cls.SCHOOL, "ZPVI")
		cls.engg_programme, cls.engg_intake = cls.make_offering(cls.ENGG, "ZPBE", department=True)

	# --- Fixtures --------------------------------------------------------------------

	@staticmethod
	def ensure(doctype, name, values):
		if frappe.db.exists(doctype, name):
			return name
		return frappe.get_doc({"doctype": doctype, **values}).insert(ignore_permissions=True).name

	@classmethod
	def make_offering(cls, institution, code, *, department=False):
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
			values["department"] = cls.ensure(
				"Department",
				f"{institution}-{code}",
				{
					"trust": cls.TRUST,
					"institution": institution,
					"department_code": code,
					"department_name": code,
				},
			)
		programme = frappe.get_doc(values).insert(ignore_permissions=True).name
		intake = (
			frappe.get_doc(
				{
					"doctype": "Programme Intake",
					"academic_year": cls.year,
					"programme": programme,
					"total_seats": 30,
					"status": "Open",
					"application_fee": 500.0,
					"required_documents": [{"document_type": "ZPBIRTH", "is_required": 1}],
				}
			)
			.insert(ignore_permissions=True)
			.name
		)
		return programme, intake

	def paid_lead(self, institution, programme, intake, **extra):
		from erp.api.accounts.fee_payment import record_application_fee

		values = {
			"doctype": "Admission Enquiry",
			"enquiry_date": today(),
			"status": "New",
			"student_name": "Pipeline Probe",
			"phone_number": "9876700001",
			"institution": institution,
			"programme": programme,
			"programme_intake": intake,
			"admission_type": "ZPREG",
			**extra,
		}
		if department := frappe.db.get_value("Programme", programme, "department"):
			values["department"] = department
		enquiry = frappe.get_doc(values).insert(ignore_permissions=True).name
		record_application_fee(enquiry, "Cash")
		return enquiry

	def application_for(self, enquiry, intake):
		from erp.api.admission.application import start_application

		return start_application(enquiry, programme_intake=intake)["name"]

	@staticmethod
	def verify_documents(application):
		doc = frappe.get_doc("Admission Application", application)
		for row in doc.documents:
			row.copy_collected, row.original_verified, row.verified_on = 1, 1, today()
		doc.save(ignore_permissions=True)
		return doc

	# --- The interaction gate: a school has it, an engineering college does not -------

	def test_a_school_must_record_the_interaction_before_documents_verified(self):
		enquiry = self.paid_lead(self.SCHOOL, self.school_programme, self.school_intake)
		application = self.application_for(enquiry, self.school_intake)
		self.verify_documents(application)

		lead = frappe.get_doc("Admission Enquiry", enquiry)
		lead.status = "Documents Verified"
		with self.assertRaises(frappe.ValidationError) as caught:
			lead.save(ignore_permissions=True)
		self.assertIn("interaction", str(caught.exception).lower())

	def test_recording_a_recommended_interaction_clears_the_gate(self):
		enquiry = self.paid_lead(self.SCHOOL, self.school_programme, self.school_intake)
		application = self.application_for(enquiry, self.school_intake)
		doc = self.verify_documents(application)
		doc.interaction_on = today()
		doc.interaction_mode = "In Person"
		doc.interaction_outcome = "Recommended"
		doc.save(ignore_permissions=True)

		lead = frappe.get_doc("Admission Enquiry", enquiry)
		lead.status = "Documents Verified"
		lead.save(ignore_permissions=True)
		self.assertEqual(lead.status, "Documents Verified")

	def test_not_recommended_is_refused_with_its_own_message(self):
		"""A different fact from an unrecorded interaction, and a different next step for the office."""
		enquiry = self.paid_lead(self.SCHOOL, self.school_programme, self.school_intake)
		application = self.application_for(enquiry, self.school_intake)
		doc = self.verify_documents(application)
		doc.interaction_on = today()
		doc.interaction_outcome = "Not Recommended"
		doc.save(ignore_permissions=True)

		lead = frappe.get_doc("Admission Enquiry", enquiry)
		lead.status = "Documents Verified"
		with self.assertRaises(frappe.ValidationError) as caught:
			lead.save(ignore_permissions=True)
		self.assertIn("Not Recommended", str(caught.exception))

	def test_an_engineering_college_is_never_asked_about_the_interaction(self):
		"""Nothing in its ancestor chain states the capability, and the gate's own default is off.

		This is the tri-state rule doing real work. A `Check` could not express it: the app-wide
		truth is that institutions admit on an allotment or on marks, and a school is the exception
		that opts in — so "nobody said" has to mean *off* for this gate and *on* for the fee.
		"""
		self.assertFalse(gate_applies(INTERACTION, self.ENGG))
		self.assertTrue(gate_applies(INTERACTION, self.SCHOOL))

		enquiry = self.paid_lead(self.ENGG, self.engg_programme, self.engg_intake)
		application = self.application_for(enquiry, self.engg_intake)
		self.verify_documents(application)

		lead = frappe.get_doc("Admission Enquiry", enquiry)
		lead.status = "Documents Verified"
		lead.save(ignore_permissions=True)
		self.assertEqual(lead.status, "Documents Verified")

	# --- The fee gate switches off, and its default is the other way -----------------

	def test_the_fee_gate_applies_unless_a_type_says_otherwise(self):
		self.assertTrue(gate_applies(FEE, self.ENGG))
		self.assertTrue(gate_applies(FEE, self.SCHOOL))

	def test_a_fee_free_institution_type_advances_without_a_payment(self):
		"""A government arts college and a state-aided school charge nothing for the form.

		Switching the gate off for a type is not the same as exempting one applicant — an RTE seat
		at a fee-charging school is a per-applicant waiver and a different record. This proves only
		the type-level switch.
		"""
		frappe.db.set_value("Institution Type", "Arts & Science", "requires_application_fee", "No")
		try:
			self.assertFalse(gate_applies(FEE, self.ARTS))
			self.assertEqual(
				required_gates("Application Submitted", "Visited", self.ARTS),
				frozenset(),
				"no gate should apply to this transition once the fee gate is off",
			)
		finally:
			frappe.db.set_value("Institution Type", "Arts & Science", "requires_application_fee", None)

	# --- Field Policy now enforces on the application, not just the enquiry ----------

	def test_a_hidden_field_is_reverted_on_a_school_application(self):
		"""Enforcement, not presentation — the same boundary the enquiry already had.

		A school's application carried `counselling_outcome`, `allotment_reference` and
		`allotment_date` with no way to take them off, which is how a school application came to
		sit in *Awaiting Counselling* waiting for a body that does not exist.
		"""
		enquiry = self.paid_lead(self.SCHOOL, self.school_programme, self.school_intake)
		application = self.application_for(enquiry, self.school_intake)

		doc = frappe.get_doc("Admission Application", application)
		doc.allotment_reference = "TNEA/IMPOSSIBLE"
		doc.counselling_outcome = "Allotted To Us"
		doc.save(ignore_permissions=True)

		self.assertIn(doc.allotment_reference, (None, ""))

		# Reverted to the field's own *default*, not to blank — `counselling_outcome` ships with
		# `Awaited`. That is `_revert` behaving correctly: a policy that hides a field must not also
		# silently override its default.
		#
		# It is also the reason hiding these fields does not on its own fix the school's problem.
		# `derive_application_state` reads `counselling_outcome` whenever the route is Government
		# Quota, and `admission_route` still *defaults* to Government Quota — so a school
		# application lands in "Awaiting Counselling" on a value nobody typed, in a field nobody
		# can see. Field Policy cannot reach it either: `admission_route` is `reqd: 1`, so
		# `validate_not_statically_required` refuses to govern it. That default belongs on the
		# Institution Type tree and arrives with the `Admission Route` master.
		self.assertNotEqual(doc.counselling_outcome, "Allotted To Us")
		self.assertEqual(
			doc.counselling_outcome,
			frappe.new_doc("Admission Application").counselling_outcome,
		)

	def test_an_engineering_application_still_keeps_the_allotment_fields(self):
		enquiry = self.paid_lead(self.ENGG, self.engg_programme, self.engg_intake)
		application = self.application_for(enquiry, self.engg_intake)

		doc = frappe.get_doc("Admission Application", application)
		doc.allotment_reference = "TNEA/2070/0001"
		doc.counselling_outcome = "Allotted To Us"
		doc.save(ignore_permissions=True)

		self.assertEqual(doc.allotment_reference, "TNEA/2070/0001")

	def test_a_capability_stated_on_a_group_is_inherited_by_its_leaves(self):
		"""The whole point of the tree: one row configures seven types."""
		frappe.db.set_value("Institution Type", "Professional", "requires_application_fee", "No")
		try:
			self.assertFalse(gate_applies(FEE, self.ENGG))
		finally:
			frappe.db.set_value("Institution Type", "Professional", "requires_application_fee", None)

	# --- The policy layer reaches the application at last ----------------------------
	#
	# Until this slice Field Policy governed Admission Enquiry alone, and a policy for the
	# application saved green and enforced nothing.

	def test_the_application_is_a_governed_doctype(self):
		from erp.field_policy import GOVERNED_DOCTYPES

		self.assertIn("Admission Application", GOVERNED_DOCTYPES)

	def test_a_school_application_does_not_collect_the_counselling_fields(self):
		spec = resolve_policy("Admission Application", institution=self.SCHOOL)
		for fieldname in ("counselling_outcome", "allotment_reference", "allotment_date"):
			self.assertEqual(spec[fieldname].requirement, "Hidden", fieldname)

	def test_a_professional_application_keeps_them_and_bounds_the_rank(self):
		spec = resolve_policy("Admission Application", institution=self.ENGG)
		self.assertNotIn("counselling_outcome", spec)
		self.assertEqual(spec["entrance_rank"].min_value, 0)

	def test_arts_and_science_no_longer_inherits_nothing(self):
		"""The gap no test would have noticed, because no test instantiated the type.

		`Arts & Science` hangs off `All`, so it inherited neither the School policy nor the
		Professional one: its enquiry form was the raw professional superset, with the entrance
		fields visible and the cut-off unbounded — GCE could save `cutoff_marks = -12.5` where GCT
		could not.
		"""
		for doctype in ("Admission Enquiry", "Admission Application"):
			spec = resolve_policy(doctype, institution=self.ARTS)
			self.assertTrue(spec, f"{doctype} resolves no policy at all for Arts & Science")
			self.assertEqual(spec["entrance_exam"].requirement, "Hidden", doctype)
