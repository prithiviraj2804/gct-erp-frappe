import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router'

import {
  deleteView,
  readViews,
  renameView,
  sameView,
  upsertView,
  viewQuery,
  type SavedView,
} from '@/screens/doctype/lib/saved-views'

/**
 * Saved views for one doctype, bound to the URL.
 *
 * The current URL query is always the live view; a saved view is that query under a name.
 * Applying one writes the query back to the URL, at which point every other list hook reacts to
 * it exactly as if the user had built the state by hand — there is no second source of truth.
 */
export interface SavedViewsState {
  views: SavedView[]
  /** The saved view matching the current URL, if any — for the active checkmark. */
  activeName: string | null
  /** Whether the current URL carries anything worth saving. */
  canSave: boolean
  apply: (view: SavedView) => void
  save: (name: string) => void
  rename: (from: string, to: string) => void
  remove: (name: string) => void
}

export function useSavedViews(doctype: string): SavedViewsState {
  const [params, setParams] = useSearchParams()
  const [views, setViews] = useState<SavedView[]>(() => readViews(doctype))

  const currentQuery = viewQuery(params.toString())
  const activeName = views.find((view) => sameView(view.query, currentQuery))?.name ?? null

  const apply = useCallback(
    (view: SavedView) => {
      // `replace: false` — applying a view is a navigation the user should be able to Back
      // out of, unlike the in-place filter/sort tweaks that replace history.
      setParams(new URLSearchParams(view.query))
    },
    [setParams],
  )

  const save = useCallback(
    (name: string) => setViews(upsertView(doctype, name, viewQuery(params.toString()))),
    [doctype, params],
  )

  const rename = useCallback((from: string, to: string) => setViews(renameView(doctype, from, to)), [doctype])

  const remove = useCallback((name: string) => setViews(deleteView(doctype, name)), [doctype])

  return {
    views,
    activeName,
    canSave: currentQuery.length > 0,
    apply,
    save,
    rename,
    remove,
  }
}
