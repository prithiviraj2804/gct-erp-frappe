# Copyright (c) 2026, Prithivi and Contributors
# See license.txt

"""What an application does between a paid lead and an admitted student.

The case this slice was built for runs through the whole suite: a student walks in asking for one
branch and counselling allots them another. The application owns the programme it admits to, the
lead keeps what was asked for, and the two are allowed to disagree forever.

Also proved here: one Admission Application serves an engineering institution and an LKG class, with the
difference carried as data on the intake — an age window and a document checklist — and no rule
anywhere keyed on `Institution.institution_type`. Plus the three pipeline gates, through both status-writers.

Own fixtures under a `ZA` prefix, in two disjoint trusts so every test has a legitimate record
and an alien one. Nothing is committed: IntegrationTestCase rolls the connection back at class
teardown, which is also why identity columns come from counters rather than literals.
"""

import itertools
import uuid

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, today

from erp.api.accounts.fee_payment import record_application_fee
from erp.api.admission.admission import confirm_admission
from erp.api.admission.application import start_application


class IntegrationTestAdmissionApplication(IntegrationTestCase):
	INST = "ZA1"
	OTHER_INST = "ZA2"
	ENG = "ZA1ENG"
	SCHOOL = "ZA1SCH"
	FEE = 750.0

	# --- Fixtures -------------------------------------------------------------------

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls._aadhaar = itertools.count(710000000001)
		cls._phone = itertools.count(9700000001)
		cls._offering = itertools.count(1)

		cls.ensure(
			"Programme Level", "UG", {"level_code": "UG", "level_name": "Undergraduate", "level_order": 1}
		)
		cls.ensure("Programme Level", "PRI", {"level_code": "PRI", "level_name": "Primary", "level_order": 1})
		cls.ensure(
			"Admission Type", "REG", {"type_code": "REG", "type_name": "Regular", "default_entry_semester": 1}
		)
		cls.ensure(
			"Admission Type", "LAT", {"type_code": "LAT", "type_name": "Lateral", "default_entry_semester": 3}
		)
		cls.ensure("Mode of Payment", "Cash", {"mode_name": "Cash", "type": "Cash"})
		for code, name in (
			("MARK12", "12th Mark Sheet"),
			("ALLOTMENT", "Allotment Order"),
			("BIRTH", "Birth Certificate"),
		):
			cls.ensure("Admission Document Type", code, {"document_code": code, "document_name": name})
		cls.structure = cls.ensure(
			"Academic Structure",
			"ZASEM",
			{
				"structure_code": "ZASEM",
				"structure_name": "A Semester",
				"terms_per_year": 2,
				"term_label": "Semester",
			},
		)

		# Inserting a trust builds its chart of accounts through the after_insert hook.
		cls.ensure("Trust", cls.INST, {"trust_code": cls.INST, "trust_name": "A Institute"})
		cls.ensure("Trust", cls.OTHER_INST, {"trust_code": cls.OTHER_INST, "trust_name": "A Rival"})
		cls.ensure(
			"Institution",
			cls.ENG,
			{
				"trust": cls.INST,
				"institution_code": cls.ENG,
				"institution_name": "A Engineering",
				"institution_type": "Engineering",
			},
		)
		cls.ensure(
			"Institution",
			cls.SCHOOL,
			{
				"trust": cls.INST,
				"institution_code": cls.SCHOOL,
				"institution_name": "A School",
				"institution_type": "School",
			},
		)

		cls.year = cls.ensure(
			"Academic Year",
			f"{cls.INST}-2060-61",
			{
				"trust": cls.INST,
				"year_code": "2060-61",
				"title": "A 2060-61",
				"start_date": "2060-06-01",
				"end_date": "2061-05-31",
				"is_admission_open": 1,
			},
		)

		cls.cse, cls.cse_intake = cls.make_offering("CSE", cls.ENG, "UG", "12th", seats=60)
		cls.ece, cls.ece_intake = cls.make_offering("ECE", cls.ENG, "UG", "12th", seats=60)
		# Two seats so exhaustion is cheap to prove.
		cls.lat, cls.lat_intake = cls.make_offering("MECHLAT", cls.ENG, "UG", "12th", seats=60)
		# A second institution's offering with no age window and no prior qualification, so a lead
		# raised at the engineering college can apply here too. That is the cardinality case: one
		# person, two institutions of one trust, which the app forbade until this slice.
		cls.hsc, cls.hsc_intake = cls.make_offering(
			"HSC", cls.SCHOOL, "PRI", None, seats=30, documents=("BIRTH",)
		)
		# The school class: no department, no prior qualification, an age window instead.
		cls.lkg, cls.lkg_intake = cls.make_offering(
			"LKG",
			cls.SCHOOL,
			"PRI",
			None,
			seats=2,
			documents=("BIRTH",),
			min_age=3,
			max_age=5,
			age_as_on="2060-06-01",
		)

	@staticmethod
	def ensure(doctype, name, values):
		if frappe.db.exists(doctype, name):
			return name
		return frappe.get_doc({"doctype": doctype, **values}).insert().name

	@classmethod
	def make_offering(
		cls, code, institution, level, prior, *, seats, documents=("MARK12", "ALLOTMENT"), **intake
	):
		"""A programme plus the intake that publishes its seats, checklist and entry conditions."""
		department = None
		if institution != cls.SCHOOL:
			department = cls.ensure(
				"Department",
				f"{institution}-{code}",
				{
					"trust": cls.INST,
					"institution": institution,
					"department_code": code,
					"department_name": code,
				},
			)
		programme = (
			frappe.get_doc(
				{
					"doctype": "Programme",
					"institution": institution,
					"department": department,
					"programme_code": code,
					"programme_name": code,
					"programme_level": level,
					"required_prior_qualification": prior,
					"academic_structure": cls.structure,
					"duration_years": 4,
					"total_terms": 8,
				}
			)
			.insert()
			.name
		)
		programme_intake = (
			frappe.get_doc(
				{
					"doctype": "Programme Intake",
					"academic_year": cls.year,
					"programme": programme,
					"total_seats": seats,
					"status": "Open",
					"application_fee": cls.FEE,
					"required_documents": [{"document_type": d, "is_required": 1} for d in documents],
					**intake,
				}
			)
			.insert()
			.name
		)
		return programme, programme_intake

	@classmethod
	def make_lead(
		cls, programme, intake, *, institution=None, date_of_birth=None, education=("12th",), **overrides
	):
		"""A lead at the point the counsellor has taken the details but no fee yet."""
		values = {
			"doctype": "Admission Enquiry",
			"enquiry_date": today(),
			"status": "New",
			"student_name": f"A Applicant {next(cls._aadhaar) % 10000}",
			"phone_number": str(next(cls._phone)),
			"aadhaar_number": f"{next(cls._aadhaar):012d}",
			"institution": institution or frappe.db.get_value("Programme", programme, "institution"),
			"department": frappe.db.get_value("Programme", programme, "department"),
			"programme": programme,
			"programme_intake": intake,
			"admission_type": "REG",
			"date_of_birth": date_of_birth,
			"previous_education": [{"qualification_level": q} for q in education if q],
		}
		values.update(overrides)
		return frappe.get_doc(values).insert().name

	@classmethod
	def paid_lead(cls, programme, intake, **kwargs):
		enquiry = cls.make_lead(programme, intake, **kwargs)
		record_application_fee(enquiry, "Cash")
		return enquiry

	@staticmethod
	def verify_documents(application):
		doc = frappe.get_doc("Admission Application", application)
		for row in doc.documents:
			row.copy_collected, row.original_verified, row.verified_on = 1, 1, today()
		doc.save()
		return doc

	@classmethod
	def allot(cls, application, programme, intake, outcome="Allotted To Us"):
		"""Record what counselling returned — routinely a different branch from the one enquired about."""
		doc = frappe.get_doc("Admission Application", application)
		doc.programme, doc.programme_intake = programme, intake
		doc.counselling_outcome = outcome
		doc.entrance_exam, doc.allotment_reference, doc.allotment_date = "TNEA", "TNEA/2060/0001", today()
		doc.save()
		return doc

	# --- Raising the application ----------------------------------------------------

	def test_application_needs_the_fee_first(self):
		"""This institution hands out its form only after the fee is taken, and so does the pipeline."""
		enquiry = self.make_lead(self.cse, self.cse_intake)
		with self.assertRaises(frappe.ValidationError) as caught:
			start_application(enquiry)
		self.assertIn("fee", str(caught.exception).lower())

	def test_application_is_seeded_from_the_lead_and_the_intake(self):
		enquiry = self.paid_lead(self.cse, self.cse_intake)
		result = start_application(enquiry)
		doc = frappe.get_doc("Admission Application", result["name"])

		self.assertTrue(result["created"])
		self.assertTrue(doc.name.startswith("AAPP-"), doc.name)
		self.assertEqual(str(uuid.UUID(doc.id)), doc.id)
		self.assertEqual(doc.programme, self.cse)
		# The branch walked in for is choice 1 until the form says otherwise.
		self.assertEqual([r.programme for r in doc.preferences], [self.cse])
		# The checklist comes from the intake, not from a global list.
		self.assertEqual({r.document_type for r in doc.documents}, {"MARK12", "ALLOTMENT"})
		self.assertTrue(all(str(uuid.UUID(r.id)) == r.id for r in doc.documents))

	def test_starting_twice_returns_the_same_application(self):
		enquiry = self.paid_lead(self.cse, self.cse_intake)
		first = start_application(enquiry)
		second = start_application(enquiry)
		self.assertFalse(second["created"])
		self.assertEqual(first["name"], second["name"])

	def test_a_lead_cannot_carry_two_applications_for_one_intake(self):
		"""The same intake twice is a duplicate for one seat. A different intake is a second choice.

		This test used to be called `test_a_lead_cannot_carry_two_applications` and asserted the
		stronger rule, which — composed with the enquiry's own one-per-Aadhaar-per-trust-per-year
		check — capped an applicant at exactly one application in the whole trust per cycle. It
		passes unchanged because a duplicate for one intake is still refused; only its name and its
		reasoning needed correcting. See `test_a_lead_may_apply_at_two_institutions_of_the_trust`.
		"""
		enquiry = self.paid_lead(self.cse, self.cse_intake)
		start_application(enquiry)
		with self.assertRaises(frappe.ValidationError):
			frappe.get_doc(
				{
					"doctype": "Admission Application",
					"admission_enquiry": enquiry,
					"application_date": today(),
					"programme": self.cse,
					"programme_intake": self.cse_intake,
				}
			).insert()

	# --- One lead, several applications ---------------------------------------------

	def test_a_lead_may_apply_at_two_institutions_of_the_trust(self):
		"""The journey: *one candidate, applications at two of the trust's institutions.*

		GEI runs both an engineering college and a school; a TNEA choice list spans two colleges,
		and a parent applies to two schools. All of it was refused: `validate_one_per_enquiry` here
		plus one enquiry per Aadhaar per trust per academic year on the lead composed into a ceiling
		of one application per person per trust per cycle. The office's workaround would have been a
		blank Aadhaar — which the lead's duplicate check skips entirely, so it bought the second
		application at the price of duplicate detection.

		The model already allowed this: an application is tied to its lead's **trust**, and takes
		its own `institution` from the programme it admits to. Only the check stood in the way.
		"""
		enquiry = self.paid_lead(self.cse, self.cse_intake)

		first = start_application(enquiry)
		second = start_application(enquiry, programme_intake=self.hsc_intake)

		self.assertTrue(first["created"])
		self.assertTrue(second["created"], "the second application was not raised")
		self.assertNotEqual(first["name"], second["name"])

		institutions = {
			frappe.db.get_value("Admission Application", name, "institution")
			for name in (first["name"], second["name"])
		}
		self.assertEqual(institutions, {self.ENG, self.SCHOOL})

	def test_the_second_application_carries_its_own_programme_and_checklist(self):
		"""Seeded from the target intake, not the lead's — otherwise it opens as a copy of the first."""
		enquiry = self.paid_lead(self.cse, self.cse_intake)
		start_application(enquiry)
		second = start_application(enquiry, programme_intake=self.hsc_intake)

		doc = frappe.get_doc("Admission Application", second["name"])
		self.assertEqual(doc.programme, self.hsc)
		self.assertEqual([row.programme for row in doc.preferences], [self.hsc])
		self.assertEqual({row.document_type for row in doc.documents}, {"BIRTH"})

	def test_starting_twice_for_one_intake_is_still_idempotent(self):
		"""Keyed on the intake now, so a double-click is safe and a second choice is possible."""
		enquiry = self.paid_lead(self.cse, self.cse_intake)
		first = start_application(enquiry, programme_intake=self.hsc_intake)
		again = start_application(enquiry, programme_intake=self.hsc_intake)
		self.assertFalse(again["created"])
		self.assertEqual(first["name"], again["name"])

	def test_a_lead_may_be_admitted_on_only_one_of_its_applications(self):
		"""Several applications are a candidate hedging. Several admissions are a double-counted
		student, a seat consumed in two intakes, and two rows in the statutory register.

		`Student.validate_unique_aadhaar` refuses the second register row, but only when an Aadhaar
		is on hand and only when the Student is written — too late to be a useful message. This is
		the same invariant stated on the document the office is looking at.
		"""
		enquiry = self.paid_lead(self.cse, self.cse_intake)
		first = start_application(enquiry)["name"]
		second = start_application(enquiry, programme_intake=self.hsc_intake)["name"]

		self.allot(first, self.cse, self.cse_intake)
		self.verify_documents(first)
		confirm_admission(first)

		# `Direct`, so the second application is not held up by the counselling gate and the
		# already-admitted objection is what actually refuses it.
		doc = frappe.get_doc("Admission Application", second)
		doc.admission_route = "Direct"
		doc.save()
		self.verify_documents(second)

		with self.assertRaises(frappe.ValidationError) as caught:
			confirm_admission(second)
		self.assertIn("already been admitted", str(caught.exception))

		self.assertFalse(
			frappe.db.get_value("Admission Application", second, "student"),
			"the second application was refused but a Student was written anyway",
		)

	def test_a_lead_with_no_aadhaar_is_still_admitted_only_once(self):
		"""The backstop does not cover this, and it is the lead most likely to be entered twice.

		`Student.validate_unique_aadhaar` returns early when no Aadhaar was recorded — an enquiry
		can legitimately be logged before the number is on hand — so before the pipeline asked the
		question, a lead with a blank Aadhaar could produce two register rows.
		"""
		enquiry = self.paid_lead(self.cse, self.cse_intake, aadhaar_number=None)
		first = start_application(enquiry)["name"]
		second = start_application(enquiry, programme_intake=self.hsc_intake)["name"]

		self.allot(first, self.cse, self.cse_intake)
		self.verify_documents(first)
		confirm_admission(first)

		doc = frappe.get_doc("Admission Application", second)
		doc.admission_route = "Direct"
		doc.save()
		self.verify_documents(second)

		with self.assertRaises(frappe.ValidationError) as caught:
			confirm_admission(second)
		self.assertIn("already been admitted", str(caught.exception))

	def test_admitting_checks_the_application_in_hand_not_the_lead_s_best(self):
		"""The gate that would have opened by accident.

		Moving the *lead* to Admitted is justified by any one of its applications being admissible —
		the lead's status is its furthest progress. Admitting on *this* application is not. With one
		admissible application and one still awaiting a counselling round, the lead-level question
		answers yes for both, so `confirm_admission` on the second would have passed a gate it had
		not cleared and taken a seat in an intake that never allotted it.
		"""
		enquiry = self.paid_lead(self.cse, self.cse_intake)
		ready = start_application(enquiry)["name"]
		awaiting = start_application(enquiry, programme_intake=self.ece_intake)["name"]

		self.allot(ready, self.cse, self.cse_intake)
		self.verify_documents(ready)
		self.verify_documents(awaiting)

		# `awaiting` is Government Quota by default and has no counselling outcome recorded.
		with self.assertRaises(frappe.ValidationError) as caught:
			confirm_admission(awaiting)
		self.assertIn("allotment", str(caught.exception).lower())

	def test_the_lead_advances_when_any_one_application_clears(self):
		"""The lead's status is its furthest progress, not every application's.

		Holding a lead back because a second application elsewhere is still waiting on a counselling
		round it may never win would be nonsense — the certificates have been seen.
		"""
		enquiry = self.paid_lead(self.cse, self.cse_intake)
		cleared = start_application(enquiry)["name"]
		start_application(enquiry, programme_intake=self.ece_intake)

		self.verify_documents(cleared)

		lead = frappe.get_doc("Admission Enquiry", enquiry)
		lead.status = "Documents Verified"
		lead.save()
		self.assertEqual(lead.status, "Documents Verified")

	def test_when_no_application_clears_every_objection_is_reported(self):
		"""One application's complaint is not the lead's answer.

		The office's next action depends on which route is closest: chasing a certificate for one
		application is worth doing, waiting on a counselling round for another is not. So the error
		names each application rather than reporting the first.
		"""
		enquiry = self.paid_lead(self.cse, self.cse_intake)
		first = start_application(enquiry)["name"]
		second = start_application(enquiry, programme_intake=self.ece_intake)["name"]

		lead = frappe.get_doc("Admission Enquiry", enquiry)
		lead.status = "Documents Verified"
		with self.assertRaises(frappe.ValidationError) as caught:
			lead.save()

		message = str(caught.exception)
		self.assertIn(first, message)
		self.assertIn(second, message)

	def test_one_application_still_reports_its_own_message_verbatim(self):
		"""The generalisation should be invisible in the common case."""
		enquiry = self.paid_lead(self.cse, self.cse_intake)
		start_application(enquiry)

		lead = frappe.get_doc("Admission Enquiry", enquiry)
		lead.status = "Documents Verified"
		with self.assertRaises(frappe.ValidationError) as caught:
			lead.save()

		message = str(caught.exception)
		self.assertIn("still unverified", message)
		self.assertNotIn("None of this lead", message)

	# --- The case the slice exists for ----------------------------------------------

	def test_allotted_branch_may_differ_from_the_one_enquired_about(self):
		"""Walked in for CSE, TNEA allotted ECE. Both facts survive, on their own records."""
		enquiry = self.paid_lead(self.cse, self.cse_intake)
		application = start_application(enquiry)["name"]

		doc = self.allot(application, self.ece, self.ece_intake)

		self.assertEqual(doc.programme, self.ece)
		self.assertEqual(doc.department, f"{self.ENG}-ECE", "the department must follow the branch")
		self.assertEqual(
			frappe.db.get_value("Admission Enquiry", enquiry, "programme"),
			self.cse,
			"the lead must still record what the student actually asked for",
		)

	def test_the_admitted_student_carries_the_allotted_branch(self):
		enquiry = self.paid_lead(self.cse, self.cse_intake)
		application = start_application(enquiry)["name"]
		self.allot(application, self.ece, self.ece_intake)
		self.verify_documents(application)

		student = frappe.get_doc("Student", confirm_admission(application)["student"])

		self.assertEqual(student.programme, self.ece)
		self.assertEqual(student.programme_intake, self.ece_intake)
		self.assertEqual(student.admission_enquiry, enquiry)

	def test_intake_must_belong_to_the_programme(self):
		"""The intake carries the seats, checklist and age window — the wrong one applies wrong rules."""
		enquiry = self.paid_lead(self.cse, self.cse_intake)
		doc = frappe.get_doc("Admission Application", start_application(enquiry)["name"])
		doc.programme = self.ece  # intake still points at CSE
		with self.assertRaises(frappe.ValidationError) as caught:
			doc.save()
		self.assertIn("not", str(caught.exception).lower())

	def test_a_branch_change_rechecks_the_entry_requirement(self):
		"""A lateral-entry seat needs a diploma the original choice never asked for."""
		enquiry = self.paid_lead(self.cse, self.cse_intake, education=("12th",))
		doc = frappe.get_doc("Admission Application", start_application(enquiry)["name"])
		doc.programme, doc.programme_intake = self.lat, self.lat_intake
		doc.admission_type = "LAT"
		with self.assertRaises(frappe.ValidationError) as caught:
			doc.save()
		self.assertIn("Diploma", str(caught.exception))

	def test_branch_cannot_change_after_admission(self):
		application = self.admitted_application()  # admitted into CSE
		doc = frappe.get_doc("Admission Application", application)
		doc.programme, doc.programme_intake = self.ece, self.ece_intake
		with self.assertRaises(frappe.ValidationError) as caught:
			doc.save()
		self.assertIn("cannot be changed", str(caught.exception))

	# --- One doctype for a school and an institution -------------------------------------

	def test_school_intake_enforces_its_age_window(self):
		too_young = self.paid_lead(self.lkg, self.lkg_intake, date_of_birth="2058-01-01", education=())
		with self.assertRaises(frappe.ValidationError) as caught:
			start_application(too_young)
		self.assertIn("age", str(caught.exception).lower())

		too_old = self.paid_lead(self.lkg, self.lkg_intake, date_of_birth="2052-01-01", education=())
		with self.assertRaises(frappe.ValidationError):
			start_application(too_old)

		just_right = self.paid_lead(self.lkg, self.lkg_intake, date_of_birth="2056-01-01", education=())
		self.assertTrue(start_application(just_right)["created"])

	def test_a_degree_intake_sets_no_age_window_so_none_is_checked(self):
		"""The same date of birth that fails LKG is irrelevant to a B.E. — the rule is data, not a
		branch on the institution's type."""
		enquiry = self.paid_lead(self.cse, self.cse_intake, date_of_birth="2058-01-01")
		self.assertTrue(start_application(enquiry)["created"])

	def test_the_checklist_is_the_intake_s_own(self):
		school = self.paid_lead(self.lkg, self.lkg_intake, date_of_birth="2056-02-02", education=())
		institution = self.paid_lead(self.cse, self.cse_intake)

		school_docs = frappe.get_doc("Admission Application", start_application(school)["name"]).documents
		institution_docs = frappe.get_doc(
			"Admission Application", start_application(institution)["name"]
		).documents

		self.assertEqual([r.document_type for r in school_docs], ["BIRTH"])
		self.assertEqual({r.document_type for r in institution_docs}, {"MARK12", "ALLOTMENT"})

	# --- Derived state ---------------------------------------------------------------

	def test_state_is_derived_not_typed(self):
		enquiry = self.paid_lead(self.cse, self.cse_intake)
		application = start_application(enquiry)["name"]
		doc = frappe.get_doc("Admission Application", application)
		self.assertEqual(doc.application_state, "Awaiting Counselling")

		doc = self.allot(application, self.cse, self.cse_intake)
		self.assertEqual(doc.application_state, "Documents Pending")

		doc = self.verify_documents(application)
		self.assertEqual(doc.application_state, "Documents Verified")

		doc.offer_issued_on = today()
		doc.save()
		self.assertEqual(doc.application_state, "Offered")

		doc.offer_response = "Accepted"
		doc.save()
		self.assertEqual(doc.application_state, "Accepted")
		self.assertEqual(
			frappe.utils.getdate(doc.offer_response_on),
			frappe.utils.getdate(today()),
			"a response dates itself",
		)

		confirm_admission(application)
		self.assertEqual(
			frappe.db.get_value("Admission Application", application, "application_state"), "Admitted"
		)

	def test_allotted_elsewhere_reads_not_allotted(self):
		enquiry = self.paid_lead(self.cse, self.cse_intake)
		application = start_application(enquiry)["name"]
		doc = frappe.get_doc("Admission Application", application)
		doc.counselling_outcome = "Allotted Elsewhere"
		doc.save()
		self.assertEqual(doc.application_state, "Not Allotted")

	# --- The gates -------------------------------------------------------------------

	def test_documents_gate_blocks_documents_verified(self):
		enquiry = self.paid_lead(self.cse, self.cse_intake)
		self.allot(start_application(enquiry)["name"], self.cse, self.cse_intake)

		lead = frappe.get_doc("Admission Enquiry", enquiry)
		lead.status = "Documents Verified"
		with self.assertRaises(frappe.ValidationError) as caught:
			lead.save()
		self.assertIn("unverified", str(caught.exception).lower())

	def test_documents_gate_blocks_the_follow_up_path_too(self):
		"""The follow-up writes status with set_value, bypassing the enquiry's validate entirely —
		which is exactly why the rule lives in pipeline.py and both writers call it."""
		enquiry = self.paid_lead(self.cse, self.cse_intake)
		self.allot(start_application(enquiry)["name"], self.cse, self.cse_intake)

		with self.assertRaises(frappe.ValidationError) as caught:
			frappe.get_doc(
				{
					"doctype": "Admission Follow-up",
					"enquiry": enquiry,
					"follow_up_on": frappe.utils.now(),
					"channel": "Call",
					"outcome": "Connected",
					"new_status": "Documents Verified",
				}
			).insert()
		self.assertIn("unverified", str(caught.exception).lower())
		self.assertEqual(frappe.db.get_value("Admission Enquiry", enquiry, "status"), "Application Submitted")

	def test_advancing_without_an_application_is_refused(self):
		enquiry = self.paid_lead(self.cse, self.cse_intake)
		lead = frappe.get_doc("Admission Enquiry", enquiry)
		lead.status = "Documents Verified"
		with self.assertRaises(frappe.ValidationError) as caught:
			lead.save()
		self.assertIn("Application", str(caught.exception))

	def test_an_applicant_allotted_elsewhere_cannot_be_admitted(self):
		"""And that is what they are told first — verifying certificates would change nothing."""
		enquiry = self.paid_lead(self.cse, self.cse_intake)
		application = start_application(enquiry)["name"]
		self.allot(application, self.cse, self.cse_intake, outcome="Allotted Elsewhere")

		with self.assertRaises(frappe.ValidationError) as caught:
			confirm_admission(application)
		self.assertIn("cannot be admitted", str(caught.exception))

	def test_an_awaited_allotment_cannot_be_admitted(self):
		enquiry = self.paid_lead(self.cse, self.cse_intake)
		application = start_application(enquiry)["name"]
		self.verify_documents(application)
		with self.assertRaises(frappe.ValidationError) as caught:
			confirm_admission(application)
		self.assertIn("allotment", str(caught.exception).lower())

	def test_an_issued_offer_must_be_accepted(self):
		enquiry = self.paid_lead(self.cse, self.cse_intake)
		application = start_application(enquiry)["name"]
		self.allot(application, self.cse, self.cse_intake)
		doc = self.verify_documents(application)
		doc.offer_issued_on = today()
		doc.save()

		with self.assertRaises(frappe.ValidationError) as caught:
			confirm_admission(application)
		self.assertIn("not been accepted", str(caught.exception))

	def test_an_offer_answered_after_it_lapsed_is_refused(self):
		enquiry = self.paid_lead(self.cse, self.cse_intake)
		application = start_application(enquiry)["name"]
		self.allot(application, self.cse, self.cse_intake)
		doc = self.verify_documents(application)
		doc.offer_issued_on = add_days(today(), -10)
		doc.offer_expires_on = add_days(today(), -3)
		doc.offer_response = "Accepted"
		doc.offer_response_on = today()
		doc.save()

		with self.assertRaises(frappe.ValidationError) as caught:
			confirm_admission(application)
		self.assertIn("expired", str(caught.exception).lower())

	def test_a_response_needs_an_offer(self):
		enquiry = self.paid_lead(self.cse, self.cse_intake)
		doc = frappe.get_doc("Admission Application", start_application(enquiry)["name"])
		doc.offer_response = "Accepted"
		with self.assertRaises(frappe.ValidationError):
			doc.save()

	def test_no_offer_at_all_is_fine(self):
		"""A counselling allotment is its own offer; a management seat is settled across a desk."""
		application = self.admitted_application()
		self.assertTrue(frappe.db.get_value("Admission Application", application, "student"))

	# --- Seats ------------------------------------------------------------------------

	def test_an_intake_cannot_be_admitted_past_its_seats(self):
		# Its own two-seat intake: the seat tests must not fill each other's, and the class rolls back
		# only at teardown, so state set by one test method is still there for the next.
		programme, intake = self.tiny_intake(seats=2)
		for _ in range(2):
			self.admitted_application(programme=programme, intake=intake)

		self.assertEqual(frappe.db.count("Student", {"programme_intake": intake, "status": "Active"}), 2)

		enquiry = self.paid_lead(programme, intake)
		application = start_application(enquiry)["name"]
		self.allot(application, programme, intake)
		self.verify_documents(application)

		with self.assertRaises(frappe.ValidationError) as caught:
			confirm_admission(application)
		self.assertIn("full", str(caught.exception).lower())

	def test_only_active_students_hold_a_seat(self):
		"""Seats are counted on Active students so a later withdrawal slice frees them by flipping a
		status, with no change to the gate."""
		programme, intake = self.tiny_intake(seats=2)
		first = self.admitted_application(programme=programme, intake=intake)
		self.admitted_application(programme=programme, intake=intake)

		student = frappe.db.get_value("Admission Application", first, "student")
		frappe.db.set_value("Student", student, "status", "Discontinued")

		third = self.admitted_application(programme=programme, intake=intake)
		self.assertTrue(frappe.db.get_value("Admission Application", third, "student"))

	# --- Admission --------------------------------------------------------------------

	def test_confirming_twice_admits_once(self):
		application = self.admitted_application()
		student = frappe.db.get_value("Admission Application", application, "student")
		again = confirm_admission(application)
		self.assertFalse(again["created"])
		self.assertEqual(again["student"], student)

	def test_admission_numbers_the_register_per_trust(self):
		application = self.admitted_application()
		student = frappe.get_doc(
			"Student", frappe.db.get_value("Admission Application", application, "student")
		)
		self.assertTrue(student.name.startswith(f"{self.INST}-STU-"), student.name)
		self.assertEqual(str(uuid.UUID(student.id)), student.id)
		self.assertEqual(student.status, "Active")
		self.assertEqual(student.date_of_admission, frappe.utils.getdate(today()))

	def test_admission_moves_the_lead_to_admitted(self):
		application = self.admitted_application()
		enquiry = frappe.db.get_value("Admission Application", application, "admission_enquiry")
		self.assertEqual(frappe.db.get_value("Admission Enquiry", enquiry, "status"), "Admitted")

	# --- Tenancy ----------------------------------------------------------------------

	def test_an_application_cannot_admit_into_another_trust(self):
		"""A Link accepts any programme in the system; only the hierarchy check rejects a rival's.

		The application derives its trust from the programme, so pointing it at another
		tenant's branch makes the lead it came from the odd one out — which is exactly what
		`validate_same_parent` on `admission_enquiry` is there to catch.
		"""
		rival_institution = self.ensure(
			"Institution",
			f"{self.OTHER_INST}COL",
			{
				"trust": self.OTHER_INST,
				"institution_code": f"{self.OTHER_INST}COL",
				"institution_name": "Rival Institution",
				"institution_type": "Engineering",
			},
		)
		rival_department = self.ensure(
			"Department",
			f"{rival_institution}-CSE",
			{
				"trust": self.OTHER_INST,
				"institution": rival_institution,
				"department_code": "CSE",
				"department_name": "Rival CSE",
			},
		)
		rival_programme = (
			frappe.get_doc(
				{
					"doctype": "Programme",
					"institution": rival_institution,
					"department": rival_department,
					"programme_code": "RCSE",
					"programme_name": "Rival CSE",
					"programme_level": "UG",
					"academic_structure": self.structure,
					"duration_years": 4,
					"total_terms": 8,
				}
			)
			.insert()
			.name
		)

		enquiry = self.paid_lead(self.cse, self.cse_intake)
		doc = frappe.get_doc("Admission Application", start_application(enquiry)["name"])
		doc.programme = rival_programme
		doc.programme_intake = None
		with self.assertRaises(frappe.ValidationError):
			doc.save()

	# --- Shared helper ----------------------------------------------------------------

	@classmethod
	def tiny_intake(cls, *, seats):
		"""A private programme + intake, so a test that fills seats cannot starve another."""
		return cls.make_offering(f"SEAT{next(cls._offering)}", cls.ENG, "UG", "12th", seats=seats)

	@classmethod
	def admitted_application(cls, programme=None, intake=None, **kwargs):
		"""A lead carried all the way to a student, for tests about what happens afterwards."""
		programme = programme or cls.cse
		intake = intake or cls.cse_intake
		enquiry = cls.paid_lead(programme, intake, **kwargs)
		application = start_application(enquiry)["name"]
		cls.allot(application, programme, intake)
		cls.verify_documents(application)
		confirm_admission(application)
		return application


