import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'

import type { Density } from '@/screens/doctype/lib/fields'
import {
  decodeFilter,
  encodeFilter,
  type ColumnFilter,
  type FilterOperator,
} from '@/screens/doctype/lib/filters'

const DEFAULT_DENSITY: Density = 'comfortable'

/** Prefix marking a typed per-column filter param: `f.<field>=<op>:<value>`. */
const COLUMN_FILTER_PREFIX = 'f.'

/**
 * Reserved param names, so a flat filter can never collide with view state.
 *
 * `page`, `size`, `sort` and `dir` are still listed although nothing writes them any more. The
 * grid paginates and sorts in the browser now (see `DoctypeGrid`), but links carrying the old
 * params are still in tickets and bookmarks, and an unreserved `sort=college_code` would be
 * read as a *filter* on a column called `sort` and sent to Frappe as one. Reserved, they are
 * simply ignored.
 */
const RESERVED = new Set(['q', 'page', 'size', 'sort', 'dir', 'density', 'hide'])

export interface ListState {
  search: string
  /** Active filter-bar selections (Select/Check), by fieldname. Only non-empty entries appear. */
  filters: Record<string, string>
  /** Typed per-column filters (text/number/date/link), operator-carrying. */
  columnFilters: ColumnFilter[]
  hasFilters: boolean
  density: Density
  /** Columns switched off by the user, by fieldname. */
  hiddenColumns: ReadonlySet<string>

  setSearch: (value: string) => void
  setFilter: (field: string, value: string) => void
  /** Set or clear a typed column filter. `null` value removes it. */
  setColumnFilter: (field: string, op: FilterOperator, value: string) => void
  removeColumnFilter: (field: string) => void
  clearFilters: () => void
  setDensity: (density: Density) => void
  toggleColumn: (fieldname: string, visible: boolean) => void
}

/**
 * List state in the URL, not in `useState`.
 *
 * Three things fall out of that and none of them are free otherwise: a filtered list is a link
 * someone can paste into a ticket, browser Back steps through filter changes instead of leaving
 * the screen, and the query key is derived from one source of truth rather than kept in step
 * with it.
 *
 * Filters are flat params (`?status=Active&college=SJC`) rather than a JSON blob, so a URL in a
 * bug report is readable.
 *
 * Paging and sorting are absent on purpose. They moved to the grid when the list became
 * client-side — `DoctypeGrid` explains why the engine cannot report them back, and a URL param
 * the table would ignore is worse than no param at all. What is left here is the state that
 * decides *which rows the server returns*, which is exactly the state worth sharing in a link.
 */
export function useListState(): ListState {
  const [params, setParams] = useSearchParams()

  const search = params.get('q') ?? ''

  const filters = useMemo(() => {
    const out: Record<string, string> = {}
    for (const [key, value] of params.entries()) {
      // `f.`-prefixed keys are the typed channel below; a flat filter is anything else that
      // isn't reserved. The guard is what stops a column filter doubling as an equality one.
      if (!RESERVED.has(key) && !key.startsWith(COLUMN_FILTER_PREFIX) && value) out[key] = value
    }
    return out
  }, [params])

  const columnFilters = useMemo<ColumnFilter[]>(() => {
    const out: ColumnFilter[] = []
    for (const [key, value] of params.entries()) {
      if (!key.startsWith(COLUMN_FILTER_PREFIX)) continue
      const parsed = decodeFilter(key.slice(COLUMN_FILTER_PREFIX.length), value)
      if (parsed) out.push(parsed)
    }
    return out
  }, [params])

  const density: Density = params.get('density') === 'compact' ? 'compact' : DEFAULT_DENSITY

  // In the URL for the same reason the filters are: "here is the list, with the four columns
  // that matter for this question" is the thing people paste into a ticket. It is also the
  // cheapest possible saved view — one that needs no doctype and no write path to exist.
  const hiddenColumns = useMemo(
    () => new Set((params.get('hide') ?? '').split(',').filter(Boolean)),
    [params],
  )

  // `prev => next` form throughout: setSearchParams is state, and reading `params` from the
  // closure would drop an update when two setters fire in the same tick.
  const patch = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          mutate(next)
          // A leftover `page` from a link written before the grid paginated client-side would
          // sit in the URL forever, since nothing reads or rewrites it any more.
          next.delete('page')
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const setValue = useCallback(
    (key: string, value: string) => patch((next) => (value ? next.set(key, value) : next.delete(key))),
    [patch],
  )

  return {
    search,
    filters,
    columnFilters,
    hasFilters: Object.keys(filters).length > 0 || columnFilters.length > 0 || !!search,
    density,
    hiddenColumns,

    setSearch: useCallback((value: string) => setValue('q', value), [setValue]),
    setFilter: useCallback((field: string, value: string) => setValue(field, value), [setValue]),
    setColumnFilter: useCallback(
      (field: string, op: FilterOperator, value: string) =>
        patch((next) => {
          const key = `${COLUMN_FILTER_PREFIX}${field}`
          const encoded = encodeFilter({ field, op, value })
          if (encoded) next.set(key, encoded)
          else next.delete(key)
        }),
      [patch],
    ),
    removeColumnFilter: useCallback(
      (field: string) => patch((next) => next.delete(`${COLUMN_FILTER_PREFIX}${field}`)),
      [patch],
    ),
    clearFilters: useCallback(
      () =>
        patch((next) => {
          for (const key of Array.from(next.keys())) {
            if (!RESERVED.has(key)) next.delete(key)
          }
          next.delete('q')
        }),
      [patch],
    ),
    setDensity: useCallback(
      (value: Density) =>
        patch((next) => (value === DEFAULT_DENSITY ? next.delete('density') : next.set('density', value))),
      [patch],
    ),
    toggleColumn: useCallback(
      (fieldname: string, visible: boolean) =>
        patch((next) => {
          const hidden = new Set((next.get('hide') ?? '').split(',').filter(Boolean))
          if (visible) hidden.delete(fieldname)
          else hidden.add(fieldname)
          if (hidden.size) next.set('hide', Array.from(hidden).join(','))
          else next.delete('hide')
        }),
      [patch],
    ),
  }
}
