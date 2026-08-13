# Project docs

These docs exist to answer one question before any code is written: **what are we building next,
and what does it actually need?**

## The rule

> **No master is created without a feature slice that consumes it.**
> A master starts at the minimum fields its first consumer justifies, and grows one slice at a time.

The first phase of this app was built the other way round — from a list of masters. Eleven of them
exist today and not one has ever been read by a user journey, so nothing has confirmed that their
fields are the right fields. From here the order is reversed: pick a feature, write its journeys,
and let the journeys name the masters.

## What's here

| Doc | Read it when |
|---|---|
| [METHOD.md](METHOD.md) | You're starting a slice and want the procedure, start to finish. |
| [PRODUCT.md](PRODUCT.md) | You need the domain — who this serves, and how one model covers both colleges and schools. |
| [DATA-MODEL.md](DATA-MODEL.md) | You need what already exists, how the hierarchy is enforced, and which masters are still unbuilt. |
| [ROADMAP.md](ROADMAP.md) | You want the slice order and what each slice is expected to pull in. |
| [MODULES.md](MODULES.md) | You're adding a module or wiring something into the SPA navigation. |
| [features/](features/) | One spec per slice. Start from [features/TEMPLATE.md](features/TEMPLATE.md). |

## Status

- **Slice 1 — Admission Gate Pass**: backend built, SPA deferred.
  → [features/admission-gate-pass.md](features/admission-gate-pass.md)
- [ROADMAP.md](ROADMAP.md) beyond Slice 1 and the module map in [MODULES.md](MODULES.md) are
  **DRAFT** — they get settled in the modules discussion, not by writing code against them.

Coding rules live in [../CLAUDE.md](../CLAUDE.md); the step-by-step procedures live in the skills
under [../.claude/skills/](../.claude/skills/).
