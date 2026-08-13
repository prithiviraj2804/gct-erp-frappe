import type { Filter } from 'frappe-js-sdk/lib/db/types'

import type { SchemaField } from '@/screens/doctype/types'

/**
 * Per-column filters: the operator-carrying kind, distinct from the flat equality filters the
 * toolbar's Select/Check controls write.
 *
 * ## Why two representations coexist
 *
 * The Select/Check filter bar has always written flat params (`?status=Active`), and shared links
 * in tickets rely on that. Rather than migrate them — and break every pasted URL — the richer
 * filters get their own namespace, `f.<field>=<op>:<value>`, and the two are merged only at the
 * point they become a Frappe query. A field is one fieldtype, so a column is only ever in one
 * channel; they never collide.
 *
 * ## The grammar
 *
 *     f.college_code = like:eng            → college_code LIKE %eng%
 *     f.institution  = eq:GEI              → institution = 'GEI'
 *     f.total_area   = between:10,50       → total_area BETWEEN 10 AND 50
 *     f.seats        = gte:100             → seats >= 100
 *     f.creation     = between:2026-01-01,2026-12-31
 *
 * The op is everything before the FIRST colon, so a datetime value (`2026-01-01 10:30:00`) keeps
 * its own colons. `between` carries `lo,hi`; a comma never appears in the number/date values this
 * app filters on.
 *
 * ## Why these are AND filters, not OR
 *
 * Each is a single-column constraint, so they go in Frappe's `filters` (ANDed), which
 * `frappe.client.get_count` CAN see — unlike the global search, which fans out across
 * `search_fields` via `or_filters` and is why the count hides during a search. So a column filter
 * narrows the total honestly; only search does not.
 */

export type FilterOperator = 'eq' | 'like' | 'gt' | 'gte' | 'lt' | 'lte' | 'between'

export interface ColumnFilter {
  field: string
  op: FilterOperator
  /** Raw value; for `between`, `"lo,hi"`. */
  value: string
}

/** Fieldtypes the header filter offers a control for. Select/Check stay in the toolbar bar. */
const FILTERABLE_TYPES = new Set(['Data', 'Link', 'Int', 'Float', 'Currency', 'Date', 'Datetime'])

export function isColumnFilterable(field: SchemaField): boolean {
  return FILTERABLE_TYPES.has(field.fieldtype)
}

const FRAPPE_OP: Record<Exclude<FilterOperator, 'like' | 'between'>, string> = {
  eq: '=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
}

/**
 * One `ColumnFilter` as a Frappe filter tuple, or null when it carries no usable value.
 *
 * `null` rather than throwing: a half-typed `between` (one bound) or an emptied box is a normal
 * intermediate state, and it should simply not constrain the query rather than error.
 */
export function toFrappeFilter(filter: ColumnFilter): Filter | null {
  if (filter.op === 'between') {
    const [lo, hi] = filter.value.split(',')
    if (!lo || !hi) return null
    return [filter.field, 'between', [lo, hi]] as Filter
  }

  if (!filter.value) return null

  if (filter.op === 'like') {
    return [filter.field, 'like', `%${filter.value}%`] as Filter
  }

  return [filter.field, FRAPPE_OP[filter.op], filter.value] as Filter
}

/** The URL value (`op:value`) for a filter, or null when it should be dropped from the URL. */
export function encodeFilter(filter: ColumnFilter): string | null {
  if (!filter.value) return null
  if (filter.op === 'between') {
    const [lo, hi] = filter.value.split(',')
    if (!lo && !hi) return null
  }
  return `${filter.op}:${filter.value}`
}

/** Parse a `f.<field>` URL value back into a `ColumnFilter`, or null when malformed. */
export function decodeFilter(field: string, raw: string): ColumnFilter | null {
  const colon = raw.indexOf(':')
  if (colon < 0) return null
  const op = raw.slice(0, colon) as FilterOperator
  const value = raw.slice(colon + 1)
  if (!value) return null
  if (!isOperator(op)) return null
  return { field, op, value }
}

function isOperator(value: string): value is FilterOperator {
  return (
    value === 'eq' ||
    value === 'like' ||
    value === 'gt' ||
    value === 'gte' ||
    value === 'lt' ||
    value === 'lte' ||
    value === 'between'
  )
}

/** A `between` (or one-sided) filter's two bounds, for a range control to render. */
export function rangeBounds(filter: ColumnFilter | undefined): [string, string] {
  if (!filter) return ['', '']
  if (filter.op === 'between') {
    const [lo = '', hi = ''] = filter.value.split(',')
    return [lo, hi]
  }
  if (filter.op === 'gte' || filter.op === 'gt') return [filter.value, '']
  if (filter.op === 'lte' || filter.op === 'lt') return ['', filter.value]
  return ['', '']
}

/**
 * Build a range filter from two bounds — `between` when both are set, one-sided otherwise, and
 * null when neither is. The single place that decides which operator a from/to pair means.
 */
export function rangeFilter(field: string, from: string, to: string): ColumnFilter | null {
  if (from && to) return { field, op: 'between', value: `${from},${to}` }
  if (from) return { field, op: 'gte', value: from }
  if (to) return { field, op: 'lte', value: to }
  return null
}

const OP_LABEL: Record<FilterOperator, string> = {
  eq: 'is',
  like: 'contains',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  between: '',
}

/** A short human phrase for a filter chip. */
export function describeFilter(field: SchemaField, filter: ColumnFilter): string {
  const label = field.label ?? field.fieldname
  if (filter.op === 'between') {
    const [lo, hi] = filter.value.split(',')
    return `${label}: ${lo} – ${hi}`
  }
  if (filter.op === 'like') return `${label} contains “${filter.value}”`
  return `${label} ${OP_LABEL[filter.op]} ${filter.value}`
}
