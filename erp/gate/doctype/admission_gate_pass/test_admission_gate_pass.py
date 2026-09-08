# Copyright (c) 2026, Prithivi and Contributors
# See license.txt

"""What a pass raised at the admission gate must not be allowed to record.

Fixtures build two complete, disjoint trusts (A and B) — each with a campus, a
institution and a staff member — so every test can reach for a legitimate record and an alien
one of the same doctype. Trust A additionally owns the open admission year and a
consultancy, because A is the tenant the passes are raised under.

Nothing is committed: `IntegrationTestCase` rolls the connection back at class teardown.
"""

import itertools
import uuid

import frappe
from frappe.tests import IntegrationTestCase

from erp.master.hierarchy import HierarchyMismatchError

# Codes are prefixed `ZG` so they cannot collide with real master data on a dev site.
TRUST_A = "ZGA"
TRUST_B = "ZGB"
CAMPUS_A = "ZGA-MAIN"
CAMPUS_B = "ZGB-MAIN"
INSTITUTION_A = "ZGACOL"
INSTITUTION_B = "ZGBCOL"

IN_TIME = "2030-06-01 09:00:00"

# `photo` is reqd, and Attach Image only checks that the column is non-empty — the bytes
# behind the URL are the File doctype's business, not this doctype's.
PHOTO = "/private/files/zg-test-visitor.png"

STAFF_1 = "Anitha Ramesh"
STAFF_2 = "Bala Subramani"
STAFF_3 = "Chitra Devi"


