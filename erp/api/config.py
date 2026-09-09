# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""The Effective Configuration screen's one endpoint.

App-wide rather than module-scoped: configuration is not a module's, and every module's forms
resolve through the same chain. See `erp/config/resolver.py` for the resolution itself.

**Scoped, and deliberately written that way rather than copied.** `docs/CONFIGURATION.md` §3
specifies `explain(key, **anchors)` with caller-supplied anchors, and the one existing endpoint of
that exact shape — `erp.api.field_policy.get_policy` — shipped without an institution check, so a
counsellor at one institution could read another's resolved configuration. `resolve_policy` and
`get_config` both read through `frappe.get_all` and `frappe.db.get_value`, which bypass the
permission layer by design, so neither can refuse it from inside. The check has to be here.

What this returns is configuration *metadata*, not applicant data — which is why the disclosure was
small and the precedent was the dangerous part.
"""

import frappe
from frappe import _

from erp.api.permission import assert_institution_in_scope
from erp.config.resolver import explain
from erp.config.settings import ALL_KEYS


@frappe.whitelist(methods=["GET"])
def explain_config(
	key: str,
	institution: str | None = None,
	programme: str | None = None,
	programme_intake: str | None = None,
) -> dict:
	"""The effective value of one key, and every level the resolver looked at to reach it.

	The question an operator actually asks is not "what is the value" but "why is it that, and
	where do I change it" — so the trace is the answer and the value is one field of it.

	Anchors are completed upward by the resolver, so passing an intake is enough. The scope check is
	applied to whichever anchor the caller supplied *and* to the institution the resolver derives
	from it, because a programme names an institution and passing one must not be a way round the
	other.
	"""
	if key not in ALL_KEYS:
		frappe.throw(
			_("{0} is not a registered configuration key.").format(frappe.bold(key)),
			title=_("Unknown Configuration Key"),
		)

	institution = institution or _institution_behind(programme, programme_intake)
	if not institution:
		frappe.throw(
			_("Name an institution, a programme or an intake to resolve {0} against.").format(
				frappe.bold(key)
			),
			title=_("No Scope"),
		)

	assert_institution_in_scope(institution)

	return explain(
		key, institution=institution, programme=programme, programme_intake=programme_intake
	).as_dict()


def _institution_behind(programme: str | None, programme_intake: str | None) -> str | None:
	"""The institution a programme or an intake belongs to.

	Resolved here rather than left to `scope_chain` because the *permission* check needs it before
	anything is read. Deriving it twice is cheap; letting an unscoped anchor through is not.
	"""
	if programme_intake and not programme:
		programme = frappe.db.get_value("Programme Intake", programme_intake, "programme")

	return frappe.db.get_value("Programme", programme, "institution") if programme else None
