import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { Filter } from 'frappe-js-sdk/lib/db/types'

import {
  doctypeKeys,
  fetchDoc,
  fetchDocCount,
  fetchDocList,
  fetchDoctypeSchema,
  type ListQuery,
} from '@/pages/doctype/lib/doctype'

/**
 * A doctype's schema.
 *
 * Long `staleTime`: a schema only changes on `bench migrate`, so refetching it within a session
 * is pure waste. It is also fetched once per doctype per session and is on the critical path of
 * every screen, which is why the record page fires this and the document fetch in parallel
 * rather than gating one on the other.
 */
export function useDoctypeSchema(doctype: string | null) {
  return useQuery({
    queryKey: doctypeKeys.schema(doctype),
    queryFn: () => fetchDoctypeSchema(doctype!),
    enabled: !!doctype,
    staleTime: 30 * 60_000,
  })
}

export function useDocList(doctype: string | null, query: ListQuery, enabled = true) {
  return useQuery({
    queryKey: doctypeKeys.list(doctype, query),
    queryFn: () => fetchDocList(doctype!, query),
    enabled: !!doctype && enabled,
    // Without this, every page turn and every keystroke in the search box unmounts the table
    // into a skeleton and back. That flash is the single most common way a server-paginated
    // list feels broken, even when it is fast.
    placeholderData: keepPreviousData,
  })
}

export function useDocCount(doctype: string | null, filters: Filter[], enabled = true) {
  return useQuery({
    queryKey: doctypeKeys.count(doctype, filters),
    queryFn: () => fetchDocCount(doctype!, filters),
    enabled: !!doctype && enabled,
    placeholderData: keepPreviousData,
  })
}

export function useDoc(doctype: string | null, name: string | null) {
  return useQuery({
    queryKey: doctypeKeys.doc(doctype, name),
    queryFn: () => fetchDoc(doctype!, name!),
    enabled: !!doctype && !!name,
  })
}
