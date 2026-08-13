import { ExternalLinkIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { useNavigate } from 'react-router'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

interface RowActionsProps {
  /** The record's own page. */
  href: string
  onDelete: () => void
  canWrite: boolean
  canDelete: boolean
  /** Names the menu for screen readers — "Actions for SJC", not a column of "Actions". */
  subject: string
}

/**
 * Per-row actions.
 *
 * A menu rather than a row of icon buttons: three icons repeated down forty rows is a column of
 * visual noise competing with the data, and only one of the three is ever wanted at a time.
 *
 * Deliberately NOT hover-only. Revealing the trigger on `:hover` is the fashionable version and
 * it puts a destructive action behind a capability that touch and keyboard users do not have —
 * the same rule the module rail follows, where the flyout is an accelerator and never the only
 * route. It renders at low contrast instead, and lifts on hover and focus.
 *
 * Edit and Delete are absent, not disabled, when permission is missing. A greyed Delete tells a
 * user their account is broken; its absence tells them nothing they need to know.
 */
export function RowActions({ href, onDelete, canWrite, canDelete, subject }: RowActionsProps) {
  const navigate = useNavigate()

  if (!canWrite && !canDelete) {
    // Open-only leaves nothing a menu adds: the identity cell already links there.
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${subject}`}
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors duration-150 ease-out hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-[state=open]:bg-muted data-[state=open]:text-foreground motion-reduce:transition-none"
      >
        <MoreHorizontalIcon className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={() => void navigate(href)}>
          <ExternalLinkIcon aria-hidden="true" />
          Open
        </DropdownMenuItem>
        {canWrite && (
          <DropdownMenuItem onSelect={() => void navigate(`${href}?edit=1`)}>
            <PencilIcon aria-hidden="true" />
            Edit
          </DropdownMenuItem>
        )}
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2Icon aria-hidden="true" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
