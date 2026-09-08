import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { call } from '@/lib/frappe'
import type { LinkFilter, SchemaField } from '@/pages/doctype/types'

/**
 * Link field search.
 *
 * Uses Frappe's own `frappe.desk.search.search_link` rather than a new endpoint or a raw
 * `getDocList`. Three reasons, in order of weight:
 *
 *   1. It is the call the Desk link control makes, so the SPA and Desk return the same options
 *      for the same field — including `search_fields`, `show_title_field_in_link` and the
 *      doctype's own `@frappe.whitelist` search query when one is set.
 *   2. It applies user permissions and `ignore_user_permissions` correctly. Reimplementing that
 *      over `/api/resource` would be reimplementing a permission surface, which METHOD.md step 5
 *      exists to prevent.
 *   3. Link targets are not all ours. `Country` is a Frappe core doctype, so
 *      `erp.api.doctype.get_doctype_schema` refuses it by design — any approach that needed the
 *      target's schema first would fail on exactly the field a user is most likely to touch.
 *
 * It is `@http_cache`d server-side for 60s, so a repeated search costs nothing.
 */

export interface LinkOption {
  /** The `name` — what gets stored in the field. */
  value: string
  /** Secondary line: the target's other search fields, already joined by the server. */
  description: string
  /** The title, when the target sets `show_title_field_in_link`. Absent otherwise. */
  label?: string
}

/** A `[fieldname, operator, value]` triple, the shape `frappe.get_list` accepts. */
type ResolvedFilter = [string, string, unknown]

export interface LinkFilterState {
  filters: ResolvedFilter[]
  /**
   * Sibling fields this Link depends on that have no value yet.
   *
   * Not an edge case — it is the norm on a fresh form. `Campus` filters on `institution`, so
   * until an institution is chosen there is no meaningful set of campuses to offer. Searching
   * with an empty filter value silently returns nothing, which reads as "there are no campuses".
   * Naming the blocker instead is the difference between a dead control and an instruction.
   */
  blockedBy: string[]
}

/**
 * Turn a field's `link_filters` into something `search_link` can take, against the form's
 * current values.
 *
 * A **picker convenience only** — Frappe does not enforce `link_filters` on save and neither do
 * we; `validate_same_parent` in the controllers is the guard. See docs/DATA-MODEL.md.
 */
export function resolveLinkFilters(
  linkFilters: LinkFilter[] | null,
  values: Record<string, unknown>,
): LinkFilterState {
  if (!linkFilters?.length) return { filters: [], blockedBy: [] }

  const filters: ResolvedFilter[] = []
  const blockedBy: string[] = []

  for (const filter of linkFilters) {
    if ('from_field' in filter) {
      const value = values[filter.from_field]
      if (value === null || value === undefined || value === '') {
        blockedBy.push(filter.from_field)
        continue
      }
      filters.push([filter.fieldname, filter.operator, value])
    } else {
      filters.push([filter.fieldname, filter.operator, filter.value])
    }
  }

  return { filters, blockedBy }
}

export const linkKeys = {
  search: (doctype: string, txt: string, filters: ResolvedFilter[]) =>
    ['link-search', doctype, txt, filters] as const,
}

export async function searchLink(
  doctype: string,
  txt: string,
  filters: ResolvedFilter[],
): Promise<LinkOption[]> {
  const res = await call.get<{ message: LinkOption[] }>('frappe.desk.search.search_link', {
    doctype,
    txt,
    // Always a string: `search_link` runs `json.loads` on whatever arrives, and an array sent
    // as repeated query params would reach it as something it cannot parse.
    filters: JSON.stringify(filters),
    page_length: 20,
  })
  return res.message ?? []
}

export function useLinkSearch(
  field: SchemaField,
  txt: string,
  values: Record<string, unknown>,
  enabled: boolean,
) {
  const target = field.options ?? ''
  const { filters, blockedBy } = resolveLinkFilters(field.link_filters, values)

  const query = useQuery({
    queryKey: linkKeys.search(target, txt, filters),
    queryFn: () => searchLink(target, txt, filters),
    enabled: enabled && !!target && blockedBy.length === 0,
    // The list is a picker, not data the user is reading. Holding the previous results while
    // the next keystroke resolves is what stops the popover emptying and re-filling on every
    // character.
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

  return { ...query, blockedBy }
}
