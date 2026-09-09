# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""The app-wide conventions, tested rather than asserted in a docstring.

The UUID `id` column is the project's central convention and it was broken for every child table
from the day it was written — `before_insert` fires for the parent only, so no child row ever got
one, and a `unique: 1` index full of NULLs raised nothing. These tests exist because that failure
was invisible: nothing errored, nothing logged, and the JSON said the field was unique.
"""

import json
import pathlib
import re

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


# The flags the `id` convention specifies, verbatim from CLAUDE.md. `in_standard_filter` is
# deliberately not among them: it is right for Desk, and the SPA drops it on purpose
# (`_NEVER_FILTER` in erp/api/doctype.py), so a doctype that omits it has broken nothing.
ID_CONVENTION = {"fieldtype": "Data", "unique": 1, "read_only": 1, "no_copy": 1}


def app_doctypes() -> list[str]:
	"""Every doctype this app owns, child tables included — the `id` convention exempts nothing."""
	return frappe.get_all("DocType", filters={"module": ("in", frappe.get_module_list("erp"))}, pluck="name")


class IntegrationTestUuidColumnIsDeclared(IntegrationTestCase):
	"""Every doctype in this app must *declare* the `id` column, not merely have it filled.

	`erp.utils.set_uuid_id` acts only on doctypes that define the field, so one shipped without it
	simply never gets a UUID: no error, no log, no failing save — CLAUDE.md's "omitting it errors
	nowhere, which is why it's easy to miss". The tests above prove the hook fills the column; this
	one proves the column is there to be filled, which is the half with no runtime symptom at all.

	Read from the database rather than the JSON on disk, deliberately. A field authored in the file
	but never migrated is invisible to the hook exactly as an absent one is, and only the synced
	meta can tell the difference.
	"""

	def test_every_doctype_declares_the_id_column(self):
		missing = sorted(dt for dt in app_doctypes() if not frappe.get_meta(dt).has_field("id"))
		self.assertEqual(
			missing,
			[],
			f"these doctypes carry no `id` column, so set_uuid_id skips them silently: {missing}",
		)

	def test_every_id_column_is_a_unique_read_only_data_field(self):
		"""A declared `id` that is editable, copied or non-unique is not the convention.

		`no_copy` is the one people drop, and it is the one that hurts: without it Duplicate carries
		the source row's UUID into the new document, and two records claim one external identity —
		or the unique index rejects the copy with a message about a field the form never showed.
		"""
		wrong = {}
		for doctype in app_doctypes():
			field = frappe.get_meta(doctype).get_field("id")
			if not field:
				continue

			declared = {prop: field.get(prop) for prop in ID_CONVENTION}
			if declared != ID_CONVENTION:
				wrong[doctype] = declared

		self.assertEqual(wrong, {}, f"`id` declared, but not as the convention specifies: {wrong}")


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


class IntegrationTestReportTenancy(IntegrationTestCase):
	"""Reports must not be the way out of tenancy.

	A report is the sanctioned escape hatch for analytics a list view cannot express. Written
	carelessly it is also the escape hatch out of the row filter, and nothing about the resulting
	number looks wrong — it is simply larger than it should be. Ten years of reports written by
	whoever was on shift is how a multi-tenant system leaks.

	Two rules, both checkable:

	1. **No Query Reports.** `frappe/core/doctype/report/report.py:181` runs
	   `frappe.db.sql(self.query, filters)` raw, and a static SQL string cannot call the scoping
	   helper, so a Query Report cannot be tenant-scoped at all. Write a Script Report.
	2. **A Script Report reaches rows through `frappe.get_list`**, which applies the `"*"` tenancy
	   hook, User Permissions and owner scoping. `frappe.get_all` sets `ignore_permissions=True`
	   and `frappe.db.sql` reaches nothing — either is allowed only in a module that also uses
	   `erp.api.permission.institution_sql_clause`, which makes the scoping explicit and greppable.
	"""

	APP = pathlib.Path(frappe.get_app_path("erp"))

	def test_no_report_is_a_query_report(self):
		offenders = []
		for path in self.APP.glob("*/report/*/*.json"):
			config = json.loads(path.read_text())
			if config.get("report_type") == "Query Report":
				offenders.append(config.get("report_name", path.stem))

		self.assertEqual(
			offenders,
			[],
			"Query Reports run raw SQL and bypass every row filter, so they cannot be scoped to an "
			f"institution. Rewrite as Script Reports: {offenders}",
		)

	def test_every_report_scopes_its_reads(self):
		offenders = []
		for path in self.APP.glob("*/report/*/*.py"):
			if path.name == "__init__.py":
				continue
			source = path.read_text()
			unscoped = "frappe.get_all(" in source or "frappe.db.sql(" in source
			if unscoped and "institution_sql_clause" not in source:
				offenders.append(str(path.relative_to(self.APP)))

		self.assertEqual(
			offenders,
			[],
			"These reports read rows without the tenancy filter. Use frappe.get_list, or "
			f"erp.api.permission.institution_sql_clause if raw SQL is unavoidable: {offenders}",
		)


class IntegrationTestFieldPolicyRegistry(IntegrationTestCase):
	"""`GOVERNED_DOCTYPES` must match the controllers that actually call the enforcer.

	The registry is what `Field Policy.validate_document_type_is_governed` refuses against and what
	`erp.api.doctype` publishes to the SPA, so a stale entry is worse than none: it would let a
	policy save for a doctype nothing enforces — the silent no-op the whole layer is written to
	avoid — or it would close the SPA's form for a doctype no policy governs.

	Declared rather than discovered because there is no cheap runtime question that means "does
	this controller call the enforcer". This test is the discovery, run in CI.
	"""

	APP = pathlib.Path(frappe.get_app_path("erp"))
	ENFORCER = "apply_field_policy"

	def _controllers_calling_the_enforcer(self) -> set[str]:
		"""Every doctype whose own controller calls `apply_field_policy`."""
		governed = set()
		for path in self.APP.glob("*/doctype/*/*.py"):
			if path.name != f"{path.parent.name}.py":
				continue
			if f"{self.ENFORCER}(" not in path.read_text():
				continue
			# `admission_enquiry` -> `Admission Enquiry`, via the schema rather than by guessing at
			# capitalisation: `Arts & Science` and `MBA` are exactly why title-casing a slug is not
			# good enough anywhere in this app.
			schema = json.loads((path.parent / f"{path.parent.name}.json").read_text())
			governed.add(schema["name"])
		return governed

	def test_the_registry_matches_the_source(self):
		from erp.field_policy import GOVERNED_DOCTYPES

		actual = self._controllers_calling_the_enforcer()

		self.assertEqual(
			set(GOVERNED_DOCTYPES),
			actual,
			"GOVERNED_DOCTYPES has drifted from the controllers that call apply_field_policy. "
			f"Declared but not enforcing: {sorted(set(GOVERNED_DOCTYPES) - actual)}. "
			f"Enforcing but not declared: {sorted(actual - set(GOVERNED_DOCTYPES))}.",
		)


class IntegrationTestStatusLiterals(IntegrationTestCase):
	"""The SPA's status words must be words the schema actually has.

	`frontend/src/modules/*/screens.ts` declares `statusTones` and `statusFlow` as literals,
	because a `Select`'s options are a *set* and nothing in the schema says which doctypes have a
	sequence. That is the right call and it has one failure mode: a literal that does not match.
	It happened — `Application Submit` for `Application Submitted` — and it is invisible, because
	`statusTone()` falls through to a neutral default and `flow.indexOf()` returns -1 rather than
	throwing. Every submitted lead rendered with no tone and no current step, and nothing errored.

	This reads the TypeScript as text on purpose. Parsing it properly would mean a JS toolchain in
	the Python suite, and the app has no unit runner on that side — only Playwright. The shape it
	relies on is the one Prettier produces for this table and nothing else in the file matches it:
	a two-space-indented quoted key opening a block, `statusTones` mapping a status to a tone, and
	`statusFlow` as an array of statuses.

	It reads the *keys* of `statusTones`, never the values. The first version of this test read
	both and reported that `status` has no option `'info'` — the tones are quoted and the keys
	often are not, which is exactly the kind of near-miss the test exists to catch, so it is worth
	the state machine.
	"""

	APP = pathlib.Path(frappe.get_app_path("erp"))
	FRONTEND = APP.parent / "frontend" / "src" / "modules"

	# `  'Admission Enquiry': {` — the table's own keys, at two spaces. Nested keys are deeper.
	DOCTYPE_KEY = re.compile(r"^  '([^']+)':\s*\{")
	# `New: 'attention',` or `'Application Submitted': 'info',` — the key, quoted or not.
	TONE_KEY = re.compile(r"^\s*(?:'([^']+)'|([A-Za-z_]\w*))\s*:\s*'[a-z]+',?\s*$")
	QUOTED = re.compile(r"'([^']+)'")

	def _declared_statuses(self) -> dict[str, set[str]]:
		"""Every status word each screens.ts claims, keyed by doctype."""
		claimed: dict[str, set[str]] = {}

		for path in sorted(self.FRONTEND.glob("*/screens.ts")):
			doctype = None
			in_tones = False
			in_flow = False

			for line in path.read_text().splitlines():
				stripped = line.strip()
				if stripped.startswith(("*", "//", "/*")):
					continue

				match = self.DOCTYPE_KEY.match(line)
				if match:
					doctype = match.group(1)
					claimed.setdefault(doctype, set())
					in_tones = in_flow = False
					continue

				if not doctype:
					continue

				if "statusTones" in stripped:
					in_tones = True
					# `statusTones: { New: 'attention' },` on one line still has to be read.
					claimed[doctype].update(self._tone_keys_inline(stripped))
					if stripped.endswith("},") or stripped.endswith("}"):
						in_tones = False
					continue

				if "statusFlow" in stripped:
					in_flow = "]" not in stripped
					claimed[doctype].update(self.QUOTED.findall(stripped))
					continue

				if in_tones:
					if stripped.startswith("}"):
						in_tones = False
						continue
					key = self.TONE_KEY.match(line)
					if key:
						claimed[doctype].add(key.group(1) or key.group(2))
					continue

				if in_flow:
					if stripped.startswith("]"):
						in_flow = False
						continue
					claimed[doctype].update(self.QUOTED.findall(stripped))

		return {doctype: words for doctype, words in claimed.items() if words}

	def _tone_keys_inline(self, stripped: str) -> set[str]:
		"""Status keys from a one-line `statusTones: { ... }`."""
		body = stripped.split("{", 1)[1] if "{" in stripped else ""
		found = set()
		for pair in body.replace("}", "").split(","):
			key = self.TONE_KEY.match(pair.strip())
			if key:
				found.add(key.group(1) or key.group(2))
		return found

	def test_the_scraper_finds_the_literals_it_is_meant_to(self):
		"""A scraper that silently finds nothing would make the test below vacuously green.

		This is the guard on the guard: the shape of `screens.ts` is a convention, and if Prettier
		or an author changes it the assertion above must fail loudly rather than pass on an empty
		set. Anchored on the two facts that made this test necessary.
		"""
		claimed = self._declared_statuses()

		self.assertIn("Admission Enquiry", claimed, f"scraper read no statuses at all: {claimed}")
		self.assertIn(
			"Application Submitted",
			claimed["Admission Enquiry"],
			"the scraper missed the very literal that was wrong",
		)
		self.assertNotIn(
			"info", claimed["Admission Enquiry"], "the scraper is reading tones as if they were statuses"
		)

	def test_every_declared_status_exists_in_the_schema(self):
		offenders = []
		for doctype, words in sorted(self._declared_statuses().items()):
			if not frappe.db.exists("DocType", doctype):
				offenders.append(f"{doctype}: no such doctype")
				continue

			field = frappe.get_meta(doctype).get_field("status")
			if not field or not field.options:
				offenders.append(f"{doctype}: has no status Select")
				continue

			options = {option.strip() for option in field.options.split("\n") if option.strip()}
			for word in sorted(words - options):
				offenders.append(f"{doctype}.status has no option {word!r}")

		self.assertEqual(
			offenders,
			[],
			"frontend/src/modules/*/screens.ts names status words the schema does not have. A "
			"mismatch is silent — no tone, no current step, no error. Fix the literal or the "
			f"Select: {offenders}",
		)


class IntegrationTestDeskCallVerbs(IntegrationTestCase):
	"""Every `erp.*` call in this app's Desk scripts must use a verb its endpoint accepts.

	`frappe.call` defaults to POST (`frappe/public/js/frappe/request.js:110`). An endpoint declared
	`@frappe.whitelist(methods=["GET"])` refuses a POST with **403**, and Desk renders a 403 as a
	permission error — so the mismatch presents as "this doctype is showing as not permitted", on a
	form the user administers, with nothing in the message about an HTTP verb. It cost a round of
	diagnosis down entirely the wrong path: DocPerms, roles, the tenancy hook and the strict
	user-permission setting were all checked and all fine.

	It is invisible until somebody clicks, which is exactly the class of thing a convention test is
	for. Reads the JS as text for the same reason `IntegrationTestStatusLiterals` does: there is no
	JS unit runner on this side, and a check that runs beats a check that is correct in every
	hypothetical.
	"""

	APP = pathlib.Path(frappe.get_app_path("erp"))

	# `method: "erp.api.field_policy.governable_fields",` — the dotted path of an app endpoint.
	CALL = re.compile(r"""method:\s*["'](erp\.[\w.]+)["']""")
	# `type: "GET",` anywhere in the same call object.
	VERB = re.compile(r"""type:\s*["'](GET|POST|PUT|DELETE)["']""")

	def _calls(self) -> list[tuple[str, str, str]]:
		"""Every (file, dotted method, verb) an app Desk script asks for."""
		found = []
		for path in sorted(self.APP.glob("*/doctype/*/*.js")):
			text = path.read_text()
			# Split on the call boundary so a verb is attributed to the call it sits in, rather
			# than to whichever call happened to be first in the file.
			for chunk in text.split("frappe.call(")[1:]:
				call = self.CALL.search(chunk)
				if not call:
					continue
				verb = self.VERB.search(chunk.split("});")[0])
				found.append(
					(str(path.relative_to(self.APP)), call.group(1), verb.group(1) if verb else "POST")
				)
		return found

	def test_the_scraper_finds_the_calls_it_is_meant_to(self):
		"""Guard on the guard: finding nothing would make the assertion below vacuously green."""
		calls = self._calls()
		self.assertTrue(calls, "no frappe.call to an erp endpoint found in any doctype script")
		self.assertIn(
			("master/doctype/field_policy/field_policy.js", "erp.api.field_policy.governable_fields", "GET"),
			calls,
			f"the scraper missed the very call that was wrong: {calls}",
		)

	def test_every_desk_call_uses_a_verb_its_endpoint_accepts(self):
		offenders = []
		for source, method, verb in self._calls():
			try:
				fn = frappe.get_attr(method)
			except Exception:
				offenders.append(f"{source}: {method} does not resolve")
				continue

			# A module-level registry keyed by the decorated function, not an attribute on it —
			# `frappe/__init__.py:466`. The first version of this test read an attribute of that
			# name off the function and concluded that every endpoint in the app was unwhitelisted.
			if fn not in frappe.whitelisted:
				offenders.append(f"{source}: {method} is not whitelisted")
				continue

			allowed = frappe.allowed_http_methods_for_whitelisted_func.get(fn) or []

			if verb not in allowed:
				offenders.append(f"{source}: calls {method} with {verb}, which accepts {sorted(allowed)}")

		self.assertEqual(
			offenders,
			[],
			"A Desk script calls an app endpoint with a verb it refuses. The refusal is a 403, "
			"which Desk shows as a permission error — so the symptom names the doctype, not the "
			f"verb: {offenders}",
		)
