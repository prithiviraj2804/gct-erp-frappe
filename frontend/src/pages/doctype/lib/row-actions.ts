import { ExternalLinkIcon, PencilIcon, Trash2Icon, type LucideIcon } from 'lucide-react'
import type { NavigateFunction } from 'react-router'

/**
 * One row's actions, decided once and rendered twice.
 *
 * Render-neutral on purpose — a descriptor, not a `BstContextMenuItem` and not a
 * `DropdownMenuItem`. The two surfaces that show these actions belong to different component
 * libraries (the app's shadcn dropdown, and the table engine's own context menu), so a shape
 * either of them could render directly would force the other to translate anyway.
 *
 * It exists because the `⋯` button and right-click used to be two disjoint menus on the same
 * object: the button offered Open / Edit / Delete, and right-clicking eight pixels away offered
 * Copy / Export / Autosize. Both are now this list, and the permissions are read in one place.
 */
export interface RowAction {
  key: 'open' | 'edit' | 'delete'
  label: string
  Icon: LucideIcon
  destructive?: boolean
  run: () => void
}

export function rowActions(opts: {
  /** The record's own page. */
  href: string
  canWrite: boolean
  canDelete: boolean
  navigate: NavigateFunction
  onDelete: () => void
}): RowAction[] {
  const { href, canWrite, canDelete, navigate, onDelete } = opts
  const actions: RowAction[] = [
    { key: 'open', label: 'Open', Icon: ExternalLinkIcon, run: () => void navigate(href) },
  ]
  // Absent, not disabled, when permission is missing. A greyed Delete tells a user their account
  // is broken; its absence tells them nothing they need to know.
  if (canWrite) {
    actions.push({ key: 'edit', label: 'Edit', Icon: PencilIcon, run: () => void navigate(`${href}?edit=1`) })
  }
  if (canDelete) {
    actions.push({ key: 'delete', label: 'Delete', Icon: Trash2Icon, destructive: true, run: onDelete })
  }
  return actions
}
