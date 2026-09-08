import { FolderOpenIcon, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

interface EmptyStateProps {
  title: string
  body: string
  /** Defaults to a folder. Pass a different one where the absence has a specific shape. */
  icon?: LucideIcon
  /** The way out — "New college", "Clear filters", "Try again". */
  action?: React.ReactNode
  /**
   * `neutral` (default) is an absence: nothing here yet, nothing matches this view.
   * `critical` is a failure: the request did not complete.
   *
   * The two used to render identically apart from the glyph, so "Records unavailable" after a
   * 500 and "No College records yet" looked like the same dashed box — in an ERP, the difference
   * between calling IT and creating a record.
   */
  tone?: 'neutral' | 'critical'
}

/**
 * Nothing here, and why.
 *
 * Deliberately takes `body` as required: an empty box with a title is a dead end, and the
 * difference between "no records yet" and "no records match this filter" is the difference
 * between a user creating one and a user clearing a filter. Callers that cannot say which it
 * is are usually rendering the wrong state.
 */
export function EmptyState({
  title,
  body,
  icon: Icon = FolderOpenIcon,
  action,
  tone = 'neutral',
}: EmptyStateProps) {
  const critical = tone === 'critical'
  return (
    <div
      // `role="alert"` on the critical tone ONLY. DoctypeListScreen re-renders this on every
      // status-filter change, so an unconditional live region would fire an assertive
      // announcement per click. An empty result set is not an alert.
      role={critical ? 'alert' : undefined}
      className={cn(
        'rounded-xl px-6 py-16 text-center',
        critical
          ? 'border border-destructive-subtle-foreground/30 bg-destructive-subtle'
          : 'border border-dashed border-border',
      )}
    >
      {/* The subtle-foreground step, not --destructive: index.css measures --destructive at
          4.13:1 on its own tint and instructs tinted surfaces to take the darker step. */}
      <Icon
        className={cn('mx-auto size-7', critical ? 'text-destructive-subtle-foreground' : 'text-muted-foreground')}
        aria-hidden="true"
      />
      {/* Title and body keep their neutral ink in both tones. Recolouring body text to a
          destructive step is recorded in index.css as producing a live AA failure. The tone is
          carried by the glyph, the title's words and the tint — never by colour alone. */}
      <p className="mt-4 text-sm font-medium text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
