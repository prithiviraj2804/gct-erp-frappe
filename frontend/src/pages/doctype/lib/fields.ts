import type { SchemaField } from '@/pages/doctype/types'

/**
 * Predicates over a fieldtype — what a field can be rendered *as*, independent of React.
 *
 * Kept out of the component files on purpose. These are data, and a `.ts` module that exports
 * no components keeps `react-refresh/only-export-components` satisfied — the same split
 * `shell/lib/module-icons.ts` already makes for the rail's icon lookup.
 */

/** Row height. `comfortable` is DESIGN.md's 44px; `compact` is 36px. */
export type Density = 'comfortable' | 'compact'

export const DENSITIES: readonly Density[] = ['comfortable', 'compact']

/** Reads as a quantity: right-aligned, header included, tabular figures. */
export const NUMERIC_TYPES = new Set(['Int', 'Float', 'Currency'])

/** Needs the full width of a record section; wraps into a ribbon in a half column. */
export const FULL_WIDTH_TYPES = new Set([
  'Text',
  'Small Text',
  'JSON',
  'Attach Image',
  'Table',
  'Table MultiSelect',
])

/** Rows in another doctype, rendered as a grid rather than as a value. */
export const CHILD_TABLE_TYPES = new Set(['Table', 'Table MultiSelect'])

/**
 * Short enough to sit in the record's summary strip.
 *
 * A summary is four facts read at a glance. A `Small Text` remark or an image is not one of
 * them, however important — those belong in the sections below, at full width.
 */
const SUMMARY_TYPES = new Set([
  'Data',
  'Link',
  'Select',
  'Date',
  'Datetime',
  'Int',
  'Float',
  'Currency',
  'Check',
])

export function isSummarisable(field: SchemaField): boolean {
  return SUMMARY_TYPES.has(field.fieldtype)
}

/**
 * Whether the filter bar can offer a control for this field.
 *
 * Only Select and Check today. A Link filter needs the search-backed combobox that arrives with
 * the write path, and a free-text `like` box per Data field would duplicate the search input
 * that already covers `search_fields`. Everything else is skipped rather than half-rendered.
 */
export function isFilterableField(field: SchemaField): boolean {
  return field.fieldtype === 'Select' || field.fieldtype === 'Check'
}
