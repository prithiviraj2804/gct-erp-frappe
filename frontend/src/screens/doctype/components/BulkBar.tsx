import { DownloadIcon, Trash2Icon, XIcon } from 'lucide-react'

import { Button } from '@/shared/ui/button'
import { Spinner } from '@/shared/ui/spinner'

interface BulkBarProps {
  count: number
  onExport: () => void
  onDelete?: () => void
  onClear: () => void
  isExporting: boolean
  isDeleting: boolean
}

/**
 * What you can do with the rows you have picked.
 *
 * Delete appears only when the schema says `can_delete`; export always does. Nothing here is
 * shown disabled — a greyed bulk action tells a user their account is broken rather than that
 * the action is unavailable to them.
 *
 * Renders as a flush bar inside the list surface rather than as a floating overlay: this list is
 * a work surface, and a bar that hovers over the last row hides the very thing being selected.
 * The primary-subtle wash (not a border) is what marks it as the selection context.
 */
export function BulkBar({ count, onExport, onDelete, onClear, isExporting, isDeleting }: BulkBarProps) {
  const busy = isExporting || isDeleting

  return (
    <div
      className="flex flex-wrap items-center gap-2 bg-primary-subtle px-3 py-2"
      role="status"
      aria-live="polite"
    >
      <span className="text-sm font-medium text-foreground tabular-nums">
        {count.toLocaleString()} selected
      </span>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-8" onClick={onExport} disabled={busy}>
          {isExporting ? <Spinner className="size-4" /> : <DownloadIcon aria-hidden="true" />}
          Export selected
        </Button>
        {onDelete && (
          <Button variant="destructive" size="sm" className="h-8" onClick={onDelete} disabled={busy}>
            {isDeleting ? <Spinner className="size-4" /> : <Trash2Icon aria-hidden="true" />}
            Delete
          </Button>
        )}
        <Button variant="ghost" size="sm" className="h-8" onClick={onClear} disabled={busy}>
          <XIcon aria-hidden="true" />
          Clear
        </Button>
      </div>
    </div>
  )
}
