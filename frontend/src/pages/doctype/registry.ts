import type { ComponentType } from 'react'

import { ADMISSION_SCREENS } from '@/modules/admission/screens'
import { GATE_SCREENS } from '@/modules/gate/screens'
import { MASTER_SCREENS } from '@/modules/master/screens'
import type { StatusTone } from '@/pages/doctype/lib/status'

/**
 * The one seam between the generic renderer and a doctype that needs something it cannot say.
 *
 * ## Why this exists
 *
 * `docs/features/master-data-administration.md` §8 commits to generic screens and names the
 * cost: "the generic form will be wrong for any screen whose journey is a *task* rather than a
 * *record*. When that happens, the answer is an override for one named doctype justified by a
 * named journey — not a second renderer."
 *
 * Without a seam, honouring that means editing `app/routes.tsx` and slotting a static route
 * above `/:moduleSlug/:doctypeSlug`. Do it three times and the routing table is the override
 * mechanism, every bespoke screen re-implements breadcrumbs and permissions, and the second
 * renderer has arrived by accident. So the route stays generic forever and this table decides
 * what happens inside it.
 *
 * ## The rule that keeps it honest
 *
 * **An override may only override a default the renderer already produces. It may never supply
 * something the doctype JSON could have said.** A column order, a filter, a label or a section
 * belongs in the schema, where Desk and the SPA read the same answer. If you find yourself
 * listing fieldnames here to get a column, author `in_list_view` instead.
 *
 * ## Four levels, escalating
 *
 * | Level | Field         | Costs                   | Use when                                    |
 * |-------|---------------|-------------------------|---------------------------------------------|
 * | 0     | *(absent)*    | nothing                 | every doctype today                          |
 * | 1     | `statusTones`, `list`, `record` | a data literal | presentation the schema cannot express |
 * | 2     | `slots`       | one small component     | an action or panel this screen alone needs   |
 * | 3     | `ListScreen`, `RecordScreen` | a whole page | a task journey, not a record journey |
 *
 * Level 3 still renders inside `RequireAuth` → `AppShell` on the generic route, so a bespoke
 * screen cannot lose its navigation, its breadcrumbs or its permission gate by being bespoke.
 */

export interface ListOverride {
  /** Columns to leave out of the table by default. The user can still switch them back on. */
  hiddenColumns?: string[]
}

export interface RecordOverride {
  /**
   * Field carrying the record's state, lifted into the record header as a status dot.
   *
   * Defaults to a `Select` field named `status`, which is what all fourteen doctypes call it —
   * so this is only for a doctype that names it something else.
   */
  statusField?: string
  /**
   * The status words in LIFECYCLE order, for a doctype whose states are a sequence.
   *
   * Drawn as a progress list in the record's context rail. Declared rather than read off the
   * `Select` options because those are a set: `Active`/`Inactive` is not a progression, and
   * nothing in the schema distinguishes the two cases. Omit it and no progress list appears,
   * which is the right default for every master.
   *
   * Not a history — the app records no transition dates. Each step shows its name and whether
   * it has been reached.
   */
  statusFlow?: string[]
  /**
   * Up to four fields lifted into the summary strip beneath the record header — the facts
   * someone opened the record to check, above the fold, before any section.
   *
   * Defaults to the first few short scalar fields the layout places, which is a guess. Naming
   * them is the single highest-value override a record screen has.
   */
  summaryFields?: string[]
}

export interface ScreenSlotProps {
  doctype: string
  /** Absent on the list screen. */
  name?: string
}

export interface ScreenOverride {
  /** Tone per status word, for a vocabulary narrower than the app-wide `Active`/`Inactive`. */
  statusTones?: Readonly<Record<string, StatusTone>>
  list?: ListOverride
  record?: RecordOverride
  slots?: {
    listHeaderActions?: ComponentType<ScreenSlotProps>
    recordHeaderActions?: ComponentType<ScreenSlotProps>
  }
  /** Level 3. Replaces the page body; the route, shell and auth gate are unchanged. */
  ListScreen?: ComponentType
  RecordScreen?: ComponentType
}

export type ScreenTable = Readonly<Record<string, ScreenOverride>>

const MODULE_TABLES: ReadonlyArray<readonly [string, ScreenTable]> = [
  ['master', MASTER_SCREENS],
  ['gate', GATE_SCREENS],
  ['admission', ADMISSION_SCREENS],
]

/**
 * Merged, with collisions surfaced rather than silently resolved.
 *
 * Two modules claiming the same doctype is a real possibility — a workspace may link to a
 * doctype owned by another module — and a spread would just let the last one win. In dev that
 * is a warning at import time; in production the first registration wins, because a screen
 * rendering with the wrong module's status vocabulary is better than one that does not render.
 */
const REGISTRY: Record<string, ScreenOverride> = {}

for (const [module, table] of MODULE_TABLES) {
  for (const [doctype, override] of Object.entries(table)) {
    if (doctype in REGISTRY) {
      if (import.meta.env.DEV) {
        console.warn(
          `Two modules register a screen override for "${doctype}"; keeping the first. ` +
            `Check src/modules/${module}/screens.ts.`,
        )
      }
      continue
    }
    REGISTRY[doctype] = override
  }
}

/** Frozen so a caller cannot mutate the table it is reading from. */
const EMPTY: ScreenOverride = Object.freeze({})

export function screenOverride(doctype: string | null | undefined): ScreenOverride {
  return (doctype && REGISTRY[doctype]) || EMPTY
}
