import { useMutation, useQueryClient } from '@tanstack/react-query'

import { doctypeKeys } from '@/screens/doctype/lib/doctype'
import { normalizeFrappeError } from '@/shared/lib/errors'
import { db } from '@/shared/lib/frappe'
import type { DocRecord } from '@/screens/doctype/types'

/**
 * Create, update and delete for the generic screens.
 *
 * Straight through the SDK's `db` handle — `/api/resource/<doctype>` — for the same reason the
 * reads are: METHOD.md step 5 forbids wrapping CRUD in a whitelisted endpoint, because it adds
 * a permission surface and buys nothing. Every controller `validate`, every framework
 * constraint and every permission check runs exactly as it does for Desk, and their messages
 * now reach the user through `shared/lib/errors.ts`.
 *
 * ## Cache invalidation
 *
 * Deliberately blunt: after any write, drop every list and count for the doctype. A create can
 * land on any page of any sort order, an edit can move a row out of the active filter, and a
 * delete changes the total — surgical cache patching would have to model all of that, and the
 * failure mode is a screen quietly showing a row that no longer exists.
 *
 * `refetchType: 'active'` keeps it cheap: only the queries currently mounted go back to the
 * server; the rest are marked stale and refetched if they are ever mounted again.
 *
 * ## No optimistic updates
 *
 * On purpose. The server decides the primary key (`autoname`), fills `fetch_from` fields, and
 * can refuse the whole document — so the optimistic row would be wrong in its identity, its
 * derived columns, or its existence. `keepPreviousData` on the list already stops the table
 * flashing while the refetch runs, which is the flicker optimism would have been buying.
 */

function useInvalidateDoctype(doctype: string) {
  const queryClient = useQueryClient()

  return () => {
    void queryClient.invalidateQueries({
      queryKey: ['doctype', 'list', doctype],
      refetchType: 'active',
    })
    void queryClient.invalidateQueries({
      queryKey: ['doctype', 'count', doctype],
      refetchType: 'active',
    })
  }
}

export function useCreateDoc(doctype: string) {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateDoctype(doctype)

  return useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      // The SDK types `createDoc<T>(doctype, value: T)`, which would demand a `name` the server
      // is the one to assign. The response is a real DocRecord; the request is a partial.
      db.createDoc(doctype, values) as Promise<DocRecord>,
    onSuccess: (created) => {
      // Seeded rather than invalidated: the response IS the saved document, so the record page
      // this is about to navigate to renders immediately instead of showing its skeleton while
      // it re-fetches what we are already holding.
      queryClient.setQueryData(doctypeKeys.doc(doctype, created.name), created)
      invalidate()
    },
  })
}

export function useUpdateDoc(doctype: string) {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateDoctype(doctype)

  return useMutation({
    mutationFn: ({ name, values }: { name: string; values: Record<string, unknown> }) =>
      db.updateDoc<DocRecord>(doctype, name, values),
    onSuccess: (updated, { name }) => {
      queryClient.setQueryData(doctypeKeys.doc(doctype, name), updated)
      invalidate()
    },
  })
}

export function useDeleteDoc(doctype: string) {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateDoctype(doctype)

  return useMutation({
    mutationFn: (name: string) => db.deleteDoc(doctype, name),
    onSuccess: (_result, name) => {
      queryClient.removeQueries({ queryKey: doctypeKeys.doc(doctype, name) })
      invalidate()
    },
  })
}

export interface BulkDeleteResult {
  deleted: string[]
  /** One entry per record that refused, with the server's reason. */
  failed: { name: string; message: string }[]
}

/**
 * Delete several records.
 *
 * Sequential, not `Promise.all`. Deletes cascade through link validation — removing a Campus
 * fails while a College still points at it — so the order matters, and firing twenty concurrent
 * deletes at a single-threaded bench worker turns a slow operation into a timed-out one.
 *
 * Partial success is the normal outcome and is reported as such: the ones that went are gone,
 * the ones that refused are named with the reason. Rolling back the successes would need a
 * transaction the REST API does not offer, and throwing away the whole batch because one row is
 * still referenced is worse than telling the user which row.
 */
export function useBulkDeleteDocs(doctype: string) {
  const invalidate = useInvalidateDoctype(doctype)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (names: readonly string[]): Promise<BulkDeleteResult> => {
      const deleted: string[] = []
      const failed: { name: string; message: string }[] = []

      for (const name of names) {
        try {
          await db.deleteDoc(doctype, name)
          deleted.push(name)
        } catch (error) {
          failed.push({ name, message: normalizeFrappeError(error).message })
        }
      }

      return { deleted, failed }
    },
    onSuccess: ({ deleted }) => {
      for (const name of deleted) {
        queryClient.removeQueries({ queryKey: doctypeKeys.doc(doctype, name) })
      }
      invalidate()
    },
  })
}
