# Copyright (c) 2026, Prithivi and contributors
# For license information, please see license.txt

"""The admission pipeline's stages and the gates each one requires, declared once.

## What this replaces

The stage vocabulary was a literal in five places: two frozensets in `pipeline.py`, two more in
`fee_gate.py`, one in `follow_up_state.py` — plus the `Select` options in two doctype JSONs and a
`statusFlow` in TypeScript. Nothing tied them together, and they had already drifted: the SPA said
`Application Submit` where the schema says `Application Submitted`, silently, for every lead that
had actually submitted an application.

More to the point, "which stages does the fee gate?" and "which stages need documents verified?"
were three separate answers to one question — *what does this stage require* — written from three
different directions. Adding a fourth gate meant finding all three and agreeing with them.

## The shape

A stage names the gates it requires. Everything the pipeline used to keep as a frozenset is now
derived from that one table by `gated_by`, which reproduces all three sets exactly:

    gated_by(FEE)        {"Application Submitted", "Documents Verified", "Admitted"}
    gated_by(DOCUMENTS)  {"Documents Verified", "Admitted"}
    gated_by(ADMISSION)  {"Admitted"}

The gates are cumulative down the pipeline and that is a property of the data, not a rule in code:
a stage requires what it requires, and the fact that later stages require more is visible by
reading the table rather than by reading three modules.

## A gate is not a Field Policy rule, and the difference is *when*

Field Policy's `Required` binds at insert, and on update only for a field the writer changed — so
that a rule added in September does not make every July lead unsaveable. That makes it exactly the
wrong mechanism for a stage requirement: the school's interview happens *after* the application is
raised, so "Required: interaction_outcome" would refuse to let the application exist at all.

A gate asks its question at a transition instead. So the division is:

| | Field Policy | a gate |
|---|---|---|
| Asks | is this field filled in **now** | has this happened **before that stage** |
| Fires on | every insert, and changed fields on update | entry into the region it guards |
| Answers about | one field | a document, and sometimes several of them |

Shipping `interaction_outcome` as Required on the School application policy is how this was learnt:
seven tests failed because `start_application` could no longer raise a school application at all.

## What is configurable, and what is not

**The sequence is fixed; which gates apply is per institution type.** That is the line this app
draws, and the reason is `REPORTING_SPINE`: `status` and `application_state` mean the same thing in
every institution, because a trust running a school and an engineering college has to be able to
count admissions across both. Letting an institution add or rename a stage would make one
institution's funnel incomparable with the next, which is the one thing configuration may not do.

So a school and an engineering college walk the same six stages. What differs is what each stage
*demands*: a government arts college charges no application fee, so the fee gate is not part of its
pipeline; a school interviews the parents, so it has a gate an engineering college does not.

A gate whose `capability` is None is unconditional — no journey has asked to switch off document
verification or seat availability, and both are universal. A gate with a capability is resolved
against the Institution Type tree by `erp.master.doctype.institution_type.resolve_capability`, so a
rule stated at `Professional` is inherited by seven types, and blank means inherit — the tri-state
rule in `docs/DATA-MODEL.md`.

When the config engine lands (`docs/ROADMAP.md` slice 4) these capabilities become `Config Setting`
keys and this table stops naming Institution Type at all. The declaration does not change; only
where the answer comes from does.
"""

from dataclasses import dataclass, field

# --- The gates ---------------------------------------------------------------------------

FEE = "fee"
DOCUMENTS = "documents"
ADMISSION = "admission"
INTERACTION = "interaction"


@dataclass(frozen=True)
class Gate:
	"""One thing a stage may require before a lead enters it.

	`capability` is the `Institution Type` column that switches the gate off, or None for a gate
	that is not negotiable. It is a `Select` with a blank option rather than a `Check`, so that
	blank means "inherit from the type above" and a leaf can say nothing at all.

	`applies_when_unstated` is what blank means once nothing in the whole ancestor chain has said
	anything — and it is **not the same answer for every gate**, which is why it is a field rather
	than a rule in `gate_applies`.

	The fee gate applies when unstated: that is what the hardcoded rule did for every institution,
	and an institution nobody has configured should not quietly stop collecting money. The
	interaction gate does *not*: the app-wide truth is that institutions admit on an external
	allotment or on marks, and a school is the exception that states `Yes`. Defaulting it the other
	way would have demanded an interview record from every engineering college on the site.

	This is the tri-state rule doing real work — `docs/DATA-MODEL.md`. A `Check` could not express
	it at all, because it cannot tell "No" from "nobody said".
	"""

	key: str
	label: str
	capability: str | None = None
	applies_when_unstated: bool = True


