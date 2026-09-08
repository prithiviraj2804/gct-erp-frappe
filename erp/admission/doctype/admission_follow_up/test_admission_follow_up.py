# Copyright (c) 2026, Prithivi and Contributors
# See license.txt

"""What logging a follow-up does to its lead, and who may log or see one.

Every follow-up rolls a summary up onto its Admission Enquiry — last contacted, last outcome,
attempt count, next step, and the derived follow-up state an admin scans by. A counsellor may only
log follow-ups on leads assigned to them and only sees their own; a manager sees all. Own fixtures
under a `ZF` prefix; IntegrationTestCase rolls it back at teardown.
"""

import itertools

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import add_days, getdate, today


class IntegrationTestAdmissionFollowUp(IntegrationTestCase):
	INST = "ZF1"
	COL = "ZF1COL"

	COUNSELLOR_A = "zf-counsellor-a@example.com"
	COUNSELLOR_B = "zf-counsellor-b@example.com"
	MANAGER = "zf-manager@example.com"

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls._aadhaar = itertools.count(500000000001)

		cls.ensure(
			"Programme Level", "UG", {"level_code": "UG", "level_name": "Undergraduate", "level_order": 1}
		)
		degree = cls.ensure(
			"Degree", "ZFDEG", {"degree_code": "ZFDEG", "degree_name": "F Bachelor", "programme_level": "UG"}
		)
		structure = cls.ensure(
			"Academic Structure",
			"ZFSEM",
			{
				"structure_code": "ZFSEM",
				"structure_name": "F Semester",
				"terms_per_year": 2,
				"term_label": "Semester",
			},
		)
		cls.ensure(
			"Admission Type", "REG", {"type_code": "REG", "type_name": "Regular", "default_entry_semester": 1}
		)

		cls.ensure("Trust", cls.INST, {"trust_code": cls.INST, "trust_name": "F Institute"})
		cls.ensure(
			"Institution",
			cls.COL,
			{"trust": cls.INST, "institution_code": cls.COL, "institution_name": "F Institution"},
		)
		cls.dept = (
			frappe.get_doc(
				{
					"doctype": "Department",
					"trust": cls.INST,
					"institution": cls.COL,
					"department_code": "ZF1DEP",
					"department_name": "F Dept",
				}
			)
			.insert()
			.name
		)
		cls.programme = (
			frappe.get_doc(
				{
					"doctype": "Programme",
					"institution": cls.COL,
					"department": cls.dept,
					"degree": degree,
					"academic_structure": structure,
					"programme_code": "ZF1UG",
					"programme_name": "F B.Tech",
					"duration_years": 4,
					"total_terms": 8,
					"required_prior_qualification": "12th",
				}
			)
			.insert()
			.name
		)
		frappe.get_doc(
			{
				"doctype": "Academic Year",
				"trust": cls.INST,
				"year_code": "2050-51",
				"title": "F 2050-51",
				"start_date": "2050-06-01",
				"end_date": "2051-05-31",
				"is_admission_open": 1,
			}
		).insert()

		cls.staff_a = cls.make_counsellor("ZFCA", cls.COUNSELLOR_A)
		cls.staff_b = cls.make_counsellor("ZFCB", cls.COUNSELLOR_B)
		cls.make_user(cls.MANAGER, "Admission Manager")

	# --- Fixture helpers ------------------------------------------------------------

	@staticmethod
	def ensure(doctype, name, values):
		if frappe.db.exists(doctype, name):
			return name
		return frappe.get_doc({"doctype": doctype, **values}).insert().name

	@classmethod
	def make_user(cls, email, role):
		if frappe.db.exists("User", email):
			return email
		user = frappe.new_doc("User")
		user.email = email
		user.first_name = email.split("@")[0]
		user.append("roles", {"role": role})
		user.flags.no_welcome_mail = True
		user.insert(ignore_permissions=True)
		return email

	@classmethod
	def make_counsellor(cls, code, email):
		cls.make_user(email, "Admission Counsellor")
		return (
			frappe.get_doc(
				{
					"doctype": "Staff",
					"trust": cls.INST,
					"institution": cls.COL,
					"staff_code": code,
					"staff_name": code,
					"user": email,
				}
			)
			.insert()
			.name
		)

	@classmethod
	def make_enquiry(cls, counsellor=None):
		doc = frappe.get_doc(
			{
				"doctype": "Admission Enquiry",
				"student_name": "Follow Up Case",
				"phone_number": "9876511111",
				"institution": cls.COL,
				"department": cls.dept,
				"programme": cls.programme,
				"admission_type": "REG",
				"aadhaar_number": f"{next(cls._aadhaar):012d}",
				"previous_education": [
					{
						"qualification_level": "12th",
						"board_university": "State Board",
						"year_of_passing": 2049,
						"percentage": 91.0,
					}
				],
			}
		)
		if counsellor:
			doc.counsellor = counsellor
		doc.insert()
		return doc.name

	def log(self, enquiry, **overrides):
		values = {
			"doctype": "Admission Follow-up",
			"enquiry": enquiry,
			"channel": "Call",
			"outcome": "Connected",
			"follow_up_on": today(),
		}
		values.update(overrides)
		return frappe.get_doc(values).insert()

	# --- Roll-up onto the lead -------------------------------------------------------

	def test_new_lead_starts_never_contacted(self):
		enquiry = frappe.get_doc("Admission Enquiry", self.make_enquiry(self.staff_a))
		self.assertEqual(enquiry.follow_up_state, "Never Contacted")
		self.assertIn(enquiry.follow_up_count, (0, None))

	def test_follow_up_rolls_up_onto_the_lead(self):
		enquiry_name = self.make_enquiry(self.staff_a)
		self.log(enquiry_name, outcome="Interested", next_follow_up_on=add_days(today(), 3))

		enquiry = frappe.get_doc("Admission Enquiry", enquiry_name)
		self.assertEqual(enquiry.follow_up_count, 1)
		self.assertEqual(enquiry.last_outcome, "Interested")
		self.assertEqual(getdate(enquiry.next_follow_up), add_days(getdate(today()), 3))
		self.assertEqual(enquiry.follow_up_state, "Scheduled")
		self.assertIsNotNone(enquiry.last_contacted_on)

	def test_state_reflects_when_the_next_step_falls(self):
		overdue = self.make_enquiry(self.staff_a)
		self.log(overdue, next_follow_up_on=add_days(today(), -1))
		self.assertEqual(frappe.db.get_value("Admission Enquiry", overdue, "follow_up_state"), "Overdue")

		due = self.make_enquiry(self.staff_a)
		self.log(due, next_follow_up_on=today())
		self.assertEqual(frappe.db.get_value("Admission Enquiry", due, "follow_up_state"), "Due Today")

		no_next = self.make_enquiry(self.staff_a)
		self.log(no_next, outcome="No Answer")
		self.assertEqual(frappe.db.get_value("Admission Enquiry", no_next, "follow_up_state"), "No Next Step")

	def test_new_status_advances_the_lead_and_closes_it(self):
		enquiry_name = self.make_enquiry(self.staff_a)
		# "Rejected" closes the lead without entering the gated region, so this exercises the
		# follow-up mechanics rather than the pipeline gates — those have their own tests in
		# test_admission_application. "Admitted" would now need a fee, an application and verified
		# documents, none of which this test is about.
		self.log(
			enquiry_name,
			outcome="Not Interested",
			new_status="Rejected",
			next_follow_up_on=add_days(today(), 2),
		)

		enquiry = frappe.get_doc("Admission Enquiry", enquiry_name)
		self.assertEqual(enquiry.status, "Rejected")
		# A closed lead reads as Closed even though a future next step was set.
		self.assertEqual(enquiry.follow_up_state, "Closed")

	def test_deleting_a_follow_up_recomputes_the_lead(self):
		enquiry_name = self.make_enquiry(self.staff_a)
		self.log(enquiry_name, next_follow_up_on=add_days(today(), 1))
		second = self.log(enquiry_name, next_follow_up_on=add_days(today(), 9))
		self.assertEqual(frappe.db.get_value("Admission Enquiry", enquiry_name, "follow_up_count"), 2)

		second.delete()
		enquiry = frappe.get_doc("Admission Enquiry", enquiry_name)
		self.assertEqual(enquiry.follow_up_count, 1)
		self.assertEqual(getdate(enquiry.next_follow_up), add_days(getdate(today()), 1))

	# --- Who may log, who may see ----------------------------------------------------

	def test_counsellor_can_only_log_on_their_own_lead(self):
		lead_of_a = self.make_enquiry(self.staff_a)
		frappe.set_user(self.COUNSELLOR_B)
		try:
			with self.assertRaises(frappe.PermissionError):
				self.log(lead_of_a, outcome="Connected")
		finally:
			frappe.set_user("Administrator")

	def test_counsellor_sees_only_their_own_follow_ups(self):
		a_lead = self.make_enquiry(self.staff_a)
		b_lead = self.make_enquiry(self.staff_b)
		a_fu = self.log(a_lead).name
		b_fu = self.log(b_lead).name

		frappe.set_user(self.COUNSELLOR_A)
		try:
			visible = set(frappe.get_list("Admission Follow-up", pluck="name"))
		finally:
			frappe.set_user("Administrator")

		self.assertIn(a_fu, visible)
		self.assertNotIn(b_fu, visible)

	def test_manager_sees_every_follow_up(self):
		a_fu = self.log(self.make_enquiry(self.staff_a)).name
		b_fu = self.log(self.make_enquiry(self.staff_b)).name

		frappe.set_user(self.MANAGER)
		try:
			visible = set(frappe.get_list("Admission Follow-up", pluck="name"))
		finally:
			frappe.set_user("Administrator")

		self.assertLessEqual({a_fu, b_fu}, visible)

	# --- The dashboard ---------------------------------------------------------------

	def test_dashboard_counts_are_scoped_to_the_caller(self):
		from erp.api.admission.dashboard import lead_dashboard

		a_lead = self.make_enquiry(self.staff_a)
		self.log(a_lead, next_follow_up_on=add_days(today(), -2))  # overdue
		self.make_enquiry(self.staff_b)  # counsellor B's, invisible to A

		frappe.set_user(self.COUNSELLOR_A)
		try:
			data = lead_dashboard()
		finally:
			frappe.set_user("Administrator")

		# Counsellor A's dashboard only counts A's leads, and sees the overdue one.
		owners = {row["counsellor"] for row in data["overdue_by_counsellor"]}
		self.assertEqual(owners, {self.staff_a})
		self.assertGreaterEqual(data["overdue_total"], 1)
