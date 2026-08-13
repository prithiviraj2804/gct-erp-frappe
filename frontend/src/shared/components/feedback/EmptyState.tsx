import { FolderOpenIcon, type LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  title: string
  body: string
  /** Defaults to a folder. Pass a different one where the absence has a specific shape. */
  icon?: LucideIcon
  /** The way out — "New college", "Clear filters", "Try again". */
  action?: React.ReactNode
}

/**
 * Nothing here, and why.
 *
 * Deliberately takes `body` as required: an empty box with a title is a dead end, and the
 * difference between "no records yet" and "no records match this filter" is the difference
 * between a user creating one and a user clearing a filter. Callers that cannot say which it
 * is are usually rendering the wrong state.
 */
export function EmptyState({ title, body, icon: Icon = FolderOpenIcon, action }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
      <Icon className="mx-auto size-7 text-muted-foreground" aria-hidden="true" />
      <p className="mt-4 text-sm font-medium text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
