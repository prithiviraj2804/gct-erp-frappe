# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""One codebase, many institutions: the scalar answers that differ between them.

## The rule

> **Most specific wins. A blank is not an answer. An unregistered key is a bug, not a missing
> value.**

Resolution walks this chain and returns the first *stated* value:

**1.** Programme Intake → **2.** Programme → **3.** Institution → **4.** Institution Type, then its
ancestors nearest-first → **5.** Trust → **6.** the key's registered default → **7.** throw if the
key is `is_required`, else `None`.

Anchors are *completed*, not required: given a Programme Intake the resolver derives its Programme,
thence its Institution, thence its Institution Type and Trust. A caller passing only `institution=`
gets levels 3 to 7. That is what lets a gate ask a question with the one anchor it happens to hold.

## Where an Institution-Type answer comes from

`docs/CONFIGURATION.md` said two things that pull against each other: §2 that capabilities live on
the Institution Type as a `Select` with a blank option, and §4 that `Config Setting` / `Config
Value` answer scalar behaviour. Both are worth keeping and neither is worth duplicating.

So a setting may declare `institution_type_field`, and where it does **the column is the only
source at that level** — never a `Config Value` row beside it. One level of the chain, one source
per key. The column keeps what it is good at: a labelled, typed control on a form a Trust Admin
already opens, with `requires_department` visible next to `requires_admission_interaction` rather
than as two rows in a generic table. `Config Value` supplies what a column cannot — the
institution, programme and intake levels below it, which is the whole reason this slice exists.

Nothing was migrated to build this, and that is the point: `requires_department`,
`requires_admission_interaction`, `requires_application_fee` and `default_admission_route` keep
their columns and gain four levels of override each.

## Caching

Per **node**, not per resolved question, so registering a new key costs no new cache entries:

    frappe.cache.hget(f"erp_config::{generation}", f"{scope_type}|{scope_name}") -> {key: raw}

* A **request memo** on `frappe.local.erp_config_nodes`, so a three-hundred-row import resolves
  each node once rather than three hundred times.
* **Surgical invalidation** on `Config Value` save and trash: `hdel` that node *and* pop the
  request memo. Without the second half, a `validate()` that writes config and then reads it back
  in the same request sees the pre-write value.
