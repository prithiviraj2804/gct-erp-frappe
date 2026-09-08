import { NUMERIC_TYPES } from '@/pages/doctype/lib/fields'
import { fieldProblems, isWritableField, resolveDefault } from '@/pages/doctype/lib/form'
import type { BstColumnMeta, FieldError } from '@/components/table/registry'
import type { DocRecord, SchemaField } from '@/pages/doctype/types'

/**
 * What a Frappe field becomes inside a Bst-Table.
 *
 * The engine's cell-type registry picks a renderer *and an editor* per column from
 * `columnDef.meta.type`, against a registry of neutral types — `text`, `number`,
 * `dateTime`, `singleSelect`, and so on. Mapping Frappe's fieldtypes onto those would be the
 * obvious move and is the wrong one: this app already owns a control per fieldtype
 * (`form/control-registry.ts`) and a renderer per fieldtype (`components/cell-renderers.ts`),
 * both of which know things the neutral types cannot be told. A `Link` is not a `text` — it is
 * a search against another doctype through `search_link`, filtered by `link_filters`. A
 * `Datetime` is not the engine's `dateTime`, whose editor round-trips through `new Date()` and
 * `toISOString()` and therefore shifts a naive site-timezone timestamp by the viewer's offset —
 * the exact bug `DateControl` and `DateCell` both exist to avoid.
 *
 * So the app registers **three** cell types rather than mapping onto the neutral ones, and each of them delegates to
 * the per-fieldtype component the app already has. They differ only in how the edit ends —
 * inline, inline-but-Enter-is-a-newline, or in a dialog. The registry is used as the seam it
 * is, not as a second widget library, and there is still one editor per fieldtype in this
 * codebase.
 */

/** Edits in place, inside the cell. The engine commits it on Enter or on blur. */
export const FRAPPE_CELL = 'frappe'

/**
 * Edits in place, but Enter belongs to the editor.
 *
 * The engine commits an inline cell on Enter unless the cell type claims the key. For a
 * `Text`, a `Small Text` or a `JSON` blob that would turn "start a new line" into "finish
 * editing", which is not a keystroke anyone can take back. Blur still commits, so there is
 * still a way out that is not the mouse.
 */
export const FRAPPE_MULTILINE_CELL = 'frappe-multiline'

/**
 * Edits in a dialog, and commits only when the dialog says so.
 *
 * For controls that open an overlay of their own. The engine's inline host commits on blur, and
 * every one of these moves focus out of the cell as its *first* action — a Radix popover or
 * select portals to `document.body`, the file picker and the colour picker are the OS's. Inline,
 * that reads as: click the control, the editor commits and unmounts, the overlay is left over a
 * cell that is no longer editing. `editMode: 'popup'` is the engine's own answer to this and
 * suppresses the blur commit entirely.
 */
export const FRAPPE_POPUP_CELL = 'frappe-popup'

const POPUP_TYPES = new Set(['Link', 'Select', 'Color', 'Attach Image'])
const MULTILINE_TYPES = new Set(['Text', 'Small Text', 'JSON'])

/** Which of the three cell types a fieldtype edits through. */
export function cellTypeFor(field: SchemaField): string {
  if (POPUP_TYPES.has(field.fieldtype)) return FRAPPE_POPUP_CELL
  if (MULTILINE_TYPES.has(field.fieldtype)) return FRAPPE_MULTILINE_CELL
  return FRAPPE_CELL
}

/**
 * What the app's cell types need that `BstColumnMeta` has no slot for.
 *
 * Carried in `cellMeta`, which the engine passes through untouched — with one exception, and
 * it is why the key is `frappeField` rather than the obvious `field`. **`cellMeta.field` is
 * reserved**: `buildCtx` reads it as the row-object key a commit writes to, ahead of
 * `accessorKey`. Putting a `SchemaField` object there makes the engine write
 * `row["[object Object]"] = value` on every commit — no error, no dirty marker, the cell simply
 * reverts and the edit is gone. Found in the browser, not by `tsc`, because `cellMeta` is typed
 * `Record<string, unknown>` and every shape satisfies it.
 */
export interface FrappeCellMeta {
  frappeField: SchemaField
  /** The child doctype, for the renderers whose output is a per-doctype product decision. */
  doctype: string
}

export function readCellMeta(meta: BstColumnMeta): FrappeCellMeta | null {
  const carried = meta.cellMeta as Partial<FrappeCellMeta> | undefined
  if (!carried?.frappeField) return null
  return { frappeField: carried.frappeField, doctype: carried.doctype ?? '' }
}

/**
 * The column meta for one child field.
 *
 * `editable` is `isWritableField` and nothing more: a read-only or `fetch_from` column in a
 * child row is the server's, the same as on the parent form, and the grid shows it as a value.
 * When the grid itself is read-only — a record page, or a `read_only` Table field — the caller
 * passes `writable: false` and every column follows, so there is one switch rather than one per
 * column.
 */
export function childColumnMeta(
  field: SchemaField,
  doctype: string,
  writable: boolean,
): BstColumnMeta<DocRecord> {
  return {
    type: cellTypeFor(field),
    editable: writable && isWritableField(field),
    // The engine puts an alignment hook on the `td`, which is what this column wanted and had to
    // fake with a wrapper span until now. The *heading* still sits left: the adapter's
    // Columns menu falls back to the column id the moment a header stops being a string, so
    // aligning the heading would relabel that menu `fee` instead of `Fee`.
    align: NUMERIC_TYPES.has(field.fieldtype) ? 'right' : undefined,
    cellMeta: { frappeField: field, doctype },
    validate: (value, ctx) => problemsToErrors(field, value, ctx.row),
  }
}

/**
 * The app's field rules, as the engine's error shape.
 *
 * `fieldProblems` is the same function the parent form validates through — required, numeric,
 * non-negative, JSON, maximum length — so a rule cannot hold on the form and lapse in the grid.
 * Everything else is the server's, which is the stance `lib/form.ts` sets out and the reason
 * this list is short.
 *
 * `row` is the sibling context `mandatory_depends_on` reads. It is the row as last committed,
 * not as currently drafted, which is exact in cell mode — a commit lands before the next cell
 * is validated — and one edit stale in a row session. The server re-checks either way.
 */
function problemsToErrors(field: SchemaField, value: unknown, row: DocRecord | undefined): FieldError[] {
  const values = { ...(row ?? {}), [field.fieldname]: value }
  return fieldProblems(field, value, values).map((message) => ({
    level: 'error',
    message,
  }))
}

/**
 * Stable row identity.
 *
 * `name` first, because a saved child row has one and it is what the server will match on. Then
 * `id` — which for an unsaved row is the temp id the engine stamped on it, and for a saved one
 * is this app's UUID column; either is stable across a sort or a delete in a way the index is
 * not. The index is the last resort, for a row that has been given neither.
 */
export function childRowId(row: DocRecord, index: number): string {
  if (typeof row.name === 'string' && row.name) return row.name
  if (typeof row.id === 'string' && row.id) return row.id
  return String(index)
}

/**
 * A blank child row.
 *
 * The child's own defaults, resolved through the same function the parent form uses — so
 * `Today` on a child Date field means today here too, and a `Check` default arrives as 1 rather
 * than as the string `"1"`. The engine stamps `id` with a temp id afterwards, and `toPayload`
 * strips it again on the way to the server.
 */
export function blankChildRow(fields: SchemaField[]): Partial<DocRecord> {
  const row: Record<string, unknown> = {}
  for (const field of fields) {
    if (!isWritableField(field)) continue
    row[field.fieldname] = resolveDefault(field)
  }
  return row as Partial<DocRecord>
}
