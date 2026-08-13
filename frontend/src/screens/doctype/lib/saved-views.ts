/**
 * Saved list views, in localStorage, per doctype.
 *
 * A view is a *name over a URL query* — "Open intakes", "Inactive colleges". Because every piece
 * of list state already lives in the query string (`use-list-state`), a view needs to store
 * nothing but that string; applying one is setting the URL back to it. This is AG Grid's
 * grid-state save/restore, made product-shaped.
 *
 * ## Why localStorage rather than a doctype
 *
 * A view is one person's shortcut, like their column widths (`use-column-widths`) — not shared
 * data. A `List View` doctype is the right home the day views must be shared between users, and
 * this store's shape (name + query) ports to one cleanly. Until then, no endpoint, no migration.
 *
 * ## Why `page` is stripped
 *
 * A view is a question and a presentation; the page number is a position *within* it. Saving
 * "Engineering colleges" on page 1 and then failing to recognise it as the same view on page 2
 * would be surprising, so `page` is dropped from both what is saved and what is compared.
 */

export interface SavedView {
  name: string
  /** The URL search string without the leading `?`, and without a `page` param. */
  query: string
}

const STORAGE_PREFIX = 'erp:saved-views:'
const MAX_VIEWS = 50

/** The query a view stores/compares on: everything except paging position. */
export function viewQuery(search: string): string {
  const params = new URLSearchParams(search)
  params.delete('page')
  params.sort()
  return params.toString()
}

/** Two queries are the same view when their non-page params match, order-independent. */
export function sameView(a: string, b: string): boolean {
  return viewQuery(a) === viewQuery(b)
}

export function readViews(doctype: string): SavedView[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + doctype)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    // Filtered, not trusted — this is user-writable storage. A malformed entry drops rather
    // than poisoning the menu.
    return parsed
      .filter(
        (entry): entry is SavedView =>
          typeof entry === 'object' &&
          entry !== null &&
          typeof (entry as SavedView).name === 'string' &&
          typeof (entry as SavedView).query === 'string' &&
          (entry as SavedView).name.trim().length > 0,
      )
      .slice(0, MAX_VIEWS)
  } catch {
    // Private mode, quota, or corrupt JSON. A list with no saved views is a working list.
    return []
  }
}

function writeViews(doctype: string, views: SavedView[]): void {
  try {
    if (views.length === 0) localStorage.removeItem(STORAGE_PREFIX + doctype)
    else localStorage.setItem(STORAGE_PREFIX + doctype, JSON.stringify(views.slice(0, MAX_VIEWS)))
  } catch {
    // Losing the preference is acceptable; taking the screen down for it is not.
  }
}

/** Upsert by name (case-insensitive), so saving over an existing view updates it in place. */
export function upsertView(doctype: string, name: string, query: string): SavedView[] {
  const trimmed = name.trim()
  if (!trimmed) return readViews(doctype)
  const others = readViews(doctype).filter((view) => view.name.toLowerCase() !== trimmed.toLowerCase())
  const next = [...others, { name: trimmed, query }]
  writeViews(doctype, next)
  return next
}

export function deleteView(doctype: string, name: string): SavedView[] {
  const next = readViews(doctype).filter((view) => view.name !== name)
  writeViews(doctype, next)
  return next
}

/** Rename, keeping the stored query. Collapses onto any existing view of the new name. */
export function renameView(doctype: string, from: string, to: string): SavedView[] {
  const trimmed = to.trim()
  const views = readViews(doctype)
  const target = views.find((view) => view.name === from)
  if (!target || !trimmed) return views

  const others = views.filter(
    (view) => view.name !== from && view.name.toLowerCase() !== trimmed.toLowerCase(),
  )
  const next = [...others, { name: trimmed, query: target.query }]
  writeViews(doctype, next)
  return next
}