* **Wholesale invalidation** by one `INCR` of `erp_config_generation`, for the changes that
  reshuffle what the chain even is: a `Config Setting` saved, an `Institution Type` saved (a
  re-parent changes every descendant's ancestry), an `Institution.institution_type` changed.

The generation counter is why invalidation is cheap: nothing has to be enumerated, and a stale
entry under an old generation is simply never read again.
"""

import frappe
from frappe.utils import cint, flt
from frappe.utils.nestedset import get_ancestors_of

_UNSET = object()

# Cast a stored string by the setting's declared type. Values are stored as Data — see
# `Config Value.value` — so that "" and "0" are different answers, which a typed column could not
# express: an Int column is NOT NULL DEFAULT 0, so a zero and an absence would be the same row.
_CASTS = {
	"Int": cint,
	"Check": cint,
	"Float": flt,
}

# Which column on `Config Value` answers for each level. Five typed `Link` columns rather than one
# `Dynamic Link`, for the reason `Field Policy` gives for its two: the SPA's generic renderer has
# never been taught to draw a Dynamic Link, and `erp/api/test_doctype.py` refuses any fieldtype it
# cannot draw. Ordered most specific first, which is the order the chain resolves in — so this
# dict is also the statement of precedence, in one place, rather than an order implied by a query.
SCOPE_FIELDS = {
	"Programme Intake": "scope_programme_intake",
	"Programme": "scope_programme",
	"Institution": "scope_institution",
	"Institution Type": "scope_institution_type",
	"Trust": "scope_trust",
}

_GENERATION_KEY = "erp_config_generation"
_MEMO = "erp_config_nodes"


class ConfigError(frappe.ValidationError):
	"""A key that is required and unanswered, or a key nobody registered."""


class ConfigTrace:
	"""Every level the resolver looked at, in order, and what each said.

	Backs an Effective Configuration screen, and answers the question an operator actually asks —
	not "what is the value" but "why is it that, and where do I change it".
	"""

	__slots__ = ("key", "steps", "value")

	def __init__(self, key: str):
		self.key = key
		self.steps: list[dict] = []
		self.value = None

	def looked_at(self, scope_type: str, scope_name: str, source: str, stated) -> None:
		self.steps.append(
			{
				"scope_type": scope_type,
				"scope_name": scope_name,
				"source": source,
				"stated": stated,
				"decided": False,
			}
		)

	def decided(self, value) -> "ConfigTrace":
		self.value = value
		if self.steps:
			self.steps[-1]["decided"] = True
		return self

	def as_dict(self) -> dict:
		return {"key": self.key, "value": self.value, "steps": self.steps}


# --- The chain ---------------------------------------------------------------------------


def scope_chain(
	*,
	programme_intake: str | None = None,
	programme: str | None = None,
	institution: str | None = None,
	trust: str | None = None,
) -> list[tuple[str, str]]:
	"""Every scope that applies, **most specific first**, as `(scope_type, scope_name)` pairs.

	The reverse order from `erp.field_policy.scope_chain`, and deliberately so: a policy is a
	*composition* — each rule overwrites only the properties it states, so it folds least-specific
	first — while a setting is a single answer, so it stops at the first one stated. The two are
	different operations on the same hierarchy and collapsing them would make one of them wrong.

	Anchors are completed upward. Passing an intake yields the whole chain; passing an institution
	yields it from level 3 down. Nothing is inferred downward: an institution does not imply a
	programme, so there is no guessing about which one.
	"""
	if programme_intake and not programme:
		programme = frappe.db.get_value("Programme Intake", programme_intake, "programme")

	if programme and not institution:
		institution = frappe.db.get_value("Programme", programme, "institution")

	institution_type = None
	if institution:
		institution_type, institution_trust = frappe.db.get_value(
			"Institution", institution, ["institution_type", "trust"]
		) or (None, None)
		trust = trust or institution_trust

	chain: list[tuple[str, str]] = []
	if programme_intake:
		chain.append(("Programme Intake", programme_intake))
	if programme:
		chain.append(("Programme", programme))
	if institution:
		chain.append(("Institution", institution))
	if institution_type:
		chain.append(("Institution Type", institution_type))
		# Nearest ancestor first — `order_by="lft desc"` is already in that order, which is why
		# this is a loop and not a sort.
		for ancestor in get_ancestors_of("Institution Type", institution_type, order_by="lft desc"):
			chain.append(("Institution Type", ancestor))
	if trust:
		chain.append(("Trust", trust))

	return chain


# --- Reading ------------------------------------------------------------------------------


def get_config(key: str, *, default=_UNSET, **anchors):
	"""The effective value of `key` for the scope the anchors describe.

	`default` overrides the registered default for this one call. Passing it also suppresses the
	`is_required` throw, because a caller who has said what to do when nothing is stated has
	answered the question the throw exists to ask.
	"""
	return _resolve(key, anchors, default=default).value


def get_many(keys, **anchors) -> dict:
	"""Several keys against one scope, sharing the node reads.

	Use this in `validate()`. The chain is walked once and each node's whole dictionary is read
	once, so asking twelve questions costs what asking one costs — which is the reason the cache is
	keyed per node rather than per question.
	"""
	chain = scope_chain(**anchors)
	nodes = [_node_values(scope_type, scope_name) for scope_type, scope_name in chain]
	settings = {key: _setting(key) for key in keys}

	answers = {}
	for key, setting in settings.items():
		answers[key] = _first_stated(key, setting, chain, nodes) or _fallback(key, setting, _UNSET)
	return answers


def explain(key: str, **anchors) -> ConfigTrace:
	"""The value, and every level the resolver looked at to reach it."""
	return _resolve(key, anchors, default=_UNSET, trace=ConfigTrace(key))


def _resolve(key: str, anchors: dict, *, default, trace: ConfigTrace | None = None):
	setting = _setting(key)
	chain = scope_chain(**anchors)

	for scope_type, scope_name in chain:
		stated, source = _stated_at(key, setting, scope_type, scope_name)
		if trace is not None:
			trace.looked_at(scope_type, scope_name, source, stated)
		if stated is not None:
			value = _cast(setting, stated)
			return trace.decided(value) if trace is not None else _Answer(value)

	value = _fallback(key, setting, default)
	if trace is not None:
		trace.looked_at("Default", key, "Config Setting.default_value", setting.default_value)
		return trace.decided(value)
	return _Answer(value)


class _Answer:
	"""So `_resolve` can return one shape whether or not a trace was asked for."""

	__slots__ = ("value",)

	def __init__(self, value):
		self.value = value


def _first_stated(key, setting, chain, nodes):
	"""The first stated raw value down the chain, already cast, or None."""
	for (scope_type, scope_name), values in zip(chain, nodes, strict=True):
		stated, _source = _stated_at(key, setting, scope_type, scope_name, values=values)
		if stated is not None:
			return _cast(setting, stated)
	return None


def _stated_at(key, setting, scope_type: str, scope_name: str, *, values=None):
	"""What this one node says about `key`, and where the answer came from.

	Returns `(None, source)` when the node says nothing. "Says nothing" means no row, or a blank
	one — the tri-state rule: a blank is not an answer, it is the absence of one.
	"""
	if scope_type == "Institution Type" and setting.institution_type_field:
		stated = frappe.db.get_value("Institution Type", scope_name, setting.institution_type_field)
		return (stated or None), f"Institution Type.{setting.institution_type_field}"

	if values is None:
		values = _node_values(scope_type, scope_name)
	return values.get(key) or None, "Config Value"


def _fallback(key: str, setting, default):
	"""The answer when nothing in the chain stated one."""
	if default is not _UNSET:
		return default

	if setting.default_value:
		return _cast(setting, setting.default_value)

	if setting.is_required:
		frappe.throw(
			frappe._(
				"No value is configured for {0}, and it is required. Set it on the trust, the "
				"institution type or the institution."
			).format(frappe.bold(setting.label or key)),
			exc=ConfigError,
			title=frappe._("Configuration Missing"),
		)

	return None


def _cast(setting, raw):
	cast = _CASTS.get(setting.value_type)
	return cast(raw) if cast else raw


# --- The registry -------------------------------------------------------------------------


def _setting(key: str):
	"""The registered setting, or a hard error.

	**An unregistered key is a bug, not a missing value.** A resolver that returned None for a
	misspelt key would make every typo a silent behaviour change — the exact failure
	`Field Policy.validate_fields_exist` exists to prevent one layer up, and worse here, because a
	setting has no form to look wrong on.
	"""
	setting = frappe.get_cached_value(
		"Config Setting",
		key,
		[
			"setting_key",
			"label",
			"value_type",
			"options",
			"default_value",
			"is_required",
			"institution_type_field",
		],
		as_dict=True,
	)
	if not setting:
		frappe.throw(
			frappe._("{0} is not a registered configuration key. Register it in {1}.").format(
				frappe.bold(key), frappe.bold("erp/config/settings.py")
			),
			exc=ConfigError,
			title=frappe._("Unknown Configuration Key"),
		)
	return setting


# --- Caching -------------------------------------------------------------------------------


def _generation() -> int:
	generation = frappe.cache.get_value(_GENERATION_KEY)
	if generation is None:
		generation = 1
		frappe.cache.set_value(_GENERATION_KEY, generation)
	return cint(generation)


def _node_values(scope_type: str, scope_name: str) -> dict:
	"""Every `Config Value` at one node, as `{setting_key: raw}`.

	Memoised on `frappe.local` first, then in the shared cache under the current generation. Read
	with `frappe.get_all` deliberately: the resolver is the only module permitted to read
	`tabConfig Value`, and it answers questions on behalf of code that has already been permitted
	to do whatever it is about to do — a gate cannot ask "is the fee required here" and be told no
	because the user cannot read a configuration row.
	"""
	memo = getattr(frappe.local, _MEMO, None)
	if memo is None:
		memo = {}
		setattr(frappe.local, _MEMO, memo)

	node = f"{scope_type}|{scope_name}"
	if node in memo:
		return memo[node]

	bucket = f"erp_config::{_generation()}"
	cached = frappe.cache.hget(bucket, node)
	if cached is None:
		cached = {
			row.setting: row.value
			for row in frappe.get_all(
				"Config Value",
				filters={SCOPE_FIELDS[scope_type]: scope_name},
				fields=["setting", "value"],
			)
		}
		frappe.cache.hset(bucket, node, cached)

	memo[node] = cached
	return cached


def clear_cache(scope_type: str | None = None, scope_name: str | None = None) -> None:
	"""Drop one node, or bump the generation to drop everything.

	Both halves matter. Dropping the shared entry without popping the request memo would leave a
	`validate()` that writes config and then reads it back in the same request seeing the pre-write
	value — the same trap `erp.field_policy.clear_cache` exists for.
	"""
	memo = getattr(frappe.local, _MEMO, None)

	if scope_type and scope_name:
		frappe.cache.hdel(f"erp_config::{_generation()}", f"{scope_type}|{scope_name}")
		if memo is not None:
			memo.pop(f"{scope_type}|{scope_name}", None)
		return

	frappe.cache.set_value(_GENERATION_KEY, _generation() + 1)
	if memo is not None:
		memo.clear()