class IntegrationTestAdmissionApplicationScoping(IntegrationTestCase):
	"""An application must not be the hole in the lead scoping.

	A counsellor barred from another counsellor's enquiry would otherwise read the same applicant's
	marks, documents and allotment through the application raised from it. Same `ZP`-style shape as
	the enquiry's scoping suite: two counsellors, one manager, one lead each.
	"""

	INST = "ZA1"

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		base = IntegrationTestAdmissionApplication
		base.setUpClass.__func__(base)

		cls.staff_a = cls.make_staff("ZASTA", "za-counsellor-a@example.com")
		cls.staff_b = cls.make_staff("ZASTB", "za-counsellor-b@example.com")
		cls.manager = cls.grant_institution(
			cls.make_user("za-manager@example.com", "Admission Manager"), base.ENG
		)

		cls.app_a = cls.application_owned_by(cls.staff_a)
		cls.app_b = cls.application_owned_by(cls.staff_b)

	@classmethod
	def make_staff(cls, code, email):
		user = cls.make_user(email, "Admission Counsellor")
		base = IntegrationTestAdmissionApplication
		staff = base.ensure(
			"Staff",
			f"{base.ENG}-{code}",
			{
				"trust": cls.INST,
				"institution": base.ENG,
				"staff_code": code,
				"staff_name": code,
				"user": user,
				"status": "Active",
			},
		)
		return staff

	@classmethod
	def grant_institution(cls, email, institution):
		"""Provision the Institution User Permission a real deployment would give this login.

		Tenancy fails closed, so a login with no Institution permission and no trust-wide role sees
		nothing at all. A counsellor gets this automatically from their Staff record
		(`Staff.sync_institution_permission`); a manager without a Staff row has to be granted it
		the way an administrator would.
		"""
		if not frappe.db.exists(
			"User Permission", {"user": email, "allow": "Institution", "for_value": institution}
		):
			frappe.get_doc(
				{
					"doctype": "User Permission",
					"user": email,
					"allow": "Institution",
					"for_value": institution,
					"apply_to_all_doctypes": 1,
				}
			).insert(ignore_permissions=True)
		return email

	@staticmethod
	def make_user(email, role):
		if frappe.db.exists("User", email):
			return email
		user = frappe.new_doc("User")
		user.email, user.first_name = email, email.split("@")[0]
		user.append("roles", {"role": role})
		user.flags.no_welcome_mail = True
		user.insert(ignore_permissions=True)
		frappe.get_doc(
			{"doctype": "User Permission", "user": email, "allow": "Trust", "for_value": "ZA1"}
		).insert(ignore_permissions=True)
		return email

	@classmethod
	def application_owned_by(cls, staff):
		base = IntegrationTestAdmissionApplication
		enquiry = base.paid_lead(base.cse, base.cse_intake, counsellor=staff)
		return start_application(enquiry)["name"]

	def _visible_to(self, user):
		frappe.set_user(user)
		try:
			return set(frappe.get_list("Admission Application", pluck="name"))
		finally:
			frappe.set_user("Administrator")

	def test_a_counsellor_sees_only_their_own_applicants(self):
		visible = self._visible_to("za-counsellor-a@example.com")
		self.assertIn(self.app_a, visible)
		self.assertNotIn(self.app_b, visible)

	def test_a_manager_sees_every_application_in_their_trust(self):
		visible = self._visible_to("za-manager@example.com")
		self.assertIn(self.app_a, visible)
		self.assertIn(self.app_b, visible)

	def test_a_counsellor_cannot_read_another_s_application_directly(self):
		frappe.set_user("za-counsellor-a@example.com")
		try:
			with self.assertRaises(frappe.PermissionError):
				frappe.get_doc("Admission Application", self.app_b).check_permission("read")
		finally:
			frappe.set_user("Administrator")

	def test_the_owner_is_taken_from_the_lead_not_from_the_caller(self):
		doc = frappe.get_doc("Admission Application", self.app_a)
		doc.counsellor = self.staff_b
		doc.save()
		self.assertEqual(doc.counsellor, self.staff_a, "a posted owner must not survive validate")
