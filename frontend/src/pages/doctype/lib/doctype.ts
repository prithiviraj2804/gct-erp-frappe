import type { Filter } from 'frappe-js-sdk/lib/db/types'

import { call, db } from '@/lib/frappe'
import type { DocRecord, DocRow, DoctypeSchema } from '@/pages/doctype/types'

/**
 * Doctype reads for the generic screens.
 *
 * Rows go through the SDK's `db` handle — `/api/resource/<doctype>` with the framework's own
 * permission checks — rather than a whitelisted endpoint. METHOD.md step 5: "an endpoint that
 * just wraps `get_list` adds a permission surface and buys nothing." Only the *schema* needs an
 * endpoint, because there is no CRUD call that returns labels and section structure.
 *
 * These are the first `db` call sites in the app.
 */

/** One column in a sort order. Several make a multi-column sort, in priority order. */
export interface SortField {
  field: string
  order: 'asc' | 'desc'
}

export interface ListQuery {
  fields: string[]
  /** Filter-bar selections, ANDed. */
  filters: Filter[]
  /** Free text, ORed across `search_fields`. */
  search: string
  searchFields: string[]
  /** Sort columns in priority order. The first is primary; ties break on the next. */
  sort: SortField[]
  /** 1-based, so it matches the `?page=` in the URL. */
  page: number
  pageSize: number
}

/**
 * Pack a multi-column sort into the SDK's single `{field, order}`.
 *
 * `frappe-js-sdk` builds its `order_by` string as exactly `` `${orderBy.field} ${orderBy.order}` ``
 * (see `db/index.js`) — one field, one direction, concatenated. Frappe itself accepts a full
 * `order_by` clause, though, so the trick is to put every column *except the last* — with its own
 * direction — inside `field`, and hand the last column's direction to `order`. The SDK's
 * concatenation then yields a valid `"college_type asc, modified desc"`.
 *
 * This is the documented workaround the audit flagged: the SDK models a single sort, the server
 * does not.
 */
export function packOrderBy(sort: SortField[]): SortField {
  if (sort.length === 0) return { field: 'modified', order: 'desc' }
  const last = sort[sort.length - 1]
  const leading = sort.slice(0, -1).map((entry) => `${entry.field} ${entry.order}`)
  return { field: [...leading, last.field].join(', '), order: last.order }
}

export const doctypeKeys = {
  schema: (doctype: string | null) => ['doctype', 'schema', doctype] as const,
  list: (doctype: string | null, query: ListQuery) => ['doctype', 'list', doctype, query] as const,
  /**
   * Deliberately keyed on the filters ALONE, not the whole query: paging and sorting do not
   * change how many rows match, so keying on `ListQuery` would refetch the count on every page
   * turn for an answer that cannot have changed.
   */
  count: (doctype: string | null, filters: Filter[]) => ['doctype', 'count', doctype, filters] as const,
  doc: (doctype: string | null, name: string | null) => ['doctype', 'doc', doctype, name] as const,
}

export async function fetchDoctypeSchema(doctype: string): Promise<DoctypeSchema> {
  const res = await call.get<{ message: DoctypeSchema }>('erp.api.doctype.get_doctype_schema', {
    doctype,
  })
  return res.message
}

function searchFilters(query: ListQuery): Filter[] | undefined {
  if (!query.search.trim()) return undefined
  // Frappe combines these as `<filters> AND (<or_filters>)`, which is exactly "the filter bar,
  // and the search box matching any searchable field".
  return query.searchFields.map((field) => [field, 'like', `%${query.search.trim()}%`] as Filter)
}

export async function fetchDocList(doctype: string, query: ListQuery): Promise<DocRow[]> {
  // `name` unconditionally — it is the row's link target, and a doctype whose title field is
  // something else would otherwise return rows the table cannot link to.
  const fields = Array.from(new Set(['name', ...query.fields]))

  const rows = await db.getDocList<DocRow>(doctype, {
    fields,
    filters: query.filters,
    orFilters: searchFilters(query),
    orderBy: packOrderBy(query.sort),
    limit: query.pageSize,
    limit_start: (query.page - 1) * query.pageSize,
  })
  return rows ?? []
}

/**
 * How many rows match the filter bar.
 *
 * Note this ignores the search box: `db.getCount` takes `filters` only — the underlying
 * `frappe.client.get_count` has no `or_filters` parameter — so a total computed here while a
 * search is active would be the unsearched total, which is worse than no total at all. The list
 * page hides the count while searching rather than printing a number that is wrong.
 */
export async function fetchDocCount(doctype: string, filters: Filter[]): Promise<number> {
  return db.getCount(doctype, filters)
}

export async function fetchDoc(doctype: string, name: string): Promise<DocRecord> {
  return db.getDoc<DocRecord>(doctype, name)
}
