# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""The shipped configuration, asserted for every kind of institution the app claims to serve.

`docs/CONFIGURATION.md` §5 promised this file and named what it is for: "Without it the config
layer rots invisibly." It also, as specified, would not have caught the thing that was actually
wrong — it asserted config *scalars*, and the live defect was that `Arts & Science` hangs off `All`
and therefore inherited neither shipped Field Policy, so its enquiry form was the raw professional
superset. No scalar was wrong. Nothing resolved to the wrong value. The type simply had no policy,
and no test noticed because **no test instantiated an institution of that type**.

A grep of every test file for an institution type literal used to return Engineering 14 times,
School twice, Professional twice, `All` three times, and nothing else. Seven of the nine types the
app ships were never instantiated anywhere.

So this gate does both halves:

* every registered key resolves to a checked-in value, for one institution of every type; and
* an Admission Enquiry **saves** at each of them, and the trust-wide funnel **counts it**.

The second half is the one that would have caught it, and it is the one every future slice needs:
a governed field added for a school gets proved for School and Engineering and shipped for nine.
"""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import today

from erp.api.config import explain_config
from erp.config.resolver import ConfigError, clear_cache, explain, get_config, get_many
from erp.config.settings import ALL_KEYS
from erp.seed import restore_shipped_field_policies

# What every registered key resolves to for an institution of each type, with nothing overridden.
# Checked in deliberately: a change here is a change to what the app does out of the box, and it
# should show up in a diff rather than in a support call.
#
# `requires_admission_interaction` is None everywhere but School, and that is not an omission — the
# gate owns its own default for silence (off), which is why the setting ships no default. See
# `erp/admission/stages.py`.
SHIPPED = {
	"School": {
		"requires_department": "No",
		"requires_application_fee": "Yes",
		"requires_admission_interaction": "Yes",
		"default_admission_route": "Direct",
		"student_register_series": "{trust}-STU-.#####",
	},
	"Arts & Science": {
		"requires_department": "Yes",
		"requires_application_fee": "Yes",
		"requires_admission_interaction": None,
		"default_admission_route": "Direct",
		"student_register_series": "{trust}-STU-.#####",
	},
	"_professional": {
		"requires_department": "Yes",
		"requires_application_fee": "Yes",
		"requires_admission_interaction": None,
		"default_admission_route": "Government Quota",
		"student_register_series": "{trust}-STU-.#####",
	},
}

# The nine types a trust can actually put an institution under. `All` and `Professional` are groups
# and hold no institutions of their own.
LEAF_TYPES = (
	"School",
	"Arts & Science",
	"Engineering",
	"Medical",
	"Polytechnic",
	"Law",
	"MBA",
	"Nursing",
	"Pharmacy",
)


class IntegrationTestShippedConfig(IntegrationTestCase):
	TRUST = "ZG1"

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		# This class asserts what the app does **out of the box**, so it has to set up out-of-the-box
		# state rather than read whatever the site happens to hold. A Trust Admin is meant to tune a
		# shipped policy; read against a tuned one, every assertion here fails and none of the
		# tracebacks say why — six `Missing Information` errors naming fields, and nothing about the
		# configuration that made them required.
		#
		# Safe because `IntegrationTestCase` rolls the connection back at class teardown: the site's
		# own configuration is untouched. `erp/test_seed.py` reports divergence deliberately, which
		# is the other half — a gate must not fail on it, an operator still wants to see it.
		restore_shipped_field_policies()
		cls.ensure("Trust", cls.TRUST, {"trust_code": cls.TRUST, "trust_name": "Config Gate Trust"})
		cls.ensure(
			"Admission Type",
			"ZGREG",
			{"type_code": "ZGREG", "type_name": "Regular", "default_entry_semester": 1},
		)
		cls.year = cls.ensure(
			"Academic Year",
			f"{cls.TRUST}-2090-91",
			{
				"trust": cls.TRUST,
				"year_code": "2090-91",
				"title": "G 2090-91",
				"start_date": "2090-06-01",
				"end_date": "2091-05-31",
				"is_admission_open": 1,
			},
		)

		# One institution per type, and a programme under each. This is the fixture the app has
		# never had, and the reason seven of nine types were never exercised.
		cls.institutions = {}
		cls.programmes = {}
		for index, institution_type in enumerate(LEAF_TYPES):
			code = f"ZG{index:02d}"
			cls.institutions[institution_type] = cls.ensure(
				"Institution",
				code,
				{
					"trust": cls.TRUST,
					"institution_code": code,
					"institution_name": f"{institution_type} at {code}",
					"institution_type": institution_type,
				},
			)
			cls.programmes[institution_type] = cls.make_programme(institution_type, code)

	@staticmethod
	def ensure(doctype, name, values):
		if frappe.db.exists(doctype, name):
			return name
		return frappe.get_doc({"doctype": doctype, **values}).insert(ignore_permissions=True).name

	@classmethod
	def make_programme(cls, institution_type, code):
		"""A programme, with a department only where the type's own configuration asks for one.

		Written this way on purpose: the fixture reads the configuration rather than branching on
		the type, so it is itself a proof that `requires_department` is answerable per type.
		"""
		from erp.master.doctype.institution_type.institution_type import institution_requires_department

		institution = cls.institutions[institution_type]
		values = {
			"doctype": "Programme",
			"trust": cls.TRUST,
			"institution": institution,
			"programme_code": f"{code}P",
			"programme_name": f"Programme {code}",
			"programme_level": "UG",
			"academic_structure": "SEM",
			"duration_years": 1,
			"total_terms": 2,
		}
		if institution_requires_department(institution):
			values["department"] = cls.ensure(
				"Department",
				f"{institution}-{code}D",
				{
					"trust": cls.TRUST,
					"institution": institution,
					"department_code": f"{code}D",
					"department_name": f"Dept {code}",
				},
			)
		return frappe.get_doc(values).insert(ignore_permissions=True).name

	def expected(self, institution_type: str) -> dict:
		return SHIPPED.get(institution_type, SHIPPED["_professional"])

	# --- Half one: every key resolves to a checked-in value, for every type ----------

	def test_every_key_resolves_as_shipped_for_every_institution_type(self):
		for institution_type in LEAF_TYPES:
			with self.subTest(institution_type=institution_type):
				resolved = get_many(ALL_KEYS, institution=self.institutions[institution_type])
				self.assertEqual(resolved, self.expected(institution_type))

	def test_every_registered_key_is_asserted_here(self):
		"""So adding a key to the registry cannot skip this gate."""
		for institution_type, expected in SHIPPED.items():
			with self.subTest(institution_type=institution_type):
				self.assertEqual(set(expected), set(ALL_KEYS))

	# --- Half two: the journey actually runs at every type ---------------------------

	def test_an_enquiry_saves_at_every_institution_type(self):
		"""The half that would have caught the Arts & Science gap.

		No scalar was wrong. The type simply inherited no Field Policy, so its form collected the
		professional superset — and a scalars-only gate resolves nine correct answers and reports
		everything as fine.
		"""
		for institution_type in LEAF_TYPES:
			with self.subTest(institution_type=institution_type):
				enquiry = self.make_enquiry(institution_type)
				self.assertTrue(frappe.db.exists("Admission Enquiry", enquiry))

	def test_the_trust_wide_funnel_counts_every_institution_type(self):
		"""A configured institution that no rollup can see is worse than an unconfigured one."""
		from erp.admission.report.admission_funnel.admission_funnel import execute

		for institution_type in LEAF_TYPES:
			self.make_enquiry(institution_type)

		_columns, data = execute({"academic_year": self.year})
		counted = {row["institution"]: row["enquiries"] for row in data}

		for institution_type in LEAF_TYPES:
			with self.subTest(institution_type=institution_type):
				institution = self.institutions[institution_type]
				self.assertGreaterEqual(
					counted.get(institution, 0), 1, f"the funnel does not count {institution}"
				)

	def make_enquiry(self, institution_type: str) -> str:
		institution = self.institutions[institution_type]
		programme = self.programmes[institution_type]
		values = {
			"doctype": "Admission Enquiry",
			"enquiry_date": today(),
			"status": "New",
			"student_name": f"Probe {institution_type}",
			"phone_number": "9876900001",
			"institution": institution,
			"programme": programme,
			"academic_year": self.year,
			"admission_type": "ZGREG",
		}
		if department := frappe.db.get_value("Programme", programme, "department"):
			values["department"] = department
		return frappe.get_doc(values).insert(ignore_permissions=True).name


class IntegrationTestResolver(IntegrationTestCase):
	"""The chain itself: most specific wins, a blank is not an answer, an unknown key is a bug."""

	TRUST = "ZR1"
	INSTITUTION = "ZRENG"

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.ensure("Trust", cls.TRUST, {"trust_code": cls.TRUST, "trust_name": "Resolver Trust"})
		cls.ensure(
			"Institution",
			cls.INSTITUTION,
			{
				"trust": cls.TRUST,
				"institution_code": cls.INSTITUTION,
				"institution_name": "Resolver Engineering",
				"institution_type": "Engineering",
			},
		)
		cls.department = cls.ensure(
			"Department",
			f"{cls.INSTITUTION}-ZRD",
			{
				"trust": cls.TRUST,
				"institution": cls.INSTITUTION,
				"department_code": "ZRD",
				"department_name": "Resolver Dept",
			},
		)
		cls.programme = (
			frappe.get_doc(
				{
					"doctype": "Programme",
					"trust": cls.TRUST,
					"institution": cls.INSTITUTION,
					"department": cls.department,
					"programme_code": "ZRP",
					"programme_name": "Resolver Programme",
					"programme_level": "UG",
					"academic_structure": "SEM",
					"duration_years": 1,
					"total_terms": 2,
				}
			)
			.insert(ignore_permissions=True)
			.name
		)

	@staticmethod
	def ensure(doctype, name, values):
		if frappe.db.exists(doctype, name):
			return name
		return frappe.get_doc({"doctype": doctype, **values}).insert(ignore_permissions=True).name

	def setUp(self):
		super().setUp()
		self._written = []

	def tearDown(self):
		"""Drop this test's Config Value rows.

		`IntegrationTestCase` rolls the connection back at **class** teardown, not per test, so a
		row written by one test is visible to the next one in the class. That is fine for fixtures
		and wrong for the thing under test: the first version of this suite had four failures that
		were all one leaked override — `requires_application_fee` set to "No" by an earlier test,
		which then truncated `explain`'s chain at Institution level and made two other assertions
		read the wrong value. Cleaning up here rather than reaching for unique keys per test keeps
		each test asserting against the *shipped* configuration, which is the point of the file.
		"""
		for name in self._written:
			if frappe.db.exists("Config Value", name):
				frappe.delete_doc("Config Value", name, force=True, ignore_permissions=True)
		clear_cache()
		super().tearDown()

	def setting_value(self, key, value, **scope):
		row = frappe.get_doc({"doctype": "Config Value", "setting": key, "value": value, **scope})
		row.insert(ignore_permissions=True)
		self._written.append(row.name)
		return row

	def test_an_institution_override_beats_the_type(self):
		"""The four levels a capability column cannot reach, which is why this slice exists.

		A trust with one fee-free school among six fee-charging ones cannot say so on the type tree,
		because both are Schools.
		"""
		institution = self.INSTITUTION
		self.assertEqual(get_config("requires_application_fee", institution=institution), "Yes")

		self.setting_value("requires_application_fee", "No", scope_institution=institution)
		self.assertEqual(get_config("requires_application_fee", institution=institution), "No")

	def test_a_trust_wide_value_is_the_floor(self):
		trust = frappe.db.get_value("Institution", self.INSTITUTION, "trust")
		self.setting_value("student_register_series", "{trust}-REG-.#####", scope_trust=trust)
		self.assertEqual(
			get_config("student_register_series", institution=self.INSTITUTION),
			"{trust}-REG-.#####",
		)

	def test_the_institution_beats_the_trust(self):
		trust = frappe.db.get_value("Institution", self.INSTITUTION, "trust")
		self.setting_value("student_register_series", "{trust}-REG-.#####", scope_trust=trust)
		self.setting_value(
			"student_register_series", "{institution}-STU-.#####", scope_institution=self.INSTITUTION
		)
		self.assertEqual(
			get_config("student_register_series", institution=self.INSTITUTION),
			"{institution}-STU-.#####",
		)

	def test_a_blank_value_is_refused_rather_than_stored(self):
		with self.assertRaises(frappe.ValidationError) as caught:
			self.setting_value("student_register_series", "", scope_institution=self.INSTITUTION)
		self.assertIn("must state a value", str(caught.exception))

	def test_two_scopes_on_one_row_are_refused(self):
		trust = frappe.db.get_value("Institution", self.INSTITUTION, "trust")
		with self.assertRaises(frappe.ValidationError):
			self.setting_value(
				"student_register_series",
				"X-.#####",
				scope_trust=trust,
				scope_institution=self.INSTITUTION,
			)

	def test_no_scope_at_all_is_refused(self):
		with self.assertRaises(frappe.ValidationError):
			self.setting_value("student_register_series", "X-.#####")

	def test_two_rows_at_one_scope_are_refused(self):
		self.setting_value("student_register_series", "A-.#####", scope_institution=self.INSTITUTION)
		with self.assertRaises(frappe.ValidationError):
			self.setting_value("student_register_series", "B-.#####", scope_institution=self.INSTITUTION)

	def test_a_value_the_setting_would_refuse_is_caught_at_save(self):
		"""Not at the first read, and by the same function that validates the shipped default."""
		with self.assertRaises(frappe.ValidationError):
			self.setting_value("requires_application_fee", "Perhaps", scope_institution=self.INSTITUTION)

	def test_a_row_at_a_scope_the_column_answers_is_refused(self):
		"""The worst configuration bug there is: it saves, and nothing changes.

		Where a setting names an `institution_type_field`, the column is the source at that level
		and the resolver never looks at a row. Accepting one would let a Trust Admin set it, see it
		saved, and get no behaviour change.
		"""
		with self.assertRaises(frappe.ValidationError) as caught:
			self.setting_value("requires_application_fee", "No", scope_institution_type="Engineering")
		self.assertIn("would be ignored", str(caught.exception))

	def test_an_unregistered_key_is_an_error_not_a_none(self):
		"""A resolver that answered None for a typo would make every typo a silent behaviour change."""
		with self.assertRaises(ConfigError):
			get_config("requires_applicaton_fee", institution=self.INSTITUTION)

	def test_a_required_key_with_no_answer_throws(self):
		frappe.db.set_value("Config Setting", "student_register_series", "default_value", "")
		clear_cache()
		try:
			with self.assertRaises(ConfigError):
				get_config("student_register_series", institution=self.INSTITUTION)
		finally:
			frappe.db.set_value(
				"Config Setting", "student_register_series", "default_value", "{trust}-STU-.#####"
			)
			clear_cache()

	def test_an_explicit_default_suppresses_the_throw(self):
		"""A caller who has said what to do when nothing is stated has answered the question."""
		frappe.db.set_value("Config Setting", "student_register_series", "default_value", "")
		clear_cache()
		try:
			self.assertEqual(
				get_config("student_register_series", institution=self.INSTITUTION, default="X"), "X"
			)
		finally:
			frappe.db.set_value(
				"Config Setting", "student_register_series", "default_value", "{trust}-STU-.#####"
			)
			clear_cache()

	def test_explain_renders_the_whole_chain(self):
		trace = explain("requires_application_fee", institution=self.INSTITUTION)

		levels = [step["scope_type"] for step in trace.steps]
		self.assertEqual(levels[:3], ["Institution", "Institution Type", "Institution Type"])
		self.assertIn("Trust", levels)
		self.assertTrue(any(step["decided"] for step in trace.steps))
		self.assertEqual(trace.value, "Yes")

	def test_explain_names_the_column_as_the_source_where_one_answers(self):
		trace = explain("requires_department", institution=self.INSTITUTION)
		type_steps = [step for step in trace.steps if step["scope_type"] == "Institution Type"]
		self.assertTrue(type_steps)
		self.assertEqual(type_steps[0]["source"], "Institution Type.requires_department")

	def test_a_written_value_is_readable_in_the_same_request(self):
		"""The trap the request memo creates and `clear_cache` has to close.

		A `validate()` that writes config and then reads it back would otherwise see the pre-write
		value — the shared cache entry was dropped but the request memo still held the old dict.
		"""
		self.assertEqual(get_config("requires_application_fee", institution=self.INSTITUTION), "Yes")
		self.setting_value("requires_application_fee", "No", scope_institution=self.INSTITUTION)
		self.assertEqual(get_config("requires_application_fee", institution=self.INSTITUTION), "No")

	def test_an_intake_anchor_completes_the_whole_chain_upward(self):
		"""Anchors are completed, not required: a gate asks with whatever it happens to hold."""
		from erp.config.resolver import scope_chain

		chain = scope_chain(programme=self.programme)
		levels = [scope_type for scope_type, _name in chain]
		self.assertEqual(levels[0], "Programme")
		self.assertIn("Institution", levels)
		self.assertIn("Institution Type", levels)
		self.assertEqual(levels[-1], "Trust")


class IntegrationTestRegisterSeries(IntegrationTestCase):
	"""The defect slice 4 was scheduled for, and the roadmap's own proof that it is fixed.

	`Student.autoname` hardcoded `f"{self.trust}-STU-.#####"` while its docstring said "the series
	is keyed on the trust because each one keeps its own register; two institutions of the same
	group never share a run of numbers". The statement and the code said opposite things and the
	code won: GIS, GCE and GCT drew from one counter.

	The roadmap's proof was "two institutions produce different `tabSeries` keys". That is what this
	asserts, because it is the thing that actually matters — two institutions sharing a `tabSeries`
	row share a register however their numbers are formatted.
	"""

	TRUST = "ZN1"
	SHARED = "ZNSHA"
	OWN = "ZNOWN"

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.ensure("Trust", cls.TRUST, {"trust_code": cls.TRUST, "trust_name": "Register Trust"})
		cls.ensure(
			"Admission Type",
			"ZNREG",
			{"type_code": "ZNREG", "type_name": "Regular", "default_entry_semester": 1},
		)
		cls.year = cls.ensure(
			"Academic Year",
			f"{cls.TRUST}-2100-01",
			{
				"trust": cls.TRUST,
				"year_code": "2100-01",
				"title": "N 2100-01",
				"start_date": "2100-06-01",
				"end_date": "2101-05-31",
				"is_admission_open": 1,
			},
		)
		cls.programmes = {}
		cls.intakes = {}
		for code in (cls.SHARED, cls.OWN):
			cls.ensure(
				"Institution",
				code,
				{
					"trust": cls.TRUST,
					"institution_code": code,
					"institution_name": f"{code} School",
					"institution_type": "School",
				},
			)
			cls.programmes[code] = (
				frappe.get_doc(
					{
						"doctype": "Programme",
						"trust": cls.TRUST,
						"institution": code,
						"programme_code": f"{code}P",
						"programme_name": f"Class at {code}",
						"programme_level": "UG",
						"academic_structure": "SEM",
						"duration_years": 1,
						"total_terms": 2,
					}
				)
				.insert(ignore_permissions=True)
				.name
			)
			cls.intakes[code] = (
				frappe.get_doc(
					{
						"doctype": "Programme Intake",
						"academic_year": cls.year,
						"programme": cls.programmes[code],
						"total_seats": 40,
						"status": "Open",
						"application_fee": 0,
					}
				)
				.insert(ignore_permissions=True)
				.name
			)

	@staticmethod
	def ensure(doctype, name, values):
		if frappe.db.exists(doctype, name):
			return name
		return frappe.get_doc({"doctype": doctype, **values}).insert(ignore_permissions=True).name

	def make_student(self, institution):
		return frappe.get_doc(
			{
				"doctype": "Student",
				"student_name": f"Register Probe {institution}",
				"date_of_admission": today(),
				"status": "Active",
				"trust": self.TRUST,
				"institution": institution,
				"programme": self.programmes[institution],
				"programme_intake": self.intakes[institution],
				"academic_year": self.year,
				"admission_type": "ZNREG",
			}
		).insert(ignore_permissions=True)

	def test_the_shipped_default_is_byte_identical_to_what_was_hardcoded(self):
		"""So no existing site renumbers its statutory register on upgrade."""
		self.assertEqual(get_config("student_register_series", institution=self.SHARED), "{trust}-STU-.#####")

	def test_two_institutions_share_one_run_until_one_is_configured(self):
		"""The defect, stated as a test rather than as a docstring that was not true."""
		first = self.make_student(self.SHARED)
		second = self.make_student(self.OWN)
		self.assertTrue(first.name.startswith(f"{self.TRUST}-STU-"))
		self.assertTrue(second.name.startswith(f"{self.TRUST}-STU-"))

	def test_an_institution_configured_with_its_own_series_gets_its_own_run(self):
		"""One Config Value row, no deploy and no patch — which was the whole point of the slice."""
		row = frappe.get_doc(
			{
				"doctype": "Config Value",
				"setting": "student_register_series",
				"value": "{institution}-STU-.#####",
				"scope_institution": self.OWN,
				"remarks": "This school keeps its own statutory register.",
			}
		).insert(ignore_permissions=True)
		try:
			shared = self.make_student(self.SHARED)
			own = self.make_student(self.OWN)

			self.assertTrue(shared.name.startswith(f"{self.TRUST}-STU-"))
			self.assertTrue(own.name.startswith(f"{self.OWN}-STU-"))

			# The thing that actually matters: two `tabSeries` rows, so the two registers cannot
			# interleave however their numbers are formatted.
			self.assertTrue(frappe.db.exists("Series", {"name": f"{self.TRUST}-STU-"}))
			self.assertTrue(frappe.db.exists("Series", {"name": f"{self.OWN}-STU-"}))
		finally:
			frappe.delete_doc("Config Value", row.name, force=True, ignore_permissions=True)
			clear_cache()

	def test_a_series_naming_an_anchor_the_student_lacks_is_refused(self):
		"""Rather than substituting a literal `{academic_year}` into a statutory register number."""
		row = frappe.get_doc(
			{
				"doctype": "Config Value",
				"setting": "student_register_series",
				"value": "{academic_year}-STU-.#####",
				"scope_institution": self.OWN,
			}
		).insert(ignore_permissions=True)
		try:
			with self.assertRaises(frappe.ValidationError) as caught:
				frappe.get_doc(
					{
						"doctype": "Student",
						"student_name": "No Year",
						"date_of_admission": today(),
						"status": "Active",
						"trust": self.TRUST,
						"institution": self.OWN,
						"programme": self.programmes[self.OWN],
						"programme_intake": self.intakes[self.OWN],
						"admission_type": "ZNREG",
					}
				).insert(ignore_permissions=True)
			self.assertIn("academic_year", str(caught.exception))
		finally:
			frappe.delete_doc("Config Value", row.name, force=True, ignore_permissions=True)
			clear_cache()


class IntegrationTestExplainEndpoint(IntegrationTestCase):
	"""The endpoint is scoped, because `get_policy` — the shape it was specified from — was not.

	Its own fixtures rather than another class's. `IntegrationTestCase` rolls back per class, so
	borrowing a sibling's institution made the security assertion `skipTest` itself — and a skipped
	security test reads as a passing one in a summary line.
	"""

	TRUST = "ZE1"
	MINE = "ZEMINE"
	THEIRS = "ZETHEIR"
	USER = "ze-scoped@example.com"

	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls.ensure("Trust", cls.TRUST, {"trust_code": cls.TRUST, "trust_name": "Explain Trust"})
		for code in (cls.MINE, cls.THEIRS):
			cls.ensure(
				"Institution",
				code,
				{
					"trust": cls.TRUST,
					"institution_code": code,
					"institution_name": f"{code} College",
					"institution_type": "Engineering",
				},
			)
		if not frappe.db.exists("User", cls.USER):
			frappe.get_doc(
				{
					"doctype": "User",
					"email": cls.USER,
					"first_name": "Explain Scoped",
					"send_welcome_email": 0,
					"roles": [{"role": "Institution Admin"}],
				}
			).insert(ignore_permissions=True)
		if not frappe.db.exists(
			"User Permission", {"user": cls.USER, "allow": "Institution", "for_value": cls.MINE}
		):
			frappe.get_doc(
				{
					"doctype": "User Permission",
					"user": cls.USER,
					"allow": "Institution",
					"for_value": cls.MINE,
				}
			).insert(ignore_permissions=True)

	@staticmethod
	def ensure(doctype, name, values):
		if frappe.db.exists(doctype, name):
			return name
		return frappe.get_doc({"doctype": doctype, **values}).insert(ignore_permissions=True).name

	def test_it_refuses_an_institution_out_of_scope(self):
		with self.set_user(self.USER):
			with self.assertRaises(frappe.PermissionError):
				explain_config("requires_application_fee", institution=self.THEIRS)

	def test_it_allows_the_institution_the_caller_is_scoped_for(self):
		"""So the refusal above is a scope check and not a blanket denial."""
		with self.set_user(self.USER):
			trace = explain_config("requires_application_fee", institution=self.MINE)
		self.assertEqual(trace["value"], "Yes")

	def test_it_refuses_an_unregistered_key(self):
		with self.assertRaises(frappe.ValidationError):
			explain_config("requires_applicaton_fee", institution=self.MINE)

	def test_it_refuses_a_call_with_no_scope_at_all(self):
		with self.assertRaises(frappe.ValidationError):
			explain_config("requires_application_fee")
