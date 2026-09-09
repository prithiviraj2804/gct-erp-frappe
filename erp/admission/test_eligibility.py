# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""Entry conditions, enforced at last — and at the grain real rules need.

The journey: *Standard VI wants age 10 to 12 as on 1 June; B.E. CSE wants 50% in 12th plus Physics
and Chemistry and a TNEA rank inside 100; both intakes open the same day.*

Two of those three were already enforced. `Programme Intake.min_percentage` was not:
`grep -rn min_percentage erp/ --include=*.py` returned exactly one line — its own 0-to-100 range
check — so an intake stating 50% admitted a 35% candidate silently, in every institution type,
while the form looked as though it were enforced. `eligibility_criteria` was read by nothing at all.

And there was nothing to enforce a subject rule *against*. `Admission Enquiry Education` holds one
aggregate `percentage` per qualification and a free-text `specialization`, so "Physics and Chemistry
compulsory", NEET's PCB rule and a weighted engineering cut-off were inexpressible however the rule
was written. The per-subject marks table is the prerequisite, not a later nicety — which is why it
is in this slice rather than deferred behind it.
"""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import today


class IntegrationTestEligibility(IntegrationTestCase):
	TRUST = "ZL1"
	INST = "ZLENG"

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.ensure("Trust", cls.TRUST, {"trust_code": cls.TRUST, "trust_name": "Eligibility Trust"})
		cls.ensure(
			"Admission Type",
			"ZLREG",
			{"type_code": "ZLREG", "type_name": "Regular", "default_entry_semester": 1},
		)
		cls.ensure("Mode of Payment", "Cash", {"mode_name": "Cash", "type": "Cash"})
		cls.ensure(
			"Admission Document Type", "ZLDOC", {"document_code": "ZLDOC", "document_name": "Marksheet"}
		)
		cls.ensure(
			"Institution",
			cls.INST,
			{
				"trust": cls.TRUST,
				"institution_code": cls.INST,
				"institution_name": "Eligibility Engineering",
				"institution_type": "Engineering",
			},
		)
		cls.year = cls.ensure(
			"Academic Year",
			f"{cls.TRUST}-2110-11",
			{
				"trust": cls.TRUST,
				"year_code": "2110-11",
				"title": "L 2110-11",
				"start_date": "2110-06-01",
				"end_date": "2111-05-31",
				"is_admission_open": 1,
			},
		)
		cls.department = cls.ensure(
			"Department",
			f"{cls.INST}-ZLD",
			{
				"trust": cls.TRUST,
				"institution": cls.INST,
				"department_code": "ZLD",
				"department_name": "CSE",
			},
		)
		cls._offering = 0

	@staticmethod
	def ensure(doctype, name, values):
		if frappe.db.exists(doctype, name):
			return name
		return frappe.get_doc({"doctype": doctype, **values}).insert(ignore_permissions=True).name

	def make_intake(self, *, min_percentage=None, rules=()):
		type(self)._offering += 1
		code = f"ZLP{type(self)._offering:02d}"
		programme = (
			frappe.get_doc(
				{
					"doctype": "Programme",
					"trust": self.TRUST,
					"institution": self.INST,
					"department": self.department,
					"programme_code": code,
					"programme_name": f"B.E. {code}",
					"programme_level": "UG",
					"required_prior_qualification": "12th",
					"academic_structure": "SEM",
					"duration_years": 4,
					"total_terms": 8,
				}
			)
			.insert(ignore_permissions=True)
			.name
		)
		intake = (
			frappe.get_doc(
				{
					"doctype": "Programme Intake",
					"academic_year": self.year,
					"programme": programme,
					"total_seats": 60,
					"status": "Open",
					"application_fee": 100.0,
					"min_percentage": min_percentage,
					"required_documents": [{"document_type": "ZLDOC", "is_required": 1}],
					"eligibility_rules": list(rules),
				}
			)
			.insert(ignore_permissions=True)
			.name
		)
		return programme, intake

	def make_lead(self, programme, intake, *, percentage=None, marks=()):
		return (
			frappe.get_doc(
				{
					"doctype": "Admission Enquiry",
					"enquiry_date": today(),
					"status": "New",
					"student_name": "Eligibility Probe",
					"phone_number": "9877000001",
					"institution": self.INST,
					"department": self.department,
					"programme": programme,
					"programme_intake": intake,
					"admission_type": "ZLREG",
					"previous_education": [{"qualification_level": "12th", "percentage": percentage}],
					"subject_marks": list(marks),
				}
			)
			.insert(ignore_permissions=True)
			.name
		)

	def raise_application(self, programme, intake, **lead_kwargs):
		from erp.api.accounts.fee_payment import record_application_fee
		from erp.api.admission.application import start_application

		enquiry = self.make_lead(programme, intake, **lead_kwargs)
		record_application_fee(enquiry, "Cash")
		return start_application(enquiry, programme_intake=intake)["name"]

	# --- The aggregate percentage, enforced at last ----------------------------------

	def test_a_candidate_below_the_minimum_is_refused(self):
		"""The defect: collected, range-checked, and read by nothing."""
		programme, intake = self.make_intake(min_percentage=50)
		with self.assertRaises(frappe.ValidationError) as caught:
			self.raise_application(programme, intake, percentage=35)
		self.assertIn("50", str(caught.exception))

	def test_a_candidate_above_the_minimum_is_admitted(self):
		programme, intake = self.make_intake(min_percentage=50)
		self.assertTrue(self.raise_application(programme, intake, percentage=72))

	def test_an_intake_stating_no_minimum_checks_nothing(self):
		programme, intake = self.make_intake()
		self.assertTrue(self.raise_application(programme, intake, percentage=12))

	def test_a_lead_with_no_percentage_yet_is_not_blocked(self):
		"""An enquiry is a lead and often arrives before results do.

		Refusing the application for a mark nobody has yet would block the journey rather than gate
		it; the intake's document checklist is what insists on the mark sheet. Deliberately unlike
		a subject rule, which is a statement that this intake does not admit anyone who did not take
		the subject — so an absent row there is exactly the case it exists to catch.
		"""
		programme, intake = self.make_intake(min_percentage=50)
		self.assertTrue(self.raise_application(programme, intake, percentage=None))

	def test_the_best_percentage_on_record_is_what_counts(self):
		"""A lateral entrant's diploma is the qualification that earns the seat.

		Picking the row matching `required_prior_qualification` sounds tighter and judges a candidate
		on whichever row a lookup happened to name.
		"""
		programme, intake = self.make_intake(min_percentage=50)
		enquiry = frappe.get_doc(
			{
				"doctype": "Admission Enquiry",
				"enquiry_date": today(),
				"status": "New",
				"student_name": "Two Records",
				"phone_number": "9877000002",
				"institution": self.INST,
				"department": self.department,
				"programme": programme,
				"programme_intake": intake,
				"admission_type": "ZLREG",
				"previous_education": [
					{"qualification_level": "10th", "percentage": 41},
					{"qualification_level": "12th", "percentage": 68},
				],
			}
		).insert(ignore_permissions=True)

		from erp.api.accounts.fee_payment import record_application_fee
		from erp.api.admission.application import start_application

		record_application_fee(enquiry.name, "Cash")
		self.assertTrue(start_application(enquiry.name, programme_intake=intake))

	# --- Subject rules, and the marks table that makes them possible -----------------

	def test_a_compulsory_subject_that_was_not_taken_refuses_the_application(self):
		programme, intake = self.make_intake(rules=({"rule_type": "Subject Required", "subject": "Physics"},))
		with self.assertRaises(frappe.ValidationError) as caught:
			self.raise_application(
				programme,
				intake,
				percentage=80,
				marks=(
					{
						"qualification_level": "12th",
						"subject": "Chemistry",
						"marks_obtained": 70,
						"max_marks": 100,
					},
				),
			)
		self.assertIn("Physics", str(caught.exception))

	def test_a_subject_percentage_below_the_threshold_refuses_the_application(self):
		programme, intake = self.make_intake(
			rules=({"rule_type": "Subject Percentage At Least", "subject": "Mathematics", "threshold": 60},)
		)
		with self.assertRaises(frappe.ValidationError) as caught:
			self.raise_application(
				programme,
				intake,
				percentage=80,
				marks=(
					{
						"qualification_level": "12th",
						"subject": "Mathematics",
						"marks_obtained": 90,
						"max_marks": 200,
					},
				),
			)
		self.assertIn("45", str(caught.exception))

	def test_marks_out_of_something_other_than_a_hundred_are_compared_correctly(self):
		"""Which is the reason `max_marks` is stored and `reqd`.

		Boards mark out of 75, 90, 200 and 600, and a rule written as a percentage cannot compare
		raw marks across them. 135 out of 200 is 67.5%, and clears a 60% rule that 135 out of 600
		would not.
		"""
		programme, intake = self.make_intake(
			rules=({"rule_type": "Subject Percentage At Least", "subject": "Mathematics", "threshold": 60},)
		)
		self.assertTrue(
			self.raise_application(
				programme,
				intake,
				percentage=80,
				marks=(
					{
						"qualification_level": "12th",
						"subject": "Mathematics",
						"marks_obtained": 135,
						"max_marks": 200,
					},
				),
			)
		)

	def test_every_unmet_condition_is_reported_at_once(self):
		"""An office told one condition at a time discovers the next one on the next save."""
		programme, intake = self.make_intake(
			rules=(
				{"rule_type": "Subject Required", "subject": "Physics"},
				{"rule_type": "Subject Required", "subject": "Chemistry"},
			)
		)
		with self.assertRaises(frappe.ValidationError) as caught:
			self.raise_application(programme, intake, percentage=80)

		message = str(caught.exception)
		self.assertIn("Physics", message)
		self.assertIn("Chemistry", message)

	def test_the_pcb_rule_a_medical_intake_needs_is_expressible(self):
		"""The case that was inexpressible however the rule was written."""
		programme, intake = self.make_intake(
			rules=(
				{"rule_type": "Subject Percentage At Least", "subject": "Physics", "threshold": 50},
				{"rule_type": "Subject Percentage At Least", "subject": "Chemistry", "threshold": 50},
				{"rule_type": "Subject Percentage At Least", "subject": "Biology", "threshold": 50},
			)
		)
		self.assertTrue(
			self.raise_application(
				programme,
				intake,
				percentage=80,
				marks=(
					{
						"qualification_level": "12th",
						"subject": "Physics",
						"marks_obtained": 61,
						"max_marks": 100,
					},
					{
						"qualification_level": "12th",
						"subject": "Chemistry",
						"marks_obtained": 58,
						"max_marks": 100,
					},
					{
						"qualification_level": "12th",
						"subject": "Biology",
						"marks_obtained": 74,
						"max_marks": 100,
					},
				),
			)
		)

	# --- Entrance rules --------------------------------------------------------------

	def test_an_entrance_rank_outside_the_cutoff_refuses_the_application(self):
		programme, intake = self.make_intake(
			rules=({"rule_type": "Entrance Rank At Most", "threshold": 100},)
		)
		application = self.raise_application(programme, intake, percentage=80)
		doc = frappe.get_doc("Admission Application", application)
		doc.entrance_rank = 4200
		with self.assertRaises(frappe.ValidationError) as caught:
			doc.save(ignore_permissions=True)
		self.assertIn("4200", str(caught.exception))

	def test_an_entrance_rank_inside_the_cutoff_is_accepted(self):
		programme, intake = self.make_intake(
			rules=({"rule_type": "Entrance Rank At Most", "threshold": 100},)
		)
		application = self.raise_application(programme, intake, percentage=80)
		doc = frappe.get_doc("Admission Application", application)
		doc.entrance_rank = 74
		doc.save(ignore_permissions=True)
		self.assertEqual(doc.entrance_rank, 74)

	def test_an_intake_with_an_entrance_rule_can_still_raise_an_application(self):
		"""The rank comes back from the counselling body weeks after the application is raised.

		Refusing here made an intake publishing an entrance cut-off unable to raise an application
		at all — found by two tests, and the reason acceptability and existence are now separate
		questions asked at separate moments.
		"""
		programme, intake = self.make_intake(
			rules=({"rule_type": "Entrance Rank At Most", "threshold": 100},)
		)
		self.assertTrue(self.raise_application(programme, intake, percentage=80))

	def test_it_may_not_admit_on_a_rank_nobody_recorded(self):
		"""The other half: existence is refused once, at the admission gate."""
		from erp.api.admission.admission import confirm_admission

		programme, intake = self.make_intake(
			rules=({"rule_type": "Entrance Rank At Most", "threshold": 100},)
		)
		application = self.raise_application(programme, intake, percentage=80)

		doc = frappe.get_doc("Admission Application", application)
		doc.admission_route = "Direct"
		for row in doc.documents:
			row.copy_collected, row.original_verified, row.verified_on = 1, 1, today()
		doc.save(ignore_permissions=True)

		with self.assertRaises(frappe.ValidationError) as caught:
			confirm_admission(application)
		self.assertIn("entrance rank", str(caught.exception))

	def test_recording_an_acceptable_rank_lets_the_admission_through(self):
		from erp.api.admission.admission import confirm_admission

		programme, intake = self.make_intake(
			rules=({"rule_type": "Entrance Rank At Most", "threshold": 100},)
		)
		application = self.raise_application(programme, intake, percentage=80)

		doc = frappe.get_doc("Admission Application", application)
		doc.admission_route = "Direct"
		doc.entrance_rank = 74
		for row in doc.documents:
			row.copy_collected, row.original_verified, row.verified_on = 1, 1, today()
		doc.save(ignore_permissions=True)

		self.assertTrue(confirm_admission(application)["student"])

	# --- A rule form that saves is one the enforcer carries out ----------------------

	def test_a_subject_rule_with_no_subject_is_refused(self):
		with self.assertRaises(frappe.ValidationError) as caught:
			self.make_intake(rules=({"rule_type": "Subject Required"},))
		self.assertIn("name a subject", str(caught.exception))

	def test_a_threshold_rule_with_no_threshold_is_refused(self):
		with self.assertRaises(frappe.ValidationError) as caught:
			self.make_intake(rules=({"rule_type": "Entrance Rank At Most"},))
		self.assertIn("state a threshold", str(caught.exception))

	def test_a_subject_percentage_outside_zero_to_a_hundred_is_refused(self):
		with self.assertRaises(frappe.ValidationError):
			self.make_intake(
				rules=({"rule_type": "Subject Percentage At Least", "subject": "Physics", "threshold": 140},)
			)

	def test_two_rules_of_one_kind_for_one_subject_are_refused(self):
		with self.assertRaises(frappe.ValidationError) as caught:
			self.make_intake(
				rules=(
					{"rule_type": "Subject Percentage At Least", "subject": "Physics", "threshold": 50},
					{"rule_type": "Subject Percentage At Least", "subject": "Physics", "threshold": 60},
				)
			)
		self.assertIn("already states", str(caught.exception))

	# --- The marks table's own arithmetic --------------------------------------------

	def test_a_percentage_is_derived_on_save(self):
		programme, intake = self.make_intake()
		enquiry = self.make_lead(
			programme,
			intake,
			percentage=80,
			marks=(
				{"qualification_level": "12th", "subject": "Physics", "marks_obtained": 45, "max_marks": 75},
			),
		)
		row = frappe.get_doc("Admission Enquiry", enquiry).subject_marks[0]
		self.assertEqual(row.percentage, 60.0)

	def test_marks_above_the_maximum_are_refused(self):
		programme, intake = self.make_intake()
		with self.assertRaises(frappe.ValidationError) as caught:
			self.make_lead(
				programme,
				intake,
				percentage=80,
				marks=(
					{
						"qualification_level": "12th",
						"subject": "Physics",
						"marks_obtained": 120,
						"max_marks": 100,
					},
				),
			)
		self.assertIn("out of", str(caught.exception))

	def test_every_marks_row_gets_its_uuid(self):
		programme, intake = self.make_intake()
		enquiry = self.make_lead(
			programme,
			intake,
			percentage=80,
			marks=(
				{"qualification_level": "12th", "subject": "Physics", "marks_obtained": 45, "max_marks": 75},
			),
		)
		rows = frappe.get_doc("Admission Enquiry", enquiry).subject_marks
		self.assertTrue(all(row.id for row in rows))

	def test_a_subject_named_by_a_rule_cannot_be_deleted(self):
		self.make_intake(rules=({"rule_type": "Subject Required", "subject": "Botany"},))
		with self.assertRaises(frappe.ValidationError):
			frappe.delete_doc("Examination Subject", "Botany")