class IntegrationTestAdmissionGatePass(IntegrationTestCase):
	# One admission per Aadhaar per trust per year is now enforced, and this class inserts
	# many passes that outlive one another (IntegrationTestCase rolls back once, at class teardown,
	# not between tests). So the factory mints a fresh Aadhaar per call — real visitors never share
	# one — and the tests that actually exercise the number override it explicitly.
	_aadhaar_counter = itertools.count(1)

	@classmethod
	def setUpClass(cls):
		super().setUpClass()

		for code, name in ((TRUST_A, "Alpha Institute"), (TRUST_B, "Beta Institute")):
			frappe.get_doc({"doctype": "Trust", "trust_code": code, "trust_name": name}).insert()

		for trust in (TRUST_A, TRUST_B):
			frappe.get_doc(
				{
					"doctype": "Campus",
					"trust": trust,
					"campus_code": "MAIN",
					"campus_name": f"{trust} Main Campus",
				}
			).insert()

		for trust, campus, code in (
			(TRUST_A, CAMPUS_A, INSTITUTION_A),
			(TRUST_B, CAMPUS_B, INSTITUTION_B),
		):
			frappe.get_doc(
				{
					"doctype": "Institution",
					"trust": trust,
					"campus": campus,
					"institution_code": code,
					"institution_name": f"{code} Institution",
				}
			).insert()

		# Only trust A has admissions open, so a pass raised under B leaves the year
		# blank rather than borrowing A's.
		year_a = frappe.get_doc(
			{
				"doctype": "Academic Year",
				"trust": TRUST_A,
				"year_code": "2030-31",
				"title": f"{TRUST_A} 2030-31",
				"start_date": "2030-06-01",
				"end_date": "2031-05-31",
				"is_admission_open": 1,
			}
		)
		year_a.insert()
		cls.year_a = year_a.name

		# Staff and Consultancy are named by their own naming rules, which this slice does
		# not own — keep the generated names rather than assuming their shape.
		# Two staff records are enough now that only the Staff Reference route links one:
		# A's to be accepted, B's to be refused. The three accountable-staff slots are typed
		# names and need no records at all.
		cls.staff_a = cls.make_staff(TRUST_A, INSTITUTION_A, "ZGASTF1", "Alpha Counsellor")
		cls.staff_b = cls.make_staff(TRUST_B, INSTITUTION_B, "ZGBSTF1", "Beta Counsellor")

		cls.consultancy_a = cls.make_consultancy(TRUST_A, "ZGACON", "Alpha Admissions Partner")
		cls.consultancy_b = cls.make_consultancy(TRUST_B, "ZGBCON", "Beta Admissions Partner")

	@staticmethod
	def make_staff(trust, institution, code, name):
		staff = frappe.get_doc(
			{
				"doctype": "Staff",
				"trust": trust,
				"institution": institution,
				"staff_code": code,
				"staff_name": name,
			}
		)
		staff.insert()
		return staff.name

	@staticmethod
	def make_consultancy(trust, code, name):
		consultancy = frappe.get_doc(
			{
				"doctype": "Consultancy",
				"trust": trust,
				"consultancy_code": code,
				"consultancy_name": name,
			}
		)
		consultancy.insert()
		return consultancy.name

	@classmethod
	def make_pass(cls, **overrides):
		values = {
			"doctype": "Admission Gate Pass",
			"student_name": "Arun Kumar",
			"phone_number": "9876543210",
			"aadhaar_number": f"{next(cls._aadhaar_counter):012d}",
			"parent_name": "Kumar S",
			"native_place": "Madurai",
			"institution": INSTITUTION_A,
			"reference": "Direct Admission",
			"reference_staff_1": STAFF_1,
			"photo": PHOTO,
			"in_time": IN_TIME,
		}
		values.update(overrides)
		return frappe.get_doc(values)

	# --- The happy path -------------------------------------------------------------

	def test_valid_pass_inserts(self):
		gate_pass = self.make_pass()
		gate_pass.insert()

		self.assertTrue(gate_pass.name.startswith("AGP-"), gate_pass.name)
		self.assertEqual(str(uuid.UUID(gate_pass.id)), gate_pass.id)
		self.assertEqual(gate_pass.trust, TRUST_A)
		self.assertEqual(gate_pass.status, "Inside")

	def test_academic_year_comes_from_the_open_admission_year(self):
		"""The desk never picks the year — it follows from the institution's trust."""
		gate_pass = self.make_pass()
		gate_pass.insert()

		self.assertEqual(gate_pass.academic_year, self.year_a)

	def test_moving_the_pass_to_another_trust_redraws_the_year(self):
		"""Correcting the institution to one under a different trust has to be savable.

		The year is read-only, so a stale one left on the row would be a hierarchy mismatch
		the desk is given no way to clear — the pass would be stuck, unfixable, for as long
		as it existed. B has no year flagged open, so the redraw here lands on blank.
		"""
		gate_pass = self.make_pass()
		gate_pass.insert()
		self.assertEqual(gate_pass.academic_year, self.year_a)

		gate_pass.institution = INSTITUTION_B
		gate_pass.save()

		self.assertEqual(gate_pass.trust, TRUST_B)
		self.assertFalse(gate_pass.academic_year)

	# --- Tenant boundaries ----------------------------------------------------------

	def test_rejects_institution_from_another_trust(self):
		"""`trust` is `fetch_from` institution and normally rewritten from it, but
		`flags.ignore_links` skips that rewrite — the controller has to catch it."""
		gate_pass = self.make_pass(institution=INSTITUTION_B, trust=TRUST_A)
		gate_pass.flags.ignore_links = True

		with self.assertRaises(HierarchyMismatchError):
			gate_pass.insert()

	def test_rejects_a_referring_staff_from_another_trust(self):
		"""A Link to Staff accepts any staff member in the system; only this check stops
		one trust's counsellor being credited with another's walk-in."""
		gate_pass = self.make_pass(reference="Staff Reference", staff_reference=self.staff_b)

		with self.assertRaises(HierarchyMismatchError):
			gate_pass.insert()

	def test_accepts_a_referring_staff_from_its_own_trust(self):
		gate_pass = self.make_pass(reference="Staff Reference", staff_reference=self.staff_a)
		gate_pass.insert()

		self.assertEqual(gate_pass.staff_reference, self.staff_a)

	def test_rejects_consultancy_from_another_trust(self):
		gate_pass = self.make_pass(reference="Consultancy Reference", consultancy=self.consultancy_b)

		with self.assertRaises(HierarchyMismatchError):
			gate_pass.insert()

	def test_accepts_consultancy_from_its_own_trust(self):
		gate_pass = self.make_pass(reference="Consultancy Reference", consultancy=self.consultancy_a)
		gate_pass.insert()

		self.assertEqual(gate_pass.consultancy, self.consultancy_a)

	# --- Identity fields ------------------------------------------------------------

	def test_rejects_aadhaar_that_is_not_twelve_digits(self):
		gate_pass = self.make_pass(aadhaar_number="12345678901")

		with self.assertRaises(frappe.ValidationError):
			gate_pass.insert()

	def test_stores_aadhaar_stripped_of_spacing(self):
		gate_pass = self.make_pass(aadhaar_number="1234 5678 9012")
		gate_pass.insert()

		self.assertEqual(gate_pass.aadhaar_number, "123456789012")

	def test_stores_phone_without_country_code_or_punctuation(self):
		gate_pass = self.make_pass(phone_number="+91 98765 43210")
		gate_pass.insert()

		self.assertEqual(gate_pass.phone_number, "9876543210")

	def test_rejects_a_short_phone_number(self):
		gate_pass = self.make_pass(phone_number="9876543")

		with self.assertRaises(frappe.ValidationError):
			gate_pass.insert()

	# --- One admission per student --------------------------------------------------

	def test_rejects_a_second_pass_for_the_same_aadhaar_in_one_cycle(self):
		"""Two passes for one visitor could name different referrers, and every referral count
		built on that column would charge the admission twice."""
		aadhaar = "700000000000"
		self.make_pass(aadhaar_number=aadhaar).insert()

		duplicate = self.make_pass(aadhaar_number=aadhaar, student_name="Priya M")
		with self.assertRaises(frappe.ValidationError):
			duplicate.insert()

	def test_accepts_the_same_aadhaar_in_a_later_admission_year(self):
		"""The rule is scoped to the cycle: a returning student is a fresh admission, not a
		duplicate, so the same Aadhaar in a different year of the same trust is allowed."""
		aadhaar = "700000000001"
		first = self.make_pass(aadhaar_number=aadhaar)
		first.insert()
		self.assertEqual(first.academic_year, self.year_a)

		# A second cycle at the same trust. Left un-opened so it never displaces the year
		# the desk auto-picks for every other pass in this class.
		year_2 = frappe.get_doc(
			{
				"doctype": "Academic Year",
				"trust": TRUST_A,
				"year_code": "2031-32",
				"title": f"{TRUST_A} 2031-32",
				"start_date": "2031-06-01",
				"end_date": "2032-05-31",
			}
		).insert()

		# `academic_year` is read-only and auto-set, but an explicit year on the same trust
		# is kept rather than redrawn (set_academic_year), so this pins the pass to the new cycle.
		second = self.make_pass(aadhaar_number=aadhaar, academic_year=year_2.name)
		second.insert()

		self.assertEqual(second.academic_year, year_2.name)

	def test_accepts_the_same_aadhaar_at_a_different_trust(self):
		"""Trusts are separate tenants — one student may enrol at two of them, and the
		check must scope to the trust, not just fall open on B's blank year."""
		aadhaar = "700000000002"
		self.make_pass(aadhaar_number=aadhaar).insert()

		# B has no open admission year, so a B pass would otherwise land on a blank year and slip
		# past via the blank-year guard. Give it an explicit (un-opened) cycle so the *trust*
		# is what keeps the two apart — and so B still reads as "no year open" for other tests.
		year_b = frappe.get_doc(
			{
				"doctype": "Academic Year",
				"trust": TRUST_B,
				"year_code": "2030-31",
				"title": f"{TRUST_B} 2030-31",
				"start_date": "2030-06-01",
				"end_date": "2031-05-31",
			}
		).insert()

		second = self.make_pass(institution=INSTITUTION_B, aadhaar_number=aadhaar, academic_year=year_b.name)
		second.insert()

		self.assertEqual(second.trust, TRUST_B)
		self.assertEqual(second.academic_year, year_b.name)

	def test_rejects_editing_an_aadhaar_onto_one_already_in_the_cycle(self):
		"""The guard has to catch the edit path too, not just the insert — otherwise a second
		student's pass can be quietly moved onto the first's Aadhaar after the fact."""
		self.make_pass(aadhaar_number="700000000003").insert()
		mover = self.make_pass(aadhaar_number="700000000004", student_name="Divya R")
		mover.insert()

		mover.aadhaar_number = "700000000003"
		with self.assertRaises(frappe.ValidationError):
			mover.save()

	# --- Reference route ------------------------------------------------------------

	def test_changing_the_route_drops_the_previous_referrer(self):
		"""Otherwise the agency stays attached to an enquiry it did not send, and every
		referral count built on that column credits it."""
		gate_pass = self.make_pass(reference="Consultancy Reference", consultancy=self.consultancy_a)
		gate_pass.insert()
		self.assertEqual(gate_pass.consultancy, self.consultancy_a)

		gate_pass.reference = "Direct Admission"
		gate_pass.save()

		self.assertFalse(gate_pass.consultancy)

	def test_rejects_the_same_staff_in_two_slots(self):
		"""Every slot, not just the second: a check that covers two of the three would leave
		the third free to duplicate, which is the same accountability hole unguarded."""
		for slot in ("reference_staff_2", "reference_staff_3"):
			with self.subTest(slot=slot):
				gate_pass = self.make_pass(**{slot: STAFF_1})

				with self.assertRaises(frappe.ValidationError):
					gate_pass.insert()

	def test_rejects_the_same_staff_typed_differently(self):
		"""Typed names, so " anitha  ramesh " and "Anitha Ramesh" are one person to
		everyone except a string equality test."""
		gate_pass = self.make_pass(reference_staff_2="  anitha   RAMESH ")

		with self.assertRaises(frappe.ValidationError):
			gate_pass.insert()

	def test_trims_typed_staff_names(self):
		"""A stray space would otherwise split one person across two rows of any count."""
		gate_pass = self.make_pass(reference_staff_1="  Anitha Ramesh  ")
		gate_pass.insert()

		self.assertEqual(gate_pass.reference_staff_1, "Anitha Ramesh")

	def test_accepts_three_different_staff(self):
		gate_pass = self.make_pass(reference_staff_2=STAFF_2, reference_staff_3=STAFF_3)
		gate_pass.insert()

		self.assertEqual(gate_pass.reference_staff_2, STAFF_2)
		self.assertEqual(gate_pass.reference_staff_3, STAFF_3)

	def test_rejects_a_route_that_names_no_referrer(self):
		"""`mandatory_depends_on` is a Desk rule the server never evaluates, so a route with
		nobody on the end of it reaches the database unless the controller stops it."""
		for reference, fieldname in (
			("Staff Reference", "staff_reference"),
			("Consultancy Reference", "consultancy"),
			("Student Reference", "student_reference"),
			("Other", "source_details"),
		):
			with self.subTest(reference=reference):
				gate_pass = self.make_pass(reference=reference)

				with self.assertRaises(frappe.MandatoryError):
					gate_pass.insert()

				self.assertFalse(gate_pass.get(fieldname))

	def test_accepts_direct_admission_with_no_remarks(self):
		"""Direct Admission is the one route that explains itself — the shared remarks field
		is offered but never demanded, or every walk-in costs the desk a sentence."""
		gate_pass = self.make_pass(reference="Direct Admission")
		gate_pass.insert()

		self.assertFalse(gate_pass.source_details)

	def test_rejects_a_pass_with_no_photo(self):
		gate_pass = self.make_pass(photo=None)

		with self.assertRaises(frappe.MandatoryError):
			gate_pass.insert()

	def test_rejects_a_vehicle_with_no_number(self):
		gate_pass = self.make_pass(vehicle=1)

		with self.assertRaises(frappe.MandatoryError):
			gate_pass.insert()

	# --- Movement -------------------------------------------------------------------

	def test_rejects_an_out_time_before_the_in_time(self):
		gate_pass = self.make_pass()
		gate_pass.insert()

		gate_pass.out_time = "2030-06-01 08:00:00"
		with self.assertRaises(frappe.ValidationError):
			gate_pass.save()

	def test_out_time_flips_status_to_exited(self):
		"""Status is derived from the stamps, so it moves without anyone setting it."""
		gate_pass = self.make_pass()
		gate_pass.insert()
		self.assertEqual(gate_pass.status, "Inside")

		gate_pass.out_time = "2030-06-01 17:30:00"
		gate_pass.save()

		self.assertEqual(gate_pass.status, "Exited")