GATES = {
	FEE: Gate(
		FEE,
		"Application Fee",
		# A government arts & science college and a state-aided school charge nothing for the form.
		# Note what this does *not* express: it switches the gate off for a whole institution type,
		# which is not the same as exempting one applicant. An RTE seat or a sibling concession at a
		# fee-charging school is a per-applicant waiver and needs its own record.
		capability="requires_application_fee",
	),
	DOCUMENTS: Gate(DOCUMENTS, "Document Verification"),
	ADMISSION: Gate(ADMISSION, "Admissibility"),
	INTERACTION: Gate(
		INTERACTION,
		"Admission Interaction",
		# A school meets the family and records an outcome before offering a place; an engineering
		# college admitting on a counselling allotment has no such step and never will — so this is
		# the gate that is off unless a type opts in.
		capability="requires_admission_interaction",
		applies_when_unstated=False,
	),
}


# --- The stages --------------------------------------------------------------------------


@dataclass(frozen=True)
class Stage:
	"""One position a lead can occupy, and what it takes to get there.

	`on_pipeline` distinguishes a position on the line from an off-ramp. Rejected and Dropped are
	decisions, not progress, which is why `advance_target_on_payment` must never resurrect one and
	why the SPA draws neither as a step.
	"""

	name: str
	gates: frozenset[str] = field(default_factory=frozenset)
	terminal: bool = False
	on_pipeline: bool = True


STAGES = (
	Stage("New"),
	Stage("Contacted"),
	Stage("Visited"),
	Stage("Application Submitted", frozenset({FEE})),
	Stage("Documents Verified", frozenset({FEE, DOCUMENTS, INTERACTION})),
	Stage("Admitted", frozenset({FEE, DOCUMENTS, INTERACTION, ADMISSION}), terminal=True),
	Stage("Rejected", terminal=True, on_pipeline=False),
	Stage("Dropped", terminal=True, on_pipeline=False),
)

BY_NAME = {stage.name: stage for stage in STAGES}

# The pipeline in order. Rejected/Dropped are off-ramps, not positions on this line.
PIPELINE = tuple(stage.name for stage in STAGES if stage.on_pipeline)

# Terminal stages — the lead is decided, so follow-up scheduling no longer applies. Admitted is
# terminal *and* on the pipeline: it is the end of the line, not a step off it.
CLOSED_STATUSES = frozenset(stage.name for stage in STAGES if stage.terminal)

# The first stage the fee gates, derived rather than restated: whichever stage first requires FEE.
GATE_ENTRY_STATUS = next(name for name in PIPELINE if FEE in BY_NAME[name].gates)


def gated_by(gate: str) -> frozenset[str]:
	"""Every stage that requires `gate`. This is what the pipeline's frozensets used to be."""
	return frozenset(stage.name for stage in STAGES if gate in stage.gates)


def entering(new_status: str, previous_status: str | None, region: frozenset[str]) -> bool:
	"""Whether this transition crosses *into* `region` from outside it.

	Every gate fires only on entry, never on a save inside the region it guards. A lead already at
	"Documents Verified" whose payment was later cancelled can still be edited; the gates are about
	advancing, not about re-litigating history.

	`previous_status=None` means a brand-new record, treated as coming from outside.
	"""
	return new_status in region and (previous_status is None or previous_status not in region)


def required_gates(new_status: str, previous_status: str | None, institution: str | None) -> frozenset[str]:
	"""Which gates this transition must clear, at this institution.

	A gate is required when two independent things are true: the transition crosses **into** the
	region that gate guards, and the gate is part of this institution's pipeline at all. Keeping
	them separate is what makes "configurable gates, fixed sequence" expressible — the first
	question is about the move, the second about the institution, and neither is derivable from the
	other.

	This is the one place either question is asked. It used to be asked in three modules against
	three hand-written frozensets, which is how "which stages does the fee gate" and "which stages
	need documents" came to be three answers to one question.
	"""
	return frozenset(
		gate
		for gate in GATES
		if entering(new_status, previous_status, gated_by(gate)) and gate_applies(gate, institution)
	)


def gate_applies(gate: str, institution: str | None) -> bool:
	"""Whether `gate` is part of this institution's pipeline.

	Unconditional gates are always in. A gate with a capability is resolved up the Institution Type
	tree, nearest statement winning, so a rule set at `Professional` is inherited by seven types.
	When nothing in the chain states anything the gate's own `applies_when_unstated` decides — see
	`Gate`, because that default is not the same for every gate.

	An institution with no type at all, or no institution in hand, falls back to the same default:
	there is nothing to resolve against, so the answer is the gate's own.
	"""
	definition = GATES[gate]
	if not definition.capability:
		return True

	if not institution:
		return definition.applies_when_unstated

	# Imported here rather than at module scope: `institution_type.py` is a doctype controller and
	# importing one at import time from a plain module drags the whole Document machinery into
	# every consumer of this table, including the ones that only want `PIPELINE`.
	from erp.master.doctype.institution_type.institution_type import resolve_capability_for_institution

	stated = resolve_capability_for_institution(institution, definition.capability)
	if not stated:
		return definition.applies_when_unstated

	return stated == "Yes"
